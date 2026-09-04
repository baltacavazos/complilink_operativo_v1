# Variables de entorno — AuditaPatrón

**Solo nombres.** Nunca valores. Nunca commitear secretos.

## Railway · servicio `web` (presentes al 2026-09-04)

Variables inyectadas por Railway (la app aún no tiene secretos de aplicación cargados en este servicio):

- `RAILWAY_ENVIRONMENT`
- `RAILWAY_ENVIRONMENT_ID`
- `RAILWAY_ENVIRONMENT_NAME`
- `RAILWAY_PRIVATE_DOMAIN`
- `RAILWAY_PROJECT_ID`
- `RAILWAY_PROJECT_NAME`
- `RAILWAY_PUBLIC_DOMAIN`
- `RAILWAY_SERVICE_ID`
- `RAILWAY_SERVICE_NAME`
- `RAILWAY_SERVICE_WEB_URL`
- `RAILWAY_STATIC_URL`

## Railway · servicio `mysql`

- `MYSQL_DATABASE`
- `MYSQL_PASSWORD`
- `MYSQL_ROOT_PASSWORD`
- `MYSQL_USER`
- `RAILWAY_VOLUME_ID`
- `RAILWAY_VOLUME_MOUNT_PATH`
- `RAILWAY_VOLUME_NAME`

(Además Railway inyecta metadatos `RAILWAY_*` del servicio.)

## Nombres de la era Manus / migración futura (aún no necesariamente en Railway)

- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY`
- `AUDITAPATRON_BRIDGE_TOKEN`
- `AUDITAPATRON_ENGINE_HMAC_SECRET`
- `AUDITAPATRON_ENGINE_WEBHOOK_URL`
- `API_KEY_HELIOS`
- `CLOUDFLARE_API_KEY`
- `DATABASE_URL`
- `DROPBOX_API_KEY`
- `GEMINI_API_KEY`
- `HMAC_SECRET`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `OWNER_BACKUP_EMAIL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SENTRY_DSN`
- `STRIPE_SECRET_KEY` (mencionado; Stripe no confirmado como activo en AuditaPatrón)
- `SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `XAI_API_KEY`
- Header `x-auditapatron-token`
- `STRIPE_WEBHOOK_SECRET`

## Regla

Valores solo en el panel de Railway / gestor de secretos. Si un secreto se filtró históricamente, rotarlo (p. ej. incidente `OPENAI_API_KEY` en Manus: revocado).
