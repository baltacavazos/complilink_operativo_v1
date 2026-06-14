# Dossier de contexto para auditoría multi-IA de CompliLink Operativo V1

## Objetivo

Este dossier resume la evidencia estructural, visual y editorial necesaria para que tres modelos externos —ChatGPT, Grok y Gemini— evalúen la plataforma **CompliLink Operativo V1 / AuditaPatron** desde una pregunta concreta: **qué se siente todavía `live coded`, repetitivo o poco humano, y qué habría que cambiar para llevar la experiencia a un consenso mínimo de 9/10**.

La revisión debe centrarse en percepción de producto, no solo en corrección técnica. El moderador consolidará después coincidencias y divergencias entre modelos.

## Contexto del producto

La plataforma es una aplicación de auditoría laboral para trabajadores mexicanos. Permite subir documentos como CFDI/XML, contratos, recibos de nómina y otros archivos para detectar discrepancias salariales y ordenar evidencia laboral. El stack actual es React 19, Tailwind 4, Express 4, tRPC 11, Drizzle ORM y MySQL/TiDB. El diseño usa tema dark por defecto y una paleta teal/slate en el sistema global, aunque la home pública opera con fondos claros y múltiples variantes cromáticas locales.

## Evidencia estructural consolidada

| Área | Evidencia | Lectura de auditoría |
| --- | --- | --- |
| `client/src/pages/Auditar.tsx` | 14,144 líneas | Señal muy fuerte de monolito frontend y crecimiento incremental dentro de un único archivo |
| `client/src/pages/Home.tsx` | 3,027 líneas | Landing extremadamente larga con alrededor de 20 secciones o bloques funcionales |
| `client/src/pages/CeoDashboard.tsx` | 4,637 líneas | Dashboard complejo que ya depende de múltiples módulos auxiliares |
| `client/src/pages/Access.tsx` | 597 líneas | Pantalla de acceso moderada, pero con varios mecanismos de entrada |
| `client/src/index.css` | Sistema de tokens semánticos con OKLCH | Existe base de design system, pero su aplicación es inconsistente en la landing |

## Hallazgos técnicos y de diseño ya confirmados

La home pública contiene una paleta fragmentada con múltiples fondos hardcodeados como `bg-[#e7f2f0]`, `bg-[#eef6f5]`, `bg-[#eaf5f3]`, `bg-[#edf7f6]`, `bg-[#f2f5f7]`, `bg-[#e7eff0]`, `bg-[#edf4f6]`, `bg-[#f3f8f8]`, `bg-[#f2f7f6]`, `bg-[#f7fafb]` y `bg-[#e8f1f0]`. Esta fragmentación convive con un `index.css` relativamente ordenado, lo que sugiere desviación local respecto del sistema de tokens, no ausencia total de sistema.

En `Home.tsx` se identificaron múltiples variantes de copy tipo A/B en el hero (`heroCopyVariants`) y también IDs duplicados, por ejemplo `id="privacidad"` aparece dos veces. La landing tiene aproximadamente veinte secciones independientes, entre ellas `SiteHeader`, `HeroSection`, `HeliosFirstEntrySection`, `QuickTrustSection`, `ConfidenceMagicSection`, `CopilotPreviewSection`, `HowItWorksSection`, `DossierSection`, `PriorityDocumentsSection`, `MobileOnboardingSection`, `GuidedTourSection`, `FindingsExamplesSection`, `PrivacySection`, `MobilePriorityPathSection`, `FAQSection`, `FinalCtaSection` y `SiteFooter`.

La lectura del arranque de `Auditar.tsx` confirma demasiadas responsabilidades en un solo archivo: branding, analítica, UI primitives, drawers, legal gate, pricing, vista CEO, mensajes para RH y WhatsApp, exportaciones PDF, bóveda laboral, calculadora guiada y más. Incluso antes de entrar a la lógica profunda, el archivo ya se comporta como un contenedor de demasiados dominios de producto.

## Evidencia visual y editorial levantada desde la preview

La preview restaurada mostró una home funcional con mejor primer impacto que en iteraciones anteriores. El hero visible dice: **"Sube tu recibo y te decimos qué revisar."** La propuesta de valor es clara, concreta y útil para una audiencia mexicana no técnica. También aparecieron mensajes como **"Primero ves qué revisar. Si te sirve, luego decides si lo guardas o sigues con otro documento."** y **"Así de simple. Subes tu recibo. Ves una señal clara. Sabes qué hacer después."**

Sin embargo, la home sigue sintiéndose larga y acumulativa. A simple vista encadena hero, sugerencia de documento, demo o microvideo, casos anonimizados, demostración del resultado, explicación de privacidad, FAQ y CTA final. El tono general es mejor que antes, pero persiste la sensación de que el producto fue mejorado por capas sin una poda editorial final. La hipótesis actual es que el principal problema ya no es falta de claridad inicial, sino **sobre-explicación modular**.

## Señales específicas de posible feeling `live coded`

| Señal | Descripción | Riesgo percibido |
| --- | --- | --- |
| Monolitos gigantes | `Auditar.tsx` y `Home.tsx` concentran demasiada lógica y narrativa | Sensación de producto ensamblado y difícil de mantener |
| Repetición de CTAs | `Empezar auditoría gratis` aparece varias veces | Da impresión de insistencia mecánica o funnel no podado |
| Repetición de promesa | Múltiples bloques repiten que basta un recibo para empezar y ver una señal | Debilita sofisticación editorial |
| Paleta fragmentada | Fondos hardcodeados fuera del sistema de tokens | Baja coherencia visual y sensación de diseño artesanal incompleto |
| A/B copy residual | Variantes de hero coexistiendo en el código | Sugiere exploración acumulada sin consolidación final |
| IDs duplicados | Por ejemplo `privacidad` | Señal de acumulación y riesgo de descuido estructural |

## Criterios de evaluación para cada modelo

Cada modelo debe evaluar la plataforma con una escala de 1 a 10 en cinco dimensiones: **UX**, **copy**, **arquitectura frontend**, **consistencia visual** y **feeling humano/pulido**. Además, debe proponer un **score global actual** y responder si ve una ruta creíble para llevar el producto a **9/10** sin reescribirlo todo desde cero.

La crítica debe ser concreta y accionable. No sirve decir simplemente que el producto está “muy largo” o “muy cargado”; se necesita identificar exactamente qué bloques sobran, qué capas deberían fusionarse, qué tokens deberían normalizarse, qué módulos deberían extraerse y qué decisiones hacen que el sistema se perciba más trabajado que improvisado.

## Preguntas obligatorias para la auditoría externa

1. ¿Qué partes del producto transmiten todavía una sensación de `live coded`, crecimiento por acumulación o refactor incompleto?
2. ¿Qué patrones de repetición narrativa o visual están degradando la percepción de calidad?
3. ¿Qué tres cambios de mayor impacto harían que la plataforma se sintiera más humana, contenida y editorialmente resuelta?
4. ¿Qué elementos actuales sí deben preservarse porque ya transmiten claridad, confianza o utilidad real?
5. ¿Cuál es el score actual por dimensión y el score global?
6. ¿Qué plan de mejora priorizado permitiría aspirar creíblemente a 9/10?

## Formato de salida esperado de cada modelo

Cada modelo debe devolver un objeto estructurado con los siguientes campos: `model`, `global_score`, `dimension_scores`, `strengths`, `live_coded_signals`, `repetition_signals`, `visual_consistency_findings`, `frontend_architecture_findings`, `top_3_changes`, `what_to_preserve`, `path_to_nine`, `confidence`, `notable_quotes`.

## Restricciones para los modelos externos

La revisión debe enfocarse en experiencia, arquitectura y consistencia percibida. No deben proponer una reescritura total salvo que sea estrictamente inevitable. Deben asumir que la plataforma ya está operativa y que se busca una **ronda de refinamiento de alto impacto**, no una refundación completa.

## Archivos de referencia auditados

| Archivo | Rol |
| --- | --- |
| `client/src/pages/Home.tsx` | Landing pública principal |
| `client/src/pages/Auditar.tsx` | Flujo principal de auditoría |
| `client/src/pages/CeoDashboard.tsx` | Dashboard operativo/administrativo |
| `client/src/pages/Access.tsx` | Acceso y autenticación |
| `client/src/App.tsx` | Ruteo global |
| `client/src/index.css` | Tokens globales y bases de tema |
| `tmp_platform_audit_browser_notes_phase2.md` | Evidencia visual y notas de auditoría |

## Nota del moderador

El consenso mínimo aceptable del debate final es **9/10**. Esto no significa falsear acuerdo, sino forzar una síntesis rigurosa: identificar dónde los tres modelos convergen con suficiente evidencia como para sostener un veredicto sólido y un plan de mejora de alta convicción.
