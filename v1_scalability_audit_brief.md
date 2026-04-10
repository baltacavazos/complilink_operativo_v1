# Brief de priorización interna AuditaPatron V1

Contexto: Helios sigue en desarrollo y su integración queda explícitamente fuera de este bloque. Debemos seguir fortaleciendo sólo AuditaPatron para acercar el cierre de V1. El usuario pide preparar la plataforma para uso potencial de miles de personas, pero sin abrir un rediseño grande ni introducir infraestructura nueva innecesaria en esta fase.

Estado actual resumido:

- El flujo `/auditar` ya recibió un endurecimiento reciente en validaciones, expiración de preview y bloqueo de re-confirmaciones.
- La Consola CEO ya tiene guardrails visibles para acciones ejecutivas cuando el snapshot está stale, en error o refrescando.
- Aun así, hay una duda puntual: los exportes ejecutivos del CEO podrían seguir habilitados en escenarios donde la vista no sea confiable, y eso podría producir decisiones o reportes operativos con datos viejos.
- También queremos identificar el siguiente bloque interno de mayor impacto para robustez inicial frente a crecimiento a miles de usuarios, sin depender todavía del motor Helios.

Tu tarea:

1. Prioriza solamente los siguientes dos frentes y di cuál debe hacerse primero:
   - A) Blindar exportes del Dashboard CEO para bloquear CSV/PDF cuando el snapshot esté stale, en error o refrescando.
   - B) Introducir un bloque pequeño de robustez/escalabilidad interna para AuditaPatron orientado a uso potencial por miles de personas.

2. Si eliges B como prioritario, debes concretarlo en cambios pequeños y realistas para esta V1. No propongas microservicios, colas complejas ni re-arquitecturas mayores si no son indispensables.

3. Evalúa el riesgo real de cada frente con este marco:
   - severidad para salida V1
   - probabilidad de fallo operativo
   - impacto en confianza del usuario
   - costo/beneficio de implementación inmediata

4. Responde con:
   - prioridad 1
   - prioridad 2
   - justificación breve pero estricta
   - el paquete mínimo exacto de cambios que recomiendas implementar ya
   - riesgos que conscientemente dejarías fuera para una V1 cercana

Restricciones:

- No expandas alcance.
- No propongas features cosméticas.
- No dependas de Helios.
- Piensa como auditor técnico de release V1 con criterio estricto de estabilidad, claridad operativa y escalabilidad prudente.
