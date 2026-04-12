# Mensaje para el otro chat: cierre de conexión del bridge AuditaPatrón → CompliLink

**Autor:** Manus AI  
**Proyecto:** CompliLink Operativo V1  
**Objetivo:** dejar listo un mensaje único, claro y técnico para pegar en el otro chat de Auditapatrón y cerrar la conexión real del bridge con CompliLink.

## Contexto breve

De este lado, en CompliLink, la alineación contractual del bridge ya quedó implementada. Esto significa que el sistema ya fue ajustado para emitir el payload saliente bajo el contrato final, autenticar la llamada según el esquema acordado, manejar la idempotencia con la clave contractual esperada, aceptar el catálogo nuevo de eventos de retorno y normalizar el acuse HTTP enriquecido. Además, las pruebas dirigidas del bridge pasaron y el proyecto quedó sin errores de TypeScript.

Aun así, la conexión **no debe darse por concluida solamente con eso**, porque para cerrar la integración real falta confirmar que el otro lado, Auditapatrón, también quedó desplegado con el mismo contrato, el mismo secreto efectivo y el endpoint correcto. Por eso, lo que sigue es enviar un mensaje preciso al otro chat y pedir una confirmación operativa puntual.

## Texto exacto para pegar en el otro chat

> Ya quedó alineado en CompliLink el contrato final del bridge AuditaPatrón → CompliLink. De este lado ya estamos enviando y recibiendo bajo el contrato final, con autenticación actualizada, idempotencia contractual y acuse HTTP enriquecido.
>
> El lado CompliLink ya quedó preparado para trabajar con este catálogo de eventos de retorno:
>
> - `document.processed.v1`
> - `document.rejected.v1`
> - `document.retry_requested.v1`
>
> También quedó alineado el payload saliente para incluir los campos operativos y contractuales esperados, incluyendo autenticación por `Bearer`, encabezado espejo `x-auditapatron-token`, firma `x-auditapatron-signature`, `eventId`, `idempotencyKey`, `correlationId` y acuse bajo el contrato `auditapatron.bridge.ack.v1`.
>
> Necesito que me confirmen, de su lado, estos cinco puntos:
>
> 1. Que Auditapatrón ya está desplegado con el contrato final compatible.
> 2. Que el endpoint activo es el correcto y está recibiendo desde CompliLink.
> 3. Que el secreto compartido o mecanismo efectivo de autenticación coincide exactamente con el que ya está configurado en CompliLink.
> 4. Que el webhook de retorno de Auditapatrón ya emite exclusivamente `document.processed.v1`, `document.rejected.v1` y `document.retry_requested.v1`.
> 5. Que podemos correr una prueba end-to-end o una prueba smoke con un documento real o controlado para validar envío, acuse y retorno.
>
> Si detectan cualquier diferencia en payload, headers, firma, acuse o nombres de evento, por favor compártanla en formato exacto para corregirla y cerrar la conexión de punta a punta.

## Lo que deben confirmar en el otro chat

La mejor forma de cerrar esta conversación es pedir una respuesta estructurada. No hace falta que el otro chat responda con explicación larga; basta con que confirme de manera exacta qué ya está desplegado y qué falta. El objetivo es eliminar ambigüedad técnica y saber si la conexión está realmente viva o solamente preparada de un lado.

| Punto a confirmar | Qué deben responder | Criterio para considerarlo resuelto |
|---|---|---|
| Contrato final desplegado | Si el lado Auditapatrón ya usa el contrato definitivo | Deben responder explícitamente que sí, o indicar la diferencia exacta |
| Endpoint activo | URL o ruta activa del receptor | Debe coincidir con la configuración esperada y estar accesible |
| Autenticación | Esquema efectivo de validación | Deben confirmar secreto, bearer, token espejo y/o firma según implementación real |
| Eventos de retorno | Lista exacta de eventos emitidos | Deben ser `document.processed.v1`, `document.rejected.v1` y `document.retry_requested.v1` |
| Prueba de punta a punta | Disponibilidad para prueba real o smoke | Deben aceptar una prueba controlada y definir qué dato usarán |

## Qué ya quedó alineado en CompliLink

Para evitar confusiones, conviene que el otro chat sepa exactamente qué quedó de este lado. Eso reduce el intercambio innecesario y les permite comparar su implementación contra un checklist concreto.

| Componente | Estado en CompliLink | Observación práctica |
|---|---|---|
| Payload saliente | Alineado | Incluye campos contractuales y operativos esperados |
| Autenticación saliente | Alineada | Se envía `Authorization: Bearer ...` y `x-auditapatron-token` |
| Firma saliente | Alineada | Se envía `x-auditapatron-signature` |
| Idempotencia | Alineada | Se usa `eventId` y `idempotencyKey` coherentes |
| Acuse HTTP | Alineado | Se soporta `auditapatron.bridge.ack.v1` |
| Webhook de retorno | Alineado | Acepta el catálogo nuevo de eventos v1 |
| Observabilidad interna | Alineada | El monitoreo del router ya reconoce los eventos finales |
| Pruebas dirigidas | Aprobadas | Pasaron las pruebas específicas de integración y retorno |

## Qué deben pedirle exactamente al otro chat si responden de forma ambigua

Si el otro chat responde con un “sí, ya quedó” pero sin precisión, conviene pedir una confirmación mínima adicional. El mensaje recomendado es el siguiente.

> Gracias. Para cerrar la conexión de forma verificable, necesito su confirmación explícita de cuatro datos exactos: endpoint activo, esquema de autenticación vigente, catálogo exacto de eventos emitidos y si autorizan una prueba end-to-end de smoke. Si alguno de esos cuatro puntos difiere, compártanme el valor exacto.

## Prueba mínima que conviene pedir

La integración debe cerrarse con una validación breve, no solo con confirmaciones verbales. La prueba ideal es un documento de smoke o un documento real controlado, enviado desde CompliLink, que reciba acuse correcto y luego produzca uno de los eventos de retorno ya normalizados. Lo importante no es el documento en sí, sino validar que el circuito completo responde con el contrato correcto en ambos sentidos.

| Etapa | Qué debe pasar | Señal de éxito |
|---|---|---|
| Envío desde CompliLink | Sale la solicitud con payload y headers alineados | Auditapatrón confirma recepción válida |
| Acuse inicial | Auditapatrón devuelve acuse contractual | Se recibe `auditapatron.bridge.ack.v1` o equivalente esperado |
| Procesamiento | Auditapatrón procesa o simula el documento | Se produce trazabilidad con `correlationId` o equivalente |
| Retorno | Llega uno de los eventos v1 acordados | CompliLink registra `document.processed.v1`, `document.rejected.v1` o `document.retry_requested.v1` |
| Cierre | Ambas partes coinciden en el resultado | Se declara conexión operativa de punta a punta |

## Señal clara de que la conexión ya quedó realmente cerrada

La conexión puede darse por concluida cuando el otro chat confirme que su lado está desplegado con el contrato final, valide que el secreto y el endpoint activos son los correctos y acepte o ejecute una prueba de punta a punta con retorno exitoso. Antes de eso, lo correcto es decir que **la integración está alineada y preparada en CompliLink, pero pendiente de confirmación operativa del lado Auditapatrón**.

## Recomendación de uso

Lo más práctico es copiar primero el bloque de “Texto exacto para pegar en el otro chat”. Si la respuesta del otro lado llega incompleta, entonces se usa el bloque de seguimiento y se exige la confirmación estructurada. De esa forma, la conversación termina con evidencia concreta y no con una impresión ambigua de que “ya quedó”.
