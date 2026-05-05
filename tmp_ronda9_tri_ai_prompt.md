Eres un auditor UX/UI senior especializado en producto móvil, flujos documentales y microcopy legal-laboral en español de México.

Contexto del producto:
- Producto: Auditapatrón.
- Usuario final: trabajador en México que sube documentos laborales para revisar señales de riesgo o inconsistencias.
- Tono exigido: cercano pero institucional.
- Restricciones: cero jerga técnica visible al usuario, nada de nombres internos, experiencia simple y confiable, sin scroll lateral móvil.

Objetivo de esta consulta:
Quiero que evalúes una nueva ronda de mejora en /auditar con dos frentes concretos:
1. Compactar todavía más el veredicto móvil post-subida para acercarlo a una calidad 9/10 sin perder claridad.
2. Detectar el error residual del primer upload móvil y proponer la corrección más segura.

Hallazgos ya observados en el código actual:
1. En el bloque post-subida móvil todavía existe un hero secundario con copy y ayudas duplicadas. El fragmento relevante hoy contiene textos como:
- "Si quieres subir otro archivo, aquí puedes hacerlo en un paso."
- "Tu resultado principal ya quedó arriba. Este bloque solo te sirve para seguir fortaleciendo el expediente con otro documento cuando lo necesites."
- CTA: "Asegurar otra evidencia"
- Hint: "Toma foto o elige un archivo guardado cuando quieras sumar otra pieza útil."
2. En el primer upload móvil, los selectores de "Tu espacio" y "Expediente" se ocultan en móvil cuando `shouldCompactMobileUploadEntry || pendingDraft || selectedFile || isAutoAnalyzingSelectedFile` es verdadero. Sin embargo, `selectedTenantId` y `selectedCaseId` inician vacíos y se rellenan después por efectos. Esto sugiere un riesgo residual: el usuario puede entrar al flujo de primer upload móvil con los selectores ocultos antes de tener explícitamente definido el expediente, o quedarse sin contexto visible cuando ya eligió archivo.
3. La lógica de autoanálisis solo arranca si existe archivo, tenant, case y no hay legal gate pendiente:
```ts
return (
  autoAnalyzeRequested &&
  hasSelectedFile &&
  !pendingDraft &&
  !legalGateRequired &&
  hasSelectedTenant &&
  hasSelectedCase &&
  !analyzePending &&
  !confirmPending
);
```
4. El handler manual de upload lanza este error si falta contexto:
```ts
if (!selectedTenantId || !selectedCaseId || !selectedFile) {
  setSubmitError("Selecciona un expediente y un archivo antes de continuar.");
  return;
}
```

Fragmento actual del hero post-subida:
```tsx
<h2>
  {shouldCompactPostUploadExperience
    ? "Si quieres subir otro archivo, aquí puedes hacerlo en un paso."
    : "Te diremos qué documento recibimos, qué señal encontramos y qué conviene revisar después."}
</h2>
<p>
  {shouldCompactPostUploadExperience
    ? "Tu resultado principal ya quedó arriba. Este bloque solo te sirve para seguir fortaleciendo el expediente con otro documento cuando lo necesites."
    : "Empieza con una foto o PDF. Dejamos la acción principal arriba y los detalles debajo para que el primer paso sea más claro."}
</p>
<Button>
  {selectedFile
    ? "Cambiar documento"
    : shouldCompactPostUploadExperience
      ? "Asegurar otra evidencia"
      : "Elegir documento"}
</Button>
<p>
  {shouldCompactPostUploadExperience
    ? "Toma foto o elige un archivo guardado cuando quieras sumar otra pieza útil."
    : "Empieza con una foto. No necesitas reunir todo..."}
</p>
```

Fragmento del primer upload móvil donde hoy se ocultan los selectores:
```tsx
<div
  className={`mt-6 gap-4 md:grid-cols-2 ${shouldCompactMobileUploadEntry || pendingDraft || selectedFile || isAutoAnalyzingSelectedFile ? "hidden sm:grid" : "grid"}`}
>
  <label>
    <span>Tu espacio</span>
    <select value={selectedTenantId}>...</select>
  </label>
  <label>
    <span>Expediente</span>
    <select value={selectedCaseId}>...</select>
  </label>
</div>
```

Necesito que respondas SOLO con JSON válido con este esquema exacto:
{
  "provider_view": "string, una frase",
  "post_upload_verdict": {
    "diagnosis": "string",
    "priority": "high|medium|low",
    "recommended_change": "string",
    "replacement_copy": {
      "title": "string",
      "body": "string",
      "cta": "string",
      "hint": "string"
    }
  },
  "first_upload_mobile_issue": {
    "is_real_issue": true,
    "root_cause": "string",
    "safe_fix": "string",
    "ux_copy_if_needed": "string"
  },
  "implementation_notes": ["string", "string", "string"],
  "publish_readiness": {
    "score": number,
    "blocker": "string"
  }
}

Criterios:
- Prioriza la solución más segura y de menor fricción.
- No propongas features nuevas ni rediseños grandes.
- El copy debe sonar a México, cercano pero institucional.
- Si ves duplicación innecesaria, dilo con claridad.
- Si consideras que el problema del primer upload móvil sí es real, márcalo como issue real.
