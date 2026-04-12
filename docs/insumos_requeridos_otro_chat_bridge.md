# Datos exactos requeridos del otro chat para cerrar el bridge AuditaPatrón → CompliLink

**Fecha:** 2026-04-12  
**Autor:** Manus AI

En este punto, la parte interna del bridge ya quedó estabilizada a nivel local: la persistencia idempotente está lista, la migración quedó reparada y la prueba del webhook duplicado ya pasó. Para continuar, ya no necesito más contexto general del otro chat; lo que hace falta ahora es **definir el contrato externo final** entre ambos lados. Este documento resume, con precisión, qué información necesito que el otro chat me entregue.

## Lo que sí necesito

| Bloque | Dato exacto que necesito | Para qué se usa | Formato ideal |
|---|---|---|---|
| 1 | **Catálogo final de eventos** que el otro lado va a emitir o reconocer | Cerrar los nombres canónicos del bridge y evitar ambigüedad entre implementación y pruebas | Tabla con `event_type`, descripción y cuándo se dispara |
| 2 | **Payload JSON exacto por evento** | Alinear campos obligatorios, opcionales, tipos y nombres finales | Un JSON por cada `event_type` |
| 3 | **Reglas de idempotencia y duplicados** | Confirmar qué campo identifica de forma única un evento y qué debe pasar si llega dos o más veces | Texto breve con `event_id`, clave idempotente y comportamiento esperado |
| 4 | **Política de reintentos** | Definir cómo debe reaccionar cada lado ante errores temporales o fallos parciales | Tabla con condición, número de reintentos y backoff |
| 5 | **Respuestas esperadas del receptor** | Cerrar el contrato HTTP del webhook y los criterios de aceptación/rechazo | Tabla con `status_code`, cuerpo de respuesta y significado |
| 6 | **Ejemplo completo de éxito** | Poder validar un flujo real extremo a extremo sin supuestos | Un request y un response completos |
| 7 | **Ejemplo completo de error** | Cubrir manejo realista de errores y pruebas negativas | Un request y un response completos |
| 8 | **Headers y firma definitivos**, si el otro chat los define | Confirmar autenticación, verificación y canonicalización del request | Lista de headers, algoritmo y ejemplo de firma |
| 9 | **Mapeo funcional mínimo** entre evento y efecto esperado en CompliLink | Verificar que la semántica del evento coincida con la acción destino | Tabla corta: evento → efecto esperado |

## Lo que sería suficiente para seguir sin bloquearme

Si el otro chat no quiere mandar documentación extensa, me basta con que entregue **estos cinco mínimos**: el catálogo final de eventos, un JSON exacto por evento, la regla de idempotencia, la política de reintentos y un ejemplo de éxito y otro de error. Con eso ya puedo seguir cerrando el contrato funcional del bridge con una base suficientemente estable.

## Lo que no necesito en este momento

No necesito una explicación larga de arquitectura, contexto histórico del otro chat, decisiones de interfaz, textos comerciales ni una reescritura completa del sistema. Tampoco necesito ideas generales sobre integración. En esta fase solo necesito los **datos contractuales finales** que permitan fijar el comportamiento entre ambos extremos sin seguir trabajando con supuestos.

## Texto listo para copiar y pegar al otro chat

> Compárteme únicamente el contrato externo final del bridge. Necesito: (1) catálogo final de eventos; (2) payload JSON exacto por cada evento; (3) regla de idempotencia y manejo de duplicados; (4) política de reintentos; (5) respuestas HTTP esperadas del receptor; (6) un ejemplo completo de éxito; (7) un ejemplo completo de error; y (8) headers o firma definitivos si aplican. No necesito contexto general ni arquitectura, solo la definición contractual final para alinear implementación y pruebas.

## Entregable ideal del otro chat

| Sección | Contenido esperado |
|---|---|
| Eventos | Lista final y estable de `event_type` |
| Contratos JSON | Un bloque JSON por cada evento |
| Idempotencia | Campo único y conducta frente a duplicados |
| Reintentos | Cuándo reintentar y cuándo cortar |
| HTTP | Códigos esperados y cuerpo de respuesta |
| Casos ejemplo | Un caso exitoso y uno fallido completos |
| Seguridad | Headers, firma y validaciones si aplican |

Con esta información podré continuar de inmediato con el cierre funcional del bridge entre ambos chats, endurecer las pruebas de integración y evitar retrabajo posterior.
