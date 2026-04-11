# Brief de hardening V1: observabilidad mínima del bridge y control de smoke tests

## Contexto

Estamos cerrando el bloque crítico V1 de `complilink_operativo_v1`. Ya se endureció el perímetro CEO y la autenticación unificada. El siguiente paso es añadir **observabilidad mínima** al bridge de AuditaPatron hacia CompliLink y dejar **control explícito** sobre cualquier smoke test remoto.

El servicio principal está en `server/auditaPatronIntegrationService.ts`. Hoy:

- firma el payload con HMAC usando `timestamp.body`;
- reintenta solo en 5xx;
- devuelve un resultado estructurado (`sent`, `failed`, `skipped`);
- expone suficiente información para auditoría posterior, pero no emite todavía un bloque de trazabilidad operacional suficientemente normalizado para diagnóstico rápido;
- existe una prueba remota opcional controlada por `RUN_LIVE_COMPLILINK_BRIDGE_SMOKE === "1"` en `server/auditaPatronBridgeSecret.test.ts`.

## Objetivo

Proponer el **mínimo cambio seguro y compatible con V1** para:

1. enriquecer `sendDocumentToAuditaPatronEngine` con observabilidad estructurada útil y estable;
2. evitar que los smoke tests remotos se ejecuten accidentalmente;
3. mejorar la legibilidad operativa sin cambiar el contrato HMAC ni el flujo funcional principal;
4. mantener compatibilidad con las pruebas actuales y permitir ampliar Vitest con validaciones pequeñas.

## Restricciones

- No romper el contrato del webhook ni el payload enviado.
- No cambiar la firma HMAC ni la política de reintentos existente salvo que sea estrictamente necesario.
- No introducir dependencias pesadas ni sistemas externos de logging.
- No convertir este bloque en una plataforma completa de observabilidad; solo necesitamos un cierre V1 pragmático.
- Debe seguir siendo fácil de consumir desde `routers.ts`, donde luego se genera auditoría y alertas operativas.

## Preguntas a responder

Devuelve JSON breve y específico con este enfoque:

- `top_risks`: riesgos reales si dejamos el bridge como está;
- `minimum_service_changes`: cambios mínimos recomendados en `auditaPatronIntegrationService.ts`;
- `result_shape_changes`: campos nuevos o ajustados que conviene devolver en `AuditaPatronEngineDispatchResult`;
- `smoke_test_guardrails`: guardrails mínimos para el test remoto y su activación explícita;
- `tests_to_add`: pruebas Vitest mínimas que deben añadirse;
- `do_not_change`: lo que conviene dejar intacto en V1;
- `confidence`: `high`, `medium` o `low`.

## Preferencia de diseño

Favorecer una salida tipo "envelope de observabilidad" simple, por ejemplo con datos como:

- `targetHost`
- `targetPath`
- `requestId` o `dispatchId`
- `retryScheduled`
- `retryDelayMs`
- `outcomeCategory`
- `remoteSmokeEnabled`

Solo si realmente agrega valor operacional y sin sobrediseñar.

## Criterio de decisión

Queremos consenso de mínimo riesgo, alta claridad operativa y cero regresión para el cierre V1.
