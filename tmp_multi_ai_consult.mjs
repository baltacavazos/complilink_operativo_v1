import fs from 'node:fs';

const prompt = `Actúa como un lead product engineer exigente para una app móvil-first en español para trabajadores en México.

Contexto del producto:
- App: AuditaPatron.
- Propósito: permitir que una persona suba documentos laborales y construya un expediente digital disponible 24/7.
- UX obligatoria: extremadamente simple, confiable, centrada, usable por un niño de 10 años o una persona mayor con muy baja alfabetización digital.
- No exponer al usuario nombres técnicos internos ni complejidad del backend.
- Pantalla foco: /auditar.

Estado actual de /auditar:
- Ya existe carga documental.
- Ya existen recomendaciones conectadas a faltantes reales.
- Ya existe historial con filtros y persistencia local básica.
- Ya existe onboarding móvil reutilizable.
- Ya existe progreso visual por tipo documental.
- Todo está en español.

Nueva iteración aprobada para decidir e implementar:
1. Añadir escaneo/captura documental asistido por IA con mínima fricción posible.
2. Persistir el contexto del usuario entre dispositivos, no solo en el navegador local.
3. Preseleccionar explícitamente el tipo documental recomendado dentro del flujo de carga.
4. Añadir una opción visible para reabrir el onboarding informativo.

Objetivo crítico del escaneo:
- Debe sentirse casi mágico, pero ser robusto.
- Debe guiar automáticamente al usuario para sacar una foto legible sin exigir conocimientos técnicos.
- Debe detectar problemas comunes antes de subir: borroso, oscuro, cortado, reflejos, documento incompleto, orientación incorrecta.
- Debe aplicar la mayor automatización posible: mejora de imagen, recorte, corrección de perspectiva, OCR/lectura, clasificación documental y validación mínima.
- Debe minimizar pasos manuales y texto para el usuario.

Restricciones técnicas y de UX:
- Mobile-first.
- La experiencia debe sentirse más clara, no más pesada.
- Prioriza robustez real, escalabilidad y calidad percibida, aunque implique usar IA avanzada.
- Aun así, evita re-arquitecturas innecesarias si puede resolverse de forma elegante y progresiva.
- La persistencia entre dispositivos puede apoyarse en backend si eso mejora continuidad y confianza.
- El flujo debe tolerar fallos de red o fotos deficientes con recuperación simple.

Quiero una respuesta ESTRICTA en JSON con esta forma exacta:
{
  "recommended_approach": "texto corto",
  "scan_stack": {
    "capture_guidance": "texto corto",
    "quality_gate": "texto corto",
    "enhancement_pipeline": ["paso 1", "paso 2", "paso 3"],
    "classification_strategy": "texto corto",
    "fallback_strategy": "texto corto"
  },
  "continuity_strategy": {
    "choice": "server_db | hybrid",
    "why": "texto"
  },
  "user_experience": {
    "first_screen": "texto corto",
    "primary_actions": ["accion 1", "accion 2", "accion 3"],
    "onboarding_reentry": "texto corto",
    "recommended_doc_preset": "texto corto"
  },
  "backend_strategy": {
    "upload_flow": "texto corto",
    "ai_services": ["servicio 1", "servicio 2"],
    "validation_logic": ["regla 1", "regla 2", "regla 3"]
  },
  "risks": ["riesgo 1", "riesgo 2", "riesgo 3"],
  "implementation_phases": ["fase 1", "fase 2", "fase 3"],
  "priority_score": 0
}

Reglas adicionales:
- Responde solo JSON válido.
- priority_score debe ser un número de 0 a 100.
- Favorece soluciones elegantes, simples, intuitivas, robustas y fáciles de usar por personas no técnicas.
- Piensa como cliente exigente obsesionado con fricción mínima y confianza máxima.`;

const results = [];

async function callOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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
  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status} ${JSON.stringify(data)}`);
  }
  const content = data?.choices?.[0]?.message?.content;
  return JSON.parse(content);
}

async function callGrok() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error('XAI_API_KEY missing');
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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
  if (!response.ok) {
    throw new Error(`Grok error: ${response.status} ${JSON.stringify(data)}`);
  }
  const content = data?.choices?.[0]?.message?.content;
  return JSON.parse(content);
}

async function callGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
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
          parts: [{ text: `${prompt}` }],
        },
      ],
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Gemini error: ${response.status} ${JSON.stringify(data)}`);
  }
  const content = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '{}';
  return JSON.parse(content);
}

for (const [name, fn] of [
  ['chatgpt', callOpenAI],
  ['grok', callGrok],
  ['gemini', callGemini],
]) {
  try {
    const output = await fn();
    results.push({ provider: name, ok: true, output });
  } catch (error) {
    results.push({ provider: name, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

const outPath = '/home/ubuntu/complilink_operativo_v1/multi_ai_consult_results.json';
fs.writeFileSync(outPath, JSON.stringify({ prompt, results }, null, 2));
console.log(outPath);
