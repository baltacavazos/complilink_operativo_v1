const fs = await import('node:fs/promises');

const prompt = `
Contexto: Estoy refinando la landing y la vista principal de AuditaPatron, una herramienta laboral para personas no expertas.

Necesito recomendaciones concretas y prudentes, sin rediseñar la arquitectura ni cambiar lógica:
1) Un microcopy de confianza para la sección/entrada del asistente, en una sola línea, lenguaje cálido, simple y tranquilizador.
2) Dos variantes de CTA hacia /auditar, cercanas y claras.
3) Una recomendación breve de ajuste visual para que las secciones se distingan mejor entre sí. El sitio se percibe demasiado blanco y continuo; quiero subir un poco el tono de los backgrounds, no mucho. Debe seguir viéndose limpio, confiable y moderno.
4) Una mini guía de color con 4-6 fondos suaves por sección, usando variaciones sutiles entre blanco, teal muy pálido, slate muy claro y tonos apenas perceptibles.
5) Señala qué errores evitar para que no parezca documento largo ni landing fragmentada en exceso.

Restricciones:
- No mencionar Helios ni nombres internos.
- Debe pasar la prueba de una persona de 10 años o una persona mayor con poca familiaridad digital.
- Responde en español de México.
- Entrega JSON con esta forma exacta:
{
  "microcopy": ["...", "...", "..."],
  "ctas": ["...", "..."],
  "visual_strategy": "...",
  "section_backgrounds": [
    {"section":"hero","color":"#...","why":"..."},
    {"section":"trust_band","color":"#...","why":"..."},
    {"section":"assistant","color":"#...","why":"..."},
    {"section":"faq","color":"#...","why":"..."},
    {"section":"legal_footer","color":"#...","why":"..."}
  ],
  "avoid": ["...", "...", "..."],
  "confidence": "high|medium|low"
}
`;

async function callOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { error: 'OPENAI_API_KEY missing' };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.5,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Eres un experto en UX writing y diseño visual para productos confiables y cálidos.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return json.choices?.[0]?.message?.content ? JSON.parse(json.choices[0].message.content) : json;
  } catch {
    return { error: 'openai_parse_error', raw: text };
  }
}

async function callGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { error: 'GEMINI_API_KEY missing' };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
        responseMimeType: 'application/json',
      },
    }),
  });
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
    return content ? JSON.parse(content) : json;
  } catch {
    return { error: 'gemini_parse_error', raw: text };
  }
}

async function callGrok() {
  const key = process.env.XAI_API_KEY;
  if (!key) return { error: 'XAI_API_KEY missing' };
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'grok-4-0709',
      temperature: 0.5,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Eres un experto en UX writing y diseño visual para productos confiables y cálidos.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return json.choices?.[0]?.message?.content ? JSON.parse(json.choices[0].message.content) : json;
  } catch {
    return { error: 'grok_parse_error', raw: text };
  }
}

const [openai, gemini, grok] = await Promise.all([callOpenAI(), callGemini(), callGrok()]);
const result = {
  createdAt: new Date().toISOString(),
  prompt,
  models: { openai, gemini, grok },
};

await fs.writeFile('/home/ubuntu/complilink_operativo_v1/tmp_multiview_ui_refine.json', JSON.stringify(result, null, 2));
console.log('saved /home/ubuntu/complilink_operativo_v1/tmp_multiview_ui_refine.json');
