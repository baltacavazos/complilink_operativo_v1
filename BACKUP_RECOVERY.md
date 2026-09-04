# Respaldo y recuperación (Independencia 2026-09-04)

Sin contraseñas ni cadenas de conexión.

## 1) Respaldos gestionados de Railway MySQL

1. Abrir el proyecto Railway `5ff3f64a-542d-4a23-b500-a430c3054daa`.
2. Entrar al servicio **MySQL** (si existe en el proyecto).
3. Revisar la pestaña **Data** (backups del dashboard).
4. Confirmar si hay backups automáticos / snapshots en el plan.
5. Anotar frecuencia y retención solo en notas privadas del dueño.

## 2) Dump manual (esquema, sin pegar secretos)

- `railway connect` al MySQL y `mysqldump`, **o**
- TCP proxy de Railway + `mysqldump` desde la máquina del dueño.

```bash
# Pseudocódigo — credenciales solo desde el panel / CLI autenticado
mysqldump --single-transaction --routines --triggers \
  -h "<host-del-panel>" -P "<puerto>" -u "<user>" -p \
  "<nombre-db>" > auditapatron_railway_YYYY-MM-DD.sql
```

Comprimir y verificar checksum en local.

## 3) Checklist de drill de restauración

- [ ] Dump o snapshot de prueba
- [ ] Restaurar en base **temporal** (no live Manus)
- [ ] Verificar tablas clave y flujo `/auditar` básico
- [ ] Cronometrar y anotar resultado
- [ ] Borrar la base temporal al terminar

## 4) Dónde guardar copias

- Dropbox del dueño (carpeta privada)
- Máquina del dueño cifrada / offline
- **No** subir dumps con datos reales a GitHub

## 5) Nota sobre scripts Manus / Dropbox del README

Los scripts Python de Dropbox del README (`scripts/dropbox_full_backup_*.py`) y la política ZIP periódica son de la **era Manus**. El camino de independencia es:

1. MySQL en Railway + backups dashboard / dumps
2. Código en GitHub
3. Copias off-platform (Dropbox del dueño / offline)

## Relacionados

- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [ENVIRONMENT.md](./ENVIRONMENT.md)
