# Auditoría de experiencia — Persona trabajadora

**Alcance.** Se revisaron las superficies móviles públicas disponibles: inicio y acceso. El flujo de carga en `/auditar` no produjo una captura fiable, por lo que no se emite un juicio concluyente sobre su funcionamiento. No se modificó código, copy ni configuración del producto.

## Veredicto actualizado

> **La propuesta de valor, la privacidad inicial y el primer paso de carga se entienden. La única validación decisiva pendiente es subir un recibo real en el teléfono y comprobar que la app confirma el avance sin trabarse.**

| Dimensión | Consenso | Lectura de una persona trabajadora |
|---|---|---|
| Claridad inicial | Favorable | “Sube tu recibo y te decimos qué revisar” explica rápido para qué sirve. |
| Utilidad percibida | Favorable | Un ejemplo de resultado permite imaginar la ayuda concreta antes de compartir el recibo. |
| Confianza | Buena al inicio, por comprobar en operación | La promesa de que solo la persona ve su recibo reduce una preocupación clave; necesita mantenerse coherente al subirlo. |
| Facilidad | Clara en el primer paso, por comprobar en operación | Foto/archivo y el CTA principal son entendibles; falta validar respuesta, progreso y confirmación reales. |
| Continuidad de acceso | Riesgo de contexto | “Todo listo” y “Continuar con mi revisión” son buenos tras una revisión iniciada, pero pueden confundir si se muestran a alguien nuevo. |

## Hallazgos priorizados

| Prioridad | Consenso de las tres evaluaciones | Evidencia y lectura correcta |
|---|---|---|
| 1 | Probar la carga real de foto o PDF desde el teléfono. | Las tres reevaluaciones coinciden: el único veredicto que falta es que el botón responda, acepte el archivo y muestre avance o confirmación. |
| 2 | Mantener la privacidad inequívoca antes y después de cargar. | El mensaje inicial funciona, pero debe seguir siendo coherente con el manejo posterior del documento. |
| 3 | Garantizar que el acceso contextual no aparezca a una persona nueva. | El mensaje de continuidad es claro para quien retoma, pero no para quien nunca ha iniciado revisión. |
| 4 | Mantener la información extensa como secundaria respecto a iniciar y subir. | Inicio y ejemplo ayudan; el contenido posterior puede cansar a alguien que llega con prisa desde el celular. |
| 5 | Anticipar las dudas prácticas de carga. | Formatos aceptados, calidad de foto, tiempo de revisión y siguiente paso deben entenderse justo cuando son necesarios. |

## Lo que funciona bien

La llamada principal baja la barrera: se entiende que basta un recibo y que se puede empezar gratis. El ejemplo de resultado reduce incertidumbre porque muestra que el producto no solo recibe un archivo, sino que devuelve una señal comprensible. El acceso de continuidad tiene una intención correcta: llevar a la persona al punto donde dejó su revisión.

## Límites y descartes

La referencia inicial de Gemini a “Sub(e)” se descarta: la captura móvil disponible muestra “Sube”. Tampoco se toma como hecho que la cámara o la carga fallen; la nueva captura prueba que el primer paso es claro, pero no que el archivo se haya procesado correctamente.

## Recomendación operativa

No hacer cambios de fondo todavía. Validar primero en el teléfono real la toma de foto, la selección de PDF/XML, el aviso de privacidad, el progreso y la pantalla de resultado. Si esos recorridos son claros, la propuesta está suficientemente entendible para una primera prueba de mercado; si alguno se atasca, ésa será la prioridad concreta de corrección.

## Fuentes internas

- Evidencia móvil revisada: `artifacts/worker_ux_audit_evidence.md`.
- Evaluación independiente de ChatGPT: `artifacts/ux_audit_chatgpt.json`.
- Evaluación independiente de Gemini: `artifacts/ux_audit_gemini.json`.
- Evaluación independiente de Grok: `artifacts/ux_audit_grok.json`.
