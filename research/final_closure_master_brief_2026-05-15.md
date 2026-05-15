# Brief maestro de cierre final de AuditaPatron

## Prioridad del usuario

El usuario quiere concentrarse en este orden: primero cerrar la **versión final web**; después auditar iterativamente todo lo necesario para volver la plataforma **lo más intuitiva posible**, eliminando fricción, redundancia y confusión; luego dejar **Helios al 100%**; después preparar la plataforma para **miles o decenas de miles de usuarios**; y solamente al final planear la conversión a **app Android e iOS**.

## Restricciones de esta ronda

No queremos abrir un rediseño caprichoso ni meter funciones nuevas por gusto. El objetivo es una **ronda de cierre final**: simplificación, endurecimiento, confiabilidad y claridad operacional. La respuesta debe priorizar qué corregir primero para acercarnos a una versión web final realmente sólida.

## Estado técnico visible hoy

| Dimensión | Estado actual |
| --- | --- |
| Servidor dev | Corriendo correctamente |
| TypeScript / LSP | Sin errores |
| Dependencias | OK |
| Observación técnica menor | Hay una advertencia de `baseline-browser-mapping` desactualizado |
| Observación operativa persistente | El escaneo automático del CEO Bridge sigue reportando infraestructura faltante por migraciones ausentes |

## Hallazgos previos ya confirmados

### 1. Readiness para pruebas masivas

Un contraste multi-IA previo concluyó **NOT_READY_FOR_CONTROLLED_MASS_TEST**. La convergencia principal fue esta:

| Área | Hallazgo convergente |
| --- | --- |
| Performance | Riesgo por bundles grandes para tráfico elevado |
| Cobertura | Pruebas E2E insuficientes o inestables |
| UX crítica | `/auditar` y partes del asistente laboral siguen densos o cognitivamente cargados |
| Claridad de acceso | La transición entre landing, `/acceso` y sesión autenticada todavía puede confundir |
| Operación interna | Consola CEO funcional, pero cargada y muy orientada a escritorio |

### 2. Prueba funcional real con documentos del CEO

Se probó el flujo con seis documentos reales: 2 XML CFDI, 2 PDFs de recibo y 2 contratos DOCX. El sistema sí creó expedientes, aceptó XML/PDF y generó lectura preliminar, pero aparecieron fallas importantes:

| Hallazgo | Impacto |
| --- | --- |
| El bridge documental recibió o guardó **HTML de la landing** en vez de un ack JSON del motor | Crítico |
| Eso contaminó `audit_logs` y produjo errores posteriores de inserción SQL | Alto |
| Los PDFs de nómina se clasificaron como `other` | Alto |
| Un XML con deducción visible de INFONAVIT no propagó correctamente esa señal | Alto |
| Los contratos DOCX contienen valor laboral útil pero hoy se rechazan por formato | Medio-Alto |
| Las respuestas de Helios todavía se sienten genéricas y poco aterrizadas | Medio |

### 3. Home / marketing

La landing ha mejorado mucho en claridad y persuasión, pero el núcleo del proyecto ya no debe girar tanto alrededor de copy de marketing. El cuello principal está en **producto, flujo documental, confianza operativa y claridad de uso**.

## Lo que se espera de la respuesta de las IA

Quiero que cada modelo actúe como un **comité de cierre final** con mentalidad de producto, UX, QA, arquitectura y operación. Deben responder para ayudar a decidir la secuencia correcta de trabajo, no para generar ideas abstractas.

Respondan en español y con enfoque ejecutivo-práctico.

## Preguntas a responder

1. Si el objetivo es dejar la web lista para una versión final seria, ¿cuáles son los **5 frentes más urgentes** en este momento?
2. ¿Qué debe considerarse **bloqueador absoluto** antes de hablar de miles o decenas de miles de usuarios?
3. ¿Qué parte de la plataforma hoy se percibe más frágil o menos intuitiva: `Home`, `/acceso`, `/auditar`, `resultado`, `Consola CEO`, o el **bridge/Helios**?
4. Si solo pudiéramos ejecutar **3 rondas de trabajo** antes de llamar a la web “versión final”, ¿cómo las estructurarían y qué incluiría cada una?
5. ¿Qué NO conviene tocar todavía para no dispersarnos?
6. ¿En qué momento sería razonable hablar de convertir esto a app móvil nativa o React Native?

## Formato de salida requerido

Devuelve SOLO JSON válido con este esquema exacto:

```json
{
  "top_5_fronts": ["string", "string", "string", "string", "string"],
  "absolute_blockers": ["string", "string", "string"],
  "most_fragile_area": {
    "surface": "string",
    "why": "string"
  },
  "three_round_plan": [
    {
      "round": 1,
      "name": "string",
      "scope": ["string", "string"],
      "exit_criteria": ["string", "string"]
    }
  ],
  "do_not_touch_yet": ["string", "string", "string"],
  "mobile_app_timing": {
    "verdict": "string",
    "condition": "string"
  },
  "executive_verdict": "string"
}
```
