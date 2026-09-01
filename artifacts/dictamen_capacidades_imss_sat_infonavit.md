# Dictamen operativo: qué puede verificar hoy AuditaPatrón sobre IMSS, impuestos e Infonavit

> **Alcance.** Este documento es un análisis técnico-operativo y de producto; no constituye asesoría jurídica, fiscal, contable ni de seguridad social individual.

## Respuesta corta

**Hoy AuditaPatrón no tiene conexión oficial con IMSS, SAT ni Infonavit.** Puede leer los documentos que aporta la persona trabajadora —por ejemplo, un recibo de nómina PDF o un CFDI XML— y mostrar los hechos que aparezcan en ellos: empleador, RFC, periodo, neto, deducciones, NSS, registro patronal y conceptos visibles de ISR, IMSS o Infonavit. Eso es una **lectura documental**, no una consulta gubernamental ni una confirmación de cumplimiento.

Por tanto, hoy la plataforma puede decir: **“en tus papeles aparece un NSS y un registro patronal”** o **“tu recibo muestra deducciones por $0.00”**. No puede decir: **“estás vigente ante IMSS”**, **“tu patrón pagó las cuotas”**, **“tu salario base está correctamente registrado”**, **“el CFDI fue certificado por SAT”** o **“tus impuestos están correctamente enterados”**.

| Pregunta de la persona trabajadora | Respuesta honesta hoy |
|---|---|
| “¿Estoy bien dado de alta en el IMSS?” | **No podemos confirmarlo hoy.** Podemos detectar indicios en los documentos; la confirmación oficial es la Constancia de Vigencia de Derechos del IMSS, obtenida por la persona titular. [1] |
| “¿Mi patrón realmente paga IMSS y registró mi salario correcto?” | **No podemos confirmarlo solo con un recibo.** El recibo puede mostrar conceptos o un salario visible, pero no prueba semanas cotizadas, salario base vigente, movimientos afiliatorios ni cuotas efectivamente enteradas. El soporte oficial es, como mínimo, la Constancia/Reporte de Semanas Cotizadas del IMSS. [2] |
| “¿Mis impuestos están bien pagados?” | **No podemos confirmarlo hoy.** Podemos leer ISR y otras retenciones visibles; un CFDI no demuestra por sí solo que el patrón enteró el impuesto. La persona puede contrastar sus datos con los visores oficiales del SAT. [3] |
| “¿Mi CFDI es auténtico?” | **No se confirma localmente.** Podemos extraer UUID/RFC/XML cuando existan; el SAT dispone de verificación oficial por folio fiscal o XML con captcha. [4] |
| “¿Mi patrón está pagando Infonavit?” | **No podemos confirmarlo con un recibo aislado.** Se pueden detectar descuentos o referencias, pero el Resumen de Movimientos/Mi Cuenta Infonavit es el soporte para revisar aportaciones y movimientos. [5] [6] |

## Lo que existe hoy en AuditaPatrón

La revisión técnica del código confirma que el flujo de análisis público procesa **únicamente archivos suministrados por la persona usuaria**. El analizador local extrae de PDF con texto nativo y de CFDI XML estos hechos cuando están presentes:

| Dato | Fuente actual | Cómo debe describirse |
|---|---|---|
| Razón social y RFC | PDF/CFDI XML del usuario | “Empresa/RFC que aparece en tu documento”. |
| Periodo, percepciones, neto y deducciones | PDF/CFDI XML del usuario | “Monto o periodo que se alcanza a leer en el recibo”. |
| NSS y registro patronal | PDF/CFDI XML del usuario | “Datos que aparecen en tus papeles; no son constancia de vigencia”. |
| ISR, cuota IMSS e Infonavit | Líneas o atributos XML visibles | “Retención o concepto visible; no prueba que se haya enterado”. |
| Señales de Infonavit | Concepto visible/atributo de deducción | “Indicio documental de crédito o descuento; no saldo ni historial oficial”. |

No se localizó en el servidor una llamada a un servicio oficial del IMSS, SAT o Infonavit. Las palabras “IMSS”, “SAT” e “Infonavit” existentes corresponden a clasificación, extracción documental, copy y recomendaciones de documentos, no a una consulta de estatus gubernamental.

## Qué evidencia resuelve cada pregunta

| Tema | Lo que puede inferirse del recibo/CFDI | Lo que sigue sin probarse | Evidencia oficial adecuada |
|---|---|---|---|
| Alta y vigencia IMSS | Que el documento menciona NSS, patrón o registro patronal. | Vigencia actual, clínica, último patrón actualizado, movimientos afiliatorios. | **Constancia de Vigencia de Derechos**. El IMSS pide CURP, NSS y correo personal; su FAQ indica que informa la vigencia, clínica y último patrón. [1] [2] |
| Semanas, SBC y cuotas IMSS | Que aparecen salario, deducciones o una cuota en un documento. | Semanas cotizadas, salario base registrado vigente, cuotas enteradas y continuidad real. | **Reporte/Constancia de Semanas Cotizadas** del IMSS y documentos oficiales emitidos a la persona titular. [2] |
| CFDI de nómina | Datos leídos del PDF/XML: RFC, periodo, total, UUID si aparece. | Certificación SAT, vigencia fiscal, cancelación o registro oficial. | **Verificación oficial de CFDI** del SAT por folio/RFC/captcha o XML/captcha. [4] |
| ISR y retenciones | ISR, IMSS, Infonavit u otros conceptos impresos en el recibo/CFDI. | Que las retenciones se declararon o enteraron correctamente; acumulados anuales. | **Visor de Nómina del Trabajador** y visores de retenciones/deducciones del SAT, a los que entra el contribuyente. [3] |
| Aportaciones y crédito Infonavit | Descuento de crédito o concepto Infonavit visible; en su caso, una estimación documental. | Saldo, pagos, aportaciones patronales reales, movimientos y estado de crédito. | **Mi Cuenta Infonavit / Resumen de Movimientos**. Infonavit señala que ahí se consulta el detalle de movimientos y que las aportaciones patronales se reflejan de forma bimestral. [5] [6] |

## Ruta recomendada, sin inventar una integración

La solución más segura en el corto plazo es mantener a AuditaPatrón como una capa de **lectura, organización y comparación documental**. La pantalla puede explicar qué se encontró y dirigir a la persona a la evidencia oficial correcta, sin presentar esos enlaces como si AuditaPatrón hubiera realizado una consulta.

En una segunda etapa, la vía de menor riesgo es permitir que la persona **suba voluntariamente** su Constancia de Vigencia, Reporte de Semanas Cotizadas, XML CFDI descargado, respuesta de verificación SAT o Resumen de Movimientos Infonavit. AuditaPatrón podría entonces organizar y comparar esos documentos, manteniendo el origen visible: “documento oficial que subiste el día X”. Esto sigue sin ser una consulta en vivo, pero permite un expediente mucho más sólido.

Una integración que consultara datos oficiales en nombre de la persona requeriría investigación específica sobre mecanismos autorizados, consentimiento, identidad, seguridad y disponibilidad de APIs/servicios. No debe construirse con scraping, con credenciales de gobierno capturadas por AuditaPatrón ni intentando evadir captcha. La opción prudente es que el titular se autentique directamente en el portal oficial y, si lo decide, aporte el documento resultante.

## Copy recomendable y copy prohibido

| Copy permitido | Copy que debe evitarse |
|---|---|
| “En tu recibo aparece un NSS y un registro patronal. Esto sale de tus papeles; no es una constancia oficial.” | “Confirmamos que estás dado de alta y vigente en el IMSS.” |
| “El CFDI muestra una deducción de ISR de $X. Para saber si fue enterada, revisa el visor oficial del SAT.” | “Tus impuestos están bien pagados.” |
| “Este XML contiene datos que puedes contrastar en el verificador oficial del SAT.” | “Validamos oficialmente tu CFDI ante el SAT.” |
| “Tu recibo muestra un concepto Infonavit. Consulta tu Resumen de Movimientos para ver aportaciones y saldo.” | “Tu patrón está al corriente con Infonavit.” |
| “Comparamos lo que aparece en tus documentos; no sustituye una constancia, declaración o consulta oficial.” | “Hicimos un cruce en vivo con IMSS, SAT o Infonavit.” |

## Consenso de modelos y límites de la consulta

ChatGPT y Gemini coincidieron en el punto central: el producto actual debe definirse como **lectura documental** y no como verificación oficial. Ambos recomiendan conservar los hallazgos extraídos, orientar a la persona a la constancia o visor adecuado y evitar almacenamiento o captura de credenciales gubernamentales dentro de la plataforma.

| Modelo | Resultado | Aporte coincidente |
|---|---|---|
| ChatGPT | Completado | Separa datos visibles de vigencia, enteros fiscales, semanas y movimientos oficiales. Recomienda rutas oficiales y copy no engañoso. |
| Gemini | Completado | Coincide en no afirmar alta, vigencia, salario base, cuotas, autenticidad fiscal ni aportaciones. Propone checklist de siguiente paso por autoridad. |
| Grok | No disponible en esta sesión | La clave `XAI_API_KEY` no está disponible y no se hizo una consulta ni se simuló su respuesta. |

La conclusión se apoya por tanto en **dos evaluaciones independientes coincidentes**, la inspección del código del proyecto y las fuentes oficiales citadas. Falta la tercera opinión de Grok por disponibilidad de credencial, no por una discrepancia identificada.

## Conclusión operativa

AuditaPatrón ya puede aportar valor inmediato al trabajador: convertir documentos difíciles en hechos legibles, detectar ausencias y explicar qué evidencia falta. **No puede, hoy, saber si la persona “está bien dada de alta” ni si “sus impuestos están bien pagados” en sentido oficial.** Para responder esas preguntas con sustento oficial, la persona necesita consultar o aportar la constancia/visor/resumen emitido por IMSS, SAT o Infonavit.

## Referencias

[1]: https://serviciosdigitales.imss.gob.mx/gestionAsegurados-web-externo/vigencia "IMSS — Solicitud de Constancia de Vigencia de Derechos"
[2]: https://www.imss.gob.mx/faq/vigencia-derechos "IMSS — Consulta si estás vigente en el IMSS"
[3]: https://www.sat.gob.mx/minisitio/DeclaracionAnual/Personas/visores.html "SAT — Visores para personas físicas"
[4]: https://verificacfdi.facturaelectronica.sat.gob.mx/ "SAT — Verificación de CFDI"
[5]: https://portalmx.infonavit.org.mx/wps/portal/infonavitmx/mx2/derechohabientes/mi_ahorro "Infonavit — Mi ahorro"
[6]: https://portalmx.infonavit.org.mx/wps/portal/infonavitmx/mx2/derechohabientes/centro_ayuda/11_aportaciones_credito/10_aportaciones_patron "Infonavit — Aportaciones de mi patrón"
