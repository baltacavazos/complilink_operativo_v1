# Contexto técnico para priorización de V1

## Objetivo de negocio

Robustecer la **versión 1** de CompliLink/AuditaPatron para llegar pronto a **pruebas piloto controladas**, dejando la base suficientemente estable para después evolucionar a apps **Android/iOS** sin rehacer la arquitectura.

## Restricción estratégica

Ya no conviene seguir agregando features dispersas. La prioridad es **endurecer**, simplificar, probar y cerrar lo mínimo indispensable para una salida a piloto.

## Estado actual confirmado del backend y datos

El proyecto ya tiene implementado un stack web con servidor, base de datos y usuarios. En el router principal existen dominios funcionales para:

- autenticación y sesión
- bootstrap y snapshot del workspace
- tenants
- dashboard
- casos
- documentos
- consentimientos
- políticas
- auditoría
- utilidades de clasificación documental

En la base de datos ya existen tablas o estructuras para:

- `users`
- `tenants`
- `tenant_memberships`
- `labor_cases`
- `case_access`
- `case_events`
- `case_documents`
- `document_policies`
- `consent_records`
- `audit_logs`
- `operational_alerts`
- `canonical_contracts`

## Capacidades ya presentes

La aplicación ya soporta, al menos en una primera versión:

- arquitectura multi-tenant
- casos laborales con `tenant_id`, `case_id` y `trace_id`
- carga documental con almacenamiento y hash SHA-256
- clasificación documental básica
- consentimientos y políticas de visibilidad
- bitácora de auditoría
- dashboard ejecutivo
- integración documental saliente y de retorno entre AuditaPatron y CompliLink MX
- firma HMAC, idempotencia y reintentos controlados en integración
- pruebas Vitest en partes críticas

## Pendientes abiertos más importantes detectados en backlog

Los pendientes abiertos más importantes giran alrededor de estos bloques:

1. **Trazabilidad y seguridad**
   - reforzar auditoría con **hash chain**
   - endurecer **RBAC** granular por tenant/caso
   - reforzar validaciones de entrada y reglas de negocio

2. **Operación y resiliencia**
   - alertas operativas con estados accionables
   - bitácora operativa centralizada y monitoreo mínimo
   - estrategia de backup y recuperación
   - evaluar versionado o supersedencia documental

3. **Producto y UX de V1**
   - simplificar CompliLink al máximo
   - dejar flujos autoexplicativos
   - priorizar solo el mínimo indispensable para piloto

4. **Integración y ecosistema**
   - presentar e implementar el plan integral de integración conectada AuditaPatron ↔ CompliLink MX
   - validar la integración con pruebas y revisión técnica
   - existen referencias estratégicas a un motor Helios como núcleo futuro, pero la V1 debe priorizar estabilidad operativa

5. **Ruta a móvil**
   - preparar transición a Android/iOS sin duplicar lógica
   - mantener backend/API/contratos reutilizables

## Preguntas para el modelo

Responde pensando como **arquitecto principal de producto y plataforma**. Quiero una propuesta para priorizar la V1 de forma extremadamente pragmática.

Devuelve un JSON válido con esta estructura exacta:

```json
{
  "top_priorities": [
    {
      "rank": 1,
      "name": "string",
      "why_now": "string",
      "scope": ["string"],
      "dependencies": ["string"],
      "risk_if_skipped": "string",
      "pilot_impact": "high|medium|low"
    }
  ],
  "recommended_next_block": {
    "name": "string",
    "why": "string",
    "deliverables": ["string"],
    "tests": ["string"],
    "not_now": ["string"]
  },
  "mobile_transition": {
    "recommendation": "string",
    "rationale": "string",
    "prerequisites": ["string"],
    "anti_patterns": ["string"]
  },
  "v1_exit_criteria": ["string"],
  "warnings": ["string"]
}
```

## Criterios de respuesta

- Prioriza una **V1 pilotable**, no una visión idealista.
- Evita sugerir features cosméticos o secundarios antes de seguridad, operación y pruebas.
- Si ves conflicto entre robustez y expansión funcional, favorece robustez.
- Sé explícito sobre qué **no** debe hacerse todavía.
