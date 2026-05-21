# Auditapatron móvil con Capacitor

## Resumen sencillo

La app móvil reutiliza la plataforma actual y la envuelve con Capacitor. En esta primera base, el shell nativo puede cargar la web pública de Auditapatron para conservar compatibilidad con autenticación, sesión y flujos documentales mientras se endurece la adaptación móvil. También queda preparado un modo de activos locales para una siguiente etapa.

## Cómo está pensada esta base

| Componente | Función |
|---|---|
| `capacitor.config.ts` | Define el `appId`, el nombre de la app, el `webDir` y el modo de shell remoto o local. |
| `android/` | Proyecto nativo base para Android. |
| `ios/` | Proyecto nativo base para iOS. |
| `client/src/components/AppUrlListener.tsx` | Escucha retornos de deep links y vuelve a enrutar dentro del SPA. |
| `client/src/lib/nativeRuntime.ts` | Detecta si la app corre en entorno nativo y centraliza helpers de deep links/URLs. |

## Identidad móvil actual

| Dato | Valor actual |
|---|---|
| Nombre visible | `Auditapatron` |
| App ID / Package base | `com.auditapatron.mobile` |
| Dominio público principal | `https://auditapatron.com` |
| Esquema nativo para retorno | `auditapatron://` |

## Modos disponibles

| Modo | Cuándo conviene | Cómo se activa |
|---|---|---|
| **Shell remoto** | Primera etapa, máxima paridad con la web actual y menor riesgo de autenticación. | Es el modo por defecto. |
| **Activos locales** | Siguiente etapa, menor dependencia de red y mayor cercanía a una app empaquetada completa. | Definiendo `CAPACITOR_USE_LOCAL_ASSETS=1`. |

## Variables de entorno útiles

| Variable | Uso |
|---|---|
| `CAPACITOR_SERVER_URL` | Permite apuntar el shell móvil a otra URL remota, por ejemplo una preview o staging. |
| `CAPACITOR_USE_LOCAL_ASSETS` | Si vale `1`, desactiva el shell remoto y usa el build local en `dist/public`. |

## Flujo recomendado de trabajo

Primero se construye la app web. Después se sincroniza con Capacitor. Luego se abre cada proyecto nativo en su herramienta correspondiente para compilar, ejecutar en simulador o firmar una release.

```bash
pnpm build
pnpm exec cap sync
pnpm exec cap open android
pnpm exec cap open ios
```

## Android

Para Android, la base ya queda en `android/`. La compilación y firma final se hacen en Android Studio.

| Paso | Acción |
|---|---|
| 1 | Ejecutar `pnpm build` y `pnpm exec cap sync`. |
| 2 | Abrir `android/` con Android Studio usando `pnpm exec cap open android`. |
| 3 | Esperar a que Gradle termine de indexar dependencias. |
| 4 | Probar en emulador o dispositivo físico. |
| 5 | Preparar firma, versión y bundle final (`.aab`) desde Android Studio. |

## iOS

La carpeta `ios/` ya queda preparada, pero la compilación real debe hacerse en macOS con Xcode.

| Paso | Acción |
|---|---|
| 1 | Ejecutar `pnpm build` y `pnpm exec cap sync`. |
| 2 | Abrir `ios/` con Xcode usando `pnpm exec cap open ios`. |
| 3 | Configurar Team, Bundle Identifier y capacidades. |
| 4 | Probar en simulador o iPhone físico. |
| 5 | Preparar firma, versión y archive final para App Store Connect. |

## Permisos mínimos a revisar

En esta base, el flujo documental ya usa el selector HTML existente. Si en la siguiente etapa se migra a plugins nativos de cámara o archivos, habrá que completar los permisos correspondientes.

| Plataforma | Archivo | Qué revisar |
|---|---|---|
| iOS | `ios/App/App/Info.plist` | Descripciones de uso para cámara, fotos y archivos si se activan plugins nativos. |
| Android | `android/app/src/main/AndroidManifest.xml` | Permisos de cámara y lectura de medios/archivos según el nivel final de integración nativa. |

## Auth y deep links en esta etapa

La ruta más estable en esta primera base móvil sigue siendo el acceso por correo. La pantalla `/acceso` ya prioriza esa vía dentro del entorno nativo, pero ahora también queda preparada la ruta de Google para abrirse en navegador externo y volver a la app con el esquema `auditapatron://` cuando el callback termine correctamente. El listener `AppUrlListener` se mantiene como punto central para capturar ese regreso, refrescar sesión y cerrar el navegador externo cuando aplica.

## Qué queda para la siguiente ronda

| Frente | Trabajo siguiente |
|---|---|
| **Autenticación** | Validar en dispositivo real el retorno nativo de Google, la continuidad de sesión y la llegada limpia a la ruta final después del callback. |
| **Captura documental** | Probar si el `input type=file` actual es suficiente en dispositivos reales o si conviene migrar a `@capacitor/camera` y `@capacitor/filesystem`. |
| **Publicación** | Generar iconos, splash screens, firma final, política de privacidad móvil y capturas para tiendas. |
| **Modo local** | Validar API, cookies y sesión cuando el shell use activos locales en vez de URL remota. |

## Checklist previo a tiendas

Antes de pensar en publicación, conviene cerrar estos puntos:

| Estado | Punto crítico |
|---|---|
| En curso | Probar login por correo en dispositivos reales. |
| En curso | Verificar continuidad de sesión al cerrar y reabrir la app. |
| Pendiente | Confirmar cámara, PDF, XML y galería en iOS y Android reales. |
| Base lista | Google ya cuenta con retorno nativo por esquema `auditapatron://`; falta validarlo en dispositivos reales y decidir si más adelante conviene complementar con enlaces universales y `.well-known`. |
| Pendiente | Configurar iconos, splash, firma y política de privacidad móvil. |
