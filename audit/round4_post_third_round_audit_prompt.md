# Reauditoría UX/UI multi-modelo — Ronda 4

Evalúa la experiencia actual de **AuditaPatron** después de una tercera ronda de mejoras UX/UI. Tu tarea es actuar como auditor senior de producto, UX writing, diseño de interacción y conversión.

## Objetivo

Determinar si la aplicación ya alcanza una **calificación global mínima de 9/10** en claridad, foco, jerarquía visual y confianza operativa, o si todavía existe una brecha concreta.

## Contexto de producto

AuditaPatron es una plataforma orientada a personas trabajadoras que suben documentos laborales para recibir una auditoría clara, señales relevantes, hallazgos accionables y guía sobre qué falta en su expediente.

Las superficies más importantes del flujo son:

1. **Home**: explica el valor, transmite confianza y conduce a empezar.
2. **/acceso**: entrada operativa al producto; debe reducir fricción y dejar clara la ruta primaria.
3. **/auditar**: flujo nuclear de carga documental; debe priorizar la acción principal y el feedback inmediato.
4. **/ceo**: consola ejecutiva; debe ser escaneable, orientada a decisiones y menos densa.

## Cambios ya implementados en las iteraciones recientes

### Rondas previas
- Compactación móvil de Home y Auditar para reducir densidad y competencia entre módulos secundarios.
- Mejoras de jerarquía y foco del primer viewport.
- Refuerzo del flujo principal de carga documental.

### Tercera ronda recién aplicada
- **/acceso**: simplificación operativa, mayor claridad de la ruta principal, reducción de alternativas secundarias visibles y onboarding contextual más inequívoco.
- **/ceo**: reordenamiento del primer viewport para una jerarquía ejecutiva más escaneable y orientada a decisión.
- **/auditar**: refuerzo del CTA principal y del feedback inmediato cerca del cargador, enfatizando la “siguiente mejor acción” y la prioridad del flujo principal sobre módulos secundarios.

## Qué debes evaluar

Quiero una evaluación estricta, no complaciente, basada en heurísticas de producto real:

- Claridad del mensaje principal.
- Jerarquía visual del primer viewport.
- Facilidad para identificar la acción principal.
- Reducción de carga cognitiva y microdecisiones.
- Confianza, credibilidad y sensación de control.
- Coherencia entre páginas del sistema.
- Calidad del flujo móvil y desktop.
- Calidad del UX writing en español.
- Qué tan cerca está de una experiencia “9/10”.

## Instrucciones de salida

Devuelve exactamente estas secciones:

### 1. Calificación global
Un número de 0 a 10, con una decimal.

### 2. Veredicto corto
Un párrafo breve respondiendo si ya alcanza 9/10 o no.

### 3. Qué mejoró claramente
Una tabla con tres columnas: `Superficie`, `Mejora observada`, `Impacto`.

### 4. Brecha restante hacia 9/10
Una tabla con tres columnas: `Prioridad`, `Problema residual`, `Por qué todavía pesa`.

### 5. Siguiente intervención más rentable
Explica cuál sería la **única siguiente mejora** de mayor impacto marginal si hubiera que hacer sólo una ronda adicional.

### 6. Riesgos de sobre-diseño o complejidad innecesaria
Indica si alguna pantalla empieza a sobreexplicarse, sobredecorarse o competir consigo misma.

### 7. Dictamen final
Una conclusión breve y ejecutiva.

## Criterio de severidad

- No regales la nota.
- Si algo está en 8.6, 8.8 o 8.9, dilo así.
- Sólo asigna **9/10 o más** si el sistema ya se percibe consistentemente claro, confiable, priorizado y escaneable en sus superficies críticas.
