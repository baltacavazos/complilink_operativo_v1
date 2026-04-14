# Contexto actual: consentimiento previo al guardado en /auditar

La experiencia actual de `/auditar` ya intenta reducir fricción legal integrando la aceptación a la acción principal, en lugar de separarla como flujo aparte. Cuando el expediente requiere aceptación legal y el usuario ya eligió archivo o tiene un borrador pendiente, aparece un bloque inline de consentimiento. En móvil, el encabezado visible dice **"Antes de guardar, confirma tu autorización"** y aclara que la versión legal vigente se registra en el mismo momento en que se guarda el documento. En desktop, el bloque equivalente usa el título **"Autorización integrada a la acción principal"** y el mismo principio: la aceptación del aviso de privacidad y de los términos se registra en el mismo paso de avanzar con el documento.

El patrón principal hoy contiene tres elementos: un texto de contexto, un enlace para abrir el drawer con los documentos legales vigentes y una casilla de verificación. La casilla usa una copia legal centralizada (`LEGAL_GATE_COPY.checkbox`) y dispara eventos de trazabilidad cuando se activa o desactiva. Si el usuario marca la casilla, se limpia el error legal previo. Si intenta avanzar sin marcarla, se muestra un error de validación del tipo **"Confirma la casilla para registrar tu aceptación y continuar con el expediente."**. Si ocurre un error operacional al registrar la aceptación, el flujo muestra mensajes tranquilizadores de protección de datos y permite reintento sin duplicar el expediente.

La acción principal también cambia de copy cuando hay consentimiento requerido. En la etapa de revisión del borrador, el CTA dominante pasa a **"Aceptar y guardar documento"** o **"Aceptar y guardar con ajustes"**. En la etapa anterior, si ya hay archivo seleccionado pero todavía no hay borrador, el CTA muestra **"Aceptar y analizar documento"**. En otras palabras, el consentimiento ya está mezclado con las acciones principales de analizar o guardar, pero la superficie visual sigue siendo una tarjeta aparte con tono ámbar y checkbox visible.

También hay señales auxiliares alrededor del consentimiento. En la sección de cobertura legal, el producto explica que la aceptación se registra cuando se confirma la acción principal del expediente. El drawer legal repite que la aceptación sólo se registra al confirmar la acción principal de analizar o guardar. Esto refuerza la trazabilidad, pero también hace que la experiencia repita varias veces la misma idea legal.

## Objetivo de esta ronda

Proponer una mejora V1 de **alto impacto y bajo riesgo** para que el consentimiento previo al guardado genere **más confianza y menos fricción**, especialmente en el momento donde el usuario ya vio la vista previa y está cerca de guardar su primer documento.

## Restricciones

- No eliminar el requisito legal ni la trazabilidad de aceptación.
- No introducir backend nuevo ni dependencias nuevas.
- No romper el patrón actual donde la aceptación se registra junto con la acción principal.
- Priorizar cambios pequeños de UX/copy/jerarquía visual y comportamiento superficial.
- Pensar primero en móvil, sin deteriorar desktop.
- Responder pensando en una app laboral/documental para México.
