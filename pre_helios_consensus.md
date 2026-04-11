# Consenso multi-IA pre-Helios

## Orden acordado
Las tres consultas coinciden en que el orden base para el sprint pre-Helios debe ser **B > A > C** o un equivalente muy cercano, con consenso claro en que primero hay que blindar el **Dashboard CEO** frente a snapshots stale, después consolidar el **pipeline documental** y el comparador multi-IA con contexto real, y al final cerrar **quick wins** de robustez y escalabilidad.

## Cambios concretos que sí valen la pena ahora

### 1) Dashboard CEO
- Bloquear en frontend y backend cualquier acción sensible o exportación cuando el snapshot esté stale, refrescando primero la vista.
- Unificar copy de bloqueo con una variante breve: "Datos desactualizados. Actualiza el dashboard antes de continuar.".
- Agregar telemetría mínima de bloqueo para saber qué acción se intentó, por qué se bloqueó y con qué snapshot.
- Mantener la auditoría de exportes y extender pruebas existentes en `server/ceoDashboardSafeActions.test.ts`.

### 2) Pipeline documental + comparador multi-IA
- Extraer el tramo repetido entre `analyzeDocumentDraft` y `uploadDocument` a un helper reutilizable del pipeline documental.
- Ese helper debe devolver contexto real utilizable por el comparador: asset validado, clasificación, scan assistance, structured extraction y análisis preliminar.
- Endurecer `scripts/multi_ai_compare.mjs` para que reciba ese contexto real, pida **JSON estructurado** a OpenAI, Gemini y Grok, y produzca además una síntesis ejecutable.
- Añadir fallback simple para Gemini sin rediseñar el sistema.

### 3) Quick wins de robustez
- Reforzar deduplicación/idempotencia en el upload documental usando hash o controles ya presentes.
- Añadir retry controlado y trazabilidad adicional en pasos frágiles como storage o dispatch externo.
- Evitar refactors grandes; priorizar logs y validaciones seguras.

## Línea de implementación elegida
1. Corregir y blindar Dashboard CEO frente a stale snapshots y exportes.
2. Reutilizar el pipeline documental para reducir duplicación y alimentar mejor el comparador multi-IA.
3. Mejorar el script multi-IA para obtener consenso estructurado listo para comparación.
4. Cerrar quick wins pequeños de robustez y cubrir todo con pruebas.

## Riesgos que se difieren
- Integración final con Helios.
- Motor avanzado de consenso multi-IA con votación ponderada o resolución sofisticada de conflictos.
- Re-arquitectura profunda para alta concurrencia o tiempo real.
