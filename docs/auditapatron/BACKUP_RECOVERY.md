# Respaldo y recuperación — MySQL (Railway)

Proyecto Railway: **auditapatron** · `5ff3f64a-542d-4a23-b500-a430c3054daa`  
Servicio: **mysql** · `fa155c62-f4f2-4e52-8ad9-4e7dde198c49`  
Volumen: `985f10e8-6e45-49a7-b18b-4ae5322765d3` montado en `/var/lib/mysql`  
Entorno: **production** · `0f91e181-af02-4123-a5a3-a52f61d276fc`

Referencia oficial: [Railway Volume Backups](https://docs.railway.com/volumes/backups) · [MySQL en Railway](https://docs.railway.com/databases/mysql#backups-and-observability)

## 1. Respaldos nativos del volumen (recomendado)

Los respaldos de volumen capturan todo lo montado en el servicio MySQL (incluye los datos de MySQL).

### Activar calendarios

En el panel de Railway → servicio **mysql** → pestaña **Backups**:

| Calendario | Frecuencia | Retención |
|------------|------------|-----------|
| Daily | cada 24 h | 6 días |
| Weekly | cada 7 días | 27 días |
| Monthly | cada 30 días | 89 días |

**Recomendación inmediata (Fase 0):** activar al menos **Daily + Weekly**. Se pueden combinar varios calendarios.

También se pueden crear respaldos **manuales** desde la misma pestaña.

Límite: un respaldo manual no puede superar ~50 % de la capacidad del volumen; si falla por tamaño, crecer el volumen antes.

### Restaurar

1. Servicio **mysql** → **Backups** → elegir fecha → **Restore**.
2. Railway **prepara** un cambio (nuevo volumen con la fecha del respaldo montado; el volumen anterior queda desmontado pero retenido).
3. Revisar en el canvas del proyecto (**Details**) y pulsar **Deploy** para aplicar.
4. El servicio se redespliega con el volumen restaurado.

**Importante**

- Solo se puede restaurar en el **mismo proyecto y entorno**.
- **Borrar / wipe** del volumen **elimina** sus respaldos.
- Los respaldos más nuevos que el punto restaurado no se copian al volumen nuevo; siguen en el volumen anterior desmontado.

## 2. Volcado lógico opcional (`mysqldump`)

Complemento off-site (no sustituye los backups de volumen):

1. Conectar al MySQL de Railway usando las variables del panel (`MYSQL_*`) vía CLI o shell de Railway — **sin pegar contraseñas en el repo ni en chats**.
2. Generar un dump comprimido fuera de la plataforma (almacenamiento cifrado externo).
3. **Nunca** commitear dumps al GitHub.

## 3. Simulacro de recuperación

Antes del corte de DNS / independencia total:

1. Tomar un backup manual.
2. Restaurar en un entorno de prueba o verificar restore en staging si existe; si solo hay `production`, coordinar ventana con Chief.
3. Verificar que la app `web` sigue leyendo datos tras el restore.

## 4. Qué no hacer

- No exponer MySQL a internet (TCP proxy) salvo necesidad temporal documentada.
- No guardar `MYSQL_PASSWORD` / `MYSQL_ROOT_PASSWORD` en el repo.
- No wipe del volumen “para limpiar” sin backup reciente verificado.
