# Consenso tri-IA app-first — Jul 15, 2026

## Fuentes internas

| Fuente | Ruta |
|---|---|
| Artefacto principal tri-IA | `/home/ubuntu/complilink_operativo_v1/artifacts/tri_ai_conversion_premium.json` |
| Script usado | `/home/ubuntu/complilink_operativo_v1/tri_ai_conversion_premium.py` |
| Checkpoint posterior ronda 1 | `manus-webdev://755d3daa` |
| Checkpoint posterior ronda 2 | `manus-webdev://c769a30b` |

## Hallazgos compartidos

Los tres modelos coincidieron en que la experiencia debía moverse todavía más hacia una lógica **app-first**: menos explicación dentro de la app, una ruta principal más obvia para subir documento y una web que no compitiera con una app futura todavía no disponible.

| Modelo | Consenso principal | Superficie prioritaria |
|---|---|---|
| ChatGPT | Simplificar el texto introductorio y dejar un CTA principal muy claro para subir el recibo o documento. | `/auditar` |
| Grok | Reducir texto inicial, hacer más obvio el camino de auditoría y evitar que la promesa de app futura distraiga de empezar hoy. | `/auditar`, `Home`, `/acceso` |
| Gemini | La sección de descarga de app en web estaba compitiendo con la conversión actual; convenía redirigir el foco a empezar hoy en web y mantener la app como promesa futura breve. | `Home` |

## Decisiones ejecutadas

| Ronda | Cambios aplicados | Estado |
|---|---|---|
| Ola app-first | `Home` reorientada para empezar hoy en web; sección de app futura compactada; `/auditar` más directa; `/acceso` con copy más corto de retorno. | Hecho |
| Micro-ronda app-first II | `Home` con entrada principal más compacta; `/acceso` reducido a una sola promesa visible de retorno en el bloque inferior. | Hecho |

## Strings clave aprobados tras la implementación

| Superficie | Cambio visible |
|---|---|
| `Home` | "App móvil en camino" |
| `Home` | "Empieza hoy aquí. La app viene después." |
| `Home` | "No necesitas esperar: la revisión gratuita ya funciona aquí." |
| `/auditar` | "Sube y revisa en segundos" |
| `/auditar` | "Sube tu recibo gratis" |
| `/auditar` | "Sube foto o archivo. Recibes una revisión gratis en segundos." |
| `/acceso` | "Escribe tu correo, recibe tu código y vuelves directo a ..." |
| `/acceso` | "Tu correo solo abre tu acceso y te devuelve directo a tu revisión." |

## Validación técnica lograda

| Validación | Resultado |
|---|---|
| `pnpm check` | Verde |
| `pnpm exec vitest run client/src/pages/ux.copy.test.ts client/src/pages/Auditar.alerts.test.ts client/src/pages/wave9.mobile-web-separation.test.ts` | 63 pruebas en verde |

## Próxima prioridad sugerida

La siguiente oportunidad natural es seguir reduciendo fricción visible en la primera pantalla post-entrada, especialmente donde aún compiten varios bloques de apoyo o explicaciones secundarias frente al camino principal de **subir → ver señal → continuar**.
