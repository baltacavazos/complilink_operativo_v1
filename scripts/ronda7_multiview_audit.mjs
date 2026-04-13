import fs from 'node:fs/promises';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const prompt = `Actúa como auditor experto de UX/UI mobile-first para AuditaPatron. Debes elegir el siguiente microajuste con mayor impacto y menor riesgo, sin cambios fundamentales.

Contexto resumido:
- App: AuditaPatron.
- Objetivo: acercar la experiencia a la máxima calificación posible en claridad, confianza y facilidad móvil.
- Restricción: NO cambiar arquitectura, NO agregar features nuevas, NO introducir más pasos.
- Checkpoint actual: e85a5f63.
- Mejoras recientes ya aplicadas: Home móvil con una sola CTA visible; bloque superior de /auditar más corto en móvil; párrafo principal del hero de Home aún más breve.
- En rondas previas ChatGPT y Grok coincidieron en priorizar Home y /auditar; Gemini ha estado intermitente por saturación.

Evalúa estos candidatos para la siguiente ronda:
A) /auditar_less_initial_chrome: recortar un poco más el chrome inicial en móvil para que la subida del archivo domine antes.
B) /acceso_more_primary: dar aún más peso visual a la ruta principal y reducir protagonismo del bloque secundario sin perder confianza.
C) /ceo_critical_first: hacer que la primera vista de Consola CEO muestre primero lo crítico sin ocultar demasiado contexto.
D) /home_trust_tighter: compactar un poco el primer bloque de confianza bajo el hero de Home para reducir scroll sin tocar el titular.

Tu tarea:
1. Puntúa cada candidato del 1 al 10 en impacto esperado inmediato.
2. Puntúa cada candidato del 1 al 10 en seguridad/riesgo bajo.
3. Elige el único mejor siguiente cambio.
4. Propón el ajuste concreto en máximo 2 frases.
5. Explica qué NO tocar todavía para evitar sobreoptimización.
6. Responde SOLO en JSON válido con esta forma exacta:
{
  "model_role": "string",
  "impact_scores": {
    "auditar_less_initial_chrome": number,
    "acceso_more_primary": number,
    "ceo_critical_first": number,
    "home_trust_tighter": number
  },
  "safety_scores": {
    "auditar_less_initial_chrome": number,
    "acceso_more_primary": number,
    "ceo_critical_first": number,
    "home_trust_tighter": number
  },
  "winner": {
    "key": "auditar_less_initial_chrome | acceso_more_primary | ceo_critical_first | home_trust_tighter",
    "why": "string",
    "change": "string"
  },
  "do_not_touch_yet": "string",
  "confidence": "high | medium | low"
}`;

async function callOpenAI() {
  if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Eres un auditor severo de UX/UI que prioriza claridad, reducción de scroll, confianza y mínima complejidad.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${text}`);
  const json = JSON.parse(text);
  return JSON.parse(json.choices[0].message.content);
}

async function callXAI() {
  if (!XAI_API_KEY) throw new Error('Missing XAI_API_KEY');
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'grok-4',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Eres un auditor severo de UX/UI que prioriza claridad, reducción de scroll, confianza y mínima complejidad.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`xAI ${response.status}: ${text}`);
  const json = JSON.parse(text);
  return JSON.parse(json.choices[0].message.content);
}

async function callGemini() {
  if (!GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      systemInstruction: {
        parts: [{ text: 'Eres un auditor severo de UX/UI que prioriza claridad, reducción de scroll, confianza y mínima complejidad.' }],
      },
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${text}`);
  const json = JSON.parse(text);
  const content = json.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '{}';
  return JSON.parse(content);
}

async function main() {
  const results = {};
  for (const [name, fn] of [
    ['chatgpt', callOpenAI],
    ['grok', callXAI],
    ['gemini', callGemini],
  ]) {
    try {
      results[name] = await fn();
    } catch (error) {
      results[name] = { error: error instanceof Error ? error.message : String(error) };
    }
  }

  await fs.mkdir('/home/ubuntu/complilink_operativo_v1/.manus-artifacts', { recursive: true });
  await fs.writeFile(
    '/home/ubuntu/complilink_operativo_v1/.manus-artifacts/ronda7_multiview_audit.json',
    JSON.stringify(results, null, 2) + '\n',
    'utf8',
  );

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
