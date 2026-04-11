# Runbook de backup recuperable de base de datos

**Autor:** Manus AI  
**Proyecto:** AuditaPatron / CompliLink Operativo V1

Este runbook define el flujo operativo del nuevo respaldo recuperable de base de datos incorporado al proyecto. El objetivo es que el equipo pueda **extraer un artefacto portable**, **verificar su integridad**, **reconstruir la base mediante SQL de restauración** y, cuando se requiera, **subir el respaldo a Dropbox** para custodia externa.

## Alcance operativo

El respaldo implementado genera un artefacto comprimido con tres capas de utilidad. Primero, conserva el **snapshot normalizado** de tablas y filas. Segundo, incorpora un **manifest** con checksums para validar integridad lógica y estructural. Tercero, produce un archivo `.restore.sql` que permite reconstruir la base sin depender del estado actual del entorno.

| Componente | Propósito operativo | Resultado esperado |
| --- | --- | --- |
| `server/databaseBackup.ts` | Núcleo del respaldo recuperable | Crea snapshot, manifest, SQL y validación |
| `scripts/export-database-backup.mjs` | Ejecución manual o automatizable del export | Genera `.backup.json.gz` y `.restore.sql` |
| `scripts/validate-database-backup.mjs` | Verificación posterior del artefacto | Confirma checksums e igualdad con base viva |
| `pnpm backup:export` | Comando corto para operación habitual | Export reutilizable desde CLI |
| `pnpm backup:validate` | Comando corto para revisión de integridad | Validación del artefacto generado |

## Flujo recomendado de operación

El flujo recomendado parte de una exportación manual controlada. Después se valida el artefacto y, solo entonces, se considera apto para custodia externa o automatización programada. Esto reduce el riesgo de conservar respaldos corruptos o incompletos.

| Paso | Acción | Comando sugerido |
| --- | --- | --- |
| 1 | Generar export local recuperable | `pnpm backup:export -- --label manual --validate` |
| 2 | Guardar también en Dropbox si se desea custodia externa | `pnpm backup:export -- --label manual --validate --dropbox-path /AuditaPatron/backups` |
| 3 | Revalidar un artefacto existente | `pnpm backup:validate -- --artifact /ruta/al/archivo.backup.json.gz` |
| 4 | Revisar el `.restore.sql` antes de restauración controlada | Abrir el archivo generado y verificar destino |

## Estructura del artefacto

Cada ejecución genera un conjunto de archivos en el directorio de salida. El archivo comprimido contiene el manifest y el snapshot. El SQL de restauración queda separado para facilitar inspección humana, pruebas de restauración y uso en procedimientos de contingencia.

| Archivo | Descripción | Uso principal |
| --- | --- | --- |
| `*.backup.json.gz` | Artefacto comprimido con manifest y snapshot | Custodia, validación, auditoría técnica |
| `*.restore.sql` | SQL reproducible para reconstruir la base | Recuperación controlada |
| Salida JSON de consola | Resumen de backup y validación | Trazabilidad operativa y automatización |

## Restauración mínima recomendada

La restauración debe hacerse siempre en un entorno controlado antes de tocar un entorno crítico. El archivo SQL ya incorpora el orden de restauración de tablas y la desactivación temporal de restricciones foráneas para minimizar fallos por dependencias.

> Se recomienda restaurar primero en una base temporal o de ensayo, revisar conteos de filas por tabla y solo después promover el procedimiento a una contingencia real.

Una restauración mínima operativa consiste en crear una base vacía de destino, ejecutar el `.restore.sql` y contrastar los conteos de tablas más sensibles con el manifest generado por el backup.

## Base lista para automatización

La automatización queda preparada porque el flujo ya puede ejecutarse de forma no interactiva desde CLI y devolver JSON utilizable por programadores de tareas. En la práctica, el siguiente paso natural es invocar `pnpm backup:export` desde una tarea programada con una etiqueta temporal y una ruta fija de Dropbox.

| Variable operativa | Recomendación |
| --- | --- |
| Frecuencia | Nocturna para continuidad básica; mayor frecuencia según criticidad |
| Etiqueta | Usar prefijos como `nightly`, `pre-release`, `pre-migration` |
| Custodia externa | Activar `--dropbox-path` para sacar el backup del entorno local |
| Validación | Mantener `--validate` en toda ejecución automática crítica |
| Revisión humana | Auditar periódicamente artefactos y tiempos de generación |

## Ejemplos prácticos

La operación diaria puede apoyarse en comandos sencillos. Los ejemplos siguientes dejan lista una base suficientemente sólida para pasar después a una programación automática.

```bash
pnpm backup:export -- --label nightly --validate --dropbox-path /AuditaPatron/backups
```

```bash
pnpm backup:validate -- --artifact /home/ubuntu/complilink_operativo_v1/backups/db-backup-20260411t183000z.backup.json.gz
```

## Criterios de aceptación del backup

Un respaldo debe considerarse aceptable únicamente cuando la validación confirme integridad interna y, si se compara con la base viva, no existan tablas desalineadas.

| Verificación | Interpretación |
| --- | --- |
| `artifactChecksumVerified = true` | El manifest no fue alterado |
| `restoreSqlChecksumVerified = true` | El SQL coincide con el artefacto esperado |
| `schemaChecksumVerified = true` | El esquema exportado es consistente |
| `dataChecksumVerified = true` | Los datos exportados son coherentes |
| `liveDatabaseComparison.ok = true` | El backup refleja el estado actual de la base comparada |

## Siguiente paso recomendado

El siguiente paso aconsejable es conectar este flujo a una ejecución programada con política de retención y notificación al propietario. Esa capa ya no requiere rediseñar el mecanismo de exportación; solo necesita orquestar periódicamente los comandos incorporados en este sprint.
