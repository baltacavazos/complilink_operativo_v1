# Brief de implementación priorizada

## Objetivo

Quiero ejecutar una primera ronda de simplificación de AuditaPatron sin destruir valor existente.

## Diagnóstico ya consensuado

- La landing tiene buena base, pero repite demasiado y usa demasiadas CTAs parecidas.
- `/acceso` existe, pero no se percibe con identidad suficientemente clara frente a la landing.
- `/auditar` es la superficie más sobrecargada: mezcla carga inicial, expediente en progreso y herramientas avanzadas al mismo tiempo.
- `/ceo` tiene valor, pero su portada muestra demasiadas capas desde el inicio.
- El problema principal es de experiencia, jerarquía visual y divulgación progresiva; no parece ser un problema central del motor o backend.

## Lo que necesito de ti

Propón la forma **más segura y de mayor impacto** para implementar esta ronda en una sola iteración, priorizando cambios de interfaz y arquitectura de información, no reescrituras profundas.

## Restricciones

- No proponer un rediseño total.
- No romper flujos ya existentes.
- Priorizar quick wins estructurales antes que cambios cosméticos.
- Mantener el producto funcional mientras se simplifica.
- Pensar especialmente en usuario nuevo y en mobile.

## Responde solo en JSON válido

```json
{
  "implementation_order": ["string"],
  "highest_risk_area": "string",
  "safe_quick_wins": ["string"],
  "changes_to_do_now": {
    "home": ["string"],
    "access": ["string"],
    "auditar": ["string"],
    "ceo": ["string"]
  },
  "changes_to_avoid_now": ["string"],
  "single_best_move": "string"
}
```
