# Changelog — migración AuditaPatrón

## 2026-09-04 — Fase 0 (activación Baltasar)

- Congelación: administrar con **cero Manus** (Manus solo lectura si hace falta); **no DNS**; **no borrar Manus**.
- Documentación operativa mínima añadida bajo `docs/auditapatron/` (README, ARCHITECTURE, DEPLOYMENT, ENVIRONMENT, SERVICES, BACKUP_RECOVERY, CHANGELOG).
- Inventario Railway: `web` + `mysql` (proyecto `5ff3f64a-542d-4a23-b500-a430c3054daa`); URL temp https://web-production-0391e.up.railway.app
- Acceso propio (correo + contraseña) documentado como **siguiente bloque**; no implementado.
- Procedimiento de respaldos MySQL (volumen Railway) documentado; pendiente activar calendarios Daily/Weekly en panel.
