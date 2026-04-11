# Hallazgos intermedios del sprint pre-Helios

## Estado del router

`server/routers.ts` volvió a compilar en TypeScript tras corregir la estructura de `confirmDocumentDraft` y `uploadDocument`, además de mover la liberación de deduplicación a bloques `finally`.

## Dashboard CEO

- `client/src/pages/CeoDashboard.tsx` ya usa `useAuth` en el arranque; no hay evidencia actual de un import duplicado activo en el tramo inspeccionado.
- El bloqueo ejecutivo vigente depende de `isRefreshing || isSnapshotStale || Boolean(snapshotError)`.
- La obsolescencia (`isSnapshotStale`) hoy se define como una antigüedad mayor a 2 minutos desde `generatedAt` del snapshot.
- Los exportes ya llaman a `getCeoExportBlockReason(...)` y bloquean la descarga si no hay snapshot, si hay refresh en curso, error de carga o snapshot stale.

## Utilidad de exportes

- `client/src/pages/ceoDashboardExports.ts` centraliza el razonamiento de bloqueo con `getCeoExportBlockReason`.
- El siguiente ajuste probable es endurecer la coherencia entre la UI y la utilidad de exportes para evitar operar con snapshots visibles que ya quedaron viejos aunque sigan renderizados.
