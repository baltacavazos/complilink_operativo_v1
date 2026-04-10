# Brief de auditoría corta para cierre V1

## Objetivo

Realizar una auditoría corta y estrictamente priorizada para cerrar la versión 1 de **AuditaPatron / CompliLink Operativo**. El objetivo no es proponer features nuevas, sino detectar solamente huecos **fundamentales** que bloquearían una salida V1 razonable.

## Estado actual verificado

La base ya cuenta con dos rondas recientes de endurecimiento del Dashboard CEO.

| Área | Estado actual |
| --- | --- |
| Dashboard CEO | Existe snapshot ejecutivo, filtros avanzados, búsqueda transversal, exportes PDF/CSV, acciones seguras y trazabilidad |
| Endurecimiento frontend | Confirmación visual reutilizable, indicador de vista stale y bloqueo preventivo |
| Endurecimiento backend | Guardrails para exigir contexto fresco y secuencias seguras en acciones ejecutivas |
| Calidad | 27 pruebas Vitest venían en verde en la ronda anterior, sin errores de TypeScript reportados |
| Alcance deseado | Cerrar V1 con lo mínimo indispensable |

## Flujos visibles del producto

| Ruta | Propósito |
| --- | --- |
| `/` | Home pública y narrativa de entrada hacia el expediente laboral |
| `/auditar` | Flujo principal del usuario: carga documental, revisión inicial, expediente, claridad legal/operativa |
| `/ceo` y subrutas | Consola CEO para snapshot ejecutivo, alertas, accesos y trazabilidad documental |
| `/legal/*` | Documentos legales |

## Hallazgos arquitectónicos ya presentes

| Componente | Observación |
| --- | --- |
| `client/src/App.tsx` | Rutas principales mínimas y directas |
| `client/src/pages/Home.tsx` | Home extensa, con CTA principal hacia `/auditar` y acceso visible a Consola CEO |
| `client/src/pages/Auditar.tsx` | Flujo nuclear del producto, muy amplio, con intake, preanálisis, seguridad social, expediente y asistente |
| `client/src/pages/CeoDashboard.tsx` | Consola CEO amplia con filtros, exportación, confirmaciones, stale state y acciones seguras |
| `server/routers.ts` | Endpoints CEO con validación de expectedCurrentStatus, secuencia segura y scope acotado |
| `server/ceoDashboardSafeActions.test.ts` | Cobertura específica de las acciones seguras del CEO |

## Restricciones de producto

1. No agregar features cosméticas ni nice-to-have.
2. Sólo señalar bloqueantes de salida V1 o mejoras que eviten un fallo importante de operación, confianza, seguridad, permisos o UX crítica.
3. Si sugieres algo para la Consola CEO, debe ser porque realmente afecta la operación V1.
4. Prioriza happy path, errores críticos sin manejar, permisos, claridad de UX, consistencia y estabilidad.

## Lo que necesito de ti

Devuelve una respuesta estructurada con exactamente estas secciones:

1. **Top 5 bloqueantes V1**
2. **Qué NO tocaría antes del release**
3. **Ajustes mínimos recomendados para el Dashboard CEO**
4. **Riesgo si se libera hoy**
5. **Orden sugerido de implementación**

## Criterio de severidad

Usa esta escala:

| Severidad | Definición |
| --- | --- |
| Crítico | Puede romper confianza, operación o seguridad central del producto |
| Alto | Daña el uso principal o deja huecos importantes de control/claridad |
| Medio | Conviene corregirlo, pero no necesariamente bloquea V1 |
| Bajo | Puede esperar después del release |

## Instrucción final

Sé duro, concreto y pragmático. Si ves que el producto ya está suficientemente cerrado para V1, dilo claramente y limita la lista a lo indispensable.
