# Notas rápidas de documentación oficial de Capacitor

## Configuración

La documentación oficial de Capacitor indica que la configuración principal admite `webDir` y también un bloque `server` con campos como `url`, `hostname`, `iosScheme`, `androidScheme`, `allowNavigation`, `errorPath` y `appStartPath`.

## Deep links

La guía oficial de deep links recomienda escuchar `App.addListener('appUrlOpen', ...)` al arrancar la app y redirigir internamente a la ruta correspondiente dentro del router. La documentación también enfatiza que los Universal Links y App Links usan URLs HTTPS del dominio propio y requieren archivos de asociación en `.well-known` para iOS y Android.

## Implicación para Auditapatron

Esto respalda una base móvil con `webDir` listo para build local, un `server.url` opcional para modo remoto controlado por entorno, y un listener `appUrlOpen` para preparar retornos de autenticación/OAuth sin reescribir toda la navegación.
