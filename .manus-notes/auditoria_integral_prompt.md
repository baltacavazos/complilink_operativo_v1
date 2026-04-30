# Brief de auditoría integral de AuditaPatron

## Objetivo

Quiero una auditoría crítica e independiente de toda la plataforma, enfocada en cuatro preguntas:

1. ¿La estética global se siente clara, confiable y coherente, o hay ruido visual y sobreexplicación?
2. ¿Qué funciones, bloques, rutas o acciones parecen duplicadas, repetidas o innecesarias?
3. ¿Qué partes generan confusión para un usuario nuevo o elevan la carga cognitiva sin aportar suficiente valor inmediato?
4. ¿Qué simplificaciones concretas harías para que la experiencia sea más sencilla, intuitiva, menos confusa y más elegante?

## Superficies auditadas

- Landing pública `/`
- Acceso `/acceso`
- Flujo principal `/auditar`
- Consola ejecutiva `/ceo`
- Páginas legales como soporte secundario

## Inventario resumido

La landing comunica una promesa clara: subir un documento laboral y obtener una primera lectura útil. La estética general es sobria y transmite confianza, pero varias ideas parecen repetirse en múltiples secciones: primera lectura, privacidad, bóveda laboral y empezar con un solo archivo.

La ruta `/acceso` existe en código como pantalla específica para continuar con correo y código de 6 dígitos, pero en la navegación observada del preview no se distinguió claramente de la landing. Eso debe tratarse como señal potencial de bug o de separación insuficiente entre explorar, entrar y guardar.

La pantalla `/auditar` concentra muchas capas simultáneas: carga inmediata, expediente seleccionado, historial/timeline, filtros, lectura preliminar, comparación entre documentos, bóveda laboral, privacidad/consentimiento, asesor y ahora también monetización. La hipótesis principal es que ahí existe sobrecarga de módulos y de acciones visibles al mismo tiempo.

La consola `/ceo` suma navegación lateral, resumen, bridge, alertas, accesos, documentos, exportes, bitácora, métricas derivadas y un chat ejecutivo. Aunque sirve para un owner avanzado, la primera vista puede estar tratando de resolver demasiados objetivos a la vez.

## Señales iniciales ya observadas

- Múltiples CTAs muy parecidos en landing.
- Repetición conceptual entre primera lectura, bóveda, privacidad y siguiente paso.
- Posible duplicidad entre varias maneras de “entender”, “abrir”, “seguir”, “guardar” o “profundizar”.
- Posible problema real o conceptual en `/acceso`, porque no se percibió como una superficie claramente diferenciada.
- `/auditar` parece mezclar experiencia inicial, expediente en progreso y herramientas avanzadas en una sola página.
- `/ceo` parece mezclar resumen, operación, auditoría, bitácora y analítica en la misma primera vista.

## Evidencia visual

- Landing: https://files.manuscdn.com/user_upload_by_module/session_file/310519663473809458/AYzKbmHbAHNUXtwP.webp
- Auditar: https://files.manuscdn.com/user_upload_by_module/session_file/310519663473809458/sqhJmUQnZlAdsseY.webp
- CEO: https://files.manuscdn.com/user_upload_by_module/session_file/310519663473809458/TpOlRUbRFlAuoIgi.webp

## Restricciones de criterio

- No propongas “más funciones” como salida por defecto.
- Prioriza simplificar, consolidar, ocultar progresivamente o eliminar cuando eso mejore claridad.
- Distingue entre problemas para usuario nuevo y problemas para usuario avanzado/owner.
- Si una función es valiosa pero está mal expuesta, sugiere reubicarla antes que borrarla.
- No te enfoques en detalles técnicos de implementación; enfócate en experiencia, estructura, claridad, estética y redundancia funcional.

## Formato de respuesta requerido

Responde solo en JSON válido con esta estructura exacta:

```json
{
  "executive_verdict": "string",
  "scores": {
    "visual_clarity": 0,
    "functional_simplicity": 0,
    "navigation_clarity": 0,
    "cognitive_load": 0,
    "overall": 0
  },
  "what_is_working": ["string"],
  "aesthetic_problems": ["string"],
  "duplicated_or_overlapping_functions": [
    {
      "surface": "string",
      "problem": "string",
      "why_it_feels_redundant": "string",
      "recommended_action": "merge|hide_progressively|remove|rename|reposition"
    }
  ],
  "confusing_points_for_new_users": ["string"],
  "confusing_points_for_advanced_users": ["string"],
  "top_5_simplification_moves": [
    {
      "title": "string",
      "impact": "high|medium|low",
      "effort": "high|medium|low",
      "recommendation": "string"
    }
  ],
  "route_assessment": {
    "home": "string",
    "access": "string",
    "auditar": "string",
    "ceo": "string"
  },
  "keep_merge_remove_table": [
    {
      "item": "string",
      "decision": "keep|merge|remove|hide_progressively",
      "reason": "string"
    }
  ],
  "single_most_important_change": "string"
}
```
