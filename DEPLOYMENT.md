# Despliegue (Independencia 2026-09-04)

Lenguaje sencillo. Sin secretos. Complementa [CONFIGURACION.md](./CONFIGURACION.md) y [ARQUITECTURA.md](./ARQUITECTURA.md).

## Dos entornos en paralelo

| Entorno | URL / dominio | Rol hoy |
| --- | --- | --- |
| **Live (Manus)** | `https://auditapatron.com` | Producción real. DNS **no** cortado. |
| **Paralelo (Railway)** | `https://web-production-0391e.up.railway.app` | Copia temporal de independencia. Proyecto Railway `5ff3f64a-542d-4a23-b500-a430c3054daa`. |

**Regla de oro:** nunca cortar DNS ni apuntar `auditapatron.com` a Railway sin OK explícito de Baltasar.

## Estado de auth en Railway

- Auth propia email/password en Railway: **aún no hecha**.
- Live sigue con Manus OAuth.

## Pasos de despliegue en Railway (resumen)

1. Conectar el repo GitHub y la rama `main` (o la que se autorice).
2. Servicio web + MySQL en el proyecto Railway indicado.
3. Variables mínimas (ver [ENVIRONMENT.md](./ENVIRONMENT.md)); secretos solo en el panel.
4. Completar auth propia antes de cualquier cutover.
5. Verificar health en la URL temporal antes de tocar DNS.

## Checklist antes de cutover DNS

- [ ] Auth email/password propia estable en Railway
- [ ] MySQL respaldado (ver [BACKUP_RECOVERY.md](./BACKUP_RECOVERY.md))
- [ ] Integraciones críticas migradas o degradadas a propósito
- [ ] OK escrito de Baltasar para DNS
- [ ] Plan de rollback (volver DNS a Manus)

## Documentación relacionada

- [ENVIRONMENT.md](./ENVIRONMENT.md)
- [SERVICES.md](./SERVICES.md)
- [BACKUP_RECOVERY.md](./BACKUP_RECOVERY.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [docs/INDEPENDENCE_AUDIT_2026-09-04.md](./docs/INDEPENDENCE_AUDIT_2026-09-04.md)
