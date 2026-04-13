# Contrato de rediseño: AuditaPatron frontend, Helios cerebro único

## Principio rector

AuditaPatron solo expone una interfaz clara y simple. Helios debe ser el motor único que:

1. recibe todo documento subido,
2. lo procesa e interpreta,
3. lo integra al expediente del usuario,
4. produce el resultado visible inmediato,
5. responde preguntas posteriores sobre ese mismo expediente.

## Problemas detectados

| Problema | Efecto en usuario |
| --- | --- |
| El resultado enfatiza "riesgo" demasiado pronto | El usuario no entiende qué ganó al subir el documento |
| El resumen útil queda enterrado entre demasiados bloques | La experiencia exige demasiado scroll |
| El asistente actual parece una capa separada | No se percibe como continuación natural del análisis |
| La lógica del copilot hoy se apoya en una llamada genérica de LLM | Rompe el modelo de Helios como cerebro único |

## Nuevo contrato visible tras subir un documento

La pantalla posterior a la subida debe abrir con esta jerarquía:

| Orden | Bloque | Objetivo |
| --- | --- | --- |
| 1 | Qué encontró Helios | Decir en una frase qué leyó del documento |
| 2 | Qué significa para ti | Traducir el hallazgo a lenguaje no experto |
| 3 | Qué conviene hacer ahora | Proponer un único siguiente paso dominante |
| 4 | Tu expediente ya creció | Confirmar que el documento quedó guardado e integrado |
| 5 | Pregúntale a Helios | Habilitar preguntas inmediatas sin sacar al usuario del contexto |
| 6 | Ver detalle completo | Dejar el análisis profundo como expansión secundaria |

## Reglas de contenido

| Regla | Aplicación |
| --- | --- |
| No abrir con "riesgo" | Abrir con utilidad y hallazgo visible |
| Una idea principal por bloque | Nada de párrafos largos arriba del primer scroll |
| Un solo CTA dominante | Evitar competencia entre botones |
| El detalle profundo queda colapsado | Reducir scroll y carga cognitiva |
| El expediente debe mostrarse como crecimiento automático | Reforzar valor acumulativo de cada subida |

## Backend objetivo

| Pieza | Cambio requerido |
| --- | --- |
| heliosIntegrationService | Cambiar narrativa para devolver utilidad inmediata, hallazgo principal, significado simple y siguiente paso claro |
| routers.ts detalle de expediente | Exponer un resumen ejecutivo corto del último documento y del expediente acumulado |
| heliosCopilotChat | Dejar de comportarse como chat genérico y responder bajo contrato Helios, anclado al expediente y a salidas de Helios |
| upload/confirm flows | Garantizar que cada documento confirmado quede incorporado al expediente visible sin pasos extra |

## Frontend objetivo en Auditar

| Zona | Cambio requerido |
| --- | --- |
| Resultado inmediato | Tarjeta breve con "qué encontró Helios", "qué significa" y "siguiente paso" |
| Expediente | Resumen compacto con contador, documento más reciente y acceso simple a los demás |
| Copilot/Sheet | Convertirlo en continuación natural del resultado: "Pregúntale a Helios sobre este documento" |
| Detalle profundo | Dejarlo detrás de acordeón o expansión secundaria |

## Señal de éxito

El usuario debe poder responder sin esfuerzo a estas tres preguntas dentro del primer scroll:

1. ¿Qué encontró el sistema en mi documento?
2. ¿Para qué me sirve eso?
3. ¿Qué hago ahora?

Y con un gesto adicional debe poder hacer una pregunta a Helios sobre ese mismo documento o ver cómo su expediente creció.
