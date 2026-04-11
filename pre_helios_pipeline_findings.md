# Pipeline documental pre-Helios

`prepareAuditarUploadAsset` hoy sólo valida nombre, MIME, tamaño máximo y coherencia binaria, devolviendo `safeFileName` y `sizeBytes`. El bloque pesado posterior vive duplicado en `analyzeDocumentDraft` y `uploadDocument`.

En `analyzeDocumentDraft`, después de `decodeBase64File` y `prepareAuditarUploadAsset`, el flujo repite: cálculo de `sha256`, deduplicación transitoria, generación de `storageKey`, `storagePut`, enriquecimiento de `textHint` con `expectedDocumentType`, clasificación con `classifyMexicanLaborDocument`, análisis de escaneo con `analyzeDocumentScanAssist`, análisis preliminar con `buildPreliminaryLaborAnalysis` y extracción estructurada con `analyzeStructuredDocumentPreview`.

Este tramo es el mejor candidato para extraerse a un helper reutilizable pre-Helios que también sirva como fuente de contexto real para el comparador multi-IA. Queda por revisar el espejo en `uploadDocument` para consolidar el helper sin alterar la lógica de persistencia ni el despacho posterior hacia Helios.
