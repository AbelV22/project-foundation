import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// --- CONFIGURACIÓN DE ZONAS ---
// Todas configuradas como STANDARD para la versión Web (Click manual)
const ZONAS: Record<string, { tipo: string; poligonos: number[][][] }> = {
  "T1": {
    tipo: "STANDARD",
    poligonos: [
      [[41.293414, 2.052955], [41.291480, 2.054785], [41.291050, 2.057731], [41.292576, 2.056044], [41.293693, 2.054042], [41.293414, 2.052955]], // Lejana
      [[41.287015, 2.073812], [41.287235, 2.074420], [41.289890, 2.072795], [41.289614, 2.072155], [41.287015, 2.073812]] // Cercana
    ]
  },
  "T2": {
    tipo: "STANDARD",
    poligonos: [
      [[41.304277, 2.067179], [41.302540, 2.068124], [41.303069, 2.069830], [41.304828, 2.068744], [41.304277, 2.067179]], // Técnica
      [[41.301671, 2.071621], [41.301226, 2.071903], [41.302190, 2.074682], [41.302677, 2.074442], [41.301671, 2.071621]] // Espera
    ]
  },
  "SANTS": {
    tipo: "STANDARD",
    poligonos: [
      [[41.3805, 2.1415], [41.3805, 2.1390], [41.3785, 2.1390], [41.3785, 2.1415], [41.3805, 2.1415]]
    ]
  },
  "PUENTE_AEREO": {
    tipo: "STANDARD", // En web, si pulsan botón es que están esperando
    poligonos: [
      [[41.289950, 2.073030], [41.290620, 2.072616], [41.289648, 2.069489], [41.288922, 2.069853], [41.289950, 2.073030]]
    ]
  },
  "T2C_EASY": {
    tipo: "STANDARD", // En web, si pulsan botón es que están esperando
    poligonos: [
      [[41.305257, 2.080754], [41.304074, 2.081675], [41.304576, 2.083332], [41.305782, 2.082448], [41.305118, 2.081675], [41.305257, 2.080754]]
    ]
  }
};

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { lat, lng, action } = await req.json();
    
    console.log(`[check-geofence] Received: lat=${lat}, lng=${lng}, action=${action}`);
    
    let zonaDetectada: string | null = null;

    // Buscar zona
    for (const [nombre, datos] of Object.entries(ZONAS)) {
      for (const poligono of datos.poligonos) {
        if (puntoEnPoligono(lat, lng, poligono)) {
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

    // REGISTRAR ENTRADA (Insertar en DB)
    if (action === 'register') {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
      );

      // Guardamos la entrada
      const { error } = await supabase.from('registros_reten').insert({
        zona: zonaDetectada,
        tipo_zona: "STANDARD",
        evento: 'ENTRADA',
        lat: lat,
        lng: lng
      });

      if (error) {
        console.error(`[check-geofence] DB Error:`, error);
        throw error;
      }
      
      console.log(`[check-geofence] Entrada registrada en ${zonaDetectada}`);
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
