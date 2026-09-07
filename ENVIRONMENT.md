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
| `ENABLE_LOCAL_PASSWORD_AUTH` | `1` fuerza correo+contraseña; `0` lo apaga; si ausente, se activa cuando **no** hay `RESEND_API_KEY` (PR #3). **Ya en** panel web = `1`. |
| `DISABLE_MANUS_AUTH` | `1`/`true`: `/acceso` **no** cae al UI Manus (`Access.tsx`) aunque el password local esté apagado. También se omite Manus automáticamente si `ENABLE_LOCAL_PASSWORD_AUTH` está activo. |

## Acceso y sesión (grupos README / CONFIGURACION)

| Variable | Notas |
| --- | --- |
| `VITE_APP_ID` | Manus OAuth en live; en Railway dejar vacío / no depender |
| `OAUTH_SERVER_URL` | Manus-era — vacío en copia Railway |
| `VITE_OAUTH_PORTAL_URL` | Manus-era — vacío en copia Railway |
| `OWNER_OPEN_ID` | Propietario |
| `OWNER_NAME` | Propietario |

## Storage propio (Railway bucket S3) — obligatorio para `/auditar` útil

Bucket de proyecto: `auditapatron-docs` (id `b269c793-692d-44e5-b11e-060e15f92052`, región `iad`).  
Cablear al servicio web. **No** usar Forge para storage en Railway (`BUILT_IN_FORGE_*` vacías OK).

| Oficial (recomendado) | Alias Railway inject | Alias AWS / otros | Notas |
| --- | --- | --- | --- |
| `S3_BUCKET` / `STORAGE_BUCKET` | `BUCKET` | `AWS_S3_BUCKET_NAME` / `AWS_BUCKET` | Nombre S3 API |
| `S3_ACCESS_KEY_ID` / `STORAGE_ACCESS_KEY_ID` | `ACCESS_KEY_ID` | `AWS_ACCESS_KEY_ID` | Credencial |
| `S3_SECRET_ACCESS_KEY` / `STORAGE_SECRET_ACCESS_KEY` | `SECRET_ACCESS_KEY` | `AWS_SECRET_ACCESS_KEY` | Credencial |
| `S3_ENDPOINT` / `STORAGE_ENDPOINT` | `ENDPOINT` | `AWS_ENDPOINT_URL` / `AWS_S3_ENDPOINT` | p. ej. storage.railway.app |
| `S3_REGION` / `STORAGE_REGION` | `REGION` | `AWS_REGION` / `AWS_DEFAULT_REGION` | Suele ser `auto` |
| `S3_PUBLIC_URL` / `STORAGE_PUBLIC_BASE_URL` | — | — | Opcional; descarga usa URL firmada |

`server/storage.ts` usa `@aws-sdk/client-s3` + URLs firmadas (bucket privado). Degrada con error claro si faltan las 4 vars obligatorias.

## Plataforma integrada (Forge) — legacy Manus

| Variable | Notas |
| --- | --- |
| `BUILT_IN_FORGE_API_URL` | **No** usada por storage en Railway |
| `BUILT_IN_FORGE_API_KEY` | **No** usada por storage en Railway |
| `VITE_FRONTEND_FORGE_API_URL` | Legacy UI Manus |
| `VITE_FRONTEND_FORGE_API_KEY` | Legacy UI Manus |

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

## Google / Apple (acceso social propio)

Cablear en Railway (nombres solo). Sin valores en Git.

| Variable | Notas |
| --- | --- |
| `GOOGLE_CLIENT_ID` | OAuth web Google; reutiliza `/api/auth/google/start|callback` |
| `GOOGLE_CLIENT_SECRET` | Secreto OAuth Google |
| `APPLE_CLIENT_ID` | Services ID de Sign in with Apple (web) |
| `APPLE_TEAM_ID` | Team ID Apple Developer |
| `APPLE_KEY_ID` | Key ID de la clave .p8 |
| `APPLE_PRIVATE_KEY` | Contenido PEM de la clave privada (o body con `\\n` escapados) |

Callback Apple web: `/api/auth/apple/callback` (POST form_post y GET).

## Legacy / opcional

| Variable |
| --- |
| *(Google movido a sección propia arriba)* |

## Estado Railway hoy (resumen)

| Tema | Estado |
| --- | --- |
| Proyecto Railway | `5ff3f64a-542d-4a23-b500-a430c3054daa` |
| URL temporal | `https://web-production-0391e.up.railway.app` |
| Auth email/password | PR #3 en main / merge según OK Baltasar |
| Bucket docs | `auditapatron-docs` (`b269c793…`, `iad`) — cablear vars S3 al web |
| Live DNS | Sigue en Manus (`auditapatron.com`) |
| Stripe | **PAUSA** |

Marcar en el panel qué vars están presentes vs faltantes; no pegar valores aquí.

## Reglas

1. Secretos solo en Railway / gestor del dueño — **nunca** en el repo.
2. No cutover DNS sin OK de Baltasar.
3. Validar auth propia en paralelo antes de cutover.
