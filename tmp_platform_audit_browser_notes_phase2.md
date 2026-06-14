# Hallazgos iniciales de auditoría visual

## Navegación 1: dominio publicado `auditapatron.com`

La URL principal publicada redirige a un flujo de autenticación hospedado por Manus. La pantalla visible es de inicio de sesión y no permite auditar la home pública de marketing sin autenticarse. Esto sugiere una posible fricción entre dominio principal y experiencia de descubrimiento de producto, porque la primera impresión no es una landing sino un muro de acceso.

## Navegación 2: preview activo del proyecto

La vista previa del proyecto no cargó la interfaz principal. El navegador mostró un error runtime visible: `TypeError: Failed to fetch dynamically imported module: ... /src/pages/Home.tsx`. Esto constituye evidencia técnica relevante para la auditoría porque degrada la confiabilidad percibida y añade una señal fuerte de fragilidad operativa. También impide, por ahora, la revisión visual completa desde la preview.

## Navegación 3: preview restaurado tras reinicio del servidor (2026-06-14)

La home pública cargó correctamente en la preview expuesta del puerto 3000. El hero visible confirma un tono más humano y directo que antes: `Sube tu recibo y te decimos qué revisar.` La propuesta de valor inicial es clara y específica, pero la landing sigue siendo muy larga y secuencial, con múltiples bloques que repiten la misma idea central: empezar con un recibo, ver una señal clara, decidir si seguir.

Se observan varias capas narrativas en cascada: hero + tarjeta de documento sugerido + microvideo guiado + casos anonimizados + demo de resultado + invitación a subir documento + argumento de privacidad + FAQ + CTA final. La experiencia se siente más útil que ornamental, pero todavía transmite ensamblaje incremental por acumulación de bloques, en lugar de una jerarquía editorial más contenida.

También hay repetición visible de CTAs (`Empezar auditoría gratis`) y microcopys equivalentes distribuidos en varias secciones. En el footer apareció un aviso de preview mode indicando que la página no está publicada directamente; esto no afecta la auditoría de composición, pero sí confirma que la revisión visual se hizo sobre entorno de desarrollo.

### Fragmentos de copy visibles relevantes

- `¿Te están pagando bien? Sube tu recibo y te mostramos si hay algo raro en tu pago.`
- `Primero ves qué revisar. Si te sirve, luego decides si lo guardas o sigues con otro documento.`
- `Así de simple. Subes tu recibo. Ves una señal clara. Sabes qué hacer después.`
- `Empieza gratis tu auditoría laboral y paga solo cuando ya te genere valor.`

### Lectura preliminar de feeling

- La landing ya no se siente improvisada en el primer pantallazo; el problema principal parece ser **sobre-explicación modular**, no ausencia de intención.
- La suma de muchos módulos pequeños con promesas muy parecidas sigue acercando la experiencia a un producto `live coded` que fue mejorado por capas sin una poda editorial final.
- El contraste multi-IA debe concentrarse en si la mejora pendiente es de arquitectura visual/editorial, no solo de copy suelto.

### Anomalía a verificar

- En la extracción markdown, el enlace `Salida rápida` apareció apuntando a `https://news.google.com/`. Esto puede ser una anomalía de extracción o un enlace mal configurado; conviene verificarlo aparte durante la fase de síntesis.


## Evidencia técnica complementaria de diseño y arquitectura

La lectura de `client/src/index.css` confirma que sí existe una base de tokens globales con variables semánticas (`--background`, `--foreground`, `--primary`, `--border`, `--sidebar`, etc.) y una implementación en OKLCH tanto para modo claro como oscuro. Esto significa que el problema visual no nace de ausencia total de sistema, sino de una **disciplina inconsistente en su aplicación**, porque en la home ya estaban detectados múltiples fondos hardcodeados fuera de ese sistema.

En otras palabras, la plataforma tiene un esqueleto de design system suficiente para verse coherente, pero la landing pública parece haberse expandido con decisiones locales que escapan a los tokens globales. Ese contraste entre `index.css` relativamente ordenado y `Home.tsx` muy largo con paleta fragmentada es una señal fuerte de crecimiento incremental no totalmente refactorizado.

La lectura del arranque de `client/src/pages/Auditar.tsx` refuerza la hipótesis de monolito `live coded`. Incluso en sus primeras 220 líneas ya acumula branding, analítica de comercio, UI primitives, drawers, legal gate, pricing, estados de CEO view, mensajes para WhatsApp/RH, referencias a exportación PDF, bóveda laboral y una larga sección de marcadores de compatibilidad de copy. Antes de entrar a la lógica profunda, el archivo ya expone demasiadas responsabilidades conceptuales para un solo punto de entrada.

La presencia de un comentario enorme con decenas de strings de interfaz y pistas de layout también sugiere un proceso de iteración continua dentro del mismo archivo, con poca extracción de submódulos de presentación. Esta es una de las evidencias más sólidas para que la ronda multi-IA evalúe no solo UX y copy, sino especialmente **arquitectura frontend, mantenibilidad y sensación de producto pulido vs producto ensamblado**.

