# Auditoría de independencia — 2026-09-04

Producto: **AuditaPatrón** (`complilink_operativo_v1`). Sin secretos.

## Resumen ejecutivo

| Pregunta | Respuesta |
| --- | --- |
| ¿Dónde está el live? | Manus en `auditapatron.com` |
| ¿Se cortó DNS? | **No** |
| ¿Hay paralelo propio? | Sí — Railway `5ff3f64a-542d-4a23-b500-a430c3054daa` |
| URL temporal | `https://web-production-0391e.up.railway.app` |
| Auth propia en Railway | **No hecha aún** |
| ¿Secretos en repo? | **Prohibido** |

## Hallazgos

1. Código en GitHub bajo control del dueño.
2. Runtime paralelo Railway existe (URL temporal).
3. Live sigue en Manus; DNS intacto.
4. Auth email/password en Railway es la brecha principal antes de cutover.
5. Scripts Dropbox del README son era Manus; independencia = Railway + GitHub + copias off-platform.

## Brechas abiertas

- [ ] Implementar y validar auth propia en Railway
- [ ] Confirmar MySQL + backups dashboard / dump drill
- [ ] Plan de storage fuera de Forge/Manus
- [ ] Cutover DNS solo con OK de Baltasar

## Conclusión

Independencia **iniciada**: paralelo Railway listo para trabajo, live intacto. No cutover hasta auth propia + OK explícito.

Ver: [DEPLOYMENT.md](../DEPLOYMENT.md), [ENVIRONMENT.md](../ENVIRONMENT.md), [SERVICES.md](../SERVICES.md), [BACKUP_RECOVERY.md](../BACKUP_RECOVERY.md).
