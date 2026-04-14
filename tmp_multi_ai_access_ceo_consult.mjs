import fs from 'node:fs';

const prompt = `Actúa como un lead product engineer obsesionado con UX móvil-first para México y responde en español.

Producto:
- App: AuditaPatron.
- Dominio público: auditapatron.com.
- Público principal de esta pantalla: personas que van a iniciar sesión desde el celular.
- Usuario crítico: el propietario del sistema, que debe entrar como CEO/admin.
- En dominio público NO debe dependerse de OAuth de Manus porque causa rebotes o errores; la vía estable es correo con código o magic link.

Problema actual:
- La pantalla /acceso venía mostrando desborde lateral y composición confusa en móvil.
- El usuario preguntó explícitamente: "Esto sigue descuadrado, yo como CEO cómo hago sign in?"
- Necesitamos una solución mínima y robusta que deje clarísimo cómo entra el CEO y elimine cualquier sensación de layout roto.

Estado deseado de /acceso:
- Una sola columna, centrada, sin scroll lateral, sin tarjetas compitiendo entre sí.
- CTA principal inequívoco para acceso por correo.
- Copy que explique en menos de 8 segundos cómo entra el CEO.
- El resto de opciones, si existen, deben quedar claramente secundarias o incluso ocultas en el dominio público.
- Si la cuenta no existe, debe crearse al continuar con correo, sin fricción adicional.

Quiero una respuesta ESTRICTA en JSON con esta forma exacta:
{
  "consensus": "texto corto",
  "layout_decision": {
    "structure": "single_column | split_but_stacked | minimal_form_only",
    "why": "texto corto",
    "must_avoid": ["regla 1", "regla 2", "regla 3"]
  },
  "ceo_sign_in_copy": {
    "headline": "texto corto",
    "support": "texto corto",
    "instruction": "texto corto",
    "primary_cta": "texto corto"
  },
  "public_domain_rules": {
    "show_manus": false,
    "show_google": false,
    "email_is_primary": true,
    "why": "texto corto"
  },
  "implementation_minimum": {
    "frontend": ["paso 1", "paso 2", "paso 3"],
    "validation": ["prueba 1", "prueba 2", "prueba 3"],
    "risk_controls": ["control 1", "control 2", "control 3"]
  },
  "user_answer": {
    "exact_answer_for_ceo": "texto corto",
    "one_sentence_reassurance": "texto corto"
  },
  "priority_score": 0
}

Reglas adicionales:
- Devuelve solo JSON válido.
- priority_score debe ser un número de 0 a 100.
- Piensa como si fueras a corregir sólo lo mínimo, sin agregar features nuevas.
- Prioriza claridad instantánea, cero scroll lateral y cero ambigüedad para el CEO.`;

async function callOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
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
  const content = data?.choices?.[0]?.message?.content;
  return JSON.parse(content || '{}');
}

async function callGrok() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error('XAI_API_KEY missing');
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
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
  const content = data?.choices?.[0]?.message?.content;
  return JSON.parse(content || '{}');
}

async function callGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Gemini error: ${response.status} ${JSON.stringify(data)}`);
  const content = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '{}';
  return JSON.parse(content);
}

const results = [];
for (const [provider, fn] of [
  ['chatgpt', callOpenAI],
  ['grok', callGrok],
  ['gemini', callGemini],
]) {
  try {
    const output = await fn();
    results.push({ provider, ok: true, output });
  } catch (error) {
    results.push({ provider, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

const outPath = '/home/ubuntu/complilink_operativo_v1/tmp_multi_ai_access_ceo_results.json';
fs.writeFileSync(outPath, JSON.stringify({ prompt, results }, null, 2));
console.log(outPath);
