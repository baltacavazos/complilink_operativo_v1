Eres un auditor senior de UX móvil.

Contexto: estoy refinando la pantalla /auditar de Auditapatrón. Ya resolvimos el problema del primer upload móvil y ahora solo busco una última micro-ronda para bajar todavía más la altura visible del veredicto móvil posterior a la primera carga, sin romper claridad ni la acción principal.

Bloque actual relevante:
```tsx
<section className={shouldCompactPostUploadExperience ? "flex min-h-[34vh] w-full flex-col items-center justify-center space-y-2 rounded-[2rem] bg-slate-50 px-1 py-2" : "space-y-6"}>
  <div className="w-full max-w-none self-center rounded-[1.9rem] border border-emerald-200/90 bg-[linear-gradient(135deg,_rgba(250,254,251,0.998),_rgba(255,255,255,1))] px-5 py-5 shadow-[0_10px_24px_-22px_rgba(16,185,129,0.16)] sm:rounded-[2.1rem] sm:px-8 sm:py-7">
    <div className="flex flex-col gap-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-3 sm:mt-2">
          <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-700" />
          <h2 className="text-[2.35rem] leading-[0.9] sm:text-[2.7rem]">
            {tipoDocumento} confirmado
          </h2>
        </div>
        <p className="mt-1 text-center text-[1.08rem] font-semibold leading-5 text-slate-800 sm:text-[1.2rem]">
          Ya quedó listo para revisar.
        </p>
      </div>
      <div className="flex w-full flex-col gap-1.5 items-center">
        <Button className="mx-auto flex h-auto min-h-[4.8rem] w-full max-w-[22rem] items-center justify-center gap-2.5 rounded-[1.6rem] border-2 border-emerald-700 bg-emerald-700 px-5 py-3.5 text-center text-[1.34rem] leading-tight tracking-[-0.02em]">
          <ArrowRight className="h-5 w-5 shrink-0" />
          Ver qué sigue
        </Button>
        <p className="max-w-[22rem] text-center text-[13px] leading-5 text-slate-600">
          Sigue con: revisar este resultado y decidir qué documento conviene conectar después. El borrador se abre aquí mismo.
        </p>
        <button className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[13px] font-medium text-slate-500">
          Ver expediente completo
        </button>
      </div>
    </div>
  </div>
</section>
```

Restricciones estrictas:
- No eliminar la CTA principal.
- No degradar la comprensión de que el documento quedó confirmado.
- No hacer rediseño grande.
- Solo aceptar microajustes: paddings, gaps, tamaño de icono, tamaño de tipografía, orden de microcopy, o eliminación de una sola línea secundaria si realmente sobra.
- No tocar desktop salvo que el cambio sea inherentemente seguro por compartir clases responsivas.

Quiero que respondas SOLO JSON válido con este esquema:
{
  "provider_view": "string",
  "best_micro_adjustment": "string",
  "safe_edits": ["string", "string", "string"],
  "risky_edits_to_avoid": ["string", "string"],
  "recommended_publish_after_this": true,
  "reason": "string"
}
