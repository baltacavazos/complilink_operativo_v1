# Contrato actual de pruebas para Dashboard CEO

La suite `server/ceoDashboardSafeActions.test.ts` ya cubre acciones seguras sobre alertas, memberships y progresión de caso, además de la auditoría de exportes. El snapshot base de pruebas usa `generatedAt = 2026-04-08T09:30:00.000Z`.

Los casos de auditoría de exportes ya envían `snapshotGeneratedAt`, pero las mutaciones seguras `ceoUpdateAlertStatus`, `ceoUpdateMembershipStatus` y `ceoProgressCaseStage` todavía se ejercitan principalmente con `expectedCurrentStatus`. Esto permite endurecer el contrato agregando `snapshotGeneratedAt` a los casos exitosos y a los rechazos por vista desactualizada.

La preparación común de mocks ya fija `db.getCeoDashboardSnapshot` con un snapshot determinista, lo que facilita añadir validaciones de freshness sin tocar el resto del set-up.
