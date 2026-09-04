# Respaldo y recuperación (Independencia 2026-09-04)

Sin contraseñas ni cadenas de conexión.

## 1) Respaldos nativos de volumen en Railway (MySQL)

El MySQL del proyecto `5ff3f64a-542d-4a23-b500-a430c3054daa` **ya existe** y usa volumen en `/var/lib/mysql`.

1. Abrir el proyecto Railway.
2. Entrar al servicio **mysql**.
3. Abrir la pestaña **Backups** (no «Data»).
4. Activar calendario **Daily** (y opcional Weekly).
5. Confirmar en el panel que el schedule quedó aplicado.
6. Anotar retención solo en notas privadas del dueño.

Nota: Railway puede crear backups automáticos según el schedule; un disparo manual no siempre está en la API.

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

1. MySQL en Railway + pestaña **Backups** / dumps
2. Código en GitHub
3. Copias off-platform (Dropbox del dueño / offline)

## Relacionados

- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [ENVIRONMENT.md](./ENVIRONMENT.md)
