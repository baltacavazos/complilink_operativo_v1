# Revalidación end-to-end de Héctor Jovane Ortiz Hernández

## Resumen ejecutivo

Se ejecutó una **revalidación punta a punta real** del expediente de **Héctor Jovane Ortiz Hernández** dentro de CompliLink Operativo V1 usando un CFDI XML timbrado y el contrato laboral en formato DOCX. La corrida creó un expediente nuevo, clasificó ambos documentos, generó opinión inicial de Helios para cada uno y despachó ambos artefactos al bridge remoto con respuesta **HTTP 202** en los dos envíos. En consecuencia, el flujo operativo principal quedó **funcional** para este trabajador.

Desde el punto de vista documental, el caso vuelve a mostrar el mismo patrón observado en trabajadores previos: los identificadores personales y laborales duros son consistentes entre contrato y CFDI, pero existe una **discrepancia material** entre el salario diario contractual y el **SBC/SDI** reportado en los CFDI. Por ello, el veredicto final del caso no es de bloqueo operativo, sino de **éxito técnico con reserva jurídica/documental**.

## Evidencia documental revisada

| Componente | Dato confirmado |
|---|---|
| Trabajador | **HÉCTOR JOVANE ORTIZ HERNÁNDEZ** |
| RFC | **OIHH850612NS2** |
| CURP | **OIHH850612HDFRRC01** |
| NSS | **01038527295** |
| Patrón | **EVOLUCION CREATIVA CAMREFLEX** |
| RFC patrón | **ECC190605VA1** |
| Registro patronal | **R1379389106** |
| Puesto contractual | **VIGILANCIA** |
| Fecha de inicio laboral | **2023-09-01** |
| Cuenta bancaria | **1577189636** |
| Salario diario en contrato | **$207.44** |
| SBC / SDI en CFDI | **$331.45** |
| Total quincenal en CFDI | **$4,725.60** |
| Deducción visible recurrente | **PAGO INFONAVIT $530.99** |

La evidencia documental es consistente en los campos críticos de identidad y relación laboral. Los tres CFDI corresponden a quincenas consecutivas de abril y mayo de 2026 y conservan montos uniformes, lo que refuerza la trazabilidad del expediente. La única reserva relevante vuelve a ser la diferencia entre lo pactado en el contrato y lo timbrado/registrado como base de cotización en CFDI.

## Consenso multi-modelo

Se reconstruyó el contraste con **ChatGPT, Grok y Gemini** usando las API keys configuradas del proyecto. Los tres modelos coincidieron en que el expediente se encuentra **documentalmente consistente, pero con advertencia**, y que la corrida estaba **lista con reservas**.

| Modelo | Veredicto documental | Preparación final | Coincidencias principales |
|---|---|---|---|
| ChatGPT | **warning** | **ready_with_caveats** | Consistencia fuerte en RFC, CURP, NSS, cuenta, fechas y periodicidad; alerta por salario contractual vs SBC/SDI |
| Grok | **warning** | **ready_with_caveats** | Consistencia total de identidad y periodos; foco en discrepancia salarial y propagación correcta al bridge |
| Gemini | **warning** | **ready_with_caveats** | Coincidencia plena de datos personales y laborales; recomienda alertar y gobernar explícitamente la precedencia salarial |

El consenso multi-modelo fue especialmente útil para separar dos capas. En la capa **operativa**, los modelos consideraron viable correr el flujo completo. En la capa **jurídico-documental**, los tres recomendaron tratar la brecha salarial como un hallazgo persistente que debe visibilizarse y no normalizarse silenciosamente.

## Resultados de la corrida operativa real

La corrida se ejecutó con origen administrativo interno hacia el tenant **balt-1**, creando el expediente **CASE-BALT-1-MPQ0AJXA**. El sistema persistió el caso, cargó el XML, lo clasificó como **cfdi / cfdi_nomina**, generó una opinión inicial de Helios y despachó el documento al bridge remoto. Después hizo lo mismo con el contrato DOCX, clasificándolo como **contract / contrato_laboral**. Ambos envíos fueron aceptados por el bridge con **HTTP 202**.

| Hito operativo | Resultado |
|---|---|
| Creación del expediente | **OK** |
| Case ID | **CASE-BALT-1-MPQ0AJXA** |
| XML CFDI cargado | **OK** |
| Tipo XML detectado | **cfdi / cfdi_nomina** |
| Confianza de clasificación XML | **91** |
| Contrato DOCX cargado | **OK** |
| Tipo contrato detectado | **contract / contrato_laboral** |
| Confianza de clasificación contrato | **84** |
| Opinión inicial de Helios sobre XML | **OK** |
| Opinión inicial de Helios sobre contrato | **OK** |
| Dispatch XML al bridge | **OK / HTTP 202** |
| Dispatch contrato al bridge | **OK / HTTP 202** |
| Persistencia en `case_documents` | **2 documentos** |
| Persistencia en `case_events` | **9 eventos** |
| Persistencia en `complilink_webhook_events` dentro de 5s | **0 eventos** |

La evidencia operacional confirma que el flujo principal sigue respondiendo como se esperaba después del endurecimiento previo del bridge. En particular, los dos eventos de despacho quedaron registrados como enviados exitosamente al host remoto objetivo, ambos apuntando a **`auditapatron.com/api/auditapatron/webhook`**.

## Evidencia de bridge y Helios

| Documento | Document ID | Dispatch ID | Correlation ID | HTTP | Resultado |
|---|---|---|---|---|---|
| CFDI XML | **DOC-43F098BDDE984FA5** | **669115b4-8927-4377-bd72-d20b8dca98d7** | **de0a9f33-e21b-4e06-ba16-8e2175b44d03** | **202** | Bridge aceptó el documento |
| Contrato DOCX | **DOC-595758A422254588** | **4f61af3c-6575-41f0-b2d3-3915e4091eef** | **d466fe3f-a6e9-4067-ade1-a4bf0ef8ef3a** | **202** | Bridge aceptó el documento |

A nivel de timeline, el expediente registró los eventos esperables para una corrida sana: creación de caso, carga documental, clasificación automática, nota de escaneo asistido, opinión inicial de Helios y nota de envío a CompliLink. No se observó rechazo por formato ni ruptura contractual del bridge en ninguno de los dos documentos cargados.

## Observación sobre retorno asíncrono

Dentro de la ventana corta de observación usada en esta sesión, la tabla **`complilink_webhook_events`** permaneció vacía para el caso. Esto reproduce el patrón ya visto en pruebas previas: el bridge **acepta** los documentos y devuelve acuse contractual correcto, pero el **callback asíncrono final no aparece** todavía dentro de los primeros segundos observados.

Esta ausencia no invalida la corrida, porque el acuse remoto y los eventos locales sí prueban que el envío salió correctamente. Sin embargo, sigue siendo un hueco operacional importante para la trazabilidad completa del circuito de retorno.

## Veredicto final

El caso de **Héctor Jovane Ortiz Hernández** queda **revalidado operativamente**. El expediente se creó, ambos documentos se clasificaron, Helios emitió opinión inicial para XML y contrato, y el bridge remoto aceptó los dos despachos con **HTTP 202**. Bajo ese criterio, la conexión **Helios ↔ bridge ↔ conectores** permanece funcional para este trabajador.

El veredicto documental es **warning / ready_with_caveats**. La reserva no nace de una falla del sistema, sino de una discrepancia consistente entre el salario diario del contrato (**$207.44**) y el **SBC/SDI** de los CFDI (**$331.45**). Dado que este patrón ya apareció en trabajadores anteriores del mismo patrón, lo razonable es tratarlo como un hallazgo sistémico de negocio y compliance, no como un bug puntual del flujo técnico.

## Recomendaciones siguientes

La prioridad inmediata es conservar este caso como **evidencia de éxito técnico** y, al mismo tiempo, usarlo para robustecer dos controles ya sugeridos por el patrón observado. Primero, conviene implementar una **alerta automática de discrepancia salarial** cuando el salario contractual y el SBC/SDI del CFDI diverjan por arriba del umbral permitido. Segundo, conviene instrumentar un **monitoreo explícito del callback asíncrono**, con timeout, bitácora y alerta visible cuando el bridge acepte el documento pero el retorno no llegue en la ventana esperada.

## Archivos de evidencia

| Archivo | Descripción |
|---|---|
| `hector_revalidation_report.md` | Informe final legible del caso |
| `tmp_revalidate_hector_case_output.json` | Evidencia cruda de la corrida end-to-end |
| `tmp_hector_multi_model_review_output.json` | Consenso multi-modelo de ChatGPT, Grok y Gemini |
| `tmp_revalidate_hector_case.mts` | Script interno usado para la corrida operativa |
| `tmp_hector_multi_model_review.py` | Script usado para el contraste multi-modelo |
