# Brief de simplificación priorizada 3 · Portada CEO

Necesito una recomendación breve y accionable para la siguiente iteración de AuditaPatron.

## Contexto actual

La consola `/ceo` ya fue simplificada en dos rondas previas. Hoy la portada ya prioriza un resumen ejecutivo, muestra alertas críticas, documentos pendientes y accesos vigentes, y deja el panel maestro colapsado por defecto.

Aun así, todavía existe profundidad visible de más en la primera lectura, especialmente por la presencia de bloques como bitácora operativa, lecturas rápidas, distribución y otras superficies analíticas que compiten con las prioridades del día.

## Objetivo exacto

Quiero una **tercera ronda de simplificación** para que la portada CEO se sienta todavía más ejecutiva, más directa y menos cargada, sin quitar capacidad real ni perder trazabilidad.

## Lo que debes evaluar

1. Qué bloque o bloques deberían quedar ocultos detrás de expansión controlada en la portada inicial.
2. Qué debe seguir visible siempre en el primer pantallazo para que el CEO decida rápido.
3. Cómo esconder bitácora y profundidad analítica sin generar sensación de pérdida de control.
4. Qué copy o etiquetas ayudan a que la expansión sea intuitiva para un usuario no técnico.
5. Qué cambio harías primero si sólo pudiera implementarse una micro-ronda de bajo riesgo.

## Restricciones

- No agregar funciones nuevas.
- No rehacer lógica de negocio.
- No romper accesos existentes a alertas, documentos, bridge o Helios.
- Cambios mínimos de código, alto impacto visual y de claridad.
- La respuesta debe favorecer una experiencia muy simple, intuitiva y poco confusa para México.

## Salida esperada

Devuelve una respuesta estructurada que incluya:

- `keep_visible_now`
- `collapse_next`
- `safe_micro_round`
- `ux_risk`
- `copy_labels`
- `why_this_order`

Prioriza claridad ejecutiva, reducción de carga cognitiva y control aparente sin sacrificar operación.
