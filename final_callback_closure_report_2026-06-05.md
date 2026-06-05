# Cierre técnico final del flujo AuditaPatron → CompliLink

**Fecha:** 2026-06-05  
**Autor:** Manus AI

## Resumen ejecutivo

Se corrigió el flujo local y remoto necesario para que los despachos de AuditaPatron hacia CompliLink no se queden únicamente en el acuse HTTP inicial. La revalidación controlada del caso de **Jaime Santiago López** confirmó que el sistema ya despacha al endpoint canónico remoto con autenticación **Bearer**, usando los **IDs remotos válidos** confirmados para CompliLink, y que además **persiste localmente** los eventos de retorno transitorio mediante la ingestión del `currentResponseEvent` contenido en el acuse remoto.

En términos prácticos, el problema principal quedó resuelto en el lado del proyecto: **ya existen `compliLinkWebhookEvents` persistidos**, ya se generan eventos legibles en el expediente, y la correlación entre `documentId`, `sourceDocumentId`, `documentNumericId`, `traceId`, `correlationId` e `intakeId` quedó alineada para los eventos observados.

## Qué se corrigió

| Componente | Corrección aplicada | Resultado |
|---|---|---|
| Dispatch al bridge | Se consolidó el uso del endpoint remoto canónico `https://complilink.mx/api/integrations/auditapatron/bridge` con autenticación Bearer | El bridge remoto respondió con **HTTP 200** y acuse válido |
| Payload remoto | Se ajustaron `providerId`, `userId`, `workspaceId`, `documentId` numérico interno, `category` y `processingStatus` al contrato real aceptado por CompliLink | El upstream dejó de rechazar el payload por esquema o identidad |
| Contrato de acuse | Se adaptó el parseo y la validación del response contract real, incluyendo `responseContract` como objeto y cuerpos largos | El acuse remoto ya se considera válido y utilizable |
| Persistencia local de retorno | Se añadió ingestión inmediata del `currentResponseEvent` del acuse remoto y resolución ampliada del documento por múltiples claves | El expediente ahora registra localmente `document.retry_requested.v1` |
| Idempotencia de eventos | Se compactó `eventKey` al límite real de la tabla (`varchar(64)`) sin perder estabilidad | La inserción en `compliLinkWebhookEvents` dejó de fallar por longitud |
| Conciliación de identificadores | Se amplió la conciliación por `sourceDocumentId`, `documentNumericId`, `traceId`, `correlationId` e identificadores remotos | Los eventos ya se asocian al documento correcto |

## Evidencia principal de la revalidación

La corrida controlada más reciente del caso de Jaime dejó dos despachos exitosos hacia CompliLink y persistió dos eventos en `webhookEvents`.

| Documento | Dispatch remoto | Evento persistido localmente | Estado |
|---|---|---|---|
| CFDI de Jaime | HTTP 200 | `document.retry_requested.v1` | Persistido |
| Contrato de Jaime | HTTP 200 | `document.retry_requested.v1` | Persistido |

Además, la inspección posterior a la ventana corta mostró que el expediente ya presenta notas legibles del tipo **“Reintento solicitado por CompliLink”**, junto con la discrepancia salarial ya conocida y los eventos de envío a CompliLink.

## Lectura técnica del estado actual

El sistema ya no está roto en la parte que controlamos dentro de este proyecto. Lo que antes fallaba en cadena —endpoint incorrecto, autenticación, IDs remotos, contrato de acuse, longitud de `eventKey` y correlación documental— ya quedó corregido. Por eso ahora sí aparecen registros en `compliLinkWebhookEvents` y eventos de negocio en el expediente.

La señal observable más reciente que devuelve CompliLink sigue siendo **transitoria**: `document.retry_requested.v1`. Eso significa que, al menos en esta ventana de observación, el remoto no emitió todavía un evento final como `document.processed.v1` o `document.rejected.v1`. Sin embargo, el sistema local ya está preparado para persistirlo cuando llegue y ya no depende exclusivamente del webhook outbound final para ofrecer visibilidad operativa.

## Veredicto

> **El flujo quedó arreglado en el ámbito del proyecto:** AuditaPatron ya despacha correctamente, acepta el contrato real del bridge, persiste los eventos transitorios relevantes y los muestra en el expediente con correlación correcta.

> **Lo único no comprobado como hecho consumado en esta corrida es la llegada de un evento remoto final distinto de `retry_requested`.** Eso ya no se ve como una falla del proyecto, sino como el siguiente comportamiento a observar del lado operativo de CompliLink una vez que complete su siguiente ciclo.

## Artefactos de soporte

| Archivo | Propósito |
|---|---|
| `tmp_revalidate_jaime_case_output.json` | Evidencia cruda completa de la corrida controlada de Jaime |
| `tmp_inspect_jaime_callback_visibility_output.json` | Estado observable del expediente tras la ventana corta |
| `server/auditaPatronReturnWebhook.ts` | Correcciones de correlación, persistencia e idempotencia del retorno |
| `server/routers.ts` | Ingestión síncrona del `currentResponseEvent` tras el acuse remoto |

## Próximo paso operativo recomendado

Si se quiere cerrar también la observación remota final, conviene dejar una corrida adicional de seguimiento centrada en detectar si CompliLink emite posteriormente `document.processed.v1` o `document.rejected.v1` para estos mismos `remoteEventId`. Ese seguimiento ya no requiere rediseño del proyecto; requiere principalmente observación del comportamiento remoto.
