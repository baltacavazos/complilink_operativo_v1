# Plan de conversión de AuditaPatron a app iOS/Android

**Autor:** Manus AI  
**Fecha:** 2026-06-18

## Resumen ejecutivo

La ruta recomendada para convertir **AuditaPatron** en una app real de **iOS y Android** es **construir sobre la base actual con Capacitor**, no reescribir el producto ahora mismo en React Native o Expo. Además, esta preparación ya no es solo teórica: el proyecto cuenta ya con `capacitor.config.ts` y con proyectos nativos base `ios/` y `android/`, por lo que la siguiente iteración puede concentrarse en flujos críticos como autenticación, deep links, cámara, archivos y persistencia multiplataforma. Esta decisión se apoya en dos hechos. Primero, el repositorio ya contiene dependencias y señales de integración móvil parcial, incluyendo soporte para abrir autenticación externa, parseo de rutas nativas y uso de un dominio público estable. Segundo, la documentación oficial de Capacitor encaja con el modelo operativo de AuditaPatron, especialmente en **deep links HTTPS** y **captura documental con cámara** [1] [2].

La conclusión práctica es que la estrategia con mejor relación entre velocidad, riesgo y reutilización es una **migración móvil por fases**. La web actual no debe tratarse como un experimento aislado, sino como el núcleo compartido de una primera app publicable, endurecida con adaptadores nativos, permisos correctos, deep links formales y una política clara de almacenamiento local.

## Diagnóstico del estado actual

La base del proyecto ya ofrece un punto de partida mejor de lo normal para una app híbrida. El cliente corre en **React + Vite**, el backend y contratos ya existen, y el repositorio incluye dependencias de Capacitor para **App**, **Browser**, **Camera**, **Filesystem** y **Preferences**. Además, el código ya contiene una capa parcial de runtime nativo y escucha de URLs entrantes, lo que reduce trabajo en autenticación y retorno desde navegador externo.

| Área | Estado actual | Implicación móvil |
| --- | --- | --- |
| Stack del producto | React 19, Vite, tRPC, Express, Drizzle | Se puede reutilizar gran parte del producto sin duplicar lógica |
| Dependencias nativas | Capacitor ya está en `package.json` | La ruta móvil ya está insinuada dentro del repositorio |
| Deep links | Existe soporte parcial de runtime y listener de URLs | Hay base para cerrar autenticación y navegación nativa |
| Captura documental | `/auditar` ya modela cámara/archivo como decisiones de producto | La experiencia principal ya está diseñada con mentalidad móvil |
| Configuración nativa | Ya existe `capacitor.config.ts` y ya están presentes `ios/` y `android/` | El proyecto ya tiene scaffolding móvil base y puede pasar a integración funcional |
| APIs browser-first | Persisten referencias a `window`, `document`, `localStorage`, `sessionStorage`, `FileReader` | Deben encapsularse antes de confiar en un runtime nativo |

## Decisión arquitectónica

La estrategia recomendada es **Capacitor como ruta principal**, con una postura de contingencia inteligente: si más adelante aparecieran límites severos en experiencia nativa o rendimiento, podrían migrarse superficies específicas. Sin embargo, el punto de partida **no** debe ser una reescritura total.

> La guía oficial de Capacitor para deep links establece que **Universal Links** en iOS y **App Links** en Android permiten usar la misma URL HTTPS del sitio y abrir directamente la app cuando está instalada, con fallback al sitio web cuando no lo está [1].

> La documentación oficial del plugin de cámara confirma que la app puede tomar fotos o elegir imágenes existentes, pero exige permisos explícitos en iOS y recomienda manejar `appRestoredResult` porque la captura puede interrumpirse si el sistema termina la app durante la Activity [2].

## Consenso multi-IA utilizado para esta decisión

Siguiendo tu instrucción, la definición arquitectónica no se dejó a una sola lectura. Se contrastó con **ChatGPT**, **Grok** y **Gemini** usando el estado real del código y el contexto del negocio. El consenso fue claro: **no conviene reescribir desde cero ahora**. Dos modelos recomendaron **Capacitor directo** y el tercero recomendó una **estrategia híbrida por fases**, pero también arrancando con Capacitor.

| Modelo | Recomendación | Lectura operativa |
| --- | --- | --- |
| ChatGPT | Estrategia por fases iniciando con Capacitor | Reutilizar al máximo y reservar migraciones selectivas solo si se vuelven necesarias |
| Grok | Capacitor directo | Evitar meses de reescritura innecesaria |
| Gemini | Capacitor directo | Acelerar salida a mercado y aprovechar la base existente |

Mi interpretación moderada de ese consenso es que **Capacitor es la decisión correcta para la siguiente etapa**, siempre que se implemente con disciplina arquitectónica y no como un simple “wrapper” improvisado.

## Arquitectura móvil objetivo

La app móvil debe usar el mismo backend productivo de AuditaPatron y una sola fuente de verdad para autenticación, expedientes y análisis documental. La parte móvil debe aportar la capa nativa necesaria para cámara, archivos, persistencia local, deep links y experiencia de publicación en tiendas.

| Capa | Recomendación |
| --- | --- |
| UI compartida | Mantener React como base principal del producto |
| Runtime móvil | Usar Capacitor para iOS y Android |
| Navegación de retorno | Universal Links / App Links con `auditapatron.com` |
| Autenticación externa | `Browser.open()` con retorno controlado a la app |
| Cámara y galería | `@capacitor/camera` |
| Persistencia local básica | `@capacitor/preferences` |
| Archivos locales | `@capacitor/filesystem` |
| Estado offline avanzado | Posponer a una fase posterior, salvo caché mínima y continuidad básica |

## Qué debe construirse primero

La primera fase de implementación móvil no debe intentar resolver todo. Debe convertir la base actual en una **app compilable, navegable y funcional** en los flujos esenciales.

| Prioridad | Trabajo |
| --- | --- |
| Alta | Crear `capacitor.config.ts` y formalizar la configuración móvil |
| Alta | Generar proyectos `ios/` y `android/` con Capacitor |
| Alta | Encapsular accesos a `window`, `document`, `localStorage`, `sessionStorage`, `navigator` y `FileReader` detrás de adaptadores multiplataforma |
| Alta | Convertir el flujo de captura documental a una implementación nativa con cámara/galería y manejo de restauración de estado |
| Alta | Configurar Universal Links y App Links con archivos `/.well-known/` y ajustes por plataforma |
| Alta | Definir permisos nativos y textos de privacidad para cámara y biblioteca |
| Media | Crear assets móviles: íconos, splash, nombre de app, bundle IDs y package IDs |
| Media | Validar autenticación real en dispositivos físicos |

## Qué puede esperar a una segunda fase

No todo debe entrar al primer corte móvil. Para reducir riesgo, conviene dejar varios frentes para la segunda ola después de tener un build interno funcional.

| Puede esperar | Razón |
| --- | --- |
| Push notifications | No bloquean un primer build funcional |
| Offline avanzado con sincronización compleja | Requiere diseño más profundo de conflicto y persistencia |
| Pulido nativo de componentes no críticos | Puede llegar tras validar uso real |
| Crash reporting y analítica móvil avanzada | Conveniente, pero no bloqueante para iniciar |
| Evaluación de migración parcial a superficies más nativas | Solo tiene sentido con evidencia real de límite |

## Riesgos principales

El mayor riesgo no es tecnológico en abstracto, sino de ejecución: intentar publicar una app “rápida” dejando dependencias browser-first dispersas dentro del código compartido. Esa práctica genera fragilidad, errores intermitentes y una experiencia menos confiable.

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Dependencia de APIs web directas | Bugs en WebView, auth y almacenamiento | Crear wrappers de plataforma desde el inicio |
| Deep links incompletos | Login roto o retorno fallido | Configurar `/.well-known/`, Associated Domains e intent filters de forma temprana |
| Captura documental no nativa | Mala UX en el flujo central del producto | Migrar pronto a `@capacitor/camera` + `@capacitor/filesystem` |
| Permisos mal definidos | Rechazo en App Store / Play o experiencia rota | Declarar textos y permisos por plataforma desde la primera iteración |
| Falta de pruebas en dispositivos | Falsos positivos desde navegador | Probar en iPhone y Android reales antes de cualquier publicación |

## Hoja de ruta recomendada

La migración debe dividirse en fases de producto, no solo de ingeniería. El objetivo es tener una progresión clara desde “base preparada” hasta “app publicable”.

| Fase | Objetivo | Resultado esperado |
| --- | --- | --- |
| Fase 0 | Preparación arquitectónica | Decisión de stack, backlog, auditoría y plan de implementación cerrados |
| Fase 1 | Arranque operativo móvil | `capacitor.config.ts`, carpetas `ios/` y `android/`, build local inicial |

La **Fase 1** ya quedó iniciada en el repositorio actual: la configuración de Capacitor y los proyectos nativos base ya existen. Eso reduce el riesgo de la siguiente iteración, porque el foco ya no es crear el cascarón móvil, sino conectar correctamente los flujos del producto al runtime nativo.
| Fase 2 | Núcleo funcional | Login, deep links, captura documental, selección de archivos y continuidad básica funcionando |
| Fase 3 | Endurecimiento móvil | Persistencia local limpia, permisos, recuperación de estado, pruebas en dispositivos |
| Fase 4 | Preparación de stores | Assets, textos, política de privacidad, bundle/package IDs, pruebas internas |
| Fase 5 | Publicación controlada | TestFlight, Play Internal Testing y ajustes finales |

## Próximos pasos concretos

La siguiente ejecución técnica ya no debe enfocarse en crear el cascarón móvil, porque esa base ya existe. El siguiente movimiento correcto es **migrar las dependencias browser-first más sensibles hacia adaptadores de plataforma**, empezando por autenticación, deep links, entrada documental y persistencia local.

El inventario técnico preparado en `references/mobile-adapter-inventory.md` ya dejó trazadas las superficies críticas y su prioridad de ataque. Eso permite pasar de una preparación arquitectónica a una implementación móvil incremental, con menos incertidumbre y mejor control del riesgo.

> El antipatrón a evitar es intentar que el código compartido siga llamando directamente a `window`, `document`, `navigator`, `localStorage` o `FileReader` dentro de una app nativa. Esa mezcla tiende a romper la confiabilidad del producto y vuelve más costosa cualquier publicación futura.

## Referencias

[1]: https://capacitorjs.com/docs/guides/deep-links "Deep Links | Capacitor Documentation"
[2]: https://capacitorjs.com/docs/apis/camera "Camera Capacitor Plugin API | Capacitor Documentation"

## Estado real de la segunda ola de adaptación móvil

Quedó completada una segunda ola enfocada en el flujo central. `platformDocumentInput` ya se conectó a helpers puntuales de `Home` y `/auditar`, sustituyendo lecturas web directas por una capa reutilizable para la futura captura nativa. En paralelo, `platformStorage` ya gobierna persistencias prioritarias en `ViewModeContext` y en el estado persistido de `/auditar`, reduciendo dependencia directa de `localStorage` y `sessionStorage` en superficies críticas.

La validación técnica de esta ola quedó limpia con `tsc --noEmit`, y además se fijó cobertura focal con Vitest sobre `platformStorage` y sobre los marcadores de integración móvil en `Auditar.upload-validation.test.ts`. El siguiente paso natural es ampliar `platformDocumentInput` desde helpers puntuales hacia los disparadores de cámara/galería y continuar retirando accesos browser-first residuales del workspace principal.

## Estado real de la tercera ola de adaptación móvil

La tercera ola ya dejó lista la base para el siguiente salto funcional móvil. `platformDocumentInput` ahora expone capacidades y disparadores por modo para cámara y galería, de modo que el flujo central puede evolucionar desde `input[type=file]` hacia selección nativa controlada sin volver a mezclar lógica browser-first. En paralelo, `platformAuthNavigation` quedó reforzado con URLs absolutas y con encapsulación del acceso vía Google, lo que reduce acoplamiento directo entre pantallas de acceso y detalles del runtime.

En esta misma ola también se conectó `Access.tsx` al flujo encapsulado de Google, manteniendo la navegación externa controlada tanto para acceso tradicional como para proveedores externos. La validación quedó en verde con `tsc --noEmit` y con pruebas focales sobre `Access.mobile-auth.test.ts`, `Auditar.upload-validation.test.ts` y `platformStorage.test.ts`. El siguiente paso técnico natural es integrar los nuevos disparadores de cámara/galería directamente en `/auditar` y empezar a retirar los `click()` directos sobre inputs ocultos cuando el runtime sea nativo.
