# Health Audit Pre-Lanzamiento de AUDITAPATRON

**Autor:** Manus AI  
**Fecha:** 2026-08-06  
**Proyecto:** AUDITAPATRON / CompliLink Operativo

## Resumen ejecutivo

La plataforma **no está lista para abrirse al público todavía**. La conclusión no surge de una impresión subjetiva de interfaz, sino de una combinación clara de evidencia técnica: el servidor está arriba, TypeScript está limpio, las rutas públicas principales responden correctamente y el build de producción sí compila; sin embargo, la corrida completa de Vitest reporta **25 pruebas fallidas en 10 archivos**, incluyendo fallas en workflows centrales, integraciones externas críticas y regresiones de experiencia móvil [1] [2]. Además, la ronda comparativa con **ChatGPT, Gemini y Grok** llegó al mismo veredicto de forma unánime: **`not_ready`** [3].

En otras palabras, la plataforma ya tiene una base visual y operativa mucho más fuerte que antes, pero todavía conserva **riesgos de release** demasiado altos para exponerla a usuarios reales. Lo más delicado no es el landing ni el scroll restante; lo más delicado es que varios de los contratos internos y externos que sostienen la operación todavía no están cerrados con suficiente confiabilidad.

## Estado general por frente

| Frente | Estado | Lectura ejecutiva |
|---|---|---|
| Servidor y entorno dev | Amarillo | El servidor está corriendo y `webdev_check_status` no reporta errores de TypeScript ni de LSP, lo cual es una buena base [4]. |
| Rutas públicas | Verde | `/`, `/auditar` y `/acceso` responden `200`, así que la plataforma es accesible y navegable a nivel HTTP [1]. |
| Build de producción | Amarillo | El build termina correctamente, pero deja advertencias de chunks grandes y un warning de configuración de pnpm que conviene revisar antes de crecer tráfico real [2]. |
| Suite de pruebas | Rojo | El estado actual de pruebas es incompatible con una salida pública segura: 25 fallas en 10 archivos [1]. |
| Integraciones críticas | Rojo | Dropbox, bridge de AuditaPatron y autenticación del bridge de Helios presentan señales de configuración o contrato aún no cerradas [1] [3]. |
| UX móvil y flujo core | Amarillo | La experiencia se ve mucho más compacta y orientada a app, pero sigue habiendo regresiones de tests responsive y de copy que indican deuda de estabilidad de frontend [1]. |
| Operación y automatización | Rojo | El warning de infraestructura faltante para `CEO Bridge Schedule` indica capacidad operativa incompleta para automatizaciones relevantes [1]. |

## Lo que sí está sano hoy

Hay varios elementos importantes que sí juegan a favor del proyecto. El primero es que la aplicación **no está rota estructuralmente**: el entorno de desarrollo está estable, las rutas públicas responden, TypeScript no está marcando errores y el build de producción sí termina [1] [2] [4]. Eso significa que la base del proyecto es recuperable y que no estamos frente a una plataforma colapsada, sino frente a una plataforma que todavía necesita endurecimiento antes de exponerse a tráfico real.

El segundo punto fuerte es que la capa de producto ya muestra una dirección mucho más clara que en iteraciones anteriores. La compactación de Home, la simplificación de `/acceso` y el enfoque más app-first de `/auditar` son mejoras reales. En el estado visual actual, el proyecto transmite bastante mejor su promesa central y el flujo principal es más entendible que antes [4].

El tercer punto positivo es que existe una **cobertura amplia de pruebas**, lo cual aunque hoy duele, en realidad es una fortaleza estratégica. El sistema está fallando ruidosamente en CI local, no silenciosamente en producción. Eso permite detectar antes del lanzamiento dónde están exactamente los contratos todavía inestables [1].

## Bloqueadores críticos antes de abrir al público

### 1. Fallas en workflows centrales de backend

La señal más grave es `server/caseWorkflows.test.ts`, con **14 fallas** relacionadas con un mock incompleto de `getStoredCommerceStatusForUser` [1]. Esto es especialmente delicado porque ese archivo toca el flujo más sensible del producto: subida documental, confirmación, límites de tasa, validaciones y guardrails de identidad. Cuando un bloque tan central falla de forma tan concentrada, el problema no debe tratarse como “solo test roto”; debe asumirse como **riesgo real de regresión o contrato interno inestable**.

> “14 tests en `server/caseWorkflows.test.ts` están fallando debido a un problema de mocking (`getStoredCommerceStatusForUser`). Esto impacta directamente funcionalidades críticas como la subida de documentos, la aplicación de límites de tasa y la confirmación de auditorías.” [3]

### 2. Integración de Dropbox no confiable

La batería de pruebas de Dropbox muestra tres señales simultáneas: el módulo `dropbox` no está disponible para cierto script de restore, el auth check devuelve `401` y el scope esperado de restore también devuelve `401` [1]. Para una plataforma que va a recibir usuarios reales y datos sensibles, esto es grave porque afecta **recuperación**, **respaldo** y **restauración**. Aunque el flujo principal del usuario no dependa de Dropbox para operar minuto a minuto, la salida pública no debería ocurrir con un esquema de backup/restore todavía no verificado.

### 3. Desalineación del bridge de AuditaPatron

Dos pruebas señalan una misma anomalía: la URL configurada del webhook esperado no coincide con la URL realmente publicada por la configuración runtime [1]. Eso puede producir fallas silenciosas en integración o eventos enviados al endpoint equivocado. En un producto cuya propuesta depende de contratos entre servicios, esto es un bloqueo serio.

### 4. Bridge de Helios con autenticación inconsistente

El test del bridge de Helios muestra un comportamiento muy específico: la versión `www` devuelve `403`, mientras otra variante del host responde `200` [1]. Eso sugiere una mezcla peligrosa entre host canónico, redirects y pérdida de headers sensibles en la autenticación. Para una salida pública, esta clase de ambigüedad en dominios y headers puede convertirse en una fuente de bugs intermitentes muy costosos de diagnosticar.

### 5. Infraestructura incompleta para CEO Bridge Schedule

El log del dev server reporta que se omite el escaneo automático porque faltan migraciones del bridge [1]. Aunque no todo el producto dependa de esa parte para el primer uso del usuario final, sí es una señal de que la plataforma todavía tiene **operación incompleta** en automatización y monitoreo interno.

## Riesgos altos, aunque no necesariamente bloqueadores absolutos

| Riesgo | Severidad | Por qué importa |
|---|---|---|
| Regresiones de responsive layout y copy | Alta | Fallan pruebas específicas de Home y de la experiencia móvil, lo que indica que la capa visual todavía puede degradarse con cambios pequeños [1]. |
| Flujo de acceso de usuarios retornantes | Alta | `server/v1.release.scope.test.ts` falla en el flujo de email access, lo que impacta directamente experiencia de login y reingreso [1]. |
| Dependencia `baseline-browser-mapping` desactualizada | Media | No bloquea por sí sola, pero sí sugiere compatibilidad o baseline de navegadores desalineado [1]. |
| Chunks de frontend demasiado grandes | Media-Alta | El build pasa, pero reporta chunks por encima de 500 kB y artefactos grandes como `Auditar`, `CeoDashboard` y `jspdf`, lo que puede penalizar tiempos de carga y memoria en dispositivos móviles [2]. |
| Warning de configuración de pnpm | Media | No rompe el build, pero indica que la configuración `pnpm` en `package.json` ya no está siendo leída como se esperaba [2]. |

## Evaluación técnica detallada

### Estabilidad de código y compilación

La compilación de producción pasa, lo cual es una muy buena señal de salud sintáctica y de bundling. Sin embargo, pasar `pnpm build` **no compensa** el estado actual de la suite completa. Hoy la plataforma compila, pero **no está suficientemente validada**. Esa es una diferencia crítica de release. Un build que termina permite desplegar; una suite roja impide confiar en lo desplegado [1] [2].

### Calidad de pruebas

La plataforma tiene 341 pruebas totales, con 314 pasando, 2 skipped y 25 fallando [1]. Eso significa que la cobertura existe, pero la confiabilidad del release está comprometida. En un entorno pre-público, la referencia correcta no es “la mayoría pasa”; la referencia correcta es “los flujos de negocio y las integraciones críticas pasan”. Hoy eso no se cumple.

### Integraciones externas

Las integraciones son el frente más frágil del sistema. Dropbox falla por auth y por dependencia. El bridge de AuditaPatron muestra un desajuste de endpoint. El bridge de Helios muestra ambigüedad de host/autorización. Y hay además una infraestructura operativa incompleta para jobs relacionados al CEO Bridge Schedule [1] [3]. Si el producto empieza a recibir usuarios reales sin cerrar este frente, el mayor riesgo no será el copy ni el diseño; será **inconsistencia operacional**.

### Performance y carga inicial

El build muestra chunks grandes, con varios assets por encima del umbral de advertencia de Vite y bundles muy pesados para rutas importantes [2]. Esto no significa que el lanzamiento deba bloquearse solo por performance, pero sí indica que el producto podría sufrir en red móvil, equipos modestos o sesiones largas con usuarios concurrentes. Dado que el usuario ya expresó la intención de llevar esto a iOS/Android y hacerlo muy usable desde celular, conviene tratar este punto como prioridad temprana de endurecimiento.

## Evaluación de readiness para usuarios reales

Si hoy empezaran a crearse usuarios públicos, la plataforma probablemente **no caería de inmediato**, pero sí hay una probabilidad demasiado alta de encontrar defectos en rutas críticas: subida documental, confirmación, acceso por correo, bridges y recuperación operativa. Eso es exactamente el tipo de riesgo que erosiona confianza en una primera ola de usuarios.

La pregunta correcta no es si la app “se ve bien” o si “abre”; la pregunta correcta es si puede absorber usuarios reales sin meter al equipo en un modo reactivo de soporte. Con la evidencia actual, la respuesta todavía es **no**.

## Recomendación final de lanzamiento

> **Veredicto:** `NOT READY` para salida pública abierta. [3]

Mi recomendación es **no abrir todavía al público general**. Sí consideraría razonable una fase de endurecimiento corta y agresiva antes del lanzamiento, enfocada no en más polish visual, sino en cerrar los contratos técnicos que hoy siguen fallando.

## Top 5 acciones antes de salir al público

| Prioridad | Acción | Dueño sugerido | Motivo |
|---|---|---|---|
| 1 | Dejar la suite completa de Vitest en verde, empezando por `server/caseWorkflows.test.ts` | Backend + QA | El flujo core de documentos no puede salir con 14 fallas en workflows. |
| 2 | Corregir Dropbox end-to-end: dependencia, auth y restore scope | Backend / Infra | Sin backup/restore verificable, el riesgo operativo es demasiado alto. |
| 3 | Alinear `AUDITAPATRON_ENGINE_WEBHOOK_URL` y validar bridge de AuditaPatron | Backend | La integración contractual no debe salir con endpoint ambiguo o desalineado. |
| 4 | Corregir autenticación/host canónico del bridge de Helios | Backend | Hay riesgo de pérdida de headers o comportamiento distinto entre hosts. |
| 5 | Resolver regresiones de responsive/copy y revisar acceso de usuarios retornantes | Frontend | La experiencia pública debe ser consistente, especialmente en móvil y login. |

## Decisión operativa sugerida

La salida pública debería ocurrir **solo después** de una tanda corta de hardening con criterio de release. Mi recomendación práctica es dividir el siguiente trabajo en dos frentes. Primero, un **frente técnico de bloqueo** para dejar pruebas, Dropbox y bridges en verde. Segundo, un **frente de smoke testing real** sobre dominio público, login por correo, subida documental y flujo de expediente con uno o dos usuarios reales controlados.

Cuando ambos frentes estén cerrados, sí vería sentido en volver a evaluar lanzamiento.

## Referencias

[1]: Project artifact: `/home/ubuntu/complilink_operativo_v1/artifacts/prelaunch_health_baseline.txt` — baseline técnico con smoke de rutas, suite completa de Vitest y logs.
[2]: Project artifact: `/home/ubuntu/terminal_full_output/2026-08-06_18-22-04_355114_9369.txt` — verificación de `pnpm build` y advertencias de tamaño/configuración.
[3]: Project artifact: `/home/ubuntu/complilink_operativo_v1/artifacts/tri_ai_prelaunch_health_audit.json` — consenso comparativo entre ChatGPT, Gemini y Grok.
[4]: Project artifact: `webdev_check_status` ejecutado sobre `complilink_operativo_v1` — servidor activo, TypeScript sin errores, LSP sin errores y screenshot del estado actual.
