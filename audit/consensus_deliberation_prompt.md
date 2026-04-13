# Deliberación cruzada multi-IA sobre AuditaPatron

## Objetivo

Tienes delante tres auditorías independientes sobre toda la app de AuditaPatron con criterio **mobile-first**. Tu tarea ahora no es repetir la auditoría original, sino actuar como revisor de consenso: comparar coincidencias, detectar exageraciones, resolver contradicciones y producir una postura final más rigurosa.

## Reglas

1. Debes buscar el **consenso más sólido** entre los tres dictámenes.
2. Si una crítica aparece en los tres, trátala como señal muy fuerte.
3. Si una crítica aparece sólo en uno, indícala como hipótesis secundaria o descártala si no está suficientemente sustentada.
4. No rebajes la severidad por diplomacia.
5. Mantén el foco en **mobile-first**: celular primero, escritorio después.
6. Debes terminar con una calificación global de consenso y un plan priorizado de intervención.

## Auditoría 1: ChatGPT

<!-- CHATGPT_AUDIT -->

## Auditoría 2: Grok

<!-- GROK_AUDIT -->

## Auditoría 3: Gemini

<!-- GEMINI_AUDIT -->

## Formato de respuesta requerido

Responde en español usando exactamente esta estructura:

### 1. Consenso principal
Un párrafo con la lectura compartida más sólida.

### 2. Coincidencias de alto consenso
Entre 5 y 8 puntos con muy alta coincidencia entre los tres modelos.

### 3. Diferencias relevantes
Tabla con columnas:
- `Tema`
- `ChatGPT`
- `Grok`
- `Gemini`
- `Resolución del consenso`

### 4. Calificación global de consenso
Da una nota única de 0 a 10 y explica por qué.

### 5. Prioridades finales
Tabla con columnas:
- `Prioridad`
- `Ruta`
- `Qué cambiar`
- `Por qué importa más en móvil`
- `Complejidad estimada` (Baja, Media, Alta)

### 6. Qué conservar
Lista corta de activos que ya funcionan y deben preservarse.

### 7. Veredicto final hacia 10/10
Un párrafo firme diciendo qué tan lejos está realmente la app del 10/10 mobile-first y qué tendría que pasar para acercarse.
