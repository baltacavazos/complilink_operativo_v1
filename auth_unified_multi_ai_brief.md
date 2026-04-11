# Brief de hardening de autenticación unificada para cierre V1

## Contexto operativo
CompliLink Operativo V1 ya cerró el perímetro CEO. El siguiente bloque crítico autorizado es endurecer la autenticación unificada sin romper Manus OAuth. El proyecto corre con React + Express + tRPC y expone una pantalla `/access` que hoy ofrece tres entradas: Manus OAuth, Google OAuth y passwordless por correo con código de 6 dígitos.

## Superficies confirmadas

| Superficie | Archivo | Hallazgo actual |
| --- | --- | --- |
| UI de acceso | `client/src/pages/Access.tsx` | Renderiza acceso por Manus, Google y correo/código; consulta `auth.googleStatus`, usa `requestEmailCode` y `verifyEmailCode`. |
| URLs de inicio | `client/src/const.ts` | `getManusLoginUrl()` construye el login Manus con `window.location.origin`; `getGoogleLoginUrl()` dirige a `/api/auth/google/start?returnTo=...`. |
| Router tRPC auth | `server/routers.ts` | `auth.googleStatus`, `auth.requestEmailCode`, `auth.verifyEmailCode` ya existen y delegan al servicio de autenticación. |
| Servicio auth | `server/authService.ts` | Implementa `isGoogleOAuthConfigured`, construcción de autorización Google, callback, `startEmailLogin`, `completeEmailLogin` y sesión de aplicación. |
| Rutas Express OAuth | `server/_core/oauth.ts` | Maneja `/api/auth/google/start` y `/api/auth/google/callback`; si falla hoy responde JSON con error 500 o 400. |
| Pruebas | `server/auth.routes.test.ts` | Cubre status Google, solicitud de código y verificación de código, pero no la experiencia UI ni el enfriamiento visible. |

## Restricciones de cierre V1

| Restricción | Implicación |
| --- | --- |
| No romper Manus OAuth | Cualquier mejora debe convivir con el flujo ya existente y mantener `returnTo`. |
| Google OAuth debe ser "real" | Si no hay credenciales, la UI debe explicarlo claramente sin falsas promesas ni botones ambiguos. |
| Passwordless debe mostrar límites visibles | Deben existir mensajes y/o estados claros para reintentos, enfriamiento o indisponibilidad temporal. |
| No introducir regresiones en sesión | El usuario autenticado debe seguir redirigiendo correctamente al destino solicitado. |
| Mantener el patrón del template | Nada de wrappers Axios; conservar tRPC, rutas OAuth existentes y sesiones actuales. |

## Problema puntual a resolver
Queremos una recomendación concreta y mínima para cerrar V1 en autenticación con tres frentes:
1. Qué endurecer en la UI `/access` para que el estado de Google OAuth y el passwordless sean claros, confiables y sin errores silenciosos.
2. Qué endurecer en backend/rutas para que los fallos de Google OAuth y del flujo de código por correo se presenten con mensajes controlados y trazables.
3. Cómo introducir límites visibles de reenvío o enfriamiento en el passwordless sin reescribir el sistema completo.

## Señales actuales relevantes
- `auth.googleStatus` ya informa si Google está configurado.
- `/api/auth/google/start` y `/api/auth/google/callback` ya existen, pero ante fallos responden con JSON genérico.
- El flujo por correo ya solicita y valida códigos, pero no está confirmado que exponga espera mínima entre reenvíos ni countdown visible en la interfaz.
- Existe un error histórico de Vite relacionado con `Access.tsx` y `useAuth`; necesitamos confirmar una solución robusta que no dependa de estado residual del bundler.

## Lo que necesito de cada modelo
Devuelve una respuesta estructurada con estas secciones:

1. `top_risks`: lista de 3 a 5 riesgos reales para cierre V1 en este flujo.
2. `minimum_backend_changes`: cambios mínimos recomendados en backend/rutas para cerrar V1.
3. `minimum_frontend_changes`: cambios mínimos recomendados en `/access` para cerrar V1.
4. `cooldown_strategy`: propuesta concreta y mínima para reintento/reenvío de código con UX clara.
5. `error_copy`: mensajes breves recomendados para Google no configurado, callback fallido, código inválido y enfriamiento.
6. `do_not_change`: qué conviene no tocar en V1 para evitar regresiones.
7. `confidence`: `high`, `medium` o `low`.

## Criterio de arbitraje esperado
Prioriza una solución de bajo riesgo, compatible con el flujo actual, fácilmente testeable con Vitest y honesta sobre limitaciones de configuración.
