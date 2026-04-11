# Brief de hardening CEO V1

Contexto: Proyecto `complilink_operativo_v1`. Estamos cerrando el bloque crítico de V1 del dashboard CEO. Ya existen mutaciones administrativas protegidas para:

- confirmar avance seguro de caso
- acusar / resolver alertas
- registrar auditoría de exportes ejecutivos
- revocar o actualizar accesos case-scoped

Hallazgos internos ya confirmados en código:

1. Las mutaciones CEO están detrás de `adminProcedure`.
2. `ceoRecordExportAudit` ya valida frescura del snapshot (`snapshotGeneratedAt`) y, si hay `tenantId`, exige `assertTenantAdminAccess`.
3. `ceoUpdateAlertStatus` y `ceoProgressCaseStage` sí restringen transiciones seguras explícitas.
4. `ceoUpdateMembershipStatus` NO tiene una transición segura explícita; hoy acepta cualquier cambio distinto entre `active` y `revoked`.
5. En frontend, `getSafeMembershipAction()` hoy permite `active -> revoked` y también `revoked -> active`, lo que abre la puerta a reactivar accesos desde la consola CEO.
6. Ya hay pruebas para stale data en alertas, membresías y casos, pero no está cerrada la cobertura negativa final para exportes stale ni para la posible reactivación de accesos.

Necesito una revisión crítica y concreta sobre este cierre V1. Responde con JSON válido bajo este esquema exacto:

```json
{
  "keep_as_is": ["string"],
  "must_fix_now": [
    {
      "issue": "string",
      "why": "string",
      "minimal_fix": "string",
      "test_to_add": "string"
    }
  ],
  "nice_to_have_later": ["string"],
  "risk_level": "low|medium|high",
  "final_recommendation": "string"
}
```

Criterios:
- Prioriza cambios mínimos, seguros y de bajo riesgo para cerrar V1.
- No propongas refactors amplios.
- Evalúa específicamente permisos, stale exports, transición de membresías y pruebas negativas finales.
- Si crees que la reactivación `revoked -> active` desde CEO debe bloquearse en V1, dilo explícitamente.
