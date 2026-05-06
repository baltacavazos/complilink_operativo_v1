Necesito un dictamen UX/UI para una landing de AuditaPatrón ya recortada, con prioridad absoluta en compatibilidad mobile amplia.

Contexto del producto:
- Landing pública para trabajadores en México.
- Debe sentirse clara, confiable y usable en móviles pequeños, medianos y grandes.
- Objetivo: evitar overflow horizontal, densidad excesiva, CTAs apretados, targets táctiles débiles y jerarquía confusa.
- Restricción: aplicar cambios de bajo riesgo, preferentemente sin rediseñar la arquitectura general.

Hallazgos técnicos ya detectados en el código:
1. El header móvil ya acota logo y CTA, pero la CTA usa `max-w-[8rem]` y el wordmark depende de viewport width.
2. El hero móvil usa `h1` grande (`text-[2.28rem]`), múltiples tarjetas apiladas, chips uppercase y bastante padding/sombra.
3. Varias secciones colapsan a una columna en mobile, pero conservan paddings generosos y copy largo, por lo que todavía puede sentirse densa en 320–360 px.
4. Hay múltiples grids, tarjetas y pills en privacidad, bóveda, copiloto, recorrido, preguntas y pricing.
5. No hay evidencia clara de overflow horizontal en el código inspeccionado, pero sí riesgo de longitud percibida, targets secundarios juntos y títulos largos que compiten entre sí.
6. Existe una prueba responsive básica, pero aún no cubre densidad del hero, espaciado entre CTAs, ni guardrails específicos para sub-360 px.

Fragmentos representativos:
- Header móvil: CTA `max-w-[8rem]`, logo `max-w-[40vw]`, wordmark `max-w-[min(34vw,7.8rem)]`.
- Hero: `text-[2.28rem]`, badges uppercase, CTA principal `h-12 w-full`, cards con `rounded-[1.35rem]` a `rounded-[2rem]`, bloques stacked y varios `p-4`/`p-5`.
- FAQ: layout `grid` con recomendación activa + acordeón.
- Pricing: CTA principal + secundaria y principios en tarjetas.

Quiero que respondas ÚNICAMENTE en JSON válido con este esquema:
{
  "veredicto_general": "ok_con_ajustes" | "riesgo_medio" | "riesgo_alto",
  "compatibilidad_mobile_actual": {
    "small_320_359": "baja" | "media" | "alta",
    "medium_360_389": "baja" | "media" | "alta",
    "large_390_430": "baja" | "media" | "alta"
  },
  "top_5_ajustes": [
    {
      "id": "string_corto",
      "zona": "header|hero|lectura|privacidad|boveda|copiloto|como_funciona|expediente|faq|pricing|footer",
      "impacto": "alto|medio|bajo",
      "riesgo": "alto|medio|bajo",
      "cambio": "explicación concreta y breve",
      "porque": "por qué ayuda específicamente en mobile",
      "aplicar_en": ["320-359", "360-389", "390-430"]
    }
  ],
  "ajustes_a_evitar": ["lista breve de cambios que serían innecesarios o peligrosos"],
  "orden_recomendado": ["id1", "id2", "id3"],
  "estimacion_mejora": {
    "legibilidad": "baja|media|alta",
    "tap_targets": "baja|media|alta",
    "densidad_visual": "baja|media|alta",
    "riesgo_de_overflow": "baja|media|alta"
  },
  "dictamen_final": "máximo 90 palabras, muy concreto"
}

Criterio clave: prioriza cambios que vuelvan la landing más robusta en iPhone SE, Android pequeños y móviles modernos sin perder claridad ni confianza.
