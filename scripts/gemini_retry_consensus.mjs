import fs from "node:fs/promises";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY no está disponible");
}

const prompt = `
Eres un consultor senior de producto y arquitectura para una plataforma web mexicana llamada AuditaPatron.

Contexto del producto:
- La marca pública visible es AuditaPatron.
- El motor interno es Helios y NO debe aparecer en la UI pública.
- Toda la información del usuario y todos los documentos subidos deben seguir una arquitectura Helios-first: el documento se carga, Helios lo analiza y almacena, y Helios emite los resultados.
- El tono debe ser cercano, claro y prudente. No debe prometer validación oficial infalible ni solución legal automática.
- IMSS e Infonavit deben ser visibles en la experiencia, porque son claves para la propuesta de valor.

Estado actual implementado:
- Ya existe en /auditar un indicador dinámico del expediente ligado al estado real de los documentos.
- Ya existe una acción de revalidación de IMSS e Infonavit.
- Ya existe una derivación backend de socialSecurityValidation con coverageScore, statusLabel, summary, recommendedNextStep, revalidationHistory, hasNewClarity, clarityDelta, clarityChangeLabel, recommendedDocumentTitle y recommendedDocumentReason.
- Se necesita mejorar y completar la experiencia visible.

Tres funcionalidades pendientes por implementar:
1. Historial de revalidaciones: mostrar un historial con fecha y cambio detectado cada vez que se revalida IMSS/Infonavit.
2. Recomendación del siguiente documento: sugerir automáticamente el documento más útil a subir según el estado actual de IMSS/Infonavit del usuario.
3. Notificación de nueva claridad: mostrar una notificación simple cuando el expediente gana nueva claridad tras subir un archivo.

Lo que necesito de ti:
- Propón la mejor estrategia de implementación visible y backend para estas 3 funciones.
- Explica qué debe mostrarse exactamente en la UI de /auditar para que se entienda en móvil y escritorio.
- Define qué datos conviene persistir o derivar para que el historial y la notificación sean consistentes.
- Sugiere microcopy en español claro para cada bloque, sin mencionar Helios en la UI pública.
- Señala riesgos de UX o confianza si se implementa mal.
- Termina con una recomendación priorizada en formato JSON válido con esta forma exacta:
{
  "ux_structure": ["..."],
  "backend_notes": ["..."],
  "microcopy": {
    "history_title": "...",
    "history_empty": "...",
    "clarity_gain": "...",
    "recommended_doc_title": "...",
    "recommended_doc_cta": "..."
  },
  "risks": ["..."],
  "priority_order": ["..."],
  "implementation_notes": ["..."]
}
`.trim();

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiOnce() {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Devuelve solo JSON válido. ${prompt}` }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Gemini error: ${response.status} ${JSON.stringify(data)}`);
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}

let lastError = null;
for (let attempt = 1; attempt <= 3; attempt += 1) {
  try {
    const raw = await callGeminiOnce();
    const parsed = JSON.parse(raw);
    const outputPath = "/home/ubuntu/complilink_operativo_v1/tmp/gemini_retry_consensus.json";
    await fs.mkdir("/home/ubuntu/complilink_operativo_v1/tmp", { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify({ ok: true, attempt, data: parsed }, null, 2));
    console.log(outputPath);
    process.exit(0);
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    if (attempt < 3) {
      await sleep(1500 * attempt);
    }
  }
}

const outputPath = "/home/ubuntu/complilink_operativo_v1/tmp/gemini_retry_consensus.json";
await fs.mkdir("/home/ubuntu/complilink_operativo_v1/tmp", { recursive: true });
await fs.writeFile(outputPath, JSON.stringify({ ok: false, error: lastError }, null, 2));
console.log(outputPath);
process.exit(1);
