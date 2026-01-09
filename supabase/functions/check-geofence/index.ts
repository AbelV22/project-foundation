import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// --- CONFIGURACIÓN DE ZONAS ---
const ZONAS: Record<string, { tipo: string; poligonos: number[][][] }> = {
  "T1": {
    tipo: "STANDARD",
    poligonos: [
      [[41.293414, 2.052955], [41.291480, 2.054785], [41.291050, 2.057731], [41.292576, 2.056044], [41.293693, 2.054042], [41.293414, 2.052955]],
      [[41.287015, 2.073812], [41.287235, 2.074420], [41.289890, 2.072795], [41.289614, 2.072155], [41.287015, 2.073812]]
    ]
  },
  "T2": {
    tipo: "STANDARD",
    poligonos: [
      [[41.304277, 2.067179], [41.302540, 2.068124], [41.303069, 2.069830], [41.304828, 2.068744], [41.304277, 2.067179]],
      [[41.301671, 2.071621], [41.301226, 2.071903], [41.302190, 2.074682], [41.302677, 2.074442], [41.301671, 2.071621]]
    ]
  },
  "SANTS": {
    tipo: "STANDARD",
    poligonos: [
      [[41.3805, 2.1415], [41.3805, 2.1390], [41.3785, 2.1390], [41.3785, 2.1415], [41.3805, 2.1415]]
    ]
  },
  "PUENTE_AEREO": {
    tipo: "STANDARD",
    poligonos: [
      [[41.289950, 2.073030], [41.290620, 2.072616], [41.289648, 2.069489], [41.288922, 2.069853], [41.289950, 2.073030]]
    ]
  },
  "T2C_EASY": {
    tipo: "STANDARD",
    poligonos: [
      [[41.305257, 2.080754], [41.304074, 2.081675], [41.304576, 2.083332], [41.305782, 2.082448], [41.305118, 2.081675], [41.305257, 2.080754]]
    ]
  }
};

// Tolerancia de 100m en grados (~0.0009 para latitud)
const TOLERANCE = 0.001;

function puntoEnPoligono(lat: number, lng: number, poligono: number[][]) {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const xi = poligono[i][0], yi = poligono[i][1];
    const xj = poligono[j][0], yj = poligono[j][1];
    const intersect = ((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) dentro = !dentro;
  }
  return dentro;
}

function puntoCercaDePoligono(lat: number, lng: number, poligono: number[][]): boolean {
  // Check if point is inside polygon
  if (puntoEnPoligono(lat, lng, poligono)) return true;
  
  // Check if point is within tolerance distance of any edge
  for (let i = 0; i < poligono.length - 1; i++) {
    const [lat1, lng1] = poligono[i];
    const [lat2, lng2] = poligono[i + 1];
    
    // Simple distance check to line segment
    const dist = distanciaPuntoALinea(lat, lng, lat1, lng1, lat2, lng2);
    if (dist <= TOLERANCE) return true;
  }
  return false;
}

function distanciaPuntoALinea(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) param = dot / lenSq;
  
  let xx, yy;
  
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }
  
  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { lat, lng, action, deviceId } = await req.json();
    
    console.log(`[check-geofence] Received: lat=${lat}, lng=${lng}, action=${action}, deviceId=${deviceId}`);
    
    // Validate deviceId
    if (!deviceId || typeof deviceId !== 'string' || deviceId.length < 36) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "❌ Device ID inválido." 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // Validate coordinates
    if (typeof lat !== 'number' || typeof lng !== 'number' || 
        lat < 41.0 || lat > 42.0 || lng < 1.5 || lng > 3.0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "❌ Coordenadas fuera del área de Barcelona." 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let zonaDetectada: string | null = null;

    // Buscar zona con tolerancia de 100m
    for (const [nombre, datos] of Object.entries(ZONAS)) {
      for (const poligono of datos.poligonos) {
        if (puntoCercaDePoligono(lat, lng, poligono)) {
          zonaDetectada = nombre;
          break;
        }
      }
      if (zonaDetectada) break;
    }

    console.log(`[check-geofence] Zona detectada: ${zonaDetectada || 'ninguna'}`);

    if (!zonaDetectada) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "❌ No estás en una zona autorizada. Acércate al punto de espera." 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // REGISTRAR ENTRADA
    if (action === 'register') {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Rate limiting: check last entry from this device
      const { data: lastEntry } = await supabase
        .from('registros_reten')
        .select('created_at')
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastEntry) {
        const lastTime = new Date(lastEntry.created_at).getTime();
        const now = Date.now();
        const diffMinutes = (now - lastTime) / (1000 * 60);
        
        if (diffMinutes < 5) {
          return new Response(JSON.stringify({ 
            success: false, 
            message: `⏳ Espera ${Math.ceil(5 - diffMinutes)} minutos para registrar otra entrada.` 
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      const { error } = await supabase.from('registros_reten').insert({
        zona: zonaDetectada,
        tipo_zona: "STANDARD",
        evento: 'ENTRADA',
        lat: lat,
        lng: lng,
        device_id: deviceId
      });

      if (error) {
        console.error(`[check-geofence] DB Error:`, error);
        throw error;
      }
      
      console.log(`[check-geofence] Entrada registrada en ${zonaDetectada} para device ${deviceId}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      zona: zonaDetectada, 
      message: `✅ Entrada confirmada en ${zonaDetectada}` 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error(`[check-geofence] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
