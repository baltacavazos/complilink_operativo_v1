# Ajuste pendiente en confirmDocumentDraft

Las pruebas muestran dos contratos simultáneos que deben convivir:

1. **Las confirmaciones expiradas o inválidas siguen pasando por `withDatabaseLock`** para preservar el conteo observado por la suite `server/caseWorkflows.test.ts`.
2. **Una confirmación exitosa inmediata del mismo `draftId` debe bloquearse antes de volver a ejecutar el tramo pesado**, de forma que el segundo intento no vuelva a persistir ni a tomar el lock operativo.

El enfoque de mover `acquireAuditarTransientDedup` antes del lock rompió el primer contrato. La corrección adecuada es mantener el flujo actual para borradores expirados o ausentes, y añadir un guardrail específico para confirmaciones ya completadas recientemente, reutilizando la infraestructura de deduplicación transitoria pero con una clave/acción distinta asociada al éxito de la confirmación.
