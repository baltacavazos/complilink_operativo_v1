# Inventario de servicios (Independencia 2026-09-04)

| Servicio | Clasificación | Estado independencia | Notas |
| --- | --- | --- | --- |
| Railway web | Propio | Paralelo temporal | `https://web-production-0391e.up.railway.app` |
| Railway MySQL | Propio (cuando cableado) | En proyecto `5ff3f64a-542d-4a23-b500-a430c3054daa` | Backups: ver BACKUP_RECOVERY |
| GitHub | Propio | Activo | Repo `complilink_operativo_v1` |
| Auth email/password propia | Propio (objetivo) | **Pendiente** en Railway | Bloqueante para cutover |
| Manus OAuth | Dependiente | Live en Manus | DNS no cortado |
| S3 / Forge | Dependiente | Live Manus | Migrar cuando se defina |
| Dropbox | Dependiente | Era Manus (scripts README) | Independencia: dumps + off-platform |
| OpenAI | Dependiente | Según vars | |
| Gemini | Dependiente | Según vars | |
| xAI / Grok | Dependiente | Contraste multi-IA | |
| Resend | Dependiente | Correo | |
| Stripe | Dependiente | Si aplica módulos de cobro | |
| WhatsApp | Dependiente | Si se activa | |
| Bridge AuditaPatrón (HMAC/webhook) | Mixto | Config en live | Secretos fuera de Git |
| DNS `auditapatron.com` | Crítico | Sigue a Manus | **Nunca** cambiar sin OK |

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) y [docs/INDEPENDENCE_AUDIT_2026-09-04.md](./docs/INDEPENDENCE_AUDIT_2026-09-04.md).
