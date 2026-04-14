# Contexto actual del resultado post-subida en /auditar

Objetivo de esta consulta: decidir una mejora UX de bajo riesgo para el resultado que ve el usuario justo después de guardar un documento en `/auditar`, con foco mobile-first y sin añadir complejidad visible.

## Estado actual observado

El bloque "Tu último documento" ya muestra varias piezas de información una vez existe `lastUpload`.

1. Un mensaje de guardado exitoso cuando aplica.
2. Un bloque de "Siguiente paso sugerido para ti" con copy dinámico y atajos contextuales.
3. Un bloque opcional de asistencia de escaneo con confianza visual, alineación esperada y problemas detectados.
4. Un bloque "Resumen sencillo" con tipo documental, resumen y etiquetas de revisión/estado.
5. Un bloque de aporte del documento (`uploadInsight`) explicando qué contribuye el archivo.
6. Un bloque de estado del motor (`engineStatus`) con tono success/warning/neutral.
7. Un texto aclarando la diferencia entre lo confirmado y lo estimado.
8. Un resultado enriquecido del análisis con:
   - headline y lead
   - nivel de riesgo, confianza y modo
   - tarjetas de hallazgos clave
   - comparación entre documentos cuando existe
   - siguiente paso sugerido
   - actualización del expediente
   - incertidumbres o aspectos preliminares
   - asistente contextual con preguntas sugeridas

## Posibles problemas UX a resolver

Aunque el resultado ya es rico, hay riesgo de que para una persona no experta:

- no quede totalmente claro en los primeros 3-5 segundos cuál fue el valor principal recibido;
- compitan demasiados bloques por atención;
- el siguiente paso exista, pero no domine visualmente como la única acción más útil;
- se sienta como una lectura extensa antes que como una respuesta inmediata y tranquilizadora.

## Restricciones

- No mencionar nombres internos de motor o arquitectura al usuario final.
- No romper la estructura técnica existente más de lo necesario.
- Priorizar cambios de jerarquía, copy, agrupación y énfasis antes que agregar nuevas funciones.
- Debe seguir funcionando bien en móvil.
- Debe preservar la idea de qué es preliminar versus qué ya quedó incorporado al expediente.

## Lo que necesito de cada modelo

Propón una mejora UX/UI de bajo riesgo para este resultado post-subida respondiendo en JSON con esta estructura exacta:

```json
{
  "diagnosis": ["3 a 5 observaciones concretas"],
  "recommended_changes": [
    {
      "title": "nombre breve del cambio",
      "impact": "high|medium|low",
      "effort": "low|medium|high",
      "why": "por qué ayuda",
      "implementation_hint": "cómo aplicarlo sin reescribir todo"
    }
  ],
  "priority_order": ["cambio 1", "cambio 2", "cambio 3"],
  "avoid": ["cosas que no conviene hacer en esta ronda"],
  "north_star": "cómo debería sentirse el resultado ideal en una frase"
}
```

Prioriza una recomendación consensuable, de bajo riesgo y de impacto visible inmediato.
