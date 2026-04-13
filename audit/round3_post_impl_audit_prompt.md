# Prompt maestro de reauditoría UX/UI post-implementación — AuditaPatron

Quiero que actúes como **auditor senior de producto digital, UX/UI y conversión**, con criterio estricto, orientación a producto de alta calidad y tolerancia baja a la complejidad innecesaria.

## Contexto del producto

AuditaPatron es una plataforma web de auditoría legal/documental. Su foco visible para personas usuarias es:

1. Subir documentos laborales.
2. Recibir hallazgos y claridad útil.
3. Construir un expediente digital ordenado, disponible y cada vez más sólido.

## Prioridades obligatorias de evaluación

- **Mobile-first** para páginas públicas y de captación: `/`, `/acceso`, `/auditar`.
- **Desktop-first** para `/ceo` porque es un dashboard ejecutivo para administración interna.
- El objetivo es evaluar el estado **después** de una nueva ronda de implementación, estimar la **calificación actual real** y decir si ya está en **9/10** o todavía no.

## Estado previo antes de esta ronda

En la reauditoría anterior, el consenso fue aproximadamente:

- Grok: **7.0/10**
- ChatGPT: **7.2/10**
- Gemini: **7.5/10**
- Consolidado práctico: **~7.2/10**

El consenso de debilidades era:

1. Exceso de densidad y módulos en Home y `/auditar`, sobre todo en móvil.
2. Competencia entre bloques secundarios y la acción primaria.
3. Jerarquía todavía mejorable en acceso y en la lectura del producto.
4. `/ceo` sólido, pero aún denso para lectura ejecutiva.

## Cambios recién implementados en esta ronda

Esta nueva ronda ya aplicó cambios concretos orientados al consenso anterior:

### Home (`client/src/pages/Home.tsx`)
- Se añadió una **ruta móvil priorizada** para reducir carga cognitiva en pantallas pequeñas.
- Se compactaron o relegaron bloques secundarios amplios en móvil.
- Se preservaron anchors y navegación esencial (`como-funciona`, `expediente`, `privacidad`) sin romper el hilo principal.
- Se mantuvo la propuesta de valor fuerte en el hero, pero con una lectura móvil más enfocada.

### Auditar (`client/src/pages/Auditar.tsx`)
- Se añadió un **resumen antes de subir** para orientar mejor el flujo principal.
- Se compactaron u ocultaron en móvil bloques secundarios amplios que competían con la subida documental.
- Se priorizó visualmente el flujo principal de cargar documento por encima del resto de módulos.

### Validación técnica
- TypeScript sin errores.
- Suite de pruebas en verde, incluyendo cobertura UX actualizada para esta ronda.
- Checkpoint guardado después de validación.

## Lo que necesito de ti

Quiero una respuesta estricta y accionable con estas secciones:

### 1. Calificación actual honesta
Da una sola calificación global **hoy**, considerando el estado post-implementación.

### 2. Debate crítico
Explica si esta ronda sí movió la aguja de forma material y qué techo queda antes del 9/10.

### 3. Evaluación del impacto de esta ronda
Di específicamente si la compactación móvil de Home y `/auditar` fue la decisión correcta o si se atacó una superficie equivocada.

### 4. Top 3 cambios restantes con mejor impacto marginal
Dame solo **3 cambios restantes** con mejor relación impacto/esfuerzo para alcanzar o acercarse al 9/10.

Para cada cambio, incluye:
- superficie o ruta afectada,
- problema actual,
- cambio propuesto,
- impacto esperado en la nota.

### 5. Veredicto final
Responde claramente una de estas tres opciones:
- **Ya está en 9/10 o más**
- **Todavía no llega a 9/10, pero está cerca**
- **Sigue lejos del 9/10**

## Formato obligatorio de salida

Devuelve la respuesta en español y con esta estructura exacta:

```md
## Calificación actual
...

## Debate crítico
...

## Impacto de esta ronda
...

## Top 3 cambios restantes
| Prioridad | Ruta | Problema | Cambio propuesto | Impacto esperado |
|---|---|---|---|---|
...

## Veredicto final
...
```

Sé exigente. Si el producto sigue por debajo de 9/10, dilo claramente. Si esta ronda sí fue la correcta, dilo también. No des recomendaciones cosméticas; prioriza lo que realmente cambia comprensión, foco, confianza y conversión.
