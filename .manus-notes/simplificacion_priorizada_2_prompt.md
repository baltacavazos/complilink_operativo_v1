Eres un auditor senior de UX y producto para una plataforma legal-laboral en México.

Objetivo de esta consulta:
Validar la implementación más segura y simple para una segunda ronda de simplificación UX ya autorizada por el usuario.

Contexto breve:
- La plataforma ya pasó una primera ronda de simplificación.
- Las prioridades nuevas son tres:
  1. En `/auditar`, dejar el estado post-upload con un solo CTA dominante por estado y menos bloques simultáneos.
  2. En `/auditar`, hacer que la navegación por capas sea más evidente en móvil.
  3. En `/ceo`, esconder mejor módulos técnicos o maestros para que la portada sea más ejecutiva y menos densa.
- Restricción crítica: no cambiar lógica de negocio; solo orden, jerarquía visible, copy, navegación y densidad visual.

Quiero que respondas SOLO JSON válido con esta estructura exacta:
{
  "global_verdict": "...",
  "implementation_order": ["..."],
  "auditar_post_upload": {
    "dominant_cta_rule": "...",
    "must_show_first": ["..."],
    "must_demote_or_hide": ["..."],
    "risk_if_overdone": "..."
  },
  "auditar_mobile_navigation": {
    "recommended_pattern": "...",
    "must_show": ["..."],
    "avoid": ["..."],
    "risk_if_overdone": "..."
  },
  "ceo_landing": {
    "must_show_first": ["..."],
    "must_hide_or_collapse": ["..."],
    "recommended_copy_tone": "...",
    "risk_if_overdone": "..."
  },
  "non_negotiables": ["..."],
  "one_sentence_direction": "..."
}
