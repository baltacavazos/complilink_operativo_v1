# Diseño técnico comparado · Agenda automática y presets del bridge CEO

## Síntesis comparada

Se contrastaron tres propuestas externas antes de implementar. **OpenAI**, **Gemini** y **xAI** coinciden en separar la solución en dos entidades: una para **presets reutilizables** y otra para **agendas automáticas**. También coinciden en no rehacer la UI existente, mantener la **auditoría** actual como fuente de trazabilidad y reutilizar el flujo ya existente de exportación/envío del bloque bridge.

La divergencia principal está en el nivel de complejidad inicial. Gemini propone un modelo más amplio con CRUD completo, `nextRunAt`, `status` y un worker desacoplado. OpenAI propone algo intermedio con `cron_expression` y ejecución periódica. xAI propone la variante más incremental: tablas nuevas, cron ligero en backend y UI mínima integrada a los botones actuales.

## Decisión de implementación para esta iteración

Se implementará una versión **incremental y compatible con el código actual**, tomando como base el consenso de los tres modelos y adaptándolo al proyecto existente:

| Decisión | Justificación |
| --- | --- |
| Crear tabla `ceo_bridge_presets` | Los tres modelos recomiendan persistir presets separados del flujo actual para no duplicar lógica ni perder reutilización. |
| Crear tabla `ceo_bridge_schedules` | Hay consenso en separar la programación automática del preset para permitir reuso y activación/desactivación independiente. |
| Mantener claves `int` para `userId` y `varchar(64)` para `tenantId` | Así se alinea con `users.id` y `tenants.tenantId` reales del esquema actual. |
| Guardar filtros y destinatarios como JSON serializado en `text` | El proyecto actual usa MySQL/Drizzle con patrones de serialización en texto; esto evita introducir un patrón nuevo innecesario. |
| Persistir también `smokeThreshold` dentro del preset | Tanto Gemini como xAI sugieren incluir el umbral del bridge para reproducir la vista exportada. |
| Añadir `nextRunAt`, `lastRunAt`, `lastRunStatus` y `isActive` en agendas | Permite idempotencia, observabilidad básica y ejecución manual sin depender solo de cron raw. |
| Reutilizar auditoría existente con nuevas acciones `dashboard.ceo.bridge_*` | Mantiene trazabilidad homogénea con `dashboard.ceo.export_generated` y `dashboard.ceo.export_emailed`. |
| Extender la UI con modales/controles mínimos, sin rehacer filtros ni botones superiores | Coincide con el objetivo del usuario y el consenso de los tres modelos. |

## Modelo seleccionado

### Tabla de presets

La tabla `ceo_bridge_presets` almacenará:

- `id`
- `userId`
- `tenantId` opcional
- `name`
- `description` opcional
- `filtersJson`
- `exportFormat`
- `emailRecipientsJson`
- `emailMessage`
- `smokeThreshold`
- `createdAt`
- `updatedAt`

### Tabla de agendas

La tabla `ceo_bridge_schedules` almacenará:

- `id`
- `presetId`
- `userId`
- `tenantId` opcional
- `cronExpression`
- `timezone`
- `nextRunAt`
- `lastRunAt`
- `lastRunStatus`
- `lastRunError`
- `isActive`
- `createdAt`
- `updatedAt`

## Contrato backend previsto

Se añadirá un grupo de procedimientos tRPC para el dashboard CEO bridge:

| Procedimiento | Tipo | Objetivo |
| --- | --- | --- |
| `ceoBridgePresets` | query | Listar presets visibles del usuario actual |
| `ceoCreateBridgePreset` | mutation | Guardar la configuración actual del bridge como preset |
| `ceoUpdateBridgePreset` | mutation | Editar nombre, filtros, formato, correo o umbral |
| `ceoDeleteBridgePreset` | mutation | Eliminar preset no bloqueado por agendas dependientes |
| `ceoBridgeSchedules` | query | Listar agendas del usuario actual |
| `ceoCreateBridgeSchedule` | mutation | Crear agenda automática a partir de un preset |
| `ceoUpdateBridgeSchedule` | mutation | Editar frecuencia, activación o destinatarios efectivos |
| `ceoDeleteBridgeSchedule` | mutation | Eliminar agenda |
| `ceoRunBridgeScheduleNow` | mutation | Ejecutar manualmente una agenda y registrar auditoría |

## Criterios de ejecución automática

En esta iteración, la agenda quedará modelada y operable desde backend con lógica de cálculo de próxima ejecución e invocación manual inmediata. Si el servidor actual no ofrece un worker permanente fiable para cron residente, se dejará la ejecución periódica preparada a nivel de datos y procedimientos, manteniendo la **ejecución manual inmediata** y la **compatibilidad futura** con polling/worker.

## Guardrails adoptados

| Regla | Aplicación |
| --- | --- |
| Máximo 5 destinatarios | Se preserva la restricción ya presente en `ceoEmailBridgeExport`. |
| Snapshot fresco obligatorio | Se conserva el guardrail actual del dashboard CEO para evitar envíos con vista obsoleta. |
| Ownership por usuario/tenant | Cada preset y agenda se filtrará por `userId` y, cuando aplique, `tenantId`. |
| Auditoría obligatoria | Crear, editar, eliminar y ejecutar agendas/presets generará eventos de auditoría dedicados. |
| UI incremental | Se evita rehacer exportación, PDF/CSV y filtros existentes. |

## Conclusión operativa

La versión a implementar combinará la sobriedad incremental sugerida por **xAI**, la separación clara de entidades propuesta por **OpenAI** y la capacidad de evolución futura sugerida por **Gemini**. El resultado buscado es una primera entrega sólida: persistencia real, presets reutilizables, agendas trazables y mínima fricción sobre el flujo CEO actual.
