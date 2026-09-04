# Despliegue — AuditaPatrón (Railway)

## Principio

Administración **sin Manus** como camino principal. El sitio público `auditapatron.com` permanece en Manus hasta el corte de DNS (solo con OK explícito). **No borrar Manus.**

## Servicio `web`

1. Código en GitHub: `baltacavazos/complilink_operativo_v1`.
2. Railway conecta ese repo al servicio `web` y construye con **Railpack**.
3. URL temporal pública: https://web-production-0391e.up.railway.app
4. Dominio propio / DNS: **fuera de alcance** hasta OK de Baltasar o Chief of Staff.

## Servicio `mysql`

- No se construye desde el repo.
- Imagen Docker `mysql:8`.
- Datos persistentes en volumen Railway montado en `/var/lib/mysql`.
- Ver [BACKUP_RECOVERY.md](./BACKUP_RECOVERY.md).

## Acceso de usuarios

- Hoy (copia / legado): entrada estilo Manus (correo + código).
- **Siguiente bloque técnico**: acceso propio en Railway (correo + contraseña).
- **No implementar** acceso propio sin instrucción explícita de código.

## Qué no hacer en un deploy rutinario

- No apuntar DNS a Railway sin OK.
- No borrar ni apagar Manus.
- No publicar secretos en el repo ni en tickets.
