# Implementación de recomendaciones operativas posteriores a la revalidación de Héctor

## Resumen ejecutivo

Se implementaron y validaron las **tres recomendaciones aprobadas** después de la revalidación del expediente de Héctor Jovane Ortiz Hernández. En términos operativos, el sistema ahora **detecta automáticamente discrepancias salariales** entre contrato y CFDI/IMSS, **expone de forma visible el estado pendiente del callback asíncrono de CompliLink** a partir de la trazabilidad ya persistida y quedó **revalidado de punta a punta con el caso de Jaime Santiago López** en este runtime restaurado.

La validación sobre Jaime confirma que el flujo sigue funcionando sin bloquear la carga documental. Los dos documentos fueron aceptados por el bridge con **HTTP 202**, Helios generó opinión inicial para ambas piezas y, una vez transcurrida la ventana de gracia, el detalle del expediente mostró dos alertas derivadas de **"Callback de CompliLink pendiente"** además de la alerta persistida de **"Discrepancia salarial detectada"**.

| Recomendación | Estado | Evidencia principal |
|---|---:|---|
| Alerta automática de discrepancia salarial | Implementada y validada | `persistedAlerts` y evento `alert_raised` en el caso de Jaime |
| Monitoreo visible del callback asíncrono | Implementado y validado | `visibleAlerts` derivadas tras la ventana de gracia en el caso de Jaime |
| Revalidación E2E del caso de Jaime | Ejecutada y validada | creación de expediente, uploads, Helios inicial, bridge `202`, eventos y alertas |

## Cambios implementados

La primera mejora consistió en enriquecer la **extracción preliminar** de documentos para capturar señales salariales comparables. El análisis de contratos ahora intenta identificar **salario diario contractual**, mientras que el análisis de CFDI/recibos detecta **SBC** y **SDI** cuando vienen presentes en XML o texto de apoyo. Esas señales quedan incorporadas al contrato canónico de clasificación ya existente, de modo que no fue necesario introducir una nueva tabla ni una migración de base de datos.

La segunda mejora consistió en añadir una rutina de comparación operativa al finalizar `cases.uploadDocument`. Cuando ya existe un par comparable entre contrato y CFDI/IMSS, el sistema calcula la diferencia absoluta y porcentual y, si supera el umbral operativo, registra una alerta persistida en `operationalAlerts` con categoría **`integrity_gap`**, además de un evento explícito `alert_raised` dentro del timeline del caso.

La tercera mejora consistió en derivar alertas visibles de seguimiento del bridge a partir de dos fuentes ya existentes: los **audit logs** del despacho `document.engine_dispatch` y los registros de **`compliLinkWebhookEvents`**. Si un despacho fue aceptado por el bridge con **202** y no aparece callback correlacionado después de la ventana de gracia, el detalle del expediente ahora muestra una alerta derivada de categoría **`upload_pending`**. Si el tiempo sigue corriendo y rebasa la ventana larga configurada, la alerta escala a severidad crítica sin requerir duplicación de datos ni bloqueo del flujo.

## Validación técnica ejecutada

La validación técnica se hizo en dos niveles. Primero se corrieron pruebas unitarias focalizadas para la extracción salarial y las nuevas señales operativas. Se ejecutó de forma dirigida la suite:

| Suite | Resultado |
|---|---:|
| `server/caseContracts.test.ts` | OK |
| `server/operationalSignals.test.ts` | OK |
| `server/auditaPatronReturnWebhook.test.ts` | OK |

Adicionalmente, se revisó el estado del proyecto después de la implementación. El estado reportó **TypeScript sin errores**, dependencias en estado **OK** y el servidor fue reiniciado para dejar la vista de desarrollo nuevamente disponible. La suite global del proyecto aún contiene fallas preexistentes ajenas a estas recomendaciones, concentradas en pruebas de UI no relacionadas con este bloque; por ello la verificación útil para este cambio se apoyó en las pruebas focalizadas y en la corrida E2E real de Jaime.

## Resultado de la revalidación con Jaime Santiago López

La corrida interna reutilizó el CFDI XML y el contrato DOCX del caso histórico de Jaime ya persistidos en almacenamiento. Con esos insumos se generó un nuevo expediente de revalidación y se cargaron de nuevo ambos documentos.

| Elemento | Resultado observado |
|---|---|
| Expediente nuevo | `CASE-BALT-1-MPQ2N1KZ` |
| XML reutilizado | `1F870DC0-BDF0-5227-A698-907D55E15F69_JAIME_SANTIAGO_LOPEZ.xml` |
| Contrato reutilizado | `CONTRATOINDETERMINADO-SANTIAGOLOPEZJAIME.docx` |
| Opinión inicial Helios | Sí, para ambos documentos |
| Despacho al bridge | Sí, para ambos documentos |
| Código HTTP del bridge | `202` en ambos despachos |
| Callback remoto en ventana corta | No observado |
| Alerta salarial persistida | Sí |
| Alertas visibles de callback pendiente | Sí, dos alertas derivadas |

En el expediente generado se observó una alerta persistida con el texto:

> **Discrepancia salarial detectada**: Se detectó una diferencia de **59.78%** entre el salario contractual (**207.44**) y el **SDI** reportado en CFDI/IMSS (**331.45**). El flujo continúa, pero conviene revisar la congruencia salarial del expediente.

Después de releer el detalle del expediente tras la ventana de gracia, también aparecieron dos alertas derivadas de seguimiento del bridge:

> **Callback de CompliLink pendiente** para el CFDI y para el contrato, cada una con `dispatchId`, `correlationId`, hora de despacho y `timeoutAt` visibles dentro del metadata derivado.

## Interpretación operativa

El comportamiento observado es el esperado para el diseño aprobado. La discrepancia salarial ya no queda como hallazgo implícito en la interpretación del expediente, sino como una **señal operativa explícita** y trazable. A la vez, el callback asíncrono deja de ser un silencio opaco del sistema y pasa a una condición observable dentro del propio detalle del caso, lo que permite distinguir entre un despacho aceptado y un retorno todavía no recibido.

Esto mejora la capacidad de diagnóstico sin endurecer innecesariamente el flujo. El expediente sigue avanzando, Helios sigue emitiendo su primera lectura y el bridge sigue despachando, pero ahora la interfaz de datos deja claro cuándo existe una reserva salarial material y cuándo CompliLink todavía no devuelve respuesta posterior al `202`.

## Archivos de evidencia

Los archivos adjuntos o generados para esta ronda son los siguientes:

| Archivo | Contenido |
|---|---|
| `server/operationalSignals.ts` | Lógica pura de discrepancia salarial y callback derivado |
| `server/operationalSignals.test.ts` | Pruebas unitarias de señales operativas |
| `tmp_revalidate_jaime_case_output.json` | Evidencia cruda de la corrida E2E de Jaime |
| `tmp_inspect_jaime_callback_visibility_output.json` | Evidencia de alertas visibles tras la ventana de gracia |
| `recommendations_implementation_report.md` | Este informe final |

## Siguiente paso sugerido

El siguiente endurecimiento natural sería transformar la alerta derivada de callback pendiente en una **transición automática a crítica** cuando se rebasa la ventana larga y, si así lo decides, enlazarla con una notificación ejecutiva o un recordatorio operativo para la consola CEO. Con la base ya implementada, esa extensión sería incremental y no requeriría rediseñar el flujo documental actual.
