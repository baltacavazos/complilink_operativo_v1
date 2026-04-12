# Contexto técnico para contraste multi-IA

Necesito una recomendación técnica **mínima, segura y consistente** para implementar en este orden tres mejoras en la Consola CEO del proyecto `complilink_operativo_v1`.

## Objetivo

1. **Envío por correo** del export bridge en **PDF/CSV** a destinatarios configurables desde la Consola CEO.
2. **Gráfico de tendencia** de éxito/fallo para el histórico smoke del bridge.
3. **Filtros exportables** del bridge por **ventana**, **severidad** y **tenant**.

## Restricciones del proyecto

- Stack: React 19 + Tailwind 4 + Express + tRPC + Vitest.
- Debo hacer cambios mínimos y reutilizar la infraestructura existente.
- Debo conservar trazabilidad/auditoría de acciones ejecutivas.
- Quiero evitar refactors grandes o introducir dependencias innecesarias si no aportan valor inmediato.
- La app ya tiene exportación local CSV/PDF del panel bridge funcionando.

## Estado actual confirmado

### Frontend: `client/src/pages/CeoDashboard.tsx`

- Ya existe `handleExport(kind)` para descargar CSV/PDF.
- Ya se usa:
  - `downloadCeoPdfReport(...)`
  - `downloadCeoCsvReport(...)`
  - `recordExportAuditMutation = trpc.dashboard.ceoRecordExportAudit.useMutation()`
- La sección `bridge` ya construye `bridgeExportPayload` con:
  - `summaryRows`
  - `tables`
- Ya existen filtros globales del dashboard:
  - `tenantId`
  - `severity`
  - `caseId`
  - `userId`
  - `dateWindowDays`
- Ya existe histórico smoke y comparativos:
  - `bridgeSmokeHistory`
  - `filteredBridgeSmokeHistory`
  - `bridgeSmokeComparisons = buildBridgeSmokeComparisonSummary(bridgeSmokeHistory)`
- Ya existe UI del comparativo diario y semanal en tarjetas numéricas.
- Ya existen filtros específicos del smoke:
  - `bridgeSmokeHistoryFilter`
  - `bridgeSmokeTimeWindow`
  - `bridgeSmokeSeverityFilter`

### Backend: `server/routers.ts`

- Ya existe `ceoRecordExportAudit` con input:
  - `tenantId?: string`
  - `section: "resumen" | "bridge" | "alertas" | "accesos" | "documentos"`
  - `format: "csv" | "pdf"`
  - `snapshotGeneratedAt: string`
  - `appliedFilters: string[]`
  - `visibleCount: number`
- Esa mutación persiste auditoría con acción:
  - `dashboard.ceo.export_generated`

### Correo: `server/authService.ts`

- Ya existe integración funcional con Resend usando `fetch("https://api.resend.com/emails", ...)`.
- Actualmente se usa para login por email, sin helper genérico de adjuntos.
- Están disponibles `ENV.resendApiKey` y `ENV.resendFromEmail`.

## Lo que necesito de ti

Quiero una respuesta muy concreta y accionable en formato de tabla con estas columnas:

| Tema | Recomendación mínima | Riesgos | Decisión sugerida |

Después de la tabla, agrega una sección corta con:

1. **Diseño recomendado de API/tRPC** para el envío por correo del export bridge.
2. **Dónde renderizar el gráfico** dentro del bloque bridge existente.
3. **Cómo unificar filtros visibles y filtros exportados** sin duplicar lógica.
4. **Qué pruebas Vitest mínimas** agregarías.

## Preguntas específicas

1. ¿Conviene generar el contenido del PDF/CSV **una sola vez en frontend** y reutilizarlo para correo, o replicar la generación en backend para el envío por email?
2. Dado que Resend ya existe de forma ad hoc en `authService.ts`, ¿es mejor extraer un helper reutilizable de correo o hacer una implementación localizada para esta feature?
3. Para el gráfico de tendencia, ¿conviene una visualización pequeña inline sin nueva dependencia o introducir una librería de charts?
4. Para filtros exportables del bridge, ¿conviene usar los filtros globales existentes más los filtros smoke actuales, o crear un estado separado exclusivo de exportación?
5. ¿Qué esquema de auditoría adicional recomiendas para distinguir entre `export_generated` y `export_emailed`?

Responde asumiendo que el objetivo principal es: **máximo reaprovechamiento, mínimo riesgo y mínima complejidad adicional**.
