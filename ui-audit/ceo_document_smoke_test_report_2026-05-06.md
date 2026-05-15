# Prueba funcional del flujo CEO con 6 documentos reales

## Resumen ejecutivo

Se ejecutó una prueba funcional del flujo documental del **Modo CEO** usando seis archivos reales: dos XML de nómina CFDI, dos PDFs de recibo de nómina y dos contratos en DOCX, agrupados en dos expedientes, uno para **Alma Gabriela Gómez Ruiz** y otro para **Héctor Jovane Ortiz Hernández**. El sistema **sí creó expedientes, sí aceptó XML y PDF, sí relacionó ambos archivos aceptados dentro de cada caso y sí produjo una respuesta preliminar de Helios**. Sin embargo, la prueba también mostró **fallas importantes de integridad operativa y de lectura jurídica** que hoy impiden considerar estable el flujo para documentos reales de CEO.

La conclusión es que el sistema está en una fase intermedia: **funciona parcialmente como intake y orquestador**, pero todavía **no es confiable como auditor documental completo**. El mayor problema no es visual, sino de backend: el despacho al motor remoto aparentemente recibió un **HTTP 200 con HTML de la landing**, y esa respuesta terminó contaminando el registro de auditoría y provocando errores de inserción SQL. Además, los **PDF de recibo fueron clasificados como `other`** a pesar de contener señales claras de nómina/CFDI, y una deducción explícita de **INFONAVIT** en el XML de Héctor no fue reflejada en los flags del expediente.

## Insumos probados

| Trabajador | Archivos probados | Observación base |
| --- | --- | --- |
| Alma Gabriela Gómez Ruiz | XML CFDI, PDF de recibo, contrato DOCX | El XML y el PDF corresponden al mismo recibo/periodo. El contrato contiene datos laborales históricos útiles para contraste. |
| Héctor Jovane Ortiz Hernández | XML CFDI, PDF de recibo, contrato DOCX | El XML y el PDF corresponden al mismo recibo/periodo. El XML además contiene una deducción de INFONAVIT. |

## Qué hizo bien el sistema

En los dos expedientes el sistema **creó correctamente un caso por trabajador**, separó los documentos por expediente y dejó trazabilidad mínima suficiente para observar `caseId`, `documentId`, `documentType`, resumen Helios y conteo de documentos por caso. También rechazó los DOCX con un mensaje claro y consistente, lo cual confirma que los guardrails de tipo de archivo sí están operando.

| Comportamiento | Resultado observado | Evaluación |
| --- | --- | --- |
| Creación de expediente por trabajador | Sí, generó un caso para Alma y otro para Héctor | Correcto |
| Aceptación de XML | Sí | Correcto |
| Aceptación de PDF | Sí | Correcto |
| Rechazo de DOCX | Sí, con mensaje claro | Correcto como guardrail actual, aunque limita mucho el caso de uso CEO |
| Relación de documentos dentro del expediente | Sí, `documentsCount = 2` por caso aceptado | Correcto |
| Generación de resumen preliminar Helios | Sí, con `heliosSummary` y siguientes pasos | Correcto pero aún superficial |

## Qué hizo mal el sistema

El problema más serio fue que las cargas de XML se reportaron como **error** aunque el documento sí quedó persistido y sí avanzó parcialmente en el pipeline. Esto no parece un rechazo real del archivo, sino una **falla posterior del registro de auditoría**. En ambos casos, el error incluye un intento de insertar en `audit_logs` una respuesta `document.engine_dispatch` cuyo `responseBody` contiene el **HTML completo de la landing**, no un acuse JSON del motor. Eso apunta a que el bridge documental está pegándole a un destino que devuelve página web en lugar de un webhook/ack válido, o bien a una ruta correcta pero mal resuelta.

Además, el sistema clasificó los **XML como `cfdi` con confianza 91**, lo cual es razonable, pero clasificó los **PDF como `other` con confianza 45** aun cuando el PDF contiene datos visibles de nómina como folio fiscal, RFC patronal, NSS, periodo, fecha de pago y total de percepciones. Eso reduce mucho el valor del flujo, porque el PDF es justamente uno de los formatos más probables en uso real.

## Contraste contra el contenido real de los documentos

El XML de **Alma Gabriela Gómez Ruiz** contiene un CFDI de nómina con receptor `GORA9412229J2`, NSS `94099403126`, periodo del `2026-03-01` al `2026-03-15`, total de percepciones de `4725.60`, salario base de cotización de `331.86` y fecha de inicio laboral `2022-04-08`. El PDF de Alma repite claramente esas señales y además se presenta como **representación impresa de un CFDI**. Pese a ello, el PDF quedó como `other`, cuando el contenido real sí permite inferir que es un recibo de nómina ligado al mismo CFDI.

El XML de **Héctor Jovane Ortiz Hernández** contiene un CFDI de nómina con receptor `OIHH850612NS2`, NSS `01038527295`, periodo del `2026-03-01` al `2026-03-15`, total de percepciones de `4725.60`, total de deducciones de `530.99` y una deducción explícita `TipoDeduccion="010"` con concepto **PAGO INFONAVIT**. Sin embargo, el expediente resultante dejó `hasInfonavitSignal: false`, lo que constituye un **falso negativo material**.

El contrato DOCX de Alma contiene información laboral de alto valor: patrón `EVOLUCIÓN CREATIVA CAMREFLEX, S.A. DE C.V.`, trabajadora Alma Gabriela Gómez Ruiz, RFC, CURP, NSS, puesto **Analista de Atracción de Talento Jr**, inicio de relación el **08 de abril de 2022** y salario diario pactado de **$172.87**. Ese dato es particularmente útil porque permite contrastar contra los valores visibles en nómina. Hoy el sistema no lo aprovecha porque el DOCX es rechazado por diseño.

## Hallazgos más relevantes

| Hallazgo | Evidencia observada | Impacto |
| --- | --- | --- |
| Error operativo tras aceptar XML | El upload termina con error de `audit_logs` aunque el documento sí quedó registrado | Alto |
| Bridge devuelve HTML en vez de ack JSON | En `document.engine_dispatch`, `responseBody` contiene la landing completa | Crítico |
| PDFs de recibo se clasifican como `other` | `documentType: other`, confianza 45, en ambos PDFs | Alto |
| Señal de INFONAVIT no se refleja | XML de Héctor trae deducción 010 por 530.99, pero el caso deja `hasInfonavitSignal: false` | Alto |
| DOCX con valor probatorio queda fuera | Contratos contienen datos útiles, pero hoy son rechazados | Medio-Alto |
| Respuesta Helios todavía es muy genérica | El resumen habla de “documento en revisión” pero no aterriza hallazgos concretos del CFDI | Medio |

## Lectura funcional del sistema hoy

Desde la perspectiva de producto, el flujo ya muestra una base prometedora: **el expediente se arma, los documentos se ordenan y existe una narrativa preliminar para el usuario**. Eso es positivo. Pero desde la perspectiva de una auditoría laboral real, todavía falta robustez para que el sistema inspire confianza jurídica. Un CEO que sube estos archivos esperaría al menos tres cosas inmediatas: que el sistema no le marque error después de aceptar un documento, que reconozca un PDF de nómina como tal, y que detecte una deducción visible de INFONAVIT cuando está escrita en el XML.

Hoy el sistema **no cumple todavía esas tres expectativas de forma consistente**. Por eso la prueba fue útil: confirma que la dirección es correcta, pero también deja muy claro qué capas deben corregirse antes de presumir una revisión documental sólida.

## Recomendaciones priorizadas

| Prioridad | Recomendación | Razón |
| --- | --- | --- |
| 1 | Corregir el bridge para que `document.engine_dispatch` reciba y persista solo un ack estructurado JSON | Evita el falso error posterior y limpia la auditoría operativa |
| 2 | Limitar o truncar `responseBody` antes de guardarlo en `audit_logs` | Previene fallas SQL por payload excesivo o irrelevante |
| 3 | Mejorar la clasificación de PDF de nómina/CFDI usando texto extraído y no solo heurísticas débiles | Es un formato central para el caso de uso real |
| 4 | Extraer señales de INFONAVIT, NSS, periodo, RFC y deducciones directamente desde XML/PDF | Es el corazón del valor jurídico-laboral de Auditapatrón |
| 5 | Decidir soporte a DOCX o conversión automática en flujo CEO | Los contratos son valiosos para comparar salario, puesto, ingreso y prestaciones |
| 6 | Hacer que Helios devuelva un primer hallazgo útil y concreto cuando el XML ya trae estructura de nómina suficiente | Mejora mucho la sensación de inteligencia real del sistema |

## Veredicto final

La prueba del CEO fue **parcialmente exitosa**. El sistema **sí recibe, ordena y conecta** buena parte del material, pero todavía **falla en estabilidad operativa y en extracción laboral de alto valor**. Mi veredicto es que el flujo está **lo bastante avanzado para seguir iterando sobre una base real**, pero **todavía no lo presentaría como auditor documental confiable para expedientes reales de dirección** sin corregir primero el bridge, la clasificación de PDFs y la lectura de señales como INFONAVIT.

## Archivos de soporte generados

| Archivo | Propósito |
| --- | --- |
| `ui-audit/ceo_document_smoke_test_results_2026-05-06.json` | Resultado estructurado completo de la simulación |
| `ui-audit/ceo_document_smoke_test_stdout_2026-05-06.txt` | Salida cruda de ejecución |
| `ui-audit/ceo_document_smoke_test_report_2026-05-06.md` | Este reporte de hallazgos |
