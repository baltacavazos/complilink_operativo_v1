# Prompt maestro de reauditoría UX/UI — AuditaPatron

Quiero que actúes como **auditor senior de producto digital, UX/UI y conversión**, con criterio estricto y orientación a producto de alta calidad.

## Contexto del producto

AuditaPatron es una plataforma web de auditoría legal/documental. Su foco visible para personas usuarias es:

1. Subir documentos laborales.
2. Recibir hallazgos y claridad útil.
3. Construir un expediente digital ordenado, disponible y cada vez más sólido.

## Prioridades obligatorias de evaluación

- **Mobile-first** para páginas públicas y de captación: `/`, `/acceso`, `/auditar`.
- **Desktop-first** para `/ceo` porque es un dashboard ejecutivo para administración interna.
- El objetivo no es una crítica genérica, sino identificar **qué cambios concretos subirían la calificación global hacia 9/10** sin abrir un rediseño total fuera de alcance.

## Estado actual ya mejorado

Ya se hicieron varias rondas de mejora y el producto **sí mejoró** respecto al punto de partida.

Mejoras ya implementadas previamente:

- Home compactada, con propuesta de valor más clara, demo del resultado, señales de confianza y mejor jerarquía inicial.
- `/acceso` convertido en una pantalla operativa de login, diferenciada de la home.
- `/auditar` reorganizado para priorizar la subida documental y el valor recibido en el primer viewport.
- `/ceo` reforzado con prioridad en experiencia desktop.
- TypeScript limpio y suite de pruebas previamente en verde al cierre de la ronda anterior.

## Calificaciones previas post-mejoras

- Grok: **7.0/10**
- ChatGPT: **7.2/10**
- Gemini: **7.5/10**
- Referencia consolidada práctica: **~7.2/10**

## Consenso previo de debilidades

Aunque mejoró, el consenso previo seguía marcando:

1. **Densidad y exceso de módulos** en Home y `/auditar`, especialmente en móvil.
2. **Jerarquía insuficiente de la acción primaria** en algunas zonas del flujo.
3. `/acceso` aún con margen para verse más inequívocamente como acceso operativo.
4. `/ceo` fuerte en desktop, pero todavía con complejidad visual heredada.
5. Persistencia de copy, estados y bloques secundarios que compiten con la tarea principal.

## Evidencia técnica resumida del estado actual

### Home (`client/src/pages/Home.tsx`)
- Es una página grande y muy rica en contenido.
- Incluye hero con variantes de copy, navegación, demo/reportes, onboarding móvil, FAQs, prueba social, prioridades documentales, señales del expediente y múltiples bloques de valor.
- Riesgo actual: que la riqueza de contenido siga generando **densidad visual** o demasiados estímulos antes de la acción principal en móvil.

### Acceso (`client/src/pages/Access.tsx`)
- Ya no es una landing genérica: maneja login por email/código, Google y Manus.
- Incluye `returnTo`, estados de cooldown, errores y paneles operativos.
- Riesgo actual: que todavía pueda sentirse algo cargada o que la composición no sea lo bastante **radicalmente inequívoca** como pantalla de acceso.

### Auditar (`client/src/pages/Auditar.tsx`)
- Es el núcleo del producto y ha recibido muchas rondas de mejora.
- Ya incluye recomendaciones, contexto del expediente, historial, onboarding, comparativas, copiloto, OCR/preanálisis, captura guiada y otros elementos de valor.
- Riesgo actual: que el flujo haya ganado demasiadas capacidades visibles y vuelva a sufrir por **competencia entre módulos**, aunque cada módulo individual sea bueno.

### CEO (`client/src/pages/CeoDashboard.tsx`)
- Es una consola amplia, con múltiples KPIs, filtros, tablas, exportaciones y módulos de monitoreo.
- Debe priorizar desktop.
- Riesgo actual: que incluso en desktop todavía tenga oportunidades de mejorar **escaneo, jerarquía, agrupación, densidad, fatiga visual y acción ejecutiva**.

## Lo que necesito de ti

Quiero una respuesta estricta y accionable con estas secciones:

### 1. Calificación actual honesta
Da una sola calificación global **hoy**, considerando el estado ya mejorado.

### 2. Debate crítico
Explica por qué todavía no llega a 9/10. No repitas generalidades; habla de los verdaderos topes actuales.

### 3. Top 5 cambios con mayor impacto marginal
Dame los **5 cambios con mejor relación impacto/esfuerzo** para subir la nota lo más posible en la siguiente ronda.

Para cada cambio, incluye:
- superficie o ruta afectada,
- problema actual,
- cambio propuesto,
- por qué subiría la calificación,
- impacto esperado en la nota.

### 4. Priorización forzada
Oblígate a elegir solo una de estas estrategias como la siguiente ronda principal:
- A) compactar todavía más Home y `/auditar` en móvil,
- B) hacer `/acceso` radicalmente más claro y mínimo,
- C) limpiar y jerarquizar visualmente `/ceo` para experiencia ejecutiva desktop.

Debes elegir **una sola** y defenderla.

### 5. Riesgo de sobre-iteración
Dime qué cosas **ya no conviene tocar** porque podrían empeorar la percepción o introducir ruido innecesario.

## Formato obligatorio de salida

Devuelve la respuesta en español y con esta estructura exacta:

```md
## Calificación actual
...

## Por qué todavía no es 9/10
...

## Top 5 cambios de mayor impacto
| Prioridad | Ruta | Problema | Cambio propuesto | Impacto esperado |
|---|---|---|---|---|
...

## Estrategia elegida para la siguiente ronda
...

## Qué no tocar todavía
...
```

Sé exigente. Si crees que la app está estancada por exceso de funciones visibles, dilo claramente. Si crees que la vía más rápida al 9 es quitar o colapsar cosas en lugar de añadir más, dilo sin suavizarlo.
