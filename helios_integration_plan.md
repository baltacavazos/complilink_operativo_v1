# Plan incremental de integración con Helios

## Objetivo

Auditapatron debe poder aprovechar el motor **Helios** para enriquecer cada expediente con una **opinión jurídica asistida**, sus **fundamentos**, una **lectura de riesgo** y un **siguiente paso sugerido**, sin exponer credenciales en cliente y sin bloquear el avance por la falta de la especificación externa definitiva.

## Hallazgos sobre la arquitectura actual

La aplicación ya cuenta con una base muy adecuada para esta integración. El flujo actual de `cases.uploadDocument` clasifica el documento, genera un análisis preliminar, crea contratos canónicos y despacha el documento hacia el motor existente mediante `sendDocumentToAuditaPatronEngine()`. Además, el expediente ya conserva documentos, eventos, alertas, contratos y resultados visibles en la experiencia de `/auditar`.

Eso permite incorporar Helios como una **segunda capa de interpretación jurídica** reutilizando el mismo patrón operativo: adaptador backend, contrato interno estable, estados de procesamiento, almacenamiento por documento y renderizado en la UI del expediente.

## Supuestos temporales de trabajo

Mientras no se confirme el contrato externo final de Helios, el diseño avanzará con los siguientes supuestos operativos.

| Supuesto | Decisión temporal |
|---|---|
| Autenticación externa | Se resolverá solo en servidor mediante secretos y nunca en frontend. |
| Modo de integración | Se diseñará como servicio asíncrono con despacho y retorno posterior. |
| Unidad principal de análisis | El documento seguirá siendo la unidad mínima; luego podrá evolucionar a expediente completo. |
| Persistencia | Los resultados de Helios se almacenarán como parte del expediente y del documento, no solo como respuesta efímera. |
| UX inicial | `/auditar` mostrará una primera versión de opinión asistida, riesgo, fundamentos y siguiente paso. |
| Fallback | Si Helios no responde, Auditapatron conservará el análisis preliminar existente y mostrará estado pendiente o no disponible. |
| Lenguaje | La salida visible para personas usuarias será clara, sobria y no sustituirá asesoría profesional humana. |

## Consenso funcional entre ChatGPT, Gemini y Grok

Los tres modelos coincidieron en cinco decisiones de arquitectura. Primero, Helios debe entrar mediante un **adaptador servidor dedicado**. Segundo, conviene definir desde ahora un **contrato interno estable** aunque el API externo luego cambie. Tercero, la experiencia debe mostrar la respuesta jurídica en capas, empezando por lo más útil: resumen, riesgo y siguiente paso. Cuarto, la plataforma necesita estados explícitos para evitar ambigüedad operativa. Quinto, la interfaz debe distinguir con claridad entre **hechos confirmados**, **inferencias del sistema** y **opinión jurídica asistida**.

## Contrato interno mínimo propuesto

Este contrato interno será la base para el mock inicial y después servirá como capa de adaptación hacia la integración real.

### Solicitud interna hacia Helios

| Campo | Tipo | Propósito |
|---|---|---|
| `tenantId` | string | Separación operativa por organización. |
| `caseId` | string | Identificador del expediente. |
| `traceId` | string | Trazabilidad transversal. |
| `documentId` | string | Documento principal a interpretar. |
| `documentType` | string | Tipo documental ya clasificado por Auditapatron. |
| `documentUrl` | string | URL segura del archivo para análisis. |
| `mimeType` | string | Tipo MIME del documento. |
| `sha256` | string | Integridad y deduplicación. |
| `preliminaryAnalysis` | object | Hallazgos preliminares ya producidos por Auditapatron. |
| `caseContext` | object | Resumen contextual del expediente y eventos relevantes. |
| `jurisdiction` | string | Jurisdicción aplicable, inicialmente `México`. |
| `requestedOpinionType` | string | Tipo de orientación esperada, por ejemplo `labor_preliminary_opinion`. |
| `requestedAt` | string | Momento de despacho. |

### Respuesta interna esperada desde Helios

| Campo | Tipo | Propósito |
|---|---|---|
| `documentId` | string | Correlación directa con el documento. |
| `caseId` | string | Correlación con expediente. |
| `status` | string | Estado operativo del análisis. |
| `summary` | string | Resumen ejecutivo en lenguaje claro. |
| `legalOpinion` | string | Opinión preliminar asistida. |
| `riskLevel` | string | Nivel de riesgo: `low`, `medium`, `high`, `critical`. |
| `recommendedNextStep` | string | Siguiente paso más útil para la persona usuaria. |
| `recommendedActions` | string[] | Acciones concretas sugeridas. |
| `legalFoundations` | array | Fundamentos normativos o doctrinales estructurados. |
| `keyFactsUsed` | string[] | Hechos relevantes usados por el motor. |
| `uncertainties` | string[] | Vacíos o dudas detectadas. |
| `confidenceScore` | number | Confianza estimada de la respuesta. |
| `disclaimer` | string | Alcance de la opinión asistida. |
| `receivedAt` | string | Momento de retorno. |
| `rawPayload` | object | Carga original para auditoría y depuración. |

### Modelo de estados inicial

| Estado | Significado |
|---|---|
| `pending_dispatch` | Auditapatron ya decidió enviarlo pero aún no sale. |
| `sent` | La solicitud ya fue enviada a Helios. |
| `processing` | Helios está procesando o Auditapatron espera retorno. |
| `completed` | La opinión jurídica ya fue recibida y normalizada. |
| `partial` | Llegó respuesta incompleta pero usable. |
| `error` | Falló la integración o la respuesta fue inválida. |
| `timeout` | Se agotó la espera operativa y se mantiene fallback. |
| `not_configured` | Todavía no existe conexión real configurada. |

## Guardrails de producto y legales

La experiencia debe apoyarse en cuatro límites visibles. El primero es que Helios se presentará como **opinión jurídica asistida**, nunca como decisión definitiva ni sustituto automático de un abogado. El segundo es que la interfaz separará visualmente datos confirmados, estimaciones y opinión interpretativa. El tercero es que, ante error, timeout o baja confianza, la UI priorizará el análisis preliminar actual y sugerirá revisión humana. El cuarto es que toda interacción relevante quedará trazada en eventos o auditoría para poder revisar cómo se generó una respuesta.

## Diseño UX inicial dentro de `/auditar`

La integración inicial no requiere una ruta nueva. Puede vivir dentro de `/auditar` como un módulo claramente separado del análisis preliminar existente.

| Bloque | Contenido |
|---|---|
| Estado Helios | Indicador claro: pendiente, analizando, listo, con atención o no disponible. |
| Resumen jurídico | Dos o tres líneas con la lectura más útil del caso. |
| Riesgo detectado | Etiqueta simple con severidad. |
| Siguiente paso | Acción principal recomendada. |
| Fundamentos | Sección expandible con soporte normativo. |
| Límites de la opinión | Disclaimer persistente y visible. |

## Primer corte de implementación recomendado

La integración incremental debe empezar por un corte que ya deje valor visible sin depender todavía de la API real de Helios.

| Fase | Entregable |
|---|---|
| 1 | Crear `server/heliosIntegrationService.ts` con contrato interno y modo mock. |
| 2 | Extender el backend para producir y devolver un bloque `heliosOpinion` asociado al documento o expediente. |
| 3 | Añadir en `/auditar` un módulo visible de opinión asistida con estados, riesgo, resumen y siguiente paso. |
| 4 | Incorporar pruebas que validen renderizado, estados y fallback. |
| 5 | Sustituir después el mock por el adaptador real cuando se confirme endpoint, auth y payload definitivo. |

## Decisión de implementación inmediata

La siguiente implementación debe orientarse a un **adaptador interno mockeable** y a una **UI inicial consumible desde `/auditar`**. Esa ruta permite avanzar hoy, mantener la arquitectura limpia y reducir el costo de adaptación cuando se cierre el contrato real de Helios.

## Riesgos a controlar desde ahora

| Riesgo | Mitigación inicial |
|---|---|
| Cambio futuro del API real | Aislar todo en un adaptador servidor específico. |
| Respuestas jurídicas ambiguas | Mostrar resumen claro, confianza y vacíos detectados. |
| Sobreconfianza de la persona usuaria | Mantener disclaimer visible y tono no categórico. |
| Latencia externa | Mantener estados asíncronos y fallback útil. |
| Exposición de secretos | Resolver credenciales solo con secretos de servidor. |
| Sobrecarga visual en móvil | Mostrar primero resumen, riesgo y siguiente paso; detalles expandibles después. |

## Próximo paso técnico

El siguiente paso del proyecto será diseñar la estructura concreta del adaptador mock de Helios y decidir en qué capa persistir inicialmente `heliosOpinion`, para luego implementarlo en backend y exponerlo en `/auditar` sin romper el flujo actual.
