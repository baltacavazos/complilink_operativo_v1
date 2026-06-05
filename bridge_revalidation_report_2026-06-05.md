# Revalidación del bridge AuditaPatron → CompliLink

## Resumen ejecutivo

La revalidación con los datos remotos confirmados de CompliLink **sí destrabó el dispatch principal**. El envío ya sale al endpoint canónico `https://complilink.mx/api/integrations/auditapatron/bridge`, autenticado con **Bearer**, usando los identificadores remotos válidos confirmados para CompliLink: **`providerId=30001`** y **`userId=1`**. Además, el sistema local ya acepta correctamente el **contrato real de acuse** que devuelve CompliLink, incluso cuando `responseContract` llega como objeto largo y no como cadena simple.

La corrida controlada del caso de **Jaime Santiago López** mostró dos despachos exitosos, uno para CFDI y otro para contrato, ambos con **HTTP 200** y `status: "sent"`. El acuse remoto dejó `documentId` remotos nuevos, `remoteEventId` y un evento de negocio transitorio **`document.retry_requested.v1`** para ambos documentos. Por tanto, el bloqueo original de configuración, autenticación y payload **sí quedó corregido**.

La parte que **aún no quedó cerrada al 100%** es la persistencia local del **callback asíncrono final** en `compliLinkWebhookEvents`. En la ventana corta de observación posterior al dispatch, CompliLink todavía no envió un evento final persistido de vuelta al webhook local; solo quedó el acuse transitorio embebido en la respuesta síncrona y los eventos locales de “Documento enviado a CompliLink”.

## Qué se corrigió

| Componente | Estado previo | Estado después de la corrección |
|---|---|---|
| Endpoint remoto del bridge | Ruta pública equivocada o ambigua | `https://complilink.mx/api/integrations/auditapatron/bridge` |
| Autenticación del dispatch | Pruebas con esquema no alineado | `Authorization: Bearer <shared-secret>` |
| Identidad remota | IDs locales o no reconocidos | `providerId=30001`, `userId=1` |
| Payload mínimo | Formato parcialmente incompatible | `documentId` numérico interno, categorías aceptadas y `processingStatus` válido |
| Validación local del acuse | Rechazaba el contrato real del upstream | Ya acepta el contrato remoto real de CompliLink |
| Parseo del acuse | Se rompía por truncar JSON largo antes de parsear | Ya parsea el body crudo y luego sanitiza para observabilidad |

## Evidencia operativa principal

| Documento | Resultado del dispatch | HTTP | `remoteEventId` | Estado devuelto por CompliLink |
|---|---|---:|---|---|
| CFDI Jaime | `sent` | 200 | `clx-document-retry_requested-v1-provider-30001-document-210005-trace-balt-1-CASE-BALT-1-MQ16PGFO-mq16pgfoz2bi63` | `document.retry_requested.v1` |
| Contrato Jaime | `sent` | 200 | `clx-document-retry_requested-v1-provider-30001-document-210006-trace-balt-1-CASE-BALT-1-MQ16PGFO-mq16pgfoz2bi63` | `document.retry_requested.v1` |

## Estado del expediente tras la revalidación

El expediente de Jaime conservó correctamente la **alerta de discrepancia salarial** con diferencia de **59.78%** entre salario contractual diario (**207.44**) y SDI reportado (**331.45**). También quedaron persistidos los eventos locales de trazabilidad que prueban que cada documento fue enviado a CompliLink con éxito.

Sin embargo, al inspeccionar el expediente después de una ventana adicional, el arreglo `webhookEvents` seguía vacío. En otras palabras, **el dispatch ya quedó funcional**, pero la devolución asíncrona final del proveedor remoto **todavía no aterriza** en el webhook local dentro de la ventana observada.

## Interpretación técnica

> El problema original ya no es el dispatch local ni la autenticación ni el endpoint remoto. El punto pendiente está en el siguiente tramo del ciclo: **CompliLink aceptó el documento y respondió con un acuse transitorio, pero aún no ha ejecutado —o no ha terminado de ejecutar— el webhook outbound final hacia `https://auditapatron.com/api/auditapatron/complilink-webhook`.**

Esto cambia el diagnóstico: antes había una falla de integración. Ahora ya existe una integración funcional que llega hasta el bridge remoto real; lo pendiente es la **entrega o emisión del evento asíncrono final** después del estado `retry_requested`.

## Próximo paso recomendado

El siguiente paso correcto ya no es reconfigurar el dispatch, sino **instrumentar y esperar el callback final** del evento remoto posterior al `retry_requested`, o pedir al equipo remoto de CompliLink que confirme qué condición debe cumplirse para que emita el webhook outbound final. La evidencia disponible sugiere que el bridge remoto sí recibió y registró ambos documentos.

## Archivos de soporte

| Archivo | Propósito |
|---|---|
| `tmp_revalidate_jaime_case_output.json` | Evidencia cruda completa de la corrida controlada |
| `tmp_inspect_jaime_callback_visibility_output.json` | Verificación posterior de alertas y eventos locales |
| `server/auditaPatronIntegrationService.ts` | Ajustes al dispatch, payload y validación del acuse |
| `server/auditaPatronIntegrationService.test.ts` | Cobertura unitaria del adaptador y del contrato de acuse |
