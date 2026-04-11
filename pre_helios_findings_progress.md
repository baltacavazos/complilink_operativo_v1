# Avance del endurecimiento CEO pre-Helios

El backend del Dashboard CEO ahora exige `snapshotGeneratedAt` en `ceoRecordExportAudit`, `ceoUpdateAlertStatus`, `ceoUpdateMembershipStatus` y `ceoProgressCaseStage`. Además, `server/routers.ts` incorpora `assertCeoSnapshotFresh`, que rechaza snapshots inválidos o con más de dos minutos de antigüedad antes de permitir exportes o acciones ejecutivas.

En el frontend, `client/src/pages/CeoDashboard.tsx` ya calcula `snapshotGeneratedAtIso`, lo propaga a las mutaciones sensibles y a la auditoría de exportes, y corta la ejecución si la vista está bloqueada o si la marca temporal del snapshot no está disponible. También se unificó el copy de bloqueo stale hacia la variante breve acordada: "Datos desactualizados. Actualiza el dashboard antes de continuar.".

El tipado del frontend volvió a quedar limpio en esta zona. Quedan pendientes la actualización del contrato de pruebas, la posible alineación fina de `ceoDashboardExports.ts` y el bloque del pipeline documental con comparador multi-IA y quick wins de robustez.
