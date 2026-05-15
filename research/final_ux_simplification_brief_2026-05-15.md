# Auditoría multi-IA de simplificación final — AuditaPatron

## Objetivo

Actúa como comité brutalmente honesto de **UX, producto, onboarding, operaciones y claridad**. Tu misión es detectar qué partes siguen siendo confusas, redundantes o cognitivamente pesadas en la plataforma de AuditaPatron, pensando en un usuario común en México y también en el equipo interno que la opera.

No queremos ideas vagas ni features nuevas. Queremos una auditoría para **cerrar la versión final web** con máxima intuición y mínimo ruido.

## Contexto real del producto

AuditaPatron ayuda a revisar documentos laborales y detectar posibles diferencias o señales relevantes en pagos y expediente laboral.

El dueño del proyecto quiere esta prioridad exacta:

1. Cerrar la **versión final web**.
2. Hacer que todo sea **lo más intuitivo posible**.
3. Eliminar todo lo confuso, redundante o innecesario.
4. Dejar **Helios al 100%**.
5. Preparar la plataforma para miles o decenas de miles de usuarios.
6. Solo después pensar en app Android/iOS.

## Problemas ya sospechados

| Área | Riesgo actual |
| --- | --- |
| `/auditar` | Densidad cognitiva y demasiadas decisiones visibles al mismo tiempo |
| `/acceso` | Posible mezcla entre descubrimiento comercial, login y sesión activa |
| Consola CEO | Útil pero cargada y muy orientada a escritorio |
| Núcleo documental | Si el flujo no es claro, la promesa completa del producto pierde confianza |

## Capturas visuales a evaluar

| Superficie | URL imagen |
| --- | --- |
| Home móvil | https://files.manuscdn.com/user_upload_by_module/session_file/310519663473809458/fprpkpjSDEdIOIdy.png |
| Acceso móvil | https://files.manuscdn.com/user_upload_by_module/session_file/310519663473809458/dYhOFYvcuoKGiSSy.png |
| Auditar móvil | https://files.manuscdn.com/user_upload_by_module/session_file/310519663473809458/SmlMKxQIXHJRLLNz.png |
| CEO escritorio | https://files.manuscdn.com/user_upload_by_module/session_file/310519663473809458/AvHMxPsPoHBwfOkv.png |

## Instrucciones de evaluación

Evalúa las capturas como si fueras:

- un **trabajador común mexicano** que no conoce el producto;
- una persona que ya decidió probar y necesita entender rápido el flujo;
- un **operador o CEO** que necesita claridad y control, no ruido.

## Preguntas obligatorias

1. ¿Cuál es la superficie **más confusa** hoy y por qué?
2. ¿Qué elemento concreto sobra, distrae o compite por atención en cada pantalla?
3. ¿Qué parte del flujo no deja suficientemente claro **qué sigue**?
4. ¿Dónde hay señales de redundancia, ruido visual o exceso de densidad?
5. Si solo pudiéramos hacer **10 correcciones de simplificación final**, ¿cuáles serían y en qué orden?
6. ¿Qué pantallas ya están suficientemente bien y conviene no tocar demasiado?

## Formato obligatorio

Responde SOLO con JSON válido usando exactamente este esquema:

```json
{
  "most_confusing_surface": {
    "surface": "string",
    "why": "string"
  },
  "screen_by_screen": [
    {
      "screen": "home|acceso|auditar|ceo",
      "what_is_clear": ["string", "string"],
      "what_is_confusing": ["string", "string"],
      "what_feels_redundant": ["string", "string"],
      "next_step_clarity_score": 1,
      "do_not_touch": ["string"]
    }
  ],
  "top_10_simplification_fixes": [
    {
      "order": 1,
      "surface": "string",
      "fix": "string",
      "impact": "high|medium|low",
      "reason": "string"
    }
  ],
  "final_closure_focus": ["string", "string", "string"],
  "executive_verdict": "string"
}
```
