# Hallazgos sintetizados para la implementación legal 2.0

## Coincidencias entre Grok, Gemini y OpenAI

- Corregir primero el lockup oscuro del header evitando recorte por altura fija, overflow implícito o ancho mínimo insuficiente.
- Implementar un gate legal discreto y bloqueante solo cuando el usuario aún no haya aceptado la versión vigente de documentos legales.
- Registrar automáticamente los consentimientos `privacy_policy`, `terms_of_service`, `data_processing`, `ai_training` y `cross_platform_sharing` con versión, timestamp, IP y user-agent.
- Exponer enlaces legales de forma discreta en el footer, no en la navegación principal.
- Incluir un centro de privacidad con derechos ARCO y nota de revocación con gracia de 5 días hábiles.
- Actualizar el contexto de Helios para mencionar LFPDPPP v2.0, cifrado AES-256-GCM, consentimiento versionado, ARCO, gracia de revocación, ecosistema Helios/CompliLink, MFA/TOTP, rate limiting, invalidación JWT y audit trail.
- Cubrir con pruebas tanto el fix visual/contractual del logo como el gate legal y el contexto de Helios.

## Decisiones de implementación

- Centralizar los textos legales y el copy del gate en un archivo compartido bajo `shared/` para reutilizarlos en frontend y backend.
- Evitar migración si es posible usando `consent_records` y `audit_logs` para la trazabilidad adicional dentro de `notes`, `subjectRole`, `legalBasis` y `afterState`.
- Integrar el estado legal al `workspace.bootstrap` para que `/auditar` sepa si debe abrir el modal al iniciar.
- Crear rutas dedicadas para Aviso de Privacidad y Términos, abiertas desde footer y gate.
- Extender `Configuración > Privacidad` dentro de `/auditar` como sección discreta colapsable, no como módulo protagonista.

## Riesgos a vigilar

- No prometer capacidades técnicas que el código aún no implementa realmente, especialmente cifrado, MFA/TOTP o rate limiting, salvo como contexto heredado solicitado.
- Mantener el tono jurídico accesible y no agresivo.
- No romper el flujo actual de bootstrap ni la carga del expediente.
