# Inventario de servicios — Manus vs propio (Railway)

Fecha de inventario: **2026-09-04** (Fase 0).

| Servicio / capacidad | Rol | Dónde hoy | Notas |
|----------------------|-----|-----------|-------|
| Web UI (Home, `/auditar`, historial, beneficios, expediente, `/ceo`) | Producto visible | **Manus** vivo (`auditapatron.com`); copia **Railway** temp | Railway sano (portada y `/auditar` verificados por Tester) |
| Auth OTP (`/acceso`, Resend, OAuth Manus + JWT) | Entrada de usuarios | **Manus** | Acceso propio correo+contraseña en Railway: **PENDIENTE** (siguiente bloque; no armar sin instrucción de código) |
| Motor Helios / Asesor Laboral | Análisis jurídico | **Externo compartido** | Solo consumir; no modificar motor ni su DB |
| Webhook `document.uploaded` (HMAC) | Puente de resultados | **Incompleto / pendiente** | Firmado + endpoint de retorno incompletos |
| MySQL | Persistencia copia Railway | **Propio (Railway)** | Servicio `mysql` + volumen `/var/lib/mysql` |
| Supabase | DB / auth era Manus | **Manus / legado** | Migración a MySQL Railway en curso según estrategia de independencia |
| Cloudflare CDN | CDN / DNS edge | **Manus-era / planeado** | DNS no tocar sin OK |
| Sentry | Monitoreo | **Manus-era** | Reconectar en Railway cuando toque |
| Stripe | Pagos | **No confirmado activo** | Solo nombres de secretos documentados |
| Resend | Correo OTP | **Manus-era** | Ligado a auth OTP actual |

## Dependencias críticas de Manus (hoy)

- Sitio público y auth OTP.
- Parte de integraciones (OAuth Manus, posiblemente Supabase/Sentry según despliegue vivo).

## Ya propio en Railway

- Servicio `web` (desde este repo).
- Servicio `mysql` + volumen.

## Siguiente bloque técnico (no iniciar solo)

Acceso propio Railway (correo + contraseña), cuando Chief active instrucción de código.
