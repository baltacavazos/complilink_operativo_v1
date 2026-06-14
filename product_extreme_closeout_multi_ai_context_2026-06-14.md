# Ronda extrema final — subir de 7.8/10 a 9/10+

## Objetivo

Definir los **cambios mínimos de mayor impacto** para empujar a AuditaPatron desde una evaluación estricta de 7.8/10 hacia una percepción de producto 9/10+, con foco casi exclusivo en **confianza**, **privacidad visible**, **cierre premium** y **sensación de producto terminado**.

## Restricción operativa

No queremos abrir una refactorización grande ni reescribir la plataforma. La pregunta es: **¿qué 1 a 3 ajustes concretos moverían más la nota estricta hoy mismo?**

## Estado actual resumido

### Home

La landing ya fue compactada. El hero hoy abre con una propuesta directa, menos masa visual y prueba de realidad más arriba que antes. También existe un bloque de privacidad y confianza con CTA al aviso de privacidad, más una FAQ ultracompacta.

Bloque actual de confianza en Home:

> "Tu información sigue bajo tu control."
>
> "Tu empresa no ve lo que subes. Primero ves el resultado, después decides si lo guardas, y cuando quieras puedes revisar nuestras políticas y borrar lo que ya no necesites."
>
> "No necesitas cuenta para ver la primera lectura."
>
> "Tu empresa no ve lo que subes aquí."
>
> "Si sí te sirve, luego lo guardas en tu expediente."

### /acceso

El acceso ya no se siente como formulario aislado. Hoy dice:

> "Vuelve a tu revisión sin empezar de cero"
>
> "Escribe tu correo, recibe un código de 6 dígitos y vuelves directo a tu auditoría. Tu avance te espera del otro lado."
>
> "Tu avance sigue listo"
>
> "Correo seguro" · "Código de 6 dígitos" · "Regreso directo"
>
> CTA final: "Entrar y continuar"

### /auditar

El workspace ya fue reforzado para que el valor posterior al primer hallazgo se sienta más defendible y premium. Existen mensajes y CTAs como:

> "Resultado listo para cuidar"
>
> "Guardar evidencia en mi bóveda"
>
> "Exportar hallazgo en PDF"
>
> "Tu documento sí quedó protegido"
>
> "Tu documento ya quedó guardado y listo para continuar con su revisión."

También existe copy persistente de privacidad como:

> "Nada se integra al expediente hasta que revisas y confirmas. Tu archivo sigue bajo tu control."

### /legal/privacidad

La página legal ya tiene un resumen humano visible antes del texto completo. Incluye copy como:

> "Nadie de tu empresa puede ver lo que subes. Tus documentos son tuyos. Puedes borrarlos cuando quieras."
>
> "Este aviso carga sin login para que puedas leerlo antes de usar la plataforma."

## Validación técnica ya hecha

| Validación | Estado |
| --- | --- |
| Vitest focalizado de cierre | Aprobado |
| TypeScript | Sin errores |
| Preview visual | Home, acceso y legales cargan correctamente |

## Riesgo que sigue afectando la nota

Persistió una anomalía observacional de `Salida rápida -> news.google.com` durante la extracción del navegador. Ya se hizo búsqueda textual completa en el proyecto y **no existe ninguna referencia en el código** ni a `Salida rápida` ni a `news.google.com`. Debe tratarse como riesgo perceptual externo o artefacto del entorno, no como bug confirmado del producto.

## Pregunta para esta ronda

Bajo el criterio más estricto posible, ¿qué 1 a 3 cambios concretos harías **ya** para maximizar la nota real? No propongas reescribir la arquitectura. Busca cambios pequeños o medianos con retorno muy alto.

## Formato de salida obligatorio

```json
{
  "model": "string",
  "strict_score_now": 0,
  "trust_score_now": 0,
  "verdict": "string",
  "ship_now_strict": true,
  "highest_leverage_changes": [
    {
      "surface": "string",
      "change": "string",
      "why_it_matters": "string",
      "impact": "high|medium|low",
      "effort": "high|medium|low"
    }
  ],
  "single_best_move": "string",
  "confidence": "string"
}
```

## Criterio del moderador

El moderador elegirá solo cambios que realmente puedan implementarse en una última ronda corta y que muevan la nota estricta, no cambios cosméticos triviales ni ideas grandes para una futura V2.
