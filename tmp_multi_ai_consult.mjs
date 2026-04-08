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
- Ya existe historial con filtros y persistencia por usuario.
- Ya existe continuidad entre dispositivos con estado remoto del flujo.
- Ya existe onboarding móvil reutilizable.
- Ya existe progreso visual por tipo documental.
- Ya existe escaneo asistido por IA con evaluación preliminar de calidad y guía simple.
- Ya existe preselección del documento recomendado dentro del flujo de carga.
- Todo está en español.

Nueva iteración aprobada para decidir e implementar:
1. Añadir detección de bordes y encuadre en cámara para ayudar a capturar mejor el documento antes de subirlo.
2. Añadir OCR estructurado por tipo documental para extraer señales útiles según el documento esperado.
3. Añadir una pantalla final de confirmación de hallazgos claros, pendientes y siguiente paso recomendado antes de guardar o continuar.

Objetivo crítico:
- Debe sentirse casi mágico, pero ser robusto.
- Debe guiar automáticamente al usuario para sacar una foto legible sin exigir conocimientos técnicos.
- Debe minimizar texto, pasos y decisiones manuales.
- Debe tolerar fallos de cámara, OCR incompleto o baja confianza sin bloquear el avance.
- Debe reforzar confianza: mostrar solo hallazgos útiles, qué quedó claro y qué conviene revisar después.

Restricciones técnicas y de UX:
- Mobile-first.
- La experiencia debe sentirse más clara, no más pesada.
- Prioriza robustez real, escalabilidad y calidad percibida, aunque implique usar IA avanzada.
- Evita re-arquitecturas innecesarias si puede resolverse de forma elegante y progresiva.
- Si propones OCR, distingue entre extracción útil inmediata y validación posterior más profunda.
- La pantalla de confirmación debe ser comprensible en menos de 10 segundos.

Quiero una respuesta ESTRICTA en JSON con esta forma exacta:
{
  "recommended_approach": "texto corto",
  "camera_guidance": {
    "edge_detection_choice": "canvas_guided | cv_assisted | hybrid",
    "why": "texto corto",
    "user_feedback": ["mensaje 1", "mensaje 2", "mensaje 3"],
    "fallback": "texto corto"
  },
  "ocr_strategy": {
    "choice": "lightweight_first | structured_first | hybrid",
    "why": "texto corto",
    "document_specific_outputs": ["salida 1", "salida 2", "salida 3"],
    "confidence_handling": "texto corto"
  },
  "confirmation_screen": {
    "primary_goal": "texto corto",
    "must_show": ["elemento 1", "elemento 2", "elemento 3"],
    "must_hide": ["elemento 1", "elemento 2"],
    "cta_strategy": "texto corto"
  },
  "implementation_strategy": {
    "frontend": ["paso 1", "paso 2", "paso 3"],
    "backend": ["paso 1", "paso 2", "paso 3"],
    "risk_controls": ["control 1", "control 2", "control 3"]
  },
  "risks": ["riesgo 1", "riesgo 2", "riesgo 3"],
  "implementation_phases": ["fase 1", "fase 2", "fase 3"],
  "priority_score": 0
}

Reglas adicionales:
- Responde solo JSON válido.
- priority_score debe ser un número de 0 a 100.
- Favorece soluciones elegantes, simples, intuitivas, robustas y fáciles de usar por personas no técnicas.
- Piensa como cliente exigente obsesionado con fricción mínima, confianza máxima y claridad instantánea.`;

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
