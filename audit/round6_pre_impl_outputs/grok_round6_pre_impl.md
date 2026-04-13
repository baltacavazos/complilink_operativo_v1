### 1. Diagnóstico central
La brecha principal reside en la transición entre la selección/subida de documentos y la confirmación, donde la falta de estados intermedios y validaciones preventivas genera incertidumbre, reduciendo la percepción de control y robustez. Al incorporar progresos explícitos, chequeos anticipados y microcopy estratégico, se eleva la confianza sin alterar la interfaz visual, enfocándonos en claridad y resiliencia para un flujo más fluido en móvil.

### 2. Intervenciones prioritarias

| Prioridad | Cambio recomendado | Por qué impacta | Costo estimado |
|-----------|---------------------|-----------------|----------------|
| Alta | Agregar un indicador de progreso simple (spinner con texto) durante validación y subida. | Mejora la percepción de robustez al mostrar actividad en tiempo real, reduciendo ansiedad por esperas invisibles y elevando confianza en el proceso. | Bajo (1-2 horas de desarrollo frontend). |
| Media | Implementar validación preventiva de tipo y tamaño de archivo al seleccionar. | Evita errores frustrantes post-selección, anticipando fallos y reforzando control del usuario antes de comprometerse. | Bajo (1 hora de integración con librerías existentes). |
| Baja | Incluir microcopy de control junto al botón de upload, visible en todo momento. | Aumenta la sensación de agencia y confianza con mensajes claros, sin agregar complejidad visual, solo texto. | Muy bajo (30 minutos de edición de UI text). |

### 3. Estado de progreso ideal
El estado de progreso debe iniciarse inmediatamente tras seleccionar el archivo, mostrando un spinner circular centrado en el área de upload con texto secuencial: "Validando archivo..." (durante chequeo inicial de 1-2 segundos), seguido de "Subiendo documento..." (con barra de progreso porcentual si aplica, o solo spinner para simplicidad), y finalmente "Procesando auditoría..." antes de la confirmación. Esto se redacta en español neutro y breve, como "Cargando... Por favor espera", para mantener la interfaz limpia en móvil, usando colores existentes del tema para no alterar el diseño visual.

### 4. Validación preventiva ideal

| Validación | Momento | Microcopy recomendado | Riesgo que evita |
|------------|---------|-----------------------|------------------|
| Tipo de archivo (solo PDF, JPG, PNG) | Al seleccionar el archivo en el explorador. | "Archivo válido: PDF, JPG o PNG. Selecciona otro si no aplica." | Subidas fallidas por formato incompatible, reduciendo frustración y reintentos. |
| Tamaño de archivo (máximo 10MB) | Inmediatamente después de selección, antes de iniciar subida. | "Archivo demasiado grande (máx. 10MB). Reduce el tamaño o elige otro." | Errores de carga por límites de servidor, evitando interrupciones en el flujo. |
| Contenido vacío o corrupto | Al validar tras selección, antes de subida. | "Archivo parece vacío o dañado. Intenta con uno diferente." | Procesamientos fallidos que generan desconfianza en la app. |

### 5. Copy de control y confianza
- "Tú controlas: sube solo lo que necesites, pausar en cualquier momento."
- "Seguro y rápido: validamos antes de subir para evitar errores."
- "Confía en el proceso: te guiamos paso a paso con resultados claros."
- "Si algo sale mal, reinicia fácilmente sin perder datos."

### 6. Única recomendación final
Si solo pudiera implementarse una micro-ronda, elegiría agregar el indicador de progreso simple durante validación, carga y procesamiento, ya que resuelve directamente la brecha central de estados intermedios, impactando más en la percepción de robustez y control con el menor cambio visual (solo un elemento dinámico reutilizable), elevando la confianza en el flujo crítico de /auditar sin requerir rediseños o validaciones adicionales.