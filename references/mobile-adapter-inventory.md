# Inventario inicial de adaptadores nativos pendientes

**Autor:** Manus AI  
**Fecha:** 2026-06-18

## Objetivo

Este inventario identifica los puntos **browser-first** más relevantes del cliente actual que deben migrarse o encapsularse antes de confiar en una app iOS/Android basada en Capacitor. El objetivo no es reescribir la interfaz completa, sino reducir riesgo técnico en los flujos que más afectan la experiencia móvil: **login**, **deep links**, **cámara**, **archivos**, **persistencia local** y **navegación externa**.

## Resumen de hallazgos

El barrido del cliente detectó una concentración clara de dependencias web directas en un conjunto pequeño de superficies. Eso es positivo, porque permite atacar el problema por capas en lugar de reescribir todo el producto. El archivo más sensible es **`client/src/pages/Auditar.tsx`**, donde convergen captura documental, persistencia local, lectura de archivos, apertura de ventanas externas, parámetros de URL y acciones de portapapeles.

| Superficie | Archivo(s) principales | Dependencias detectadas | Impacto móvil |
| --- | --- | --- | --- |
| Autenticación y retorno | `client/src/lib/nativeRuntime.ts`, `client/src/pages/Access.tsx`, `client/src/components/CeoPanelDrawer.tsx` | `window.location`, `window.open`, `URLSearchParams`, `sessionStorage`, `localStorage` | Alto |
| Persistencia UI y sesión | `client/src/contexts/ThemeContext.tsx`, `client/src/contexts/ViewModeContext.tsx`, `client/src/lib/viewMode.ts`, `client/src/components/DashboardLayout.tsx` | `localStorage`, `sessionStorage`, `document` | Alto |
| Flujo central de auditoría | `client/src/pages/Auditar.tsx` | `FileReader`, `navigator.clipboard`, `localStorage`, `window.open`, `window.history`, `URLSearchParams`, timers, listeners de resize/scroll | Crítico |
| Navegación responsiva | `client/src/hooks/useMobile.tsx` | `window.matchMedia`, `window.innerWidth` | Medio |
| Integraciones browser-only | `client/src/components/Map.tsx`, `client/src/lib/analytics.ts` | `document.createElement`, `window.google`, `window.umami` | Medio |
| Recuperación ante error | `client/src/components/ErrorBoundary.tsx` | `window.location.reload()` | Bajo |

## Prioridad de migración

La prioridad no debe medirse por cantidad de llamadas al navegador, sino por su impacto en el flujo principal del producto.

| Prioridad | Área | Motivo |
| --- | --- | --- |
| 1 | `Auditar.tsx` | Aquí vive el flujo más valioso del producto y concentra lectura de archivos, cámara, persistencia y navegación de retorno |
| 2 | `nativeRuntime.ts` + `Access.tsx` | Definen la experiencia de autenticación, deep links y continuidad entre navegador externo y app |
| 3 | `ThemeContext.tsx`, `ViewModeContext.tsx`, `viewMode.ts`, `DashboardLayout.tsx` | Su persistencia debe pasar a una abstracción multiplataforma estable |
| 4 | `useMobile.tsx` y navegación responsiva | Conviene endurecerlos, pero no bloquean por sí solos la primera iteración funcional |
| 5 | `Map.tsx`, `analytics.ts`, `ErrorBoundary.tsx` | Requieren ajustes o guards, pero no son el cuello de botella principal del MVP móvil |

## Adaptadores recomendados

La siguiente fase debe crear una capa explícita de adaptadores, en lugar de seguir dispersando comprobaciones `typeof window !== "undefined"` por toda la app.

| Adaptador sugerido | Sustituye o encapsula | Primer uso objetivo |
| --- | --- | --- |
| `platformStorage` | `localStorage`, `sessionStorage` | estado UI, historial local, flags de vista, borradores |
| `platformAuthNavigation` | `window.location`, `window.open`, retorno de OAuth | login, portal de pagos, checkout, retorno desde navegador |
| `platformDocumentInput` | `FileReader`, selección de archivo, cámara web | flujo de carga documental en `/auditar` |
| `platformClipboard` | `navigator.clipboard` | copiado de mensajes rápidos y acciones RH/WhatsApp |
| `platformViewport` | `matchMedia`, `innerWidth`, listeners globales | detección de móvil y microinteracciones dependientes del viewport |
| `platformHistory` | `window.history.replaceState` y query cleanup | saneo de parámetros tras login o billing return |

## Riesgo técnico más importante

El mayor riesgo no es que existan referencias al navegador, sino que varias de ellas están mezcladas dentro del flujo de mayor valor comercial del producto. Mientras **`/auditar`** siga leyendo archivos, persistiendo estado, manipulando URLs y abriendo recursos externos sin una capa de plataforma bien definida, la app móvil tendrá puntos frágiles difíciles de probar de forma consistente.

## Siguiente ejecución recomendada

La siguiente iteración debería enfocarse en dos entregables concretos. Primero, crear los **adaptadores base** para almacenamiento, navegación de autenticación y entrada documental. Segundo, mover el flujo principal de `/auditar` a esos adaptadores sin alterar todavía la lógica de negocio.

Esa secuencia permite avanzar hacia una app móvil real sin bloquear la velocidad del producto ni abrir una reescritura innecesaria.
