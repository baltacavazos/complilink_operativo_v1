# Consulta multi-modelo previa a implementación — Ronda 6

Actúa como un auditor senior de **producto, UX writing, diseño de interacción, conversión, confianza y resiliencia de flujo** para una app llamada **AuditaPatron**.

## Objetivo

Necesito definir la **siguiente micro-ronda mínima y más rentable** para empujar la experiencia desde **8.9/10** hacia **9/10+** sin rediseñar el producto.

## Contexto del producto

AuditaPatron ayuda a personas trabajadoras a **subir documentos laborales** para recibir una auditoría clara, hallazgos accionables, explicación simple de lo detectado y guía sobre qué documento conviene agregar después.

La superficie crítica sigue siendo **/auditar**, especialmente en **móvil**.

## Consenso de la reauditoría más reciente

Ya se consultó a **ChatGPT, Grok y Gemini** tras la última ronda implementada. El consenso quedó en **8.9/10**. Los tres modelos coinciden en que la estructura gruesa ya mejoró, pero sigue faltando una mejora pequeña en el momento entre **seleccionar/subir documento** y **recibir confirmación o error**.

## Brechas residuales más relevantes

1. Faltan **estados intermedios de progreso** más explícitos durante validación, subida o procesamiento inicial.
2. La app puede anticipar mejor errores con **validación preventiva** de tipo y tamaño de archivo antes de iniciar la subida.
3. Falta reforzar la sensación de **control del usuario** con un microcopy muy visible junto al bloque principal de upload.
4. El objetivo es elevar la percepción de **robustez, control y confianza** sin agregar complejidad visual.

## Tu tarea

Propón la mejor micro-ronda para resolver exactamente esas brechas.

Evalúa en especial:

- Cómo debería verse el **estado de progreso** ideal antes de que exista éxito o error.
- Qué validaciones preventivas conviene mostrar **antes** de subir el archivo.
- Qué microcopy de **control/confianza** debe vivir junto al upload.
- Qué solución da más percepción de robustez **con el menor cambio visual posible**.

## Formato de salida obligatorio

Devuelve exactamente estas secciones:

### 1. Diagnóstico central
Un párrafo breve con la lectura principal.

### 2. Intervenciones prioritarias
Una tabla con columnas: `Prioridad`, `Cambio recomendado`, `Por qué impacta`, `Costo estimado`.

### 3. Estado de progreso ideal
Describe en un párrafo concreto cómo debería verse y redactarse el feedback durante validación, carga y procesamiento.

### 4. Validación preventiva ideal
Una tabla con columnas: `Validación`, `Momento`, `Microcopy recomendado`, `Riesgo que evita`.

### 5. Copy de control y confianza
Incluye entre **3 y 5 microcopys** listos para usar en español mexicano, muy claros, cortos y confiables.

### 6. Única recomendación final
Si sólo pudiera implementarse **una micro-ronda**, explica cuál harías y por qué.

## Criterio

- No propongas rediseños grandes.
- No abras backlog lateral.
- Prioriza robustez percibida, control y claridad.
- Responde en español.
