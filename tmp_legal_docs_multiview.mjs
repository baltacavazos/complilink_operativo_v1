import fs from 'node:fs/promises';

const prompt = `Actúa como counsel de producto digital para México y redactor legal claro. Devuelve exclusivamente JSON válido con esta forma exacta:
{
  "model_view": "string",
  "privacy_notice_markdown": "string",
  "terms_markdown": "string",
  "gate_copy": {
    "title": "string",
    "body": "string",
    "subtext": "string",
    "checkbox": "string",
    "button": "string"
  },
  "privacy_center": {
    "intro": "string",
    "rights_summary": ["string"],
    "revocation_notice": "string",
    "contact_email": "string"
  },
  "helios_context_bullets": ["string"]
}

Redacta en español profesional de México, con tono autoritativo pero accesible.

Contexto obligatorio:
- Plataforma: AuditaPatron.
- Responsable: CVZ Liderazgo en Gestión Laboral, S.A. de C.V.
- Domicilio: 459 Av. Santa Fe, Col. Cruz Manca, Cuajimalpa, CDMX, C.P. 05349.
- Objetivo: auditoría laboral, expediente digital del trabajador y copiloto legal Helios.
- Incluir Aviso de Privacidad Integral v2.0 conforme Arts. 15-18 LFPDPPP.
- Datos personales recabados: identificación, laborales, financieros, documentos laborales, datos de uso; NO biométricos.
- Finalidades primarias: verificar cumplimiento laboral/fiscal/seguridad social, analizar documentos con IA, generar reportes, mantener expediente digital, autenticar identidad, brindar asesoría laboral automatizada por Helios.
- Finalidades secundarias con esquema opt-out: uso de datos anonimizados y agregados para analítica, benchmark, informes, mejora de servicios, entrenamiento de IA, obras derivadas, compartir datos anonimizados con ecosistema CompliLink/Helios, alertas y estudios de mercado.
- Cláusula crítica: los datos anonimizados y agregados no constituyen datos personales y CVZ Liderazgo puede usarlos sin restricción, de forma perpetua e irrevocable, para fines lícitos incluyendo entrenamiento IA, benchmarks y comercialización de insights agregados.
- Derechos ARCO: incluir Acceso, Rectificación, Cancelación y Oposición; contacto privacidad@auditapatron.com; respuesta 20 días hábiles; revocación con periodo de gracia de 5 días hábiles; cancelación no procede cuando haya obligación legal.
- Transferencias: afiliadas del grupo CVZ Liderazgo (CompliLink MX, Helios), autoridades cuando aplique, proveedores tecnológicos bajo confidencialidad; sin transferencias internacionales salvo infraestructura con nivel adecuado de protección.
- Términos v2.0: definir Datos de la Plataforma, Datos Agregados, Datos Anonimizados, Obras Derivadas, Ecosistema CVZ.
- Propiedad intelectual: plataforma, marcas, algoritmos, scores, bases de datos y contenido son de CVZ Liderazgo/licenciantes.
- Licencia de datos clave: no exclusiva, mundial, perpetua, irrevocable, transferible, sublicenciable y libre de regalías para operar, mantener, mejorar, desarrollar funcionalidades, entrenar IA, análisis, generar datos agregados/anonimizados y alimentar Ecosistema CVZ; obras derivadas son titularidad exclusiva de CVZ Liderazgo; el usuario conserva titularidad de datos originales sujeto a la licencia.
- Exención: análisis/resultados/copiloto son informativos y de apoyo, no asesoría profesional vinculante; no se garantiza exactitud de fuentes gubernamentales.
- Limitación de responsabilidad: monto pagado últimos 12 meses o 5,000 MXN, lo que sea menor.
- Indemnización, supervivencia, jurisdicción Monterrey, cesión asimétrica a favor de CVZ Liderazgo.
- Gate legal: título 'Aceptación de Documentos Legales', texto que obligue aceptación para continuar, links a Aviso de Privacidad Integral v2.0 y Términos y Condiciones de Uso v2.0, checkbox único, botón 'Continuar'.
- Privacy center: resumen ARCO, revocación con gracia de 5 días hábiles, email, tono discreto.
- Helios context: mencionar AES-256-GCM, LFPDPPP v2.0, derechos ARCO, consentimiento versionado con IP/user-agent/timestamp, revocación con gracia, ecosistema Helios/CompliLink, MFA/TOTP, rate limiting, invalidación JWT, audit trail, documentos enriquecidos para expediente, doctrina de Baltasar Cavazos Flores, Mario de la Cueva y Néstor de Buen Lozano.

No agregues HTML. Devuelve Markdown puro dentro de los campos string.`;

async function callOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY missing');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Responde solo con JSON válido.' },
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
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
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
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'grok-4-fast-reasoning',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Responde solo con JSON válido.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Grok ${res.status}: ${JSON.stringify(json)}`);
  return JSON.parse(json.choices[0].message.content);
}

const result = { generatedAt: new Date().toISOString(), views: {}, errors: {} };
for (const [name, fn] of Object.entries({ openai: callOpenAI, gemini: callGemini, grok: callGrok })) {
  try {
    result.views[name] = await fn();
  } catch (error) {
    result.errors[name] = error instanceof Error ? error.message : String(error);
  }
}
await fs.writeFile('/home/ubuntu/complilink_operativo_v1/tmp_legal_docs_multiview.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ok: true, output: '/home/ubuntu/complilink_operativo_v1/tmp_legal_docs_multiview.json' }));
