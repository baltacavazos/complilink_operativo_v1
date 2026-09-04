# AuditaPatrón — documentación operativa (Fase 0)

Plataforma web para **trabajadores mexicanos**: suben documentos laborales (nóminas, recibos, contratos, CFDI, etc.) y el motor **Helios** (en la interfaz pública: **Asesor Laboral**) analiza el expediente y genera hallazgos en lenguaje sencillo.

Marca y UI **separadas** de CompliLink; solo se comparte el motor Helios.

## Dónde está hoy

| Capa | URL / ubicación | Notas |
|------|-----------------|-------|
| Sitio vivo (clientes) | https://auditapatron.com | Sigue en **Manus**. No tocar DNS ni Manus sin OK explícito de Baltasar o Chief of Staff. **No borrar Manus.** |
| Copia temporal | https://web-production-0391e.up.railway.app | Railway proyecto `auditapatron` (`5ff3f64a-542d-4a23-b500-a430c3054daa`) |
| Código | Repo `baltacavazos/complilink_operativo_v1` | Fuente del servicio `web` en Railway |

## Mandato 2026-09-04 (independencia / Fase 0)

- Administrar AuditaPatrón con **cero Manus** (solo lectura de Manus si hace falta).
- Documentar aquí en el repo.
- **No DNS** sin OK.
- **Acceso propio** (correo + contraseña) en Railway es el **siguiente bloque técnico**. **No implementarlo** sin instrucción explícita de código.

## Documentos de esta carpeta

- [ARCHITECTURE.md](./ARCHITECTURE.md) — arquitectura y límites
- [DEPLOYMENT.md](./DEPLOYMENT.md) — cómo se publica en Railway
- [ENVIRONMENT.md](./ENVIRONMENT.md) — nombres de variables (sin valores)
- [SERVICES.md](./SERVICES.md) — inventario Manus vs propio
- [BACKUP_RECOVERY.md](./BACKUP_RECOVERY.md) — respaldos MySQL en Railway
- [CHANGELOG.md](./CHANGELOG.md) — hitos de migración

## Contacto operativo

Coordina: Chief of Staff · AuditaPatrón bot · Bob · Tester · Mano.
