# Contexto actual de la Consola CEO sobre fricción histórica del primer expediente

La Consola CEO ya muestra una **lectura rápida** del primer expediente derivada del audit trail visible. Hoy resume arranques visibles, confirmaciones visibles, cargas visibles, brechas entre preview y guardado, modo de captura dominante y una prioridad operativa sintetizada. También expone señales del gate legal, incluyendo abandonos visibles, tasa de abandono cuando existe base y una lectura semanal compacta del abandono.

## Qué ya se ve hoy

La vista actual ya permite responder si el flujo visible del primer expediente parece estable o si se concentra la fricción en preview, confirmación, subida o gate legal. El tono es ejecutivo, compacto y operativo: tarjetas breves, narrativa corta y siguiente acción recomendada.

## Qué falta ahora

Todavía **no existe una vista histórica específica** que ayude a leer la evolución de la fricción del primer expediente por **día y semana**. Falta una capa ligera que permita detectar si el problema está mejorando, empeorando o simplemente cambiando de etapa dominante con el paso del tiempo.

En particular, la nueva vista debería ayudar a responder rápidamente:

1. Si el abandono visible del primer expediente sube o baja semana contra semana.
2. Si la fricción dominante cambia entre preview, confirmación, subida o gate legal.
3. Si el tiempo visible entre preview y confirmación mejora o empeora.
4. Si hay una señal histórica suficiente para distinguir incidente puntual vs. deterioro sostenido.
5. Qué nivel de detalle conviene mostrar en la Consola CEO sin convertirla en un dashboard analítico pesado.

## Restricciones de diseño

La solución debe ser de **bajo riesgo**, sin nuevas dependencias complejas, coherente con la Consola CEO actual y fácil de dejar abierta para monitoreo continuo. La prioridad es lectura ejecutiva, no exploración analítica profunda. Debe evitar visualizaciones recargadas, interpretaciones ambiguas o métricas que parezcan precisas sin tener una base visible suficiente.

## Objetivo de la consulta multi-IA

Pedir a OpenAI, Grok y Gemini una propuesta consensuada para mostrar una **vista histórica de fricción del primer expediente** en la Consola CEO, priorizando:

- nombre y framing de la sección;
- métrica principal para ver deterioro o mejora;
- combinación mínima de tendencia diaria y semanal;
- reglas de interpretación ejecutiva;
- microcopy para explicar límites de la data visible;
- riesgos de sobrecarga o falsa sensación de precisión.
