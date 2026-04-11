# Brief de contraste multi-IA: panel operativo de eventos y errores del bridge

## Objetivo
Diseñar el siguiente bloque post-V1 de **CompliLink Operativo**: un **panel operativo de eventos y errores del bridge AuditaPatron/CompliLink** para uso interno del rol CEO/admin, reutilizando al máximo la infraestructura ya existente y evitando introducir complejidad innecesaria.

## Contexto ya implementado
El proyecto ya cuenta con estos cimientos:

1. **Bridge saliente con observabilidad mínima** en `server/auditaPatronIntegrationService.ts`.
   - Cada dispatch genera un `observabilityEnvelope` con datos como `dispatchId`, `targetHost`, `targetPath`, `outcomeCategory`, `httpStatusCode`, `retryScheduled`, `retryDelayMs`, `remoteSmokeEnabled`.
   - Las pruebas validan estos metadatos en `server/auditaPatronIntegrationService.test.ts`.

2. **Webhook entrante del bridge** en `server/auditaPatronReturnWebhook.ts`.
   - Verifica HMAC.
   - Rechaza `missing_fields`, `unknown_event`, `document_not_found`.
   - Persiste resultados relevantes con `upsertCanonicalContract`, `addCaseEvent`, `addOperationalAlert` y `createAuditLog`.
   - Los eventos de retorno terminan auditados con acciones tipo `complilink.return_webhook.<event>`.

3. **Dashboard CEO con monitoreo auditado** ya existente.
   - El frontend ya usa `client/src/pages/ceoDashboardMonitoring.ts` para resumen, filtros, alertas y drill-down de bitácora auditada.
   - El router ya expone `dashboard.ceoSnapshot` y `audit.list`.
   - Ya existe monitoreo CompliLink a nivel expediente mediante `buildCompliLinkMonitoring(...)` en `server/routers.ts`, basado en eventos de dispatch y retorno.

4. **Guardrails recientes ya cerrados**.
   - Hardening de perímetro CEO.
   - Autenticación unificada endurecida.
   - Guardrails explícitos para smoke tests remotos.

## Restricciones
- No romper Manus OAuth ni el flujo actual del dashboard CEO.
- No introducir infraestructura nueva pesada si el valor puede lograrse con datos ya persistidos.
- Priorizar una solución **operable y trazable** en V1.1, no un observability platform completa.
- Mantener compatibilidad con el estilo del proyecto: router tRPC + dashboard CEO + pruebas Vitest.
- El panel debe ser **solo lectura operativa**; no debe disparar acciones sensibles desde UI en esta fase.

## Preguntas a responder
1. ¿Cuál es el **alcance mínimo útil** del panel operativo del bridge para esta siguiente iteración?
2. ¿Conviene:
   - extender la bitácora auditada existente del CEO,
   - crear una sección específica dentro del dashboard CEO,
   - o introducir un dataset/resumen derivado nuevo en `dashboard.ceoSnapshot`?
3. ¿Qué **eventos, estados y errores** deben aparecer sí o sí para que soporte interno pueda detectar:
   - dispatches exitosos,
   - envíos esperando retorno,
   - timeouts / atención,
   - retornos correctos,
   - rechazos o errores de validación del webhook,
   - advertencias/guardrails devueltos por CompliLink?
4. ¿Qué **KPIs operativos** mínimos conviene mostrar? Ejemplos: total dispatches, waiting, attention, success, return events con warnings, errores de firma o payload inválido, etc.
5. ¿Qué **modelo de datos derivado** recomiendan para no duplicar de más lo ya persistido?
6. ¿Qué cobertura de pruebas mínimas recomiendan para esta fase?

## Lo que necesito de cada modelo
Responde en JSON válido con este esquema conceptual:

```json
{
  "recommended_scope": ["..."],
  "ui_recommendation": {
    "placement": "...",
    "why": "..."
  },
  "must_have_operational_states": ["..."],
  "must_have_kpis": ["..."],
  "data_strategy": {
    "approach": "...",
    "why": "..."
  },
  "test_recommendations": ["..."],
  "risks": ["..."],
  "implementation_order": ["..."]
}
```

## Criterio de decisión esperado
Busco una recomendación pragmática para implementar **ya** el panel post-V1, con el menor cambio posible y la mayor utilidad operativa inmediata.
