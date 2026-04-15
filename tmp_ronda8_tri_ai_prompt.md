Contexto: Estoy mejorando la sección "Mi archivo digital" en la página /auditar de Auditapatrón para trabajadores en México. Ya existe una lista de documentos confirmados del expediente digital, un botón para abrir el más reciente y un CTA por tarjeta de "Ver documento". También ya existe una sección superior que hace visible el expediente justo después del resultado principal.

Objetivo de esta ronda:
1. Añadir identificación visual clara en cada tarjeta del archivo digital con miniatura o, si es mejor, una tipología/insignia visual de archivo.
2. Incorporar filtros simples por tipo y fecha dentro del archivo digital.
3. Crear una acción fija en móvil para volver rápidamente al expediente digital sin obligar al usuario a hacer mucho scroll.

Restricciones:
- Debe ser extremadamente intuitivo para personas no técnicas.
- Debe transmitir confianza y orden.
- Debe evitar jerga técnica.
- Debe funcionar bien en móvil.
- No debe sobrecargar la interfaz.
- Los documentos ya tienen al menos nombre, tipo documental y fecha de incorporación.
- Existe apertura segura del documento por botón.

Necesito una respuesta breve y práctica en JSON estricto con esta forma:
{
  "recommended_visual_strategy": "miniature" | "file_type_badge" | "hybrid",
  "visual_reason": "string",
  "recommended_filters": ["type", "date", "recent_first", "chips", "month_grouping"],
  "mobile_return_pattern": "sticky_button" | "floating_chip" | "bottom_sheet_shortcut",
  "priority_order": ["visual", "filters", "mobile_return"],
  "ui_copy": {
    "section_hint": "string",
    "recent_button": "string",
    "filter_label": "string",
    "mobile_return_label": "string"
  },
  "risks": ["string"],
  "implementation_notes": ["string"]
}

Devuelve solo JSON válido. Sin markdown. Sin explicación extra.
