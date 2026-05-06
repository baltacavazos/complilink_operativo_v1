Eres una IA senior de CRO, analítica de producto y UX mobile. Necesito que evalúes una decisión de implementación en una landing de AuditaPatrón.

## Contexto del producto

La landing mobile ya fue recortada y optimizada para pantallas pequeñas. El siguiente paso es **mejorar medición de conversión** y **preparar una variante de hero más corta para campañas pagadas**, sin romper la experiencia actual ni la compatibilidad mobile.

## Estado actual observado en el código

### 1) Medición de CTAs existente

La landing ya tiene un helper genérico:

```ts
function goToAuditFlow(payloadOrEvent?) {
  const payload = payloadOrEvent && "preventDefault" in payloadOrEvent
    ? {}
    : ((payloadOrEvent ?? {}) as Record<string, string | number | boolean | null | undefined>);

  trackEvent("audipatron_home_cta_clicked", {
    source: "home",
    destination: "/auditar",
    ...payload,
  });

  trackFunnelStep("home_cta_clicked", {
    source: "home",
    destination: "/auditar",
    ...payload,
  });

  window.location.href = "/auditar";
}
```

Hoy ese helper **sí permite payload extra**, pero no todos los CTAs lo usan bien.

### 2) Problema actual de medición

Algunos CTAs ya mandan contexto:

```ts
onClick={() => goToAuditFlow({ placement: "vault_section_primary" })}
onClick={() => goToAuditFlow({ source: `home_mobile_priority_${item.id}` })}
```

Pero varios CTAs importantes siguen sin diferenciarse:

- CTA principal del header desktop: `onClick={goToAuditFlow}`
- CTA principal del header mobile: `onClick={goToAuditFlow}`
- CTA del menú mobile: `goToAuditFlow()`
- CTA final del bloque de cierre: `onClick={goToAuditFlow}`

Eso significa que **todavía no puedo comparar con limpieza el CTA superior vs el CTA final**.

### 3) Hero ya instrumentado

El hero sí tiene tracking más fino para otros comportamientos:

```ts
trackEvent("audipatron_home_primary_cta_redirected_to_guest_preview", {
  entry_point: "hero_primary",
  hero_variant: selectedHeroVariant,
  prediagnostic: selectedHeroPrediagnostic,
  cta_label: activeHeroVariant.ctaPrimary,
});

trackEvent("audipatron_home_sidebar_cta_redirected_to_guest_preview", {
  entry_point: "hero_sidebar",
  hero_variant: selectedHeroVariant,
  prediagnostic: selectedHeroPrediagnostic,
  cta_label: "Siguiente paso sugerido",
});

trackEvent("audipatron_home_secondary_cta_clicked", payload);
```

### 4) Hero actual

El hero principal ya está optimizado para mobile y hoy usa variantes internas (`selectedHeroVariant`) con copy relativamente desarrollado. Quiero ahora preparar una **variante aún más corta** para campañas pagadas. El objetivo no es rediseñar toda la home, sino tener una versión de hero:

- más directa,
- con menos líneas antes del primer CTA,
- mejor para tráfico frío pagado,
- sin romper la versión actual de la landing para tráfico normal.

## Lo que necesito que decidas

Quiero el enfoque de **menor riesgo y mayor claridad operativa** para dos decisiones:

1. **Cómo medir correctamente el CTA superior vs el CTA final**.
2. **Cómo introducir la variante corta del hero para campañas pagadas**.

## Restricciones

- No quiero reescribir toda la analítica.
- Prefiero cambios pequeños, trazables y fáciles de probar.
- La solución debe ser compatible con mobile small / medium / large.
- Debe preservar la landing actual para tráfico orgánico/directo si eso reduce riesgo.
- Si recomiendas una variante para campañas pagadas, explica si conviene activarla por `query param`, por `utm`, por flag interna o por otra vía simple.

## Responde SOLO en JSON válido con este esquema exacto

```json
{
  "tracking_decision": {
    "recommended_approach": "string",
    "why": "string",
    "event_strategy": "string",
    "payload_fields": ["string"],
    "top_cta_key": "string",
    "final_cta_key": "string",
    "other_ctas_to_label": ["string"],
    "risk_level": "low|medium|high"
  },
  "hero_short_variant_decision": {
    "recommended_approach": "string",
    "why": "string",
    "activation_method": "string",
    "preserve_default_hero": true,
    "copy_strategy": "string",
    "layout_strategy": "string",
    "risk_level": "low|medium|high"
  },
  "implementation_order": [
    "string"
  ],
  "do_now": [
    "string"
  ],
  "avoid_now": [
    "string"
  ],
  "final_recommendation": {
    "summary": "string",
    "ship_tracking_now": true,
    "ship_short_hero_now": true,
    "confidence": "low|medium|high"
  }
}
```
