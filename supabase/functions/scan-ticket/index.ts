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

    const prompt = `Eres un experto en leer tickets de taximetro Taxitronic de Barcelona.

IMPORTANTE: Los tickets tienen DOS secciones:
1. SECCION SUPERIOR (sin prefijo): Son los TOTALES ACUMULADOS historicos. NO leas estos datos.
2. SECCION INFERIOR (con prefijo "P"): Son los datos PARCIALES DEL DIA. LEE SOLO ESTOS.

Las lineas del dia empiezan con "P" (de Parcial):
- "P No de servs" o "P Num. Servicios" = numero de carreras del dia
- "P Total" = ingresos totales del dia en euros
- "P Dist. Total" = kilometros totales del dia

Extrae SOLO los datos de la seccion "P" (parcial/diaria):

1. **num_carreras**: El valor de "P No de servs" (numero entero)
2. **ingresos_totales**: El valor de "P Total" (en euros)
3. **km_totales**: El valor de "P Dist. Total" (en km)

REGLAS:
- La coma es separador decimal: "316,25" = 316.25
- El punto es separador de miles: "1.234,56" = 1234.56
- Si un campo no esta visible, devuelve null
- NO uses los valores de la seccion superior (sin "P"), son acumulados historicos
- Devuelve SOLO JSON, sin markdown ni explicaciones

{"km_totales": number|null, "ingresos_totales": number|null, "num_carreras": number|null}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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
          maxOutputTokens: 1024,
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
    // gemini-2.5-flash may return multiple parts (thinking + response)
    // Get the last text part which contains the actual answer
    const parts = geminiData?.candidates?.[0]?.content?.parts || [];
    const rawText = parts.filter((p: any) => p.text).map((p: any) => p.text).pop() || '';

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
