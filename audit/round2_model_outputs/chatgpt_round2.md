```md
## Calificación actual
7.6/10

## Por qué todavía no es 9/10
El producto ha avanzado, pero sigue estancado en un umbral medio-alto por una razón principal: la **densidad y competencia visual entre módulos secundarios y la acción principal** en las rutas críticas (especialmente Home y `/auditar` en móvil). La experiencia aún no es lo suficientemente directa ni enfocada, lo que genera fatiga, ralentiza la toma de decisiones y diluye el valor percibido. Además, `/ceo` sigue adoleciendo de una jerarquía visual insuficiente para un dashboard ejecutivo, y `/acceso` aún no transmite inequívocamente su función operativa. El producto transmite solidez, pero no logra una experiencia “frictionless” ni una claridad radical que marquen la diferencia entre un 7.x y un 9. El riesgo de sobre-ingeniería y exceso de funcionalidades visibles es real: cada mejora suma, pero también compite por atención y puede saturar.

## Top 5 cambios de mayor impacto
| Prioridad | Ruta | Problema | Cambio propuesto | Impacto esperado |
|---|---|---|---|---|
| 1 | Home (móvil) | Exceso de bloques y módulos secundarios compitiendo antes de la acción principal (subir/crear expediente) | Colapsar/ocultar por defecto todos los bloques secundarios (FAQs, señales, testimonios, onboarding, etc.) y dejar solo el hero, CTA y demo en primer viewport. Añadir toggles/“ver más” para expandir el resto solo bajo demanda. | Reduce sobrecarga cognitiva, acelera conversión, transmite foco. Puede subir la nota hasta +0.5 solo con este cambio. |
| 2 | `/auditar` (móvil) | Competencia entre módulos de valor agregado y la tarea principal (subida y revisión documental) | Implementar tabs o acordeones para agrupar módulos secundarios (recomendaciones, onboarding, historial, copiloto, etc.) y dejar solo el flujo de subida/documento visible por defecto. | Mejora claridad, reduce fricción y fatiga. Impacto estimado: +0.3 en la nota. |
| 3 | `/ceo` (desktop) | Densidad visual, jerarquía insuficiente, fatiga al escanear KPIs y módulos | Reorganizar el dashboard en bloques claramente jerarquizados: KPIs clave arriba, filtros y acciones ejecutivas fijas, módulos secundarios colapsados o en tabs. Usar más whitespace y tipografía diferenciada. | Facilita escaneo y acción ejecutiva, reduce fatiga. Impacto: +0.2 en la nota. |
| 4 | `/acceso` | Aún no es inequívocamente una pantalla de acceso operativo; demasiados elementos secundarios visibles | Eliminar o colapsar cualquier copy, ayuda o branding no esencial. Usar layout centrado, fondo neutro, y solo campos de acceso + CTA. Incluir un microcopy muy claro (“Acceso seguro a tu expediente”) y nada más. | Reduce dudas, acelera login, transmite confianza. Impacto: +0.1-0.2. |
| 5 | Home y `/auditar` (móvil) | Persisten microcopys y bloques secundarios que compiten con la acción principal | Auditar y recortar sin piedad cualquier texto, ayuda o bloque que no sea esencial para la tarea principal. Usar tooltips o “?” contextuales en vez de bloques visibles. | Gana velocidad y foco, reduce ruido. Impacto: +0.1-0.2. |

## Estrategia elegida para la siguiente ronda
A) Compactar todavía más Home y `/auditar` en móvil.

**Justificación:**  
El mayor cuello de botella para llegar a un 9/10 está en la experiencia mobile-first, donde la densidad visual y la competencia entre módulos siguen frenando la percepción de calidad y facilidad de uso. Si no se resuelve esto, cualquier otra mejora será marginal. Compactar y colapsar radicalmente los bloques secundarios, priorizando solo la acción principal en el primer viewport, tendrá el mayor impacto marginal en conversión, claridad y satisfacción. Es la vía más rápida y efectiva para desbloquear la siguiente subida de nota.

## Qué no tocar todavía
- **No añadir más módulos, funcionalidades ni bloques secundarios** en ninguna ruta. El riesgo de sobre-iteración y saturación es alto.
- **No rediseñar la identidad visual ni la navegación global**: ya cumplen su función y tocarlas ahora solo introduce ruido y retrabajo.
- **No modificar la arquitectura de backend ni los flujos de autenticación**: los problemas actuales son de presentación y foco, no de lógica o performance.
- **No tocar los módulos de valor agregado individuales** (copiloto, OCR, comparativas) salvo para colapsarlos visualmente; cada uno ya aporta valor, el problema es la suma visible.
- **No recortar la demo ni el CTA principal** en Home: son los únicos elementos que deben permanecer siempre visibles.

En resumen: el producto está atascado por exceso de visibilidad y densidad, no por falta de capacidades. El siguiente salto solo se logrará quitando y colapsando, no sumando.
```
