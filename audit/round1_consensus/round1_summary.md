# Consenso operativo de ronda 1

La comparación entre Grok, ChatGPT y Gemini converge en una misma prioridad: **/auditar debe ganar una jerarquía de acción mucho más agresiva en móvil**, mientras que la **home debe comprimirse**, **/acceso debe dejar de parecer una segunda landing** y **/ceo debe enfocarse en escritorio con degradación honesta en pantallas chicas**.

## Acuerdos fuertes

| Área | Consenso principal | Implicación para código |
| --- | --- | --- |
| `/auditar` | La subida del documento debe vivir en el primer bloque útil y visible, acompañada por una explicación muy corta del resultado esperado. | Reordenar el layout para que el upload card suba en móvil y colapsar módulos secundarios por defecto. |
| `/auditar` | Historial, comparación, bitácora, sugerencias y módulos de contexto no deben competir con la acción primaria. | Convertirlos en módulos colapsables o secundarios en móvil. |
| `home` | El hero inicial está sobrecargado y necesita menos altura, menos texto y un CTA más dominante. | Compactar copy, reducir bloques de apoyo tempranos y bajar densidad visual arriba del pliegue. |
| `/acceso` | Debe sentirse como acceso operativo, no como una explicación del producto. | Simplificar a identidad, continuidad y acción de login. |
| `/ceo` | Debe optimizarse para escritorio; en móvil basta con una versión reducida y clara. | Diseñar densidad desktop primero y mostrar degradación explícita en móvil. |
| Bloqueo técnico | El estado roto de `ceo_bridge_schedules` afecta la credibilidad del dashboard. | Corregir esquema/queries y proteger la vista con fallback robusto. |

## Orden sugerido para la implementación

Primero conviene **mover y compactar `/auditar`**, porque es la palanca de impacto más fuerte sobre la calificación. En segundo lugar se debe **reducir la altura competitiva de la home**. Después corresponde **diferenciar `/acceso`** como puerta operativa. Finalmente, en una segunda capa de la misma ronda, se atiende **`/ceo` con prioridad desktop** junto con el bloqueo técnico de tablas faltantes.

## Regla de decisión para esta ronda

> Si un bloque no ayuda a subir un documento, entender qué pasará después de subirlo o completar el acceso, entonces en móvil debe colapsarse, diferirse o bajar de jerarquía.

## Meta de mejora esperada

Los tres modelos estiman que una ronda bien ejecutada debería mover la experiencia hacia un rango aproximado de **8.5 a 9.2/10**, siempre que además se elimine la percepción de ruido estructural en las pantallas clave.
