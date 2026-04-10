# Brief de contraste multi-IA: guardrails mínimos para `/auditar`

## Contexto verificado

AuditaPatron está en fase de **cierre y robustecimiento de V1**. Ya se blindó el bloque de exportes de la Consola CEO para impedir exportes cuando el snapshot esté stale, en error o refrescando. El siguiente frente abierto de mayor impacto es **preparar el flujo `/auditar` para una primera escala prudente**, pensando en miles de usuarios potenciales, pero sin abrir todavía un rediseño arquitectónico grande ni tocar la integración futura con Helios.

El stack actual es **TypeScript + backend tRPC/Express + Vitest**. El flujo `/auditar` tiene dos rutas pesadas en backend:

1. `cases.analyzeDocumentDraft`
2. `cases.uploadDocument`
3. `cases.confirmDocumentDraft`

Los dos primeros reciben archivos en base64, los suben a storage, ejecutan análisis preliminar, asistencia de escaneo y extracción estructurada. El tercero confirma una vista previa ya generada y dispara persistencia, contratos, auditoría y despacho al motor externo.

## Restricciones estrictas

- **No tocar la integración Helios** como frente separado. Solo se puede proteger el flujo actual sin cambiar su contrato externo.
- **No introducir infraestructura nueva obligatoria** como colas, Redis, workers separados o microservicios para esta iteración.
- **No rediseñar la arquitectura** ni abrir scope grande.
- **Sí se permiten** guardrails pequeños y pragmáticos de backend, validaciones operativas, rechazo temprano, límites básicos e instrumentación ligera.
- Debe priorizarse el **happy path estable**, claridad operativa y capacidad de soportar picos iniciales sin degradación severa.

## Lo que necesito que evalúes

Propón el **siguiente paquete mínimo exacto** que conviene implementar ya para endurecer `/auditar` ante uso concurrente alto y abuso básico, manteniendo bajo el riesgo de romper V1.

Debes evaluar especialmente estos candidatos:

- **Rate limiting básico** por usuario y/o IP en los endpoints más pesados de `/auditar`
- **Control de concurrencia básica** para evitar dobles envíos o tormentas de reintentos inmediatos sobre el mismo caso
- **Idempotencia pragmática** o deduplicación liviana cuando el mismo archivo o misma operación llegue varias veces casi al mismo tiempo
- **Rechazo temprano con mensajes claros** antes de consumir demasiado CPU/LLM/storage
- **Trazabilidad mínima** de intentos bloqueados o degradados para operación V1

## Respuesta requerida

Responde con estos cinco bloques y sé estricto:

1. **Cuál es el cambio más rentable e inmediato** para esta iteración y por qué.
2. **Paquete mínimo exacto de cambios** que implementarías ya, en no más de 5 cambios concretos.
3. **Qué dejarías conscientemente fuera** en esta V1 cercana.
4. **Qué riesgo reduce cada cambio** y cuál es el riesgo residual.
5. **Cómo evitar romper el happy path** mientras se añade este endurecimiento.

## Criterio de decisión

Quiero una recomendación que maximice:

- estabilidad operativa real
- costo/beneficio alto
- bajo riesgo de regresión
- utilidad para una primera escala prudente

Y que minimice:

- complejidad nueva
- dependencia en infraestructura adicional
- probabilidad de romper el flujo principal de subida/análisis documental
