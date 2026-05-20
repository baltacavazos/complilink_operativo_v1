# Hallazgos iniciales de auditoría tipo cliente

## Landing

La propuesta de valor principal es clara en lo general: subir un recibo para detectar si pagan de menos. Sin embargo, la página mezcla demasiadas capas narrativas al mismo tiempo. Aparecen varios bloques que repiten la misma idea con microvariantes, como primera lectura, siguiente paso, privacidad, casos anonimizados y ejemplos de salida. Esto transmite riqueza, pero también fatiga cognitiva.

También hay fricción por exceso de CTAs y enlaces secundarios visibles desde el primer pantallazo. Aunque el CTA principal existe, compite con navegación superior, tarjetas interactivas, carrusel de ejemplo, salida rápida y varios botones de empezar. La experiencia se siente más explicada de lo necesario para un usuario que solo quiere saber: qué subo, qué obtengo y si es seguro.

Se observa además copy interno o semitécnico filtrado en ejemplos de lectura, especialmente frases como `confirmedData`, que no deberían ser visibles para un cliente final.

## /auditar

El flujo principal tiene una buena base, pero todavía mezcla la experiencia normal con elementos operativos y ejecutivos. La presencia inmediata de `Modo CEO`, `Abrir acciones CEO`, `Revalidar IMSS e Infonavit` y selectores de caso/tenant añade complejidad innecesaria para alguien que llega como usuario común.

El bloque superior también acumula demasiados mensajes paralelos: privacidad, control, borrado, pasos, tipos de archivo, progreso por etapas y contexto opcional. Aunque cada pieza tiene sentido por separado, juntas vuelven más pesado el primer paso elemental: elegir el documento.

La jerarquía ideal para un usuario nuevo debería quedar en tres preguntas resueltas de inmediato: qué documento conviene subir, qué pasa al subirlo y qué verá antes de guardar. Todo lo demás parece secundario o debería estar colapsado.

## Hipótesis preliminares de simplificación

La landing probablemente necesita menos secciones visibles antes del CTA principal y una reducción de ejemplos repetidos.

El flujo `/auditar` probablemente necesita ocultar o separar por rol toda la superficie CEO y reducir el texto inicial a instrucciones mínimas, confianza esencial y una sola acción dominante.
