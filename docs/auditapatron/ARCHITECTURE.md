# Arquitectura — AuditaPatrón

## Flujo de producto

1. El trabajador entra a la web y sube documentos laborales.
2. El sistema calcula huella (`SHA-256`), aplica OCR y extracción.
3. Se notifica al motor **Helios** (evento `document.uploaded`, webhook firmado HMAC — implementación completa aún pendiente).
4. Helios devuelve indicadores de "fuerza del expediente" y hallazgos.
5. En la UI pública, Helios se presenta como **Asesor Laboral**.

## Decisiones estables

- Marcas/UI separadas de CompliLink; **solo se comparte Helios**.
- **No modificar** el motor Helios ni su base de datos (solo consumirlo).
- Modelo **freemium**.
- Contratos legales / `consent_contract_schema.json`: no alterar sin revisión.
- No generar ni rotar secretos sin revisión de seguridad.

## Railway (copia propia, 2026-09-04)

Proyecto: `auditapatron` · id `5ff3f64a-542d-4a23-b500-a430c3054daa`  
Entorno: `production` · id `0f91e181-af02-4123-a5a3-a52f61d276fc`

| Servicio | Rol | Origen |
|----------|-----|--------|
| `web` (`9479bf02-6e87-4d9e-b157-253298f01a13`) | App web | Repo GitHub `baltacavazos/complilink_operativo_v1` (Railpack); dominio `web-production-0391e.up.railway.app` |
| `mysql` (`fa155c62-f4f2-4e52-8ad9-4e7dde198c49`) | Base de datos | Imagen `mysql:8`; volumen montado en `/var/lib/mysql` (volumen `985f10e8-6e45-49a7-b18b-4ae5322765d3`) |

## Pantallas (legado Manus / copia Railway)

Home, `/auditar`, historial, beneficios, error/estado, login OTP `/acceso`, expediente, consola CEO `/ceo/*`.

## Integraciones históricas (era Manus)

Helios, Resend (OTP), OAuth Manus + JWT interno, Supabase, Cloudflare, Sentry. Varias siguen dependiendo de Manus hasta el corte.
