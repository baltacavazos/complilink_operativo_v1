import fs from 'node:fs';
import path from 'node:path';

const projectRoot = '/home/ubuntu/complilink_operativo_v1';
const homePath = path.join(projectRoot, 'client/src/pages/Home.tsx');
const outputPath = path.join(projectRoot, 'tmp_multiview_ui_iter3.json');

const homeSource = fs.readFileSync(homePath, 'utf8');

const prompt = `
Contexto del proyecto:
- Producto: AuditaPatron
- Objetivo: ayudar a personas trabajadoras a entender su situación laboral con lenguaje simple y tranquilizador.
- Restricción: no cambiar lógica, backend ni flujos. Solo UI visible y copy.
- Estado actual: la landing ya usa naming cálido, CTAs más humanos y fondos ligeramente diferenciados, pero el usuario pidió tres mejoras adicionales en esta iteración:
  1) añadir divisores o acentos visuales suaves entre bloques clave;
  2) subir un poco más la intensidad de fondos en móvil para que la segmentación se perciba mejor;
  3) dejar una sola versión final del CTA principal y reutilizarla de forma consistente.
- Tono deseado: cálido, claro, confiable, comprensible para cualquier persona usuaria.
- Evitar: apariencia de documento largo, exceso de blanco, lenguaje técnico o intimidante.

Necesito una recomendación concreta y ejecutable para frontend en React/Tailwind.

Quiero respuesta JSON con esta forma exacta:
{
  "cta_final": "string",
  "cta_rationale": "string breve",
  "section_dividers": ["3 a 6 propuestas concretas y sutiles"],
  "mobile_background_strategy": ["3 a 6 propuestas concretas"],
  "do_not_do": ["3 a 6 errores a evitar"],
  "implementation_notes": ["3 a 6 notas accionables para editar Home.tsx"]
}

Código actual relevante de Home.tsx:
${homeSource}
`;

async function callOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { error: 'OPENAI_API_KEY no disponible' };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Eres un director de UX/UI para productos de confianza masiva. Responde solo JSON válido.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { error: data };
  }
  return JSON.parse(data.choices[0].message.content);
}

async function callGrok() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return { error: 'XAI_API_KEY no disponible' };
  }

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-4-0709',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Eres un director de UX/UI para productos de confianza masiva. Responde solo JSON válido.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { error: data };
  }
  return JSON.parse(data.choices[0].message.content);
}

async function callGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { error: 'GEMINI_API_KEY no disponible' };
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.4,
        responseMimeType: 'application/json',
      },
      contents: [{
        role: 'user',
        parts: [{ text: prompt }],
      }],
      systemInstruction: {
        parts: [{ text: 'Eres un director de UX/UI para productos de confianza masiva. Responde solo JSON válido.' }],
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { error: data };
  }
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '{}';
  return JSON.parse(text);
}

const settle = async (label, fn) => {
  try {
    return await fn();
  } catch (error) {
    return { error: String(error?.message || error) };
  }
};

const result = {
  generatedAt: new Date().toISOString(),
  openai: await settle('openai', callOpenAI),
  grok: await settle('grok', callGrok),
  gemini: await settle('gemini', callGemini),
};

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log(outputPath);
