# Estado actual del flujo móvil de primera carga y confirmación en `/auditar`

La pantalla `/auditar` ya prioriza un flujo de **primer expediente** pensado para móvil. Cuando no hay documentos previos, ni borrador pendiente, ni última carga confirmada, el sistema activa un modo compacto de entrada y por defecto privilegia **cámara** sobre **archivo**. En esta superficie, el CTA principal alterna entre **"Toma foto para empezar"** y **"Elige archivo para empezar"**, y existe un conmutador rápido para cambiar entre cámara y archivo sin abrir paneles secundarios.

El flujo actual tiene cuatro etapas visibles de progreso: **Preparar**, **Analizar**, **Guardar** y **Revisar**. El microcopy reciente ya intenta tranquilizar al usuario durante la etapa de análisis, enfatizando que se ordena primero lo más útil y que la vista previa se abrirá apenas termine la lectura del documento.

En la lógica de interacción, el sistema registra eventos de selección de documento, análisis de borrador, confirmación, aceptación legal y uso de atajos contextuales. También ya instrumenta eventos específicos del **primer expediente** para contar uso de shortcuts y otras señales de fricción. La confirmación visible ocurre mediante `handleConfirmDraft`, y la carga inicial parte desde selección de archivo/cámara, autoanálisis del borrador y luego confirmación explícita.

Hay dos superficies móviles relevantes para la auditoría UX siguiente:

1. **Entrada compacta del primer expediente**, donde el usuario decide entre cámara y archivo, sube el documento y recibe el arranque automático del borrador.
2. **Vista previa pendiente de confirmar**, donde se muestran datos del borrador, acciones principales, reanálisis y atajos contextuales antes del guardado definitivo.

Fortalezas actuales observables:

- El flujo ya reduce pasos para primer expediente.
- Existe preferencia explícita de modo de captura.
- Hay análisis automático después de seleccionar el archivo.
- Se agregaron atajos contextuales por tipo documental.
- El resultado post-subida ya fue reforzado en una ronda anterior.

Riesgos o dudas a revisar en una auditoría mobile-first:

- Si la alternancia entre **cámara** y **archivo** compite visualmente con el CTA principal en pantallas pequeñas.
- Si la transición entre **selección** y **análisis automático** comunica con suficiente claridad que el sistema ya está trabajando sin requerir más acción.
- Si la **vista previa pendiente** deja suficientemente claro cuál es la única siguiente acción recomendable antes de guardar.
- Si el bloque de reanálisis, shortcuts y acciones secundarias introduce demasiada competencia justo antes de confirmar.
- Si el lenguaje y jerarquía móvil reducen la duda del primer expediente o todavía exigen interpretación adicional.

Objetivo de la consulta multi-IA:

Pedir a OpenAI, Grok y Gemini una crítica enfocada exclusivamente en el flujo móvil real de **primera carga + análisis automático + confirmación del primer expediente**, buscando una mejora de **alto impacto y bajo riesgo** que pueda implementarse sin cambiar la arquitectura actual.
