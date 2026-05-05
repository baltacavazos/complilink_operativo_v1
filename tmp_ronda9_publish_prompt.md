Eres un auditor senior de producto digital y UX móvil para una herramienta laboral en México.

Producto: Auditapatrón.
Objetivo del producto: permitir que trabajadores suban documentos laborales y reciban una lectura inicial confiable, clara y accionable.
Tono exigido: cercano pero institucional.
Restricciones: no usar jerga técnica visible, no recargar el primer viewport móvil, cero scroll lateral, experiencia simple y confiable.

Estado anterior de esta ronda:
- Había redundancia en el bloque opcional posterior al veredicto móvil.
- Había un riesgo real en el primer upload móvil: los selectores de espacio y expediente se ocultaban demasiado pronto.

Cambios ya implementados:
1. Se añadió una lógica explícita para no ocultar los selectores del primer upload móvil hasta tener contexto suficiente.
2. Se agregó un helper visible para ese criterio:
```ts
export function shouldHideUploadContextSelectors(params: {
  isFirstDocumentFlow: boolean;
  hasSelectedFile: boolean;
  hasPendingDraft: boolean;
  isAutoAnalyzing: boolean;
  hasSelectedTenant: boolean;
  hasSelectedCase: boolean;
}) {
  if (hasPendingDraft || isAutoAnalyzing) return true;
  if (!hasSelectedFile) return false;
  if (!isFirstDocumentFlow) return true;
  return hasSelectedTenant && hasSelectedCase;
}
```
3. En móvil, ahora se muestra la ayuda: "Primero confirma tu espacio y expediente. Después puedes tomar la foto o elegir el archivo."
4. El bloque opcional post-veredicto móvil se compactó a este lenguaje:
- Título: "Sube otro archivo si lo necesitas."
- Cuerpo: "Tu resultado ya está arriba. Aquí puedes sumar otra pieza útil para fortalecer tu expediente."
- CTA: "Agregar otro documento"
- Hint: "Elige un archivo o toma una foto para sumar una pieza útil."
5. La variante compacta del hero secundario también se redujo en escritorio/tablet con el mismo enfoque de no duplicar.

Validación técnica actual:
- Pruebas focalizadas de esta ronda en verde: `client/src/pages/Auditar.alerts.test.ts` y `client/src/pages/ux.copy.test.ts` => 61/61.
- La suite completa del proyecto no está totalmente verde, pero las fallas observadas en ese barrido son previas y ajenas a esta ronda móvil (bridge secret, Dropbox, release scope y tests de homepage/server ya inestables), no ligadas al flujo específico recién tocado.
- Gemini sigue bloqueado por credencial inválida; esta reauditoría final debe basarse solo en lo disponible aquí.

Necesito que respondas SOLO con JSON válido con este esquema exacto:
{
  "provider_view": "string",
  "mobile_upload_fix": {
    "assessment": "string",
    "publish_blocker": true,
    "reason": "string"
  },
  "post_verdict_compaction": {
    "assessment": "string",
    "publish_blocker": true,
    "reason": "string"
  },
  "overall_publish_readiness": {
    "score": number,
    "recommendation": "publish_now|one_more_micro_round|hold",
    "reason": "string"
  },
  "next_best_action": "string"
}

Criterios:
- Sé estricto, pero pragmático.
- No propongas nuevas features ni rediseños grandes.
- Evalúa si los cambios actuales ya son suficientemente sólidos para publicar desde la perspectiva de UX móvil en /auditar.
- Si la recomendación no es publicar, di exactamente qué micro-riesgo sigue pesando más.
