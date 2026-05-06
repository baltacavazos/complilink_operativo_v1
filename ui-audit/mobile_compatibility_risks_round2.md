# Riesgos responsive detectados en la landing recortada

La revisión del código de `Home.tsx` y de `client/src/responsive-layout.test.ts` muestra varios puntos sensibles para móviles pequeños. El header móvil ya limita logo y CTA, pero todavía concentra una CTA con `max-w-[8rem]` y un wordmark acotado por viewport, por lo que conviene revisar truncamiento y equilibrio visual en anchos cercanos a 320-360 px.

En el hero, los principales focos de riesgo son el `h1` muy grande (`text-[2.28rem]` en móvil), múltiples tarjetas apiladas con `rounded` y `shadow` generosos, y varios bloques con chips de texto uppercase que pueden romper ritmo vertical o comprimir demasiado el ancho útil. También hay varios grids que colapsan a una sola columna en mobile, pero mantienen padding amplio y copy extenso, lo que puede hacer que la página siga sintiéndose larga incluso después de la poda.

La sección de primera lectura y los bloques de privacidad, bóveda, copiloto, recorrido y pricing siguen usando tarjetas con paddings de 4-6 y títulos largos. No se detectó overflow horizontal obvio en el código ya inspeccionado, pero sí un riesgo de densidad vertical y de targets táctiles secundarios demasiado juntos en stacks móviles.

La prueba responsive actual cubre overflow global, restricciones del header móvil, shrink-safety en `/auditar` y salida rápida, pero todavía no cubre densidad del hero, anchuras de CTAs secundarios, espaciamiento mínimo entre acciones ni simplificaciones específicas para pantallas menores a 360 px.

## Consenso OpenAI + Grok + Gemini

Las tres IAs coinciden en que la landing está razonablemente bien para móviles medianos y grandes, pero todavía necesita una ronda específica para pantallas de **320–359 px**. El consenso útil es claro: optimizar primero el **header móvil**, después el **hero** y luego reducir ligeramente la densidad de secciones apiladas y el espacio entre CTAs secundarias para mejorar taps y legibilidad.

OpenAI la ve en estado `ok_con_ajustes`, con compatibilidad media en 320–359 px y alta en 360 px en adelante. Grok y Gemini son más estrictos: califican 320–359 px como compatibilidad baja y 360–389 px como media, mientras coinciden en compatibilidad alta para 390–430 px.

Los cambios de mayor consenso y menor riesgo son: ajustar el ancho y tipografía del CTA/header móvil, reducir el tamaño del `h1` y parte del padding del hero en sub-360 px, bajar padding vertical/horizontal en secciones densas, aumentar la separación entre CTAs donde conviven acciones primaria y secundaria, y vigilar títulos largos o chips que compiten visualmente en FAQ y bloques similares.
