# Propuesta de integración visible de Helios en Auditapatron

## Estado actual confirmado en el proyecto

Tras revisar el código actual, la plataforma ya tiene una **base funcional importante** para Helios, pero todavía no la expone como una capacidad persistente y clara dentro de la experiencia de usuario.

Hoy, el flujo de carga documental en `server/routers.ts` ya hace cuatro cosas clave. Primero, clasifica el documento y genera un análisis preliminar. Segundo, construye una opinión de Helios mediante `buildHeliosOpinionContract(...)`. Tercero, persiste esa opinión en contratos canónicos con `contractType: "audit"` y `schemaVersion: "helios_v1"`. Cuarto, devuelve `heliosOpinion` y `heliosOpinionContract` en la respuesta de `cases.uploadDocument`.

El hueco principal está en la capa de lectura. La pantalla `/auditar` ya puede mostrar la opinión **inmediata** del último upload si se usa la respuesta de la mutación, pero el detalle del expediente no está trayendo las opiniones persistidas por documento. En la práctica, eso significa que Helios existe en backend y trazabilidad, pero todavía no existe como parte estable del expediente visible para la persona usuaria.

## Consulta comparada con Grok, Gemini y ChatGPT

Siguiendo tu instrucción, se hizo una consulta paralela de arquitectura a **Grok**, **Gemini** y **ChatGPT** usando tus llaves disponibles en el entorno. Las respuestas estructuradas quedaron guardadas en:

| Modelo | Archivo |
|---|---|
| ChatGPT | `research/helios_multi_ai/openai_response.json` |
| Grok | `research/helios_multi_ai/grok_response.json` |
| Gemini | `research/helios_multi_ai/gemini_response.json` |

Los tres modelos convergen con bastante claridad en la misma dirección.

| Tema | ChatGPT | Grok | Gemini | Consenso útil |
|---|---|---|---|---|
| Qué hacer primero | Exponer opinión persistida en detalle del caso y lista de documentos | Unir opiniones persistidas por documento y permitir refresh | Modificar queries para incluir opinión `helios_v1` persistida | **Primero backend de lectura, no solo UI** |
| Patrón UI | Ficha contextual persistente | Acordeón expandible | Dossier contextual expandible | **Bloque expandible, simple, mobile-first** |
| Salvaguarda legal | Disclaimer claro y visible | Etiqueta de opinión preliminar | Disclaimer prominente y repetido | **Nunca presentar Helios como dictamen final** |
| Futuro modo remoto | Capa de abstracción y fallback | Switch mock/remoto + webhook | Contrato agnóstico a la fuente | **Contrato único hoy y mañana** |
| Riesgo principal | Confusión entre opinión asistida y asesoría final | Malentendido legal | Interpretación errónea por usuario | **El mayor riesgo es de confianza y comprensión, no técnico** |

## Lectura de consenso

El consenso no recomienda empezar por una integración remota compleja ni por una pantalla nueva. Recomienda algo más sólido: **hacer visible la opinión ya persistida, en el lugar donde el usuario ya está trabajando**, con lenguaje humano, bajo scroll y una jerarquía muy clara entre documento, hallazgo preliminar y siguiente paso.

También hay consenso en que la interfaz no debe “gritar IA”, ni parecer un tablero técnico. Debe sentirse como una ayuda concreta dentro del expediente. En otras palabras, Helios debe aparecer como una **lectura jurídica preliminar útil**, no como una pieza separada, intimidante o ambigua.

## Recomendación principal

La mejor decisión para el siguiente paso es implementar un **MVP visible de Helios persistido en el expediente**, con esta lógica:

| Capa | Decisión recomendada |
|---|---|
| Backend | Extender `cases.detail` para devolver opinión Helios asociada a cada documento usando los contratos `audit / helios_v1` ya guardados |
| Frontend inmediato | Mostrar la opinión del último upload justo debajo del bloque del documento cargado |
| Frontend persistente | Mostrar en la lista de documentos un indicador de “opinión preliminar disponible” y permitir expandirla en el mismo flujo |
| Contrato de datos | Mantener una estructura única que funcione con `mock` hoy y `remote` después |
| UX legal | Repetir claramente que es una **opinión jurídica asistida preliminar** y no sustituye asesoría legal personalizada |

## Diseño funcional propuesto

La integración visible debería quedar organizada como un **bloque contextual expandible**. No recomiendo una pantalla nueva por ahora, porque agregaría navegación, fricción y scroll. La experiencia actual de `/auditar` ya está bastante optimizada para móvil y conviene reforzar ese flujo en lugar de fragmentarlo.

### Patrón visual recomendado

| Sección | Contenido | Objetivo UX |
|---|---|---|
| Encabezado | “Opinión jurídica preliminar” + etiqueta Helios + disclaimer corto | Aclarar qué es y qué no es |
| Resumen corto | `summary`, `riskLevel`, `confidenceScore` traducido a lenguaje humano | Dar comprensión inmediata sin abrumar |
| Opinión expandible | `legalOpinion`, fundamentos, hechos usados, incertidumbres | Permitir profundidad opcional |
| Siguiente paso | `recommendedNextStep` + `recommendedActions` | Convertir interpretación en acción útil |

## Contrato de datos recomendado

El contrato actual ya es bueno para empezar. No recomiendo rehacerlo. Recomiendo **extender lo mínimo** para que sirva mejor a UI y al futuro remoto.

| Campo | Estado actual | Recomendación |
|---|---|---|
| `status` | Ya existe | Mantenerlo como fuente principal de estado |
| `mode` | Ya existe (`mock` / `remote`) | Mantenerlo; será clave para transición futura |
| `summary` | Ya existe | Usarlo como extracto principal en móvil |
| `legalOpinion` | Ya existe | Usarlo dentro de panel expandible |
| `riskLevel` | Ya existe | Mapearlo a chips visuales humanos |
| `recommendedNextStep` | Ya existe | Mantenerlo visible sin expandir |
| `recommendedActions` | Ya existe | Mostrar 2 o 3 acciones útiles |
| `legalFoundations` | Ya existe | Mostrar bajo “Fundamentos considerados” |
| `uncertainties` | Ya existe | Mostrar como “Lo que aún conviene confirmar” |
| `disclaimer` | Ya existe | Hacerlo visible siempre |
| `generatedAt` | Ya existe | Mostrar fecha de generación |
| `source` o `engineLabel` | No explícito en `opinion` | Opcional, útil para UI futura |
| `version` o `schemaVersion` visible | Solo en contrato externo | Útil para trazabilidad interna, no necesariamente para usuario |

## Cambios backend recomendados

La principal mejora backend no es generar más cosas, sino **leer bien lo ya generado**.

### Paso backend recomendado

| Prioridad | Cambio |
|---|---|
| Alta | Crear helper para leer contratos canónicos `audit` por `caseId` y agruparlos por `documentId` |
| Alta | Extender `cases.detail` para que cada documento devuelva `heliosOpinionSummary` y, si conviene, `heliosOpinion` completo |
| Media | Añadir un endpoint de refresh o regeneración solo si de verdad lo vamos a usar en UI ahora |
| Media | Preparar una capa `getHeliosOpinionForDocument()` para desacoplar mock y remoto |
| Baja | Añadir versionado visible para auditoría técnica interna |

La clave aquí es no duplicar lógica en frontend. El frontend no debe reconstruir opiniones a partir de eventos ni de logs. Debe consumir un objeto ya resuelto desde el backend.

## Cambios frontend recomendados

El frontend debería introducir Helios en dos niveles de visibilidad.

### Nivel 1: resultado inmediato post-upload

Justo donde hoy se muestra “Tu último documento”, conviene insertar un bloque nuevo debajo del resumen actual. Ese bloque puede decir algo como:

> **Opinión jurídica preliminar**  
> Esta lectura fue generada para orientarte mejor dentro de tu expediente. No sustituye asesoría legal personalizada.

Debajo irían el resumen, el riesgo aparente, el siguiente paso y un botón “Ver lectura completa”. Esto permite capitalizar el momento de mayor atención del usuario: justo después de subir el archivo.

### Nivel 2: persistencia dentro del expediente

En la lista de documentos del expediente, cada tarjeta debería poder mostrar si ese documento ya tiene una opinión generada. No hace falta saturar la tarjeta; basta un chip breve y un control de expansión.

| Elemento | Recomendación |
|---|---|
| Indicador | “Opinión preliminar disponible” |
| Estado alterno | “En preparación”, “Pendiente”, “No disponible” |
| Interacción | Expandir inline, no navegar a otra página |
| Accesibilidad | Respetar reduced motion y foco visible |

## Manejo de errores recomendado

Los tres modelos coincidieron en que el error debe expresarse de forma humana y tranquila. En este flujo no conviene hablar de webhook, timeout, schema o motor remoto frente al usuario final.

| Escenario | Mensaje recomendado |
|---|---|
| Opinión aún no lista | “Tu lectura preliminar todavía se está preparando.” |
| Opinión no disponible | “Todavía no pudimos mostrar una lectura preliminar para este documento.” |
| Falla temporal | “Hubo un problema temporal al preparar esta lectura. Tu documento sí quedó guardado.” |
| Reintento futuro | “Podrás volver a intentar esta lectura sin subir de nuevo el archivo.” |

## Salvaguardas legales y de confianza

Esta parte es la más importante del consenso multi-IA. La plataforma puede técnicamente mostrar la opinión desde ya, pero si se presenta mal, puede debilitar la confianza del producto.

| Riesgo | Mitigación recomendada |
|---|---|
| Que parezca asesoría definitiva | Etiqueta fija: **Opinión jurídica asistida preliminar** |
| Que el usuario actúe solo con eso | Disclaimer visible en resumen y detalle |
| Que se perciba como caja negra | Mostrar hechos usados, incertidumbres y siguiente paso |
| Que haya discrepancia futura entre mock y remoto | Mantener el mismo contrato de salida |

## Qué no recomiendo hacer ahora

No recomiendo abrir una ruta nueva solo para Helios. No recomiendo esconder el disclaimer en letra pequeña. Tampoco recomiendo implementar una integración remota antes de hacer visible y útil la opinión persistida actual.

En términos prácticos, hoy el producto gana más si **hace visible lo que ya sabe**, que si intenta todavía **hablar con más complejidad técnica**.

## Orden de implementación sugerido

| Fase | Trabajo |
|---|---|
| 1 | Exponer opiniones Helios persistidas en `cases.detail` por documento |
| 2 | Renderizar bloque de opinión preliminar en el resultado del último upload |
| 3 | Añadir indicador y expansión de opinión en la lista de documentos |
| 4 | Incorporar mensajes de estado y fallas en lenguaje humano |
| 5 | Escribir/ajustar pruebas Vitest para backend y UI |
| 6 | Dejar lista la abstracción para modo remoto sin activarlo todavía |

## Decisión recomendada para aprobación

Mi recomendación es aprobar una implementación en dos piezas, dentro del flujo actual y **sin esperar todavía los detalles técnicos del endpoint remoto de Helios**:

| Pieza | Alcance |
|---|---|
| Backend | Leer y devolver las opiniones `helios_v1` ya persistidas por documento en `cases.detail` |
| Frontend | Mostrar un bloque expandible de opinión preliminar tanto en el último upload como en la lista del expediente |

Eso nos deja con una integración visible, útil, coherente con móvil y alineada con el futuro modo remoto. Además, reduce riesgo porque no inventa una arquitectura nueva: **aprovecha lo que ya está construido**.

## Mi recomendación final

Si me das autorización, el siguiente paso ideal no es investigar más: es **implementar este MVP visible de Helios en backend + `/auditar`**, con pruebas, sin tocar todavía la conexión remota definitiva.

Eso nos permite avanzar hoy con valor real para el usuario, manteniendo el sistema preparado para cuando nos compartas los detalles técnicos del Helios remoto.
