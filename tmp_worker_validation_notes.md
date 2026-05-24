# Notas de validación del caso Jaime Santiago López

## Hallazgos documentales previos

Los tres XML muestran consistencia entre sí: trabajador **JAIME SANTIAGO LOPEZ**, RFC **SALJ6005104X2**, patrón **EVOLUCION CREATIVA CAMREFLEX** con RFC **ECC190605VA1**, NSS **64836003307**, fecha de inicio **2023-07-16**, periodicidad **04** y total quincenal **4725.60**.

El contrato DOCX coincide en empleador, RFC, trabajador, CURP, NSS y fecha de inicio, pero pacta salario diario **$207.44**. Los CFDI reflejan SBC/SDI **331.45** y total quincenal **4725.60**, lo que hace plausible una discrepancia salarial que Helios debería detectar.

## Consenso multi-modelo

ChatGPT ve consistencia general y recomienda priorizar clasificación, bridge y webhook. Grok coincide en que el flujo es viable, pero alerta por fechas futuras 2026 y diferencia salarial. Gemini considera crítica la discrepancia entre salario contractual y lo reflejado por CFDI, además de la posible ausencia de deducciones visibles.

## Validación en navegador realizada hasta ahora

Se abrió `/auditar` y se cargó correctamente el archivo `1F870DC0-BDF0-5227-A698-907D55E15F69_JAIME_SANTIAGO_LOPEZ.xml` usando el control visible **Elegir archivo**.

Después de aceptar aviso y lanzar el análisis, la app sí devolvió una lectura preliminar y clasificó el archivo como:

- Tipo de documento: **cfdi**
- Detalle detectado: **cfdi_nomina**
- Nivel de revisión: **standard / revisión inicial**
- Puede leer detalles: **true**

La pantalla mostró sugerencias visibles:

- RFC visible: **ECC190605VA1**
- Periodo visible: **2026-04**
- Fecha visible: **2026-04-30**

Observación importante: aunque la clasificación fue correcta, la lectura preliminar todavía no extrajo con claridad RFC patrón, RFC trabajador, salario, percepciones y deducciones. Esto sugiere que el flujo de ingestión y clasificación funciona, pero la capa de extracción visible sigue siendo parcial para este XML.

## Segundo tramo de validación en navegador

Se reinició `/auditar` y se cargó correctamente `CONTRATOINDETERMINADO-SANTIAGOLOPEZJAIME.docx` usando el control visible **Elegir archivo**.

La app devolvió una lectura preliminar consistente para contrato:

- Tipo de documento: **contract / contrato_laboral**
- Nivel de revisión: **contract_deep_dive / revisión profunda de contrato**
- Puede leer detalles: **true**
- RFC visible sugerido: **ECC190605VA1**
- Monto visible sugerido: **$207.44**
- Señal adicional: **HasInfonavitSignal = true**

Esto confirma que el flujo soporta correctamente ambos tipos documentales críticos del caso real de Jaime: **CFDI XML** y **contrato DOCX**. También confirma que la app sí produce una lectura jurídica preliminar alineada con el diseño de Helios para contratos.

Límite observado: la vista preliminar del contrato todavía marca como no leídos con claridad varios campos jurídicos esenciales, entre ellos **puesto, salario pactado, jornada, fecha de ingreso, duración/vigencia y vacaciones**. Es decir, la clasificación e ingestión funcionan, pero la extracción visible sigue siendo parcial y conservadora.

Además, al guardar el XML de Jaime, el expediente mostró el estado **"El documento ya fue enviado a Helios y la opinión jurídica final se completará cuando el motor termine de procesarlo dentro del expediente"**, lo que prueba que el conector hacia Helios se activa en el flujo guardado del expediente.

## Validación de conectores, bridge y Helios

Los guardados del XML y del contrato sí activaron el flujo avanzado del expediente y la interfaz mostró mensajes de envío a **Helios**. Sin embargo, la validación técnica encontró una incidencia relevante en el bridge remoto:

- En `devserver.log` aparecieron dos eventos `auditapatron_bridge_dispatch` con estado **failed** y razón **invalid_ack_contract** al procesar el caso de Jaime.
- Ambos intentos apuntaron a `https://www.complilink.mx/api/auditapatron/webhook` y recibieron **HTTP 200**, pero con un acuse que no cumplió el contrato esperado.
- El smoke test del bridge ejecutado contra `https://www.complilink.mx` devolvió:
  - `health_status: 200`
  - `webhook_status: 200`
  - `contract_passed: false`
  - sin `responseContract`
  - con evidencia de **HTML** en la respuesta de salud, no JSON contractual.

Conclusión operativa: el **flujo local de ingestión, clasificación y guardado sí funciona**, pero el **conector remoto del bridge no está devolviendo el contrato `auditapatron.bridge.ack.v1`** de manera válida en este momento. Por eso Helios queda disparado desde la app, pero el acuse remoto no puede considerarse sano ni completamente operativo.

## Hallazgo adicional de plataforma

Durante la revisión también apareció en logs un error residual del servidor:

- `ERR_MODULE_NOT_FOUND: Cannot find module '/home/ubuntu/complilink_operativo_v1/server/stripeProducts' imported from /home/ubuntu/complilink_operativo_v1/server/stripeBilling.ts`

TypeScript reportó luego `0 errors`, por lo que parece un residuo de resolución del runtime y no bloqueó la prueba documental actual, pero conviene revisarlo porque puede contaminar diagnósticos futuros.
