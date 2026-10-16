# QA en Android físico — AuditaPatron

Este protocolo valida la primera versión móvil empaquetada de AuditaPatron con el **shell remoto de Capacitor**. La app consume `https://auditapatron.com`, por lo que la misma sesión, backend y flujos documentales de producción se conservan sin duplicar la plataforma.

## Antes de instalar

La prueba en teléfono usa un APK de depuración que abre `https://auditapatron.com`. Así la cookie de sesión queda en el mismo origen que en el navegador. Ese modo solo se activa con `CAPACITOR_SERVER_URL`; sin esa variable Capacitor empaqueta `dist/public`.

```bash
pnpm mobile:android:debug-apk
```

El archivo queda en `android/app/build/outputs/apk/debug/app-debug.apk`. Cópialo al teléfono y permite la instalación desde esa fuente solo para esta prueba. No es un bundle de Play ni lleva firma de release.

Android Studio sigue sirviendo para depurar por USB: antes de **Run**, exporta la misma variable y ejecuta `pnpm exec cap sync android`, o el proyecto nativo cargará los activos locales.

## Matriz de validación esencial

| Flujo | Resultado esperado | Evidencia a registrar |
|---|---|---|
| Inicio inicial | La app abre AuditaPatron sin pantalla blanca ni scroll lateral. | Modelo, versión Android y captura inicial. |
| Correo y código | El código llega, se valida y la app vuelve a la ruta solicitada. | Correo enmascarado y ruta final, sin compartir el código. |
| Retorno de Google | El navegador externo vuelve al esquema `auditapatron://` y restituye la ruta. | Ruta final y cualquier mensaje de error. |
| Cámara | Se solicita permiso con texto claro, se toma foto y se muestra el archivo seleccionado. | Permiso concedido/denegado y tipo de foto. |
| Galería | El selector del sistema permite escoger una imagen existente. | Formato y tamaño aproximado. |
| PDF, XML y DOCX | El selector documental mantiene los formatos permitidos y AuditaPatron los valida antes de analizar. | Formato probado y resultado de validación. |
| Archivo grande o inválido | La app explica el límite o formato no admitido sin bloquearse. | Mensaje mostrado. |
| Cierre y reapertura | La sesión y la revisión no desaparecen de forma inesperada. | Estado antes/después. |
| Red inestable | La app informa un error comprensible y permite reintentar. | Tipo de red y resultado del reintento. |
| Salir | El control de salida vuelve de forma segura a la pantalla inicial. | Ruta final. |

## Criterio de avance

La primera distribución de prueba puede avanzar cuando los flujos de **inicio, acceso por correo, cámara, PDF/XML, carga válida, cierre/reapertura y error de red** pasan en un dispositivo Android físico. Cualquier error de sesión, carga documental o retorno de autenticación se considera bloqueador antes de una publicación pública.

## Límites conocidos de esta etapa

La primera aplicación usa el shell remoto para conservar paridad con la web. El siguiente salto, una vez superada la QA física, es validar el modo de activos locales sin comprometer cookies, sesión ni comunicación con la API. No se debe publicar una variante de activos locales hasta validar esos tres puntos en dispositivo real.
