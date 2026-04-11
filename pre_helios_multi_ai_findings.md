# Hallazgos para el comparador multi-IA pre-Helios

El script `scripts/multi_ai_compare.mjs` ya consulta OpenAI, Gemini y Grok con un prompt libre y guarda la respuesta consolidada en JSON. Hoy no incorpora contexto real del pipeline documental más allá del contenido que se le pase manualmente en el prompt.

El pipeline que más conviene describir y reutilizar antes de Helios está duplicado entre `analyzeDocumentDraft` y `uploadDocument`: validación del archivo, hash SHA-256, storage, enriquecimiento de `textHint`, clasificación, `scan assistance`, análisis preliminar y extracción estructurada. Ese tramo puede encapsularse en un helper para reducir divergencias y, al mismo tiempo, servir como fuente de contexto estructurado para el comparador multi-IA.

La siguiente implementación debería cubrir dos frentes: extraer un helper reutilizable del pipeline documental y mejorar `multi_ai_compare.mjs` para aceptar un brief más estructurado o un bloque de contexto del codebase, manteniendo el offload pesado en OpenAI, Gemini y Grok como pidió el usuario.
