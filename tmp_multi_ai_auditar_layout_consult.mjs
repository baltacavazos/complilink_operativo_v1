import fs from 'node:fs';

const prompt = `Actúa como un lead product engineer obsesionado con claridad visual y UX mobile-first para México. Responde en español.

Producto:
- App: AuditaPatron.
- Pantalla foco: /auditar, vista autenticada.
- Problema reportado por el usuario: "Demasiada información, no encajan bien algunos recuadros".

Contexto visible actual:
- En la zona media de /auditar aparecen varios bloques paralelos con tarjetas pequeñas y estrechas.
- Hay un bloque de seguimiento automático con métricas y un embudo operativo mínimo que hoy puede renderizar 4 tarjetas en paralelo.
- También hay una zona previa con varias tarjetas pequeñas de resumen, un bloque de siguiente documento, historial de revalidaciones y una tarjeta comercial opcional.
- El resultado percibido es demasiada densidad y algunos recuadros se sienten mal encajados o demasiado estrechos.

Restricciones:
- No agregar funcionalidades nuevas.
- Hacer el cambio mínimo pero contundente.
- Priorizar legibilidad, equilibrio y claridad de la siguiente acción.
- Evitar tarjetas muy altas y angostas.
- Debe seguir funcionando en móvil y desktop.

Quiero una respuesta ESTRICTA en JSON con esta forma exacta:
{
  "consensus": "texto corto",
  "main_problem": "texto corto",
  "layout_fix": {
    "top_priority": "texto corto",
    "grid_decision": "2_cols_max | 1_col_priority_stack | mixed",
    "why": "texto corto",
    "must_remove_or_reduce": ["item 1", "item 2", "item 3"]
  },
  "section_actions": {
    "social_security_zone": ["accion 1", "accion 2", "accion 3"],
    "monitoring_zone": ["accion 1", "accion 2", "accion 3"],
    "optional_paid_zone": ["accion 1", "accion 2"]
  },
  "implementation_minimum": {
    "css_or_layout": ["paso 1", "paso 2", "paso 3"],
    "copy": ["ajuste 1", "ajuste 2"],
    "validation": ["prueba 1", "prueba 2", "prueba 3"]
  },
  "priority_score": 0
}

Reglas adicionales:
- Devuelve solo JSON válido.
- priority_score debe ser un número de 0 a 100.
- Piensa como alguien que quiere arreglar el layout hoy mismo con el menor riesgo posible.
- Favorece menos columnas, menos cajas simultáneas y más aire visual.`;

async function callOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Eres un product engineer senior experto en UX móvil-first. Devuelves JSON estricto.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`OpenAI error: ${response.status} ${JSON.stringify(data)}`);
  return JSON.parse(data?.choices?.[0]?.message?.content || '{}');
}

async function callGrok() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error('XAI_API_KEY missing');
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'grok-4-0709',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Eres un product engineer senior experto en UX móvil-first. Devuelves JSON estricto.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Grok error: ${response.status} ${JSON.stringify(data)}`);
  return JSON.parse(data?.choices?.[0]?.message?.content || '{}');
}

async function callGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Gemini error: ${response.status} ${JSON.stringify(data)}`);
  const content = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '{}';
  return JSON.parse(content);
}

const results = [];
for (const [provider, fn] of [['chatgpt', callOpenAI], ['grok', callGrok], ['gemini', callGemini]]) {
  try {
    results.push({ provider, ok: true, output: await fn() });
  } catch (error) {
    results.push({ provider, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

const outPath = '/home/ubuntu/complilink_operativo_v1/tmp_multi_ai_auditar_layout_results.json';
fs.writeFileSync(outPath, JSON.stringify({ prompt, results }, null, 2));
console.log(outPath);
