# Consulta técnica para el otro chat de CompliLink

**Fecha:** 2026-04-12  
**Proyecto:** Bridge AuditaPatrón → CompliLink  
**Estado actual:** La fase 1 del lado AuditaPatrón ya quedó encaminada con correlación estable entre salida y retorno, persistencia mínima para deduplicación de eventos de vuelta y trazabilidad suficiente para enlazar dispatch y webhook de retorno. El tema de Dropbox está deliberadamente fuera de alcance y no debe bloquear esta coordinación.

Necesito confirmar con ustedes las definiciones externas que faltan del lado CompliLink para poder continuar sin introducir supuestos equivocados en el bridge. La idea es cerrar el contrato operativo, el comportamiento esperado ante duplicados y el formato canónico de las respuestas que CompliLink emitirá hacia AuditaPatrón.

## Confirmaciones requeridas

| Tema | Qué necesitamos que confirmen | Por qué importa |
| --- | --- | --- |
| Contrato del webhook de retorno | URL definitiva, método HTTP, headers obligatorios, tipo de autenticación o firma, y estructura exacta del body | Esto define el acoplamiento final del retorno y evita romper compatibilidad cuando activemos el flujo completo |
| Catálogo de eventos | Lista exacta de eventos o estados que CompliLink puede devolver, con nombre canónico y significado operativo | Necesitamos mapear esos estados a la auditoría y a la persistencia interna sin ambigüedades |
| Regla de idempotencia | Qué campo consideran llave canónica de deduplicación, cuánto tiempo esperan que se conserve y qué debe ocurrir si llega el mismo evento más de una vez | Ya dejamos preparada una base mínima de idempotencia, pero debe alinearse con la semántica real de CompliLink |
| Ejemplos canónicos | Un ejemplo realista de éxito, uno de rechazo funcional y uno de reintento o error transitorio | Esto permite fijar pruebas, validaciones y observabilidad sin depender de supuestos |

## Preguntas concretas para responder

Por favor confirmen si el retorno de CompliLink debe reutilizar el mismo **correlationId** del envío saliente o si habrá además un identificador propio de evento remoto. También necesitamos saber si la deduplicación debe hacerse por **correlationId**, por **eventId remoto**, o por una combinación de ambos. Si existe una firma HMAC u otro esquema de autenticación en el webhook de retorno, necesitamos el nombre exacto del header, el string base que se firma y cualquier convención especial de serialización.

En la parte funcional, confirmen qué estados de negocio consideran finales y cuáles consideran reintentables. Por ejemplo, necesitamos distinguir entre un rechazo definitivo, un error transitorio del servicio y una respuesta aceptada pero pendiente de procesamiento. Esa separación es importante porque desde AuditaPatrón ya estamos enlazando trazabilidad técnica con estados operativos.

## Formato ideal de respuesta

Pueden responder en una sola tabla con esta estructura.

| Campo | Ejemplo |
| --- | --- |
| Event name | `document.processed` |
| Final o transitorio | `final` |
| Reintenable | `sí` |
| Llave de idempotencia | `eventId` |
| CorrelationId esperado | `sí, eco exacto del saliente` |
| Auth/Firma | `x-signature HMAC-SHA256 sobre raw body` |
| Payload de ejemplo | `{ ... }` |

## Mensaje breve para copiar y pegar

Necesitamos cerrar cuatro definiciones del lado CompliLink para continuar el bridge sin supuestos: **1)** contrato final del webhook de retorno, **2)** catálogo de eventos y estados, **3)** regla canónica de idempotencia y deduplicación, y **4)** ejemplos de éxito, rechazo y error transitorio. También confirmen si el retorno debe traer el mismo `correlationId` del dispatch saliente, si además existirá un `eventId` remoto, y cuál de esos campos debe gobernar la deduplicación. Si usan firma, compartan header, algoritmo y base string exactos.

## Nota de alcance

Esta consulta no incluye Dropbox. Ese tema queda pendiente por separado y no debe mezclarse con esta definición del bridge.
