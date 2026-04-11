# Regresión detectada en confirmDocumentDraft

La suite `server/caseWorkflows.test.ts` revela una regresión en la deduplicación de `confirmDocumentDraft`: el segundo intento inmediato deja de ser rechazado porque el lock transitorio se libera en el bloque `finally`.

En `server/routers.ts`, `confirmDocumentDraft` adquiere la deduplicación con `acquireAuditarTransientDedup(...)` y luego ejecuta `releaseConfirmDedup()` dentro de `finally`. Eso anula la ventana temporal que debía bloquear reintentos consecutivos sobre el mismo `draftId`.

Para recuperar el comportamiento esperado por el contrato existente, la corrección más segura es dejar que la entrada transitoria expire sola dentro de su ventana TTL, en lugar de liberarla explícitamente al finalizar la mutación.
