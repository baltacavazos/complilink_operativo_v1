# Auditoría inicial de viabilidad móvil de AuditaPatron

La base actual de **AuditaPatron** sí es viable para evolucionar a una app real de **iOS y Android**, y de hecho ya contiene varias decisiones que apuntan en esa dirección. El proyecto corre sobre una base **React + Vite + tRPC + Express**, y ya incluye dependencias de **Capacitor** tanto en runtime como en devDependencies. Esto indica que el repositorio no parte desde cero para móvil; más bien parece una base web avanzada con un comienzo de preparación para envoltura nativa.

## Hallazgos técnicos clave

| Área | Hallazgo | Lectura para móvil |
| --- | --- | --- |
| Stack base | `package.json` ya incluye `@capacitor/core`, `@capacitor/app`, `@capacitor/browser`, `@capacitor/camera`, `@capacitor/filesystem`, `@capacitor/preferences`, `@capacitor/android`, `@capacitor/ios` y `@capacitor/cli`. | La ruta natural más viable no es reescribir en otro stack, sino formalizar una app híbrida/nativa sobre la base actual. |
| Configuración nativa | No aparecen `capacitor.config.*`, ni carpetas `ios/` o `android/`, ni manifiesto PWA base. | Hay preparación conceptual, pero todavía no existe el arranque operativo del proyecto móvil. |
| Deep links y auth | Existen `client/src/lib/nativeRuntime.ts`, `client/src/components/AppUrlListener.tsx` y construcción de URLs nativas con esquema `auditapatron:` más retorno a dominio público `https://auditapatron.com`. | La autenticación móvil ya fue pensada parcialmente y es un activo importante para la migración. |
| API pública | `getApiBaseUrl()` apunta al origen web público, no al host efímero del preview. | Esto favorece una app móvil que consuma backend remoto estable sin depender del entorno de preview. |
| Captura de documentos | `/auditar` ya tiene modelo de flujo con `preferredCaptureMode`, `selectedCaptureMode`, `openPreferredPicker`, `openCameraPicker`, `openFilePicker` y validaciones de archivo. | El producto central ya está conceptualmente alineado con uso móvil, aunque todavía apoyado en APIs web e inputs HTML. |
| Persistencia local | Hay uso extenso de `window.localStorage`, `window.sessionStorage`, temporizadores y eventos del navegador. | Es reutilizable en una primera app híbrida, pero conviene encapsularlo para robustez nativa y consistencia cross-device. |
| Dependencias web | Hay varias dependencias directas de `window`, `document`, `navigator`, `FileReader` y flujos browser-first. | No bloquean una app con Capacitor, pero sí exigen una capa de adaptación móvil para endurecer la experiencia. |
| Estado del proyecto | La base actual compila sin errores de TypeScript y el proyecto sigue operativo. | La preparación a móvil puede comenzar sin necesidad de una estabilización previa mayor del core. |

## Diagnóstico

La conclusión de esta auditoría es que **AuditaPatron ya está más cerca de una app híbrida con Capacitor que de una simple web responsiva**. Ya existe una intuición arquitectónica correcta: dominio público estable, listener de URLs nativas, soporte para abrir autenticación externa y retorno al app shell. Ese trabajo reduce significativamente el costo de entrada para iOS y Android.

Al mismo tiempo, el proyecto todavía **no está listo para compilarse y publicarse como app**. Falta la capa operativa que convierte una base web preparada en una app real: configuración de Capacitor, proyectos nativos `ios/` y `android/`, iconos y splash, reglas de deep link en ambas plataformas, política de permisos, estrategia de cámara y archivos nativos, y endurecimiento de almacenamiento local y navegación para escenarios offline/intermitentes.

## Implicación estratégica

La ruta recomendada, con base en la auditoría del código actual, es **no reescribir el producto en otro framework móvil desde cero** en esta etapa. La decisión con mayor retorno parece ser **consolidar una arquitectura móvil con Capacitor sobre la experiencia actual**, usando el backend ya existente y aislando gradualmente las dependencias browser-first detrás de adaptadores nativos.

Eso permitiría llegar más rápido a una primera app funcional para iOS y Android, validar uso real con usuarios, y solo después decidir si vale la pena migrar partes específicas a una experiencia más nativa o mantener una estrategia híbrida reforzada.

## Riesgos principales detectados

| Riesgo | Impacto esperado |
| --- | --- |
| Falta de configuración real de Capacitor | Impide generar binarios o abrir proyectos nativos hoy mismo. |
| Uso disperso de APIs web globales | Puede producir comportamientos inconsistentes en webview, auth y persistencia. |
| Flujo de cámara/archivos aún browser-first | La experiencia móvil puede sentirse menos sólida que una app nativa si no se adapta. |
| Ausencia de estrategia formal de permisos y deep links por plataforma | Riesgo alto para login social, retorno al app y captura documental en producción. |
| No hay artefactos de publicación móvil | Faltan iconos, splash, bundle IDs, nombres de app, permisos y metadatos de tienda. |

## Recomendación preliminar

La base actual debe evolucionar hacia una **primera app iOS/Android con Capacitor**, apoyándose en el dominio productivo como backend y manteniendo el código del producto principal en React. El siguiente paso no es todavía publicar, sino definir con precisión la arquitectura móvil objetivo, contrastarla con **ChatGPT, Grok y Gemini**, y luego preparar los artefactos iniciales del frente móvil para que la implementación se pueda ejecutar por fases con menor riesgo.

## Hallazgos externos oficiales ya confirmados

La documentación oficial de **Capacitor** confirma que la ruta de deep links basada en dominio propio es la adecuada para una app de AuditaPatron. Las guías oficiales indican que **Universal Links** en iOS y **App Links** en Android permiten abrir contenido directamente en la app usando la misma URL HTTPS del sitio, con fallback elegante al sitio web si la app no está instalada. También exigen una asociación bidireccional entre sitio y app mediante archivos en `/.well-known/`, concretamente `apple-app-site-association` para iOS y `assetlinks.json` para Android, además de configurar `Associated Domains` en Xcode y `intent-filter` con `android:autoVerify="true"` en Android [1].

Para el caso de **captura documental**, la documentación oficial de `@capacitor/camera` confirma que la app puede tomar foto o elegir una existente desde la galería, pero exige completar correctamente permisos y descripciones de uso. En iOS se deben declarar `NSCameraUsageDescription`, `NSPhotoLibraryAddUsageDescription` y `NSPhotoLibraryUsageDescription` en `Info.plist`; en Android, los permisos de almacenamiento solo son necesarios en escenarios como `saveToGallery: true`. Además, Capacitor recomienda escuchar `appRestoredResult` porque la captura abre una Activity separada y el sistema operativo podría terminar la app durante el flujo. Esto es especialmente relevante para AuditaPatron, porque el producto depende de un proceso de captura de recibos y documentos donde perder el estado sería costoso para la experiencia [2].

## Referencias

[1]: https://capacitorjs.com/docs/guides/deep-links "Deep Links | Capacitor Documentation"
[2]: https://capacitorjs.com/docs/apis/camera "Camera Capacitor Plugin API | Capacitor Documentation"

## Contraste multi-IA sobre la estrategia móvil

La consulta comparativa con **ChatGPT**, **Grok** y **Gemini** converge con bastante claridad en la misma dirección. Dos modelos recomiendan directamente la estrategia **A: Capacitor sobre la base actual**, y el tercero recomienda **C: estrategia híbrida por fases**, pero empezando también con **Capacitor** y dejando cualquier posible migración selectiva a React Native solamente como contingencia futura, no como punto de partida.

| Modelo | Estrategia recomendada | Lectura principal |
| --- | --- | --- |
| ChatGPT | C | Empezar con Capacitor, encapsular dependencias browser-first y reservar una migración selectiva solo si aparecen límites reales. |
| Grok | A | Aprovechar la integración parcial ya existente y evitar una reescritura costosa e innecesaria. |
| Gemini | A | Consolidar Capacitor cuanto antes para minimizar retrabajo y acelerar salida a mercado. |

La lectura moderada de este consenso es que **no conviene reescribir ahora en React Native / Expo**. La decisión más rentable para este proyecto específico es una **ruta principal con Capacitor**, pero ejecutada con disciplina de arquitectura: wrappers multiplataforma, deep links formales, permisos correctos, y migración del flujo de captura documental a plugins nativos reales.

## Decisión arquitectónica recomendada

La estrategia de trabajo recomendada para AuditaPatron es la siguiente:

| Decisión | Recomendación |
| --- | --- |
| Estrategia base | **Capacitor como ruta principal** para iOS y Android |
| Postura ante React Native | **No reescribir ahora**; solo evaluar migración parcial futura si aparecen límites reales en UX o performance |
| Reutilización | Mantener el cliente React actual, el backend tRPC/Express/Drizzle, y la lógica móvil parcial existente |
| Primer objetivo | Lograr una **primera app funcional publicable** antes de perseguir perfección nativa |
| Riesgo principal a atacar | Eliminar dependencias directas de APIs browser-first del código compartido |

Con esto, la fase siguiente ya no es discutir stack, sino preparar artefactos concretos de implementación móvil y una hoja de ruta por fases.
