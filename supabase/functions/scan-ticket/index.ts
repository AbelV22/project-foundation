import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    const prompt = `Eres un experto en leer tickets de taxímetro Taxitronic.
Esta imagen es un ticket de fin de día de un taxista de Barcelona.

Extrae EXACTAMENTE estos 3 datos:

1. **km_totales**: Kilómetros totales del día. Busca: "KM TOTALES", "KM RECORRIDOS", "TOTAL KM", "KILOMETROS", o la linea que muestre km totales.
2. **ingresos_totales**: Recaudación total en euros. Busca: "TOTAL RECAUDACION", "IMPORTE TOTAL", "TOTAL €", "TOTAL", o el importe total del día.
3. **num_carreras**: Número de servicios/carreras. Busca: "SERVICIOS", "NUM SERVICIOS", "CARRERAS", "TOTAL SERVICIOS", o el conteo de servicios.

REGLAS:
- Los tickets usan coma como decimal: "1.234,56" → devuelve 1234.56
- Los puntos son separadores de miles: "1.234" km → devuelve 1234
- Si un dato NO aparece claramente en el ticket, devuelve null
- NO inventes datos. Solo extrae lo que ves en la imagen
- Devuelve SOLO el JSON, sin explicaciones ni markdown

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
      console.error('Gemini API error:', geminiResponse.status, errText);
      return new Response(
        JSON.stringify({
          error: 'AI vision processing failed',
          details: `Status ${geminiResponse.status}`,
          km_totales: null,
          ingresos_totales: null,
          num_carreras: null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Sanitize values - ensure they are numbers or null
    const sanitize = (val: unknown): number | null => {
      if (val === null || val === undefined) return null;
      const num = Number(val);
      return isNaN(num) || num < 0 ? null : num;
    };

    return new Response(
      JSON.stringify({
        km_totales: sanitize(parsed.km_totales),
        ingresos_totales: sanitize(parsed.ingresos_totales),
        num_carreras: sanitize(parsed.num_carreras),
        raw_response: rawText,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('scan-ticket error:', err);
    return new Response(
      JSON.stringify({
        error: err.message,
        km_totales: null,
        ingresos_totales: null,
        num_carreras: null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
