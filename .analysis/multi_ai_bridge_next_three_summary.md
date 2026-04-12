# Resumen consolidado multi-IA para el siguiente bloque bridge

El contraste entre **OpenAI** y **Grok** converge en tres decisiones principales. Primero, el envío por correo del export bridge debe **reutilizar el mismo contenido generado para la exportación actual**, evitando duplicar la lógica de composición del PDF/CSV en backend. Segundo, el gráfico de tendencia debe resolverse con una **visualización inline ligera**, sin introducir una librería nueva. Tercero, los filtros exportables deben **reutilizar el mismo estado visible ya presente en la Consola CEO**, en lugar de crear un estado paralelo sólo para exportación.

| Tema | Consenso principal | Decisión operativa |
|---|---|---|
| Correo del export bridge | Reutilizar el payload y la generación existentes, y enviar al backend el artefacto listo o un contenido equivalente derivado del mismo flujo. | Implementar primero una mutación tRPC específica para envío por correo y distinguir auditoría de descarga vs envío. |
| Infraestructura de correo | OpenAI sugiere extraer helper reutilizable; Grok acepta una implementación localizada. | Optar por un punto medio: helper pequeño y enfocado para Resend con adjuntos, sin refactor amplio. |
| Gráfico de tendencia | Ambos recomiendan un gráfico pequeño inline sin dependencia nueva. | Implementar un componente React liviano con SVG reutilizando los datos ya calculados del smoke history. |
| Filtros exportables | Ambos recomiendan reutilizar filtros visibles ya existentes. | Centralizar una función utilitaria para construir los filtros aplicados del bridge y usarla tanto en UI como en export/auditoría. |
| Auditoría | Ambos recomiendan separar la acción de descarga y la de correo. | Mantener `dashboard.ceo.export_generated` para descargas y añadir `dashboard.ceo.export_emailed` para envíos por email. |
| Pruebas mínimas | Ambos recomiendan pruebas puntuales sobre la mutación de envío, la composición de filtros y el gráfico. | Añadir Vitest para helper/filtros, mutación backend y render del componente de tendencia. |

Gemini no devolvió recomendación útil porque el modelo secundario del script quedó obsoleto tras un 404 del endpoint intentado. No obstante, el consenso entre OpenAI y Grok es suficientemente claro para ejecutar una implementación de bajo riesgo y mínima complejidad adicional.

La ruta de implementación aprobada queda así. Primero, crear el flujo de **envío por correo del export bridge** con una mutación dedicada y auditoría separada. Después, añadir el **gráfico de tendencia inline** dentro del bloque histórico ya visible. Finalmente, unificar y exponer los **filtros exportables** del bridge por ventana, severidad y tenant usando el mismo estado que ya usa la consola.
