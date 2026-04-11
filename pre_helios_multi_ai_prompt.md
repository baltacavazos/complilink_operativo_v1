# Sprint pre-Helios: consulta multi-IA con contexto real

Responde en español. Actúa como **staff+ principal engineer** para un producto legal-operativo con stack React + tRPC + Drizzle. Necesito una respuesta breve pero accionable con estas secciones exactas:

1. **Consenso útil**
2. **Prioridad 1**
3. **Prioridad 2**
4. **Prioridad 3**
5. **Cambios mínimos exactos**
6. **Pruebas mínimas**
7. **Riesgos diferidos**

## Objetivo
Dejar el producto **lo más avanzado posible antes de conectar Helios**, sin hacer todavía la integración definitiva. El trabajo inmediato debe maximizar robustez, trazabilidad y escalabilidad operativa con cambios pequeños y seguros.

## Contexto del proyecto
- Existe un flujo documental en `/auditar` con dos rutas parecidas: `analyzeDocumentDraft` y `uploadDocument`.
- Ambos caminos ya usan `prepareAuditarUploadAsset`, clasifican documento, calculan `scanAssistance`, hacen `structuredExtraction`, construyen contratos canónicos y generan una opinión preliminar tipo Helios.
- El proyecto ya tiene un Dashboard CEO con guardrails de snapshot stale en frontend y backend.
- Ya existe una prueba de backend que cubre acciones seguras del Dashboard CEO y auditoría de exportes.
- Hay un script `scripts/multi_ai_compare.mjs` que hoy consulta OpenAI, Gemini y Grok, pero es muy genérico y no está orientado a este contexto real.

## Código relevante resumido
### Helper documental
```ts
function prepareAuditarUploadAsset(params: { fileName: string; mimeType: string; binary: Buffer }) {
  const { safeFileName } = validateAuditarUploadMetadata(params);

  if (params.binary.byteLength === 0) {
    throw new Error("El archivo llegó vacío. Intenta subirlo otra vez.");
  }

  if (params.binary.byteLength > AUDITAR_MAX_UPLOAD_BYTES) {
    throw new Error("El archivo supera el límite de 12 MB para esta revisión inicial. Súbelo en una versión más ligera.");
  }

  assertAuditarMimeMatchesBinary({ mimeType: params.mimeType, binary: params.binary });

  return {
    safeFileName,
    sizeBytes: params.binary.byteLength,
  };
}
```

### analyzeDocumentDraft hoy
- decodifica base64
- llama `prepareAuditarUploadAsset`
- sube archivo a storage
- clasifica documento
- corre `analyzeDocumentScanAssist`
- corre `analyzeStructuredDocumentPreview`
- arma un contrato draft y lo persiste como `classification` con `status: "draft"`
- crea audit log `document.preview_analyzed`
- devuelve preview para confirmación posterior

### confirmDocumentDraft hoy
- valida TTL y deduplicación
- aplica overrides manuales
- persiste documento real
- genera contratos `document`, `classification`, `shared_engine`, `audit`
- genera opinión preliminar tipo Helios
- despacha a motor externo actual
- crea eventos y audit logs

### uploadDocument hoy
- repite gran parte del pipeline de `analyzeDocumentDraft` + `confirmDocumentDraft`
- hace validación, clasificación, scan assistance, structured extraction
- persiste documento definitivo, contratos, opinión preliminar y dispatch

### Dashboard CEO hoy
El frontend calcula algo equivalente a:
```ts
const snapshotAgeMs = snapshotGeneratedAtMs === null ? null : Math.max(0, snapshotPulseAt - snapshotGeneratedAtMs);
const isSnapshotStale = snapshotAgeMs !== null && snapshotAgeMs > 2 * 60 * 1000;
const executiveActionsBlocked = isRefreshing || isSnapshotStale || Boolean(snapshotError);
const exportGuardReason = getCeoExportBlockReason({
  hasSnapshot: Boolean(snapshotData),
  isRefreshing,
  isSnapshotStale,
  hasSnapshotError: Boolean(snapshotError),
});
```
Y deshabilita botones de acciones sensibles y exportes cuando existe bloqueo.

### Contrato de pruebas ya existente para CEO
La suite `server/ceoDashboardSafeActions.test.ts` ya valida al menos:
- transición segura de alertas
- transición segura de memberships
- progresión segura de casos
- bloqueo si la vista del operador quedó stale
- auditoría de exportes con filtros, formato y snapshot
- resolución de tenant por defecto para export global
- bloqueo para usuarios sin rol admin

### Script multi-IA actual
```js
results.models.openai = await callOpenAI();
results.models.gemini = await callGemini();
results.models.grok = await callGrok();
```
Pero hoy:
- usa prompts genéricos
- no exige JSON estructurado
- no inyecta contexto real de código más allá de un prompt manual
- Gemini no tiene fallback
- no produce una síntesis de consenso lista para ejecutar

## Decisión que necesito
Quiero que priorices **sólo tres frentes** y me digas el orden óptimo para una entrega V1 pre-Helios:

A. Consolidar o reutilizar mejor el pipeline documental para que `prepareAuditarUploadAsset` y el contexto real alimenten el comparador multi-IA y reduzcan duplicación entre `analyzeDocumentDraft` y `uploadDocument`.
B. Endurecer el Dashboard CEO para que ningún export o acción sensible se ejecute con snapshots stale, incluyendo copy y telemetría mínima si hace falta.
C. Añadir quick wins de escalabilidad/robustez sin re-arquitectura grande, pensando en miles de usuarios y en evitar caídas o duplicaciones operativas.

## Restricciones
- No romper el comportamiento existente.
- No introducir refactors gigantes.
- No hacer todavía la integración final con Helios.
- Debe quedar listo para conectar Helios después con el menor retrabajo posible.
- Si propones cambios, deben caber en un sprint corto y tener pruebas mínimas claras.

## Qué espero de tu respuesta
- Un orden de prioridad claro entre A, B y C.
- Cambios mínimos exactos, concretos y seguros.
- Qué pruebas mínimas agregaría ya mismo.
- Qué riesgos dejarías diferidos para después de Helios.
