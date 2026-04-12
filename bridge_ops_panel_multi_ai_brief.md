# Diagnóstico actual del bridge AuditaPatrón ↔ CompliLink

## Contexto operativo
Necesito cerrar la conexión real del bridge en el proyecto `/home/ubuntu/complilink_operativo_v1`.
El objetivo es que CompliLink reciba correctamente el envío saliente desde el lado AuditaPatrón/bridge y que el proyecto quede listo para una prueba real o smoke test con evidencia.

## Hallazgos verificados en el código y entorno
1. El entorno actual sí tiene configurado `AUDITAPATRON_ENGINE_WEBHOOK_URL=https://complilink.mx/api/auditapatron/webhook`.
2. El secreto `AUDITAPATRON_ENGINE_HMAC_SECRET` existe en runtime y tiene longitud 64.
3. El servicio `server/auditaPatronIntegrationService.ts` actualmente envía `POST` con estos headers:
   - `Authorization: Bearer <secret>`
   - `x-auditapatron-token: <secret>`
   - `x-auditapatron-signature: hmac-sha256:<firma>`
   - `X-AuditaPatron-Timestamp: <unix seconds>`
4. En esa implementación, la firma efectiva del request saliente se calcula sobre `body` únicamente (`buildAuditaPatronBodySignature`) y no sobre `timestamp.body`.
5. El historial/documentación interna del proyecto afirma que el contrato final confirmado requería firma **HMAC-SHA256 sobre `timestamp.body`** y headers `X-AuditaPatron-Timestamp` + `X-AuditaPatron-Signature`.
6. Al buscar en el código, NO encontré implementación real de `GET /api/auditapatron/health` ni de `POST /api/auditapatron/webhook`; solo aparecen en tests o documentos auxiliares.
7. Un intento de `curl` contra `https://complilink.mx/api/auditapatron/health` devolvió error TLS/handshake desde el sandbox, así que no tengo confirmación externa del endpoint productivo.

## Necesidad de decisión
Quiero una recomendación de mínima intervención y máxima robustez para dejar esto realmente conectado del lado CompliLink en este proyecto.

## Responde SOLO con JSON válido usando exactamente esta forma
{
  "diagnosis": {
    "primary_blocker": "string",
    "secondary_blockers": ["string"],
    "confidence": "high|medium|low"
  },
  "recommended_fix_order": ["string"],
  "contract_decision": {
    "signature_input_should_be": "string",
    "required_headers": ["string"],
    "should_keep_bearer_or_token_headers": true,
    "why": "string"
  },
  "implementation_scope": {
    "need_public_health_endpoint": true,
    "need_public_webhook_endpoint": true,
    "need_db_or_migration_change": true,
    "need_test_updates": true,
    "need_runtime_secret_change": true
  },
  "smoke_test_plan": ["string"],
  "final_recommendation": "string"
}
