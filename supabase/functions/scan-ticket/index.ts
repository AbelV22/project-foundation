import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { image_base64 } = await req.json();

    if (!image_base64) {
      return new Response(
        JSON.stringify({ error: 'image_base64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Strip data URL prefix if present
    const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Analiza esta imagen de un ticket de taxímetro Taxitronic de fin de día.
Extrae los siguientes datos del ticket:

1. **km_totales**: Kilómetros totales recorridos en el día (busca "KM", "KILOMETROS", "TOTAL KM" o similar)
2. **ingresos_totales**: Ingresos/recaudación total del día en euros (busca "TOTAL", "RECAUDACION", "IMPORTE TOTAL" o similar)
3. **num_carreras**: Número total de carreras/servicios realizados (busca "SERVICIOS", "CARRERAS", "NUM. SERVICIOS" o similar)

IMPORTANTE:
- Los valores numéricos pueden usar coma como separador decimal (ej: 1.234,56)
- Si no encuentras un dato, devuelve null para ese campo
- Solo devuelve números, sin unidades ni símbolos de moneda
- Convierte comas decimales a puntos (ej: 1234.56)

Responde SOLO con un JSON válido, sin markdown ni explicaciones:
{"km_totales": number|null, "ingresos_totales": number|null, "num_carreras": number|null}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Data,
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 256,
        }
      })
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('Gemini API error:', errText);
      return new Response(
        JSON.stringify({ error: 'AI vision processing failed', details: errText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from response (strip any markdown code fences)
    const jsonMatch = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch);
    } catch {
      console.error('Failed to parse Gemini response:', rawText);
      return new Response(
        JSON.stringify({
          error: 'Could not parse ticket data',
          raw_response: rawText,
          km_totales: null,
          ingresos_totales: null,
          num_carreras: null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        km_totales: parsed.km_totales ?? null,
        ingresos_totales: parsed.ingresos_totales ?? null,
        num_carreras: parsed.num_carreras ?? null,
        raw_response: rawText,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('scan-ticket error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
