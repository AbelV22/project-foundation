import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Rate limiting: track requests per device
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 30 * 1000; // 30 seconds
const RATE_LIMIT_MAX_REQUESTS = 2; // Max 2 requests per 30 seconds per device

function isRateLimited(deviceId: string): { limited: boolean; retryAfter?: number } {
  const now = Date.now();
  const deviceLimit = rateLimitMap.get(deviceId);

  if (!deviceLimit || now > deviceLimit.resetTime) {
    rateLimitMap.set(deviceId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { limited: false };
  }

  if (deviceLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { limited: true, retryAfter: Math.ceil((deviceLimit.resetTime - now) / 1000) };
  }

  deviceLimit.count++;
  return { limited: false };
}

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

const TOLERANCE = 0.001; // ~100m tolerance

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
  if (puntoEnPoligono(lat, lng, poligono)) return true;
  for (let i = 0; i < poligono.length - 1; i++) {
    const [lat1, lng1] = poligono[i];
    const [lat2, lng2] = poligono[i + 1];
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
  if (param < 0) { xx = x1; yy = y1; }
  else if (param > 1) { xx = x2; yy = y2; }
  else { xx = x1 + param * C; yy = y1 + param * D; }
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
    const body = await req.json();
    const { lat, lng, action, deviceId, previousZona, accuracy, deviceName } = body;
    console.log(`[check-geofence] Received: lat=${lat}, lng=${lng}, action=${action}, deviceId=${deviceId}, prevZona=${previousZona}`);

    // Handle ping action - just check if function is alive
    if (action === 'ping') {
      console.log('[check-geofence] Ping received, responding OK');
      return new Response(JSON.stringify({
        success: true,
        message: "🟢 Edge Function operativa",
        timestamp: new Date().toISOString()
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // For register action, validate device ID
    if (!deviceId || typeof deviceId !== 'string' || deviceId.length < 2) {
      return new Response(JSON.stringify({
        success: false,
        message: "❌ Device ID inválido."
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Rate limiting check
    const rateLimitResult = isRateLimited(deviceId);
    if (rateLimitResult.limited) {
      console.log(`[check-geofence] Rate limited: ${deviceId}`);
      return new Response(JSON.stringify({
        success: false,
        message: `⏱️ Demasiadas solicitudes. Intenta en ${rateLimitResult.retryAfter}s`,
        rateLimited: true,
        retryAfter: rateLimitResult.retryAfter
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateLimitResult.retryAfter) }
      });
    }

    // Validate coordinates (Europe range for compatibility)
    if (typeof lat !== 'number' || typeof lng !== 'number' ||
      lat < 35.0 || lat > 72.0 || lng < -25.0 || lng > 45.0) {
      return new Response(JSON.stringify({
        success: false,
        message: "❌ Coordenadas fuera de Europa."
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Detect current zone
    let zonaDetectada: string | null = null;
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

    if (action === 'register') {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Determine event type
      let eventType = 'POSITION_UPDATE';
      const prevZonaReal = previousZona && previousZona !== 'DEBUG' ? previousZona : null;
      const currentZonaReal = zonaDetectada && zonaDetectada !== 'DEBUG' ? zonaDetectada : null;

      if (prevZonaReal !== currentZonaReal) {
        if (currentZonaReal && !prevZonaReal) {
          // Entering a zone from outside
          eventType = 'ENTER_ZONE';
        } else if (!currentZonaReal && prevZonaReal) {
          // Exiting a zone to outside
          eventType = 'EXIT_ZONE';
        } else if (currentZonaReal && prevZonaReal && currentZonaReal !== prevZonaReal) {
          // Changing zones directly (exit old, enter new)
          eventType = 'ZONE_CHANGE';
        }
      }

      console.log(`[check-geofence] Event type: ${eventType}`);

      // === WAITING TIME TRACKING LOGIC ===

      // If EXITING a zone or CHANGING zones, mark the exit time on the open entry
      if ((eventType === 'EXIT_ZONE' || eventType === 'ZONE_CHANGE') && prevZonaReal) {
        const { data: openEntry, error: findError } = await supabase
          .from('registros_reten')
          .select('id, created_at')
          .eq('device_id', deviceId)
          .eq('zona', prevZonaReal)
          .is('exited_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (findError) {
          console.error(`[check-geofence] Error finding open entry:`, findError);
        } else if (openEntry) {
          const { error: updateError } = await supabase
            .from('registros_reten')
            .update({ exited_at: new Date().toISOString() })
            .eq('id', openEntry.id);

          if (updateError) {
            console.error(`[check-geofence] Error updating exit time:`, updateError);
          } else {
            const entryTime = new Date(openEntry.created_at).getTime();
            const exitTime = Date.now();
            const waitMinutes = Math.round((exitTime - entryTime) / 60000);
            console.log(`[check-geofence] ✅ Marked exit from ${prevZonaReal}. Wait time: ${waitMinutes} min`);
          }
        } else {
          console.log(`[check-geofence] No open entry found for ${prevZonaReal}`);
        }
      }

      // If ENTERING a zone, create a new entry record
      if ((eventType === 'ENTER_ZONE' || eventType === 'ZONE_CHANGE') && currentZonaReal) {
        // Check rate limit (1 entry per zone per 5 minutes)
        const { data: recentEntry } = await supabase
          .from('registros_reten')
          .select('created_at')
          .eq('device_id', deviceId)
          .eq('zona', currentZonaReal)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let canCreateEntry = true;
        if (recentEntry) {
          const lastTime = new Date(recentEntry.created_at).getTime();
          const diffMinutes = (Date.now() - lastTime) / (1000 * 60);
          canCreateEntry = diffMinutes >= 5;
        }

        if (canCreateEntry) {
          const { error: insertError } = await supabase.from('registros_reten').insert({
            zona: currentZonaReal,
            tipo_zona: "STANDARD",
            evento: 'ENTRADA',
            lat: lat,
            lng: lng,
            device_id: deviceId
            // exited_at is NULL by default = waiting
          });

          if (insertError) {
            console.error(`[check-geofence] Error creating entry:`, insertError);
          } else {
            console.log(`[check-geofence] ✅ Created entry in ${currentZonaReal}`);
          }
        } else {
          console.log(`[check-geofence] Rate limited: recent entry exists for ${currentZonaReal}`);
        }
      }

      // Log the event for debugging
      const { error: logError } = await supabase.from('geofence_logs').insert({
        event_type: eventType,
        zona: zonaDetectada,
        previous_zona: previousZona || null,
        lat: lat,
        lng: lng,
        accuracy: accuracy || null,
        device_id: deviceId,
        device_name: deviceName || null
      });

      if (logError) {
        console.error(`[check-geofence] Log Error (non-fatal):`, logError);
      } else {
        console.log(`[check-geofence] Event logged: ${eventType}`);
      }
    }

    // Return response
    if (zonaDetectada) {
      return new Response(JSON.stringify({
        success: true,
        zona: zonaDetectada,
        message: `✅ ${zonaDetectada}`
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } else {
      return new Response(JSON.stringify({
        success: true,
        zona: null,
        message: `📍 Fuera de zonas`
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error(`[check-geofence] Fatal Error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Ensure we ALWAYS return JSON, never plain text or empty 200
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      message: `Critial Error: ${errorMessage}`
    }), {
      status: 200, // Return 200 so request doesn't throw, but with success: false
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
