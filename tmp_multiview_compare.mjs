import fs from 'node:fs/promises';

const prompt = `Eres un auditor técnico-legal de producto digital. Evalúa esta solicitud de implementación para una app mexicana llamada AuditaPatron. Necesito una respuesta compacta en JSON válido con esta forma exacta:
{
  "model_view": "string",
  "must_do": ["string"],
  "risk_flags": ["string"],
  "implementation_order": ["string"],
  "ui_notes": ["string"],
  "backend_notes": ["string"],
  "testing_notes": ["string"],
  "copy_adjustments": ["string"]
}

Contexto del cambio:
1) Corregir el header: el lockup/logo oscuro del header está recortado. Hay que arreglar el componente de marca y/o sus clases para que no se corte en desktop y móvil.
2) Implementar paquete legal 2.0 con textos en español jurídico accesible para México:
- Aviso de Privacidad Integral v2.0
- Términos y Condiciones v2.0
- Gate de aceptación discreto cuando el usuario entra por primera vez o cuando cambia la versión legal
- Registro automático de consentimientos: privacy_policy, terms_of_service, data_processing, ai_training, cross_platform_sharing
- Guardar trazabilidad de versión, timestamp, IP y user-agent
- Revocación con periodo de gracia de 5 días hábiles
- Footer discreto con links legales
- Gestión de privacidad y derechos ARCO dentro de Configuración > Privacidad
3) Actualizar el contexto que recibe Helios para que mencione explícitamente: cifrado AES-256-GCM, LFPDPPP v2.0, derechos ARCO, consentimiento versionado, revocación con gracia de 5 días hábiles, ecosistema Helios/CompliLink, MFA/TOTP, rate limiting, invalidación JWT y audit trail.

Dame recomendaciones concretas, priorizadas y prudentes. No redactes los documentos completos; enfócate en implementación, riesgos y pruebas.`;

async function callOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY missing');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Responde exclusivamente con JSON válido.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${JSON.stringify(json)}`);
  return JSON.parse(json.choices[0].message.content);
}

async function callGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY missing');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${JSON.stringify(json)}`);
  const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '{}';
  return JSON.parse(text);
}

async function callGrok() {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error('XAI_API_KEY missing');
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'grok-4-fast-reasoning',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Responde exclusivamente con JSON válido.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Grok ${res.status}: ${JSON.stringify(json)}`);
  return JSON.parse(json.choices[0].message.content);
}

const result = { generatedAt: new Date().toISOString(), prompt, views: {}, errors: {} };
for (const [name, fn] of Object.entries({ openai: callOpenAI, gemini: callGemini, grok: callGrok })) {
  try {
    result.views[name] = await fn();
  } catch (error) {
    result.errors[name] = error instanceof Error ? error.message : String(error);
  }
}

await fs.writeFile('/home/ubuntu/complilink_operativo_v1/tmp_multiview_compare.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ok: true, output: '/home/ubuntu/complilink_operativo_v1/tmp_multiview_compare.json' }));
