import fs from 'node:fs/promises';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const prompt = `Actúa como cliente experto en UX/UI mobile-first para un SaaS de auditoría empresarial llamado AuditaPatron.

Contexto breve:
- Objetivo: consenso cercano a 10/10 en claridad, confianza y reducción de scroll.
- Restricción V1: NO agregar funciones nuevas ni aumentar complejidad cognitiva.
- Superficies auditadas: Home, /auditar, /acceso y Consola CEO.
- Último checkpoint estable antes de esta ronda: 30361eaa.
- Mejoras ya hechas: Home con CTA más directa; Consola CEO con bitácora expandible; /auditar más compacto en móvil.
- Ajuste ya empezado en esta ronda: en /auditar el hero móvil ahora dice “Sube tu documento y recibe una lectura útil en minutos”, elimina chips redundantes y cambia el CTA a “Subir archivo ahora”.

Candidatos actuales para la siguiente micro-ronda:
A) Home móvil con UNA sola CTA visible en el hero.
B) Consola CEO con vista inicial todavía más estricta, mostrando solo alertas críticas y dejando lo demás debajo o colapsado.
C) /auditar con bloque superior aún más corto en móvil para que la subida del archivo sea la decisión dominante.
D) /acceso con ruta principal todavía más dominante y menos texto secundario en móvil.

Tu tarea:
1. Puntúa cada candidato del 1 al 10 según impacto esperado inmediato en UX sin añadir complejidad.
2. Elige los 2 cambios con mejor relación impacto/simplicidad.
3. Para cada uno, propone un ajuste mínimo y concreto de copy/layout en máximo 2 frases.
4. Señala qué NO tocarías todavía para evitar sobreoptimizar.
5. Responde SOLO en JSON válido con esta forma exacta:
{
  "model_role": "string",
  "scores": {
    "home_single_cta": number,
    "ceo_critical_only": number,
    "auditar_ultra_compact_mobile": number,
    "access_primary_path": number
  },
  "top_two": [
    {
      "key": "home_single_cta | ceo_critical_only | auditar_ultra_compact_mobile | access_primary_path",
      "why": "string",
      "change": "string"
    },
    {
      "key": "home_single_cta | ceo_critical_only | auditar_ultra_compact_mobile | access_primary_path",
      "why": "string",
      "change": "string"
    }
  ],
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
        { role: 'system', content: 'Eres un auditor severo de UX/UI que prioriza claridad, reducción de scroll y mínima complejidad.' },
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
        { role: 'system', content: 'Eres un auditor severo de UX/UI que prioriza claridad, reducción de scroll y mínima complejidad.' },
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
        parts: [{ text: 'Eres un auditor severo de UX/UI que prioriza claridad, reducción de scroll y mínima complejidad.' }],
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
    '/home/ubuntu/complilink_operativo_v1/.manus-artifacts/ronda5_multiview_audit.json',
    JSON.stringify(results, null, 2) + '\n',
    'utf8',
  );

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
