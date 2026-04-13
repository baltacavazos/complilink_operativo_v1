### 1. Diagnóstico central

El flujo de subida de documentos en /auditar aún genera incertidumbre y falta de control percibido en el usuario debido a la ausencia de estados intermedios claros, validación preventiva y microcopy de confianza, lo que limita la percepción de robustez y control pese a la buena estructura general.

---

### 2. Intervenciones prioritarias

| Prioridad | Cambio recomendado                                                                 | Por qué impacta                                             | Costo estimado        |
|-----------|-----------------------------------------------------------------------------------|-------------------------------------------------------------|----------------------|
| Alta      | Agregar barra de progreso simple y mensaje de estado durante validación y carga    | Reduce ansiedad, da control y refuerza robustez percibida   | Bajo                 |
| Alta      | Implementar validación preventiva (tipo/tamaño) antes de iniciar la subida         | Evita errores frustrantes y refuerza confianza              | Bajo                 |
| Media     | Añadir microcopy visible de control/confianza junto al bloque de upload            | Refuerza sensación de control y transparencia               | Muy bajo             |

---

### 3. Estado de progreso ideal

Durante la validación y carga, debe mostrarse una barra de progreso horizontal discreta (por ejemplo, sobre el botón de subir) acompañada de un mensaje claro y breve, como: “Validando archivo…” seguido de “Subiendo documento…” y finalmente “Procesando…”. El feedback debe ser textual, visible y sin animaciones complejas, con un spinner pequeño solo si la carga es mayor a 2 segundos. El usuario debe saber exactamente en qué paso está, sin ambigüedad.

---

### 4. Validación preventiva ideal

| Validación                | Momento                  | Microcopy recomendado                              | Riesgo que evita                     |
|--------------------------|--------------------------|---------------------------------------------------|--------------------------------------|
| Tipo de archivo permitido | Al seleccionar archivo   | “Solo aceptamos PDF, JPG o PNG.”                  | Subidas fallidas por formato         |
| Tamaño máximo permitido   | Al seleccionar archivo   | “El archivo no debe superar 10 MB.”               | Errores por archivos demasiado grandes|
| Archivo legible           | Al seleccionar archivo   | “Asegúrate que el documento sea claro y legible.” | Procesos fallidos o auditoría inútil |

---

### 5. Copy de control y confianza

1. “Tus archivos se validan y procesan de forma segura.”
2. “Puedes cancelar la subida en cualquier momento.”
3. “Solo tú tienes acceso a tus documentos.”
4. “¿Problemas al subir? Intenta de nuevo o contáctanos.”
5. “Verifica que el archivo sea legible para mejores resultados.”

---

### 6. Única recomendación final

Si solo pudiera implementarse una micro-ronda, priorizaría **agregar estados intermedios de progreso claros y microcopy asociado durante la validación, carga y procesamiento**. Esto ataca directamente la ansiedad y falta de control percibido, eleva la confianza y robustez sin rediseñar ni agregar complejidad visual significativa, y puede complementarse fácilmente con validaciones preventivas en una siguiente iteración.