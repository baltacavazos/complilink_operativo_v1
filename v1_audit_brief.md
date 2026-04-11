# Brief de auditoría de cierre V1

## Objetivo

Realizar una auditoría corta y estrictamente priorizada para determinar **qué falta realmente para cerrar la versión 1** de **AuditaPatron / CompliLink Operativo**. El objetivo no es expandir alcance ni proponer ideas bonitas, sino distinguir con dureza qué debe entrar **antes** del cierre V1 y qué puede esperar.

## Estado actual verificado

El proyecto ya pasó varias rondas de endurecimiento funcional, técnico y de pruebas.

| Área | Estado actual |
| --- | --- |
| Flujo principal `/auditar` | Endurecido en happy path y errores críticos; se añadieron validaciones negativas y de borde |
| Consola CEO | Ya tiene snapshot ejecutivo, filtros avanzados, búsqueda transversal, exportes PDF/CSV, auditoría de exportes, acciones seguras, trazabilidad y varios guardrails V1 |
| Autenticación | Existe flujo unificado con **Manus OAuth**, **correo passwordless** y preparación de **Google OAuth** sin romper la base previa |
| Calidad | La suite completa de pruebas volvió a quedar **en verde** después de aislar como opt-in el smoke test externo del bridge TLS |
| Bridge externo | El contrato local quedó validado de forma determinista; los smoke tests reales ya no rompen la suite por defecto |
| Infra interna | Se añadieron varios hardenings contra payloads base64 patológicos, validación de MIME/magic bytes y protección de exportes |

## Restricciones para esta auditoría

1. No proponer features cosméticas, marketing, rediseños amplios ni expansión de producto.
2. Priorizar solamente bloqueantes de salida V1 relacionados con **seguridad, permisos, confiabilidad, claridad operativa, continuidad del flujo principal, autenticación o escalabilidad mínima razonable**.
3. Si un pendiente puede esperar a una versión posterior sin comprometer el uso inicial con empresas conocidas o pilotos controlados, debe quedar fuera del núcleo V1.
4. No asumas que un pendiente en `todo.md` es automáticamente bloqueante; debes re-priorizarlo por impacto real.

## Pendientes candidatos hoy visibles

| Pendiente candidato | Contexto |
| --- | --- |
| Reforzar el gate de acceso y el bloqueo de exportes stale del Dashboard CEO si aún existen huecos reales | Hay antecedente de endurecimientos previos; falta decidir si todavía es bloqueante o ya quedó cubierto |
| Ejecutar un bloque final de endurecimiento V1 sobre permisos, validaciones y pruebas del Dashboard CEO | Puede ser cierre natural, pero hay que decidir si sigue siendo necesario antes de release |
| Implementar acciones administrativas seguras para la consola CEO con trazabilidad y control exclusivo para administradores | Existe mezcla de tareas históricas y tareas ya parcialmente cerradas; hay que decidir si aún falta algo material |
| Posponer integración activa con Helios y mantener AuditaPatron desacoplado operativamente | Necesitamos saber si esto debe considerarse requisito explícito de cierre V1 |
| Elegir el siguiente bloque interno de mayor impacto para cerrar V1 sin depender de Helios | Puede ser un criterio de priorización, no necesariamente una tarea técnica única |
| Evaluar cuellos de botella internos probables para una primera escala hacia miles de usuarios | Determinar si esto es V1 o V1.1 |
| Ampliar el contexto del script multi-IA para reducir recomendaciones alucinadas o repetidas | Puede mejorar la operación interna, pero quizá no sea un bloqueante del producto |
| Tomar la vista rescatada de CAMELA como referencia para futuras capas operativas empresariales | Parece claramente posterior, salvo que detectes una dependencia oculta |

## Lo que necesito de ti

Devuelve una respuesta estructurada con exactamente estas secciones:

1. **Pendientes críticos para cerrar V1**
2. **Pendientes recomendados pero no bloqueantes**
3. **Pendientes que movería después de V1**
4. **Riesgo real de liberar hoy**
5. **Siguiente bloque óptimo de trabajo**

## Criterio de severidad

| Severidad | Definición |
| --- | --- |
| Crítico | Debe resolverse antes de liberar V1 porque compromete operación, seguridad, permisos o confianza básica |
| Alto | Conviene resolverlo muy pronto; puede entrar en la última milla V1 si el costo es razonable |
| Medio | Útil pero no bloquea salida inicial controlada |
| Bajo | Deferible sin problema claro para V1 |

## Instrucción final

Sé duro, concreto y pragmático. Si el producto ya está suficientemente cerrado para una **V1 controlada**, dilo con claridad y limita la lista a lo indispensable. Si un pendiente ya está absorbido por trabajo previo, dilo en vez de volverlo a proponer.
