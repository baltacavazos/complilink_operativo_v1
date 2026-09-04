# Variables de entorno (Independencia 2026-09-04)

Solo **nombres**. Nunca valores reales. Cruza con [CONFIGURACION.md](./CONFIGURACION.md) y el README.

## Núcleo (obligatorio para operar)

| Variable | Notas independencia |
| --- | --- |
| `DATABASE_URL` | **Ya en** Railway web (2026-09-04) |
| `JWT_SECRET` | **Ya en** Railway web (firma de sesión) |
| `NODE_ENV` | **Ya en** Railway web |

## Acceso propio (copia Railway)

| Variable | Notas |
| --- | --- |
| `ENABLE_LOCAL_PASSWORD_AUTH` | `1` fuerza correo+contraseña; `0` lo apaga; si ausente, se activa cuando **no** hay `RESEND_API_KEY` (PR #3) |

## Acceso y sesión (grupos README / CONFIGURACION)

| Variable | Notas |
| --- | --- |
| `VITE_APP_ID` | Manus OAuth en live; en Railway dejar vacío / no depender |
| `OAUTH_SERVER_URL` | Manus-era — vacío en copia Railway |
| `VITE_OAUTH_PORTAL_URL` | Manus-era — vacío en copia Railway |
| `OWNER_OPEN_ID` | Propietario |
| `OWNER_NAME` | Propietario |

## Plataforma integrada (Forge)

| Variable | Notas |
| --- | --- |
| `BUILT_IN_FORGE_API_URL` | Vacío en copia Railway |
| `BUILT_IN_FORGE_API_KEY` | |
| `VITE_FRONTEND_FORGE_API_URL` | |
| `VITE_FRONTEND_FORGE_API_KEY` | |

## Bridge AuditaPatrón

| Variable | Notas |
| --- | --- |
| `AUDITAPATRON_ENGINE_WEBHOOK_URL` | Bridge externo |
| `AUDITAPATRON_ENGINE_HMAC_SECRET` | Firma; nunca en Git |

## IA

| Variable | Notas |
| --- | --- |
| `OPENAI_API_KEY` | Consenso multi-IA |
| `GEMINI_API_KEY` | Consenso multi-IA |

## Correo

| Variable | Notas |
| --- | --- |
| `RESEND_API_KEY` | Live OTP; **ausente** en Railway ⇒ modo contraseña |
| `RESEND_FROM_EMAIL` | Remitente |

## Respaldo

| Variable | Notas |
| --- | --- |
| `DROPBOX_API_KEY` | Era Manus; independencia prefiere dumps Railway + copia off-platform |

## Branding / analítica (recomendables)

| Variable |
| --- |
| `VITE_APP_TITLE` |
| `VITE_APP_LOGO` |
| `VITE_ANALYTICS_ENDPOINT` |
| `VITE_ANALYTICS_WEBSITE_ID` |
| `PORT` |

## Legacy / opcional

| Variable |
| --- |
| `GOOGLE_CLIENT_ID` |
| `GOOGLE_CLIENT_SECRET` |

## Estado Railway hoy (resumen)

| Tema | Estado |
| --- | --- |
| Proyecto Railway | `5ff3f64a-542d-4a23-b500-a430c3054daa` |
| URL temporal | `https://web-production-0391e.up.railway.app` |
| Auth email/password | PR #3 lista; Chief despliega rama; **no merge** aún |
| Live DNS | Sigue en Manus (`auditapatron.com`) |
| Stripe | **PAUSA** |

Marcar en el panel qué vars están presentes vs faltantes; no pegar valores aquí.

## Reglas

1. Secretos solo en Railway / gestor del dueño — **nunca** en el repo.
2. No cutover DNS sin OK de Baltasar.
3. Validar auth propia en paralelo antes de cutover.
