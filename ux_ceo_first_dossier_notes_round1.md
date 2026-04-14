# Contexto actual de la Consola CEO sobre primer expediente

La Consola CEO ya muestra una sección de **Lectura rápida** dentro del bloque ejecutivo de auditoría. Esa sección resume fricción y trazabilidad del flujo documental sin abrir otra capa analítica.

## Qué ya se ve hoy

Se prioriza el **gate legal visible** con tres elementos: número de abandonos abiertos, tasa de abandono cuando existe base y tiempo medio de resolución. También existe una lectura semanal compacta del abandono visible y un drill-down mínimo de casos afectados.

Además, la Consola CEO ya expone señales del embudo documental con métricas como eventos documentales, carga final y algunos textos de interpretación sobre confirmaciones, conflictos del gate legal y estado general del flujo.

## Qué falta hacer visible

Ya existe telemetría mínima del primer expediente en `/auditar`, enfocada en inicio, dudas, abandono, uso de atajos y confirmación, pero todavía no aparece como una **lectura ejecutiva específica** en la Consola CEO. Falta una vista que permita responder, de forma casi inmediata:

1. Cuántos usuarios inician realmente su primer expediente.
2. Cuántos llegan a selección de archivo, análisis, confirmación y guardado.
3. Dónde se concentra la fricción del primer expediente.
4. Si los atajos contextuales ayudan a cerrar más rápido el primer caso.
5. Qué lectura ejecutiva conviene mostrar sin volver pesada la Consola CEO.

## Restricciones de diseño

La solución debe ser de **bajo riesgo**, compacta y operativa. Debe integrarse con el tono actual de la Consola CEO: tarjetas ejecutivas, microcopy claro, drill-down breve y lectura útil para monitoreo continuo. No debe abrir una capa analítica compleja ni exigir interacción excesiva.

## Objetivo de la consulta multi-IA

Pedir a OpenAI, Grok y Gemini una propuesta consensuada para mostrar la telemetría del primer expediente como lectura visible y accionable en la Consola CEO, priorizando:

- jerarquía de métricas;
- nombre y framing de la sección;
- tarjetas o mini-funnel recomendados;
- alertas o insights automáticos de más valor;
- nivel correcto de detalle para V1;
- riesgos de sobrecarga visual o interpretación equivocada.
