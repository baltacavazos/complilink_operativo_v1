# Hallazgos backend pre-Helios

La síntesis multi-IA converge en tres prioridades: endurecer el Dashboard CEO contra snapshots stale, reutilizar mejor el pipeline documental para el comparador multi-IA con contexto real, y cerrar quick wins pequeños de robustez sin abrir una refactorización grande.

En backend, `server/routers.ts` ya contiene una defensa por `expectedCurrentStatus` mediante `assertCeoExpectedCurrentStatus`, pero las mutaciones ejecutivas aún no reciben una marca temporal explícita del snapshot visible. Eso significa que la protección actual depende del estado actual de cada entidad y no valida de forma directa la frescura temporal del snapshot desde el que actuó el operador.

Las rutas localizadas para este endurecimiento son `ceoUpdateAlertStatus`, `ceoUpdateMembershipStatus`, `ceoProgressCaseStage` y `ceoRecordExportAudit`. La suite `server/ceoDashboardSafeActions.test.ts` ya cubre mismatches de estado y auditoría de exportes, por lo que el siguiente paso natural es extender ese contrato con una verificación adicional basada en `snapshotGeneratedAt` y copiar ese valor desde el frontend al backend.
