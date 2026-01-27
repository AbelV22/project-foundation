import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Rate limiting: track requests per device
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 30 * 1000; // 30 seconds
const RATE_LIMIT_MAX_REQUESTS = 10; // Increased limit for robustness, DB handles real logic
// Reduced strictness here because we want the DB to see all points for resurrection logic if needed,
// but still prevent DoS.

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

/**
 * Attempts to "fix" malformed JSON strings.
 */
function normalizeJSON(text: string): string {
  if (!text) return "";
  let fixed = text.trim();
  fixed = fixed.replace(/'/g, '"');
  fixed = fixed.replace(/(\d),(\d)/g, '$1.$2');
  fixed = fixed.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  return fixed;
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
    const rawBody = await req.text();
    let body;

    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.warn(`[check-geofence] JSON parse failed, attempting normalization.`);
      try {
        body = JSON.parse(normalizeJSON(rawBody));
      } catch (e2) {
        return new Response(JSON.stringify({
          success: false,
          error: "INVALID_JSON",
          message: "El formato de los datos es inválido"
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const { lat, lng, action, deviceId, accuracy } = body;

    // Handle ping
    if (action === 'ping') {
      return new Response(JSON.stringify({
        success: true,
        message: "🟢 Edge Function operativa (DB Mode)"
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!deviceId) {
      return new Response(JSON.stringify({ success: false, message: "❌ Device ID requerido" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Rate Limit (Soft)
    const rateLimit = isRateLimited(deviceId);
    if (rateLimit.limited) {
      return new Response(JSON.stringify({
        success: false,
        message: `⏱️ Demasiadas solicitudes.`,
        rateLimited: true,
        retryAfter: rateLimit.retryAfter
      }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Call Supabase RPC
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`[check-geofence] Procesando evento para ${deviceId} en (${lat}, ${lng})`);

    const { data: rpcResult, error: rpcError } = await supabase.rpc('fn_process_geofence_event', {
      p_device_id: deviceId,
      p_lat: lat,
      p_lng: lng,
      p_accuracy: accuracy || 0
    });

    if (rpcError) {
      console.error('[check-geofence] RPC Error:', rpcError);
      throw rpcError;
    }

    console.log(`[check-geofence] RPC Result:`, rpcResult);

    return new Response(JSON.stringify(rpcResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`[check-geofence] Fatal Error:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: "Error crítico en servidor"
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
