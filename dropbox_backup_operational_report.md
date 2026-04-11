# Reporte operativo de respaldo en Dropbox

## Resumen

Se corrigió la discrepancia entre la prueba reforzada de Dropbox y la ejecución real del script de respaldo. El contraste con **OpenAI**, **Gemini** y **Grok** coincidió en que el problema más probable estaba en el **script operativo**, no en la credencial validada. El consenso fue que el flujo real estaba expuesto a una condición distinta de la prueba ligera, especialmente por la presencia de artefactos locales voluminosos y por una posible diferencia de contexto al empaquetar y subir el respaldo.

## Consenso comparado de las tres IA

| Motor | Hipótesis principal | Veredicto |
| --- | --- | --- |
| OpenAI | El ZIP podía estar incorporando artefactos gigantes dentro de `.manus-work/backups`, generando un contexto de ejecución distinto al de la prueba simple. | Cambiar el script |
| Gemini | El fallo apuntaba a una diferencia de contexto de ejecución del script y recomendaba endurecer exclusiones y validaciones. | Cambiar el script |
| Grok | El 401 era consistente con una discrepancia en el flujo real y sugirió revisar carga de entorno y cabeceras durante la ejecución efectiva. | Cambiar el script |

## Corrección aplicada

Se actualizó `/.manus-work/dropbox_backup.py` para excluir explícitamente rutas regenerables o problemáticas durante la creación del ZIP. En particular, ahora se omiten:

| Exclusión | Motivo operativo |
| --- | --- |
| `.manus-work/backups` | Evita autorreferencia del ZIP y crecimiento explosivo del respaldo |
| `node_modules` | Dependencia regenerable, no necesaria para respaldo fuente |
| `dist` | Artefacto compilado regenerable |
| `.git`, `.turbo`, `.next` | Artefactos o metadatos no requeridos para este respaldo operativo |
| ZIP actual en curso | Evita incluir el mismo archivo que se está creando |

## Validación posterior a la corrección

Después del ajuste se ejecutó nuevamente la prueba reforzada y luego el script operativo completo. La validación quedó positiva en ambos niveles.

| Verificación | Resultado |
| --- | --- |
| Suite de pruebas | `server/dropbox.secret.test.ts` pasó correctamente |
| Script operativo | Ejecutó sin error y subió el respaldo a Dropbox |
| Retención | Se mantuvo la política de conservar los últimos 5 respaldos |

## Evidencia del respaldo exitoso

| Campo | Valor |
| --- | --- |
| Fecha del respaldo | `2026-04-11T17:59` |
| Nombre del ZIP | `AuditaPatron_backup_20260411_1759.zip` |
| Ruta en Dropbox | `/Backups/AuditaPatron/AuditaPatron_backup_20260411_1759.zip` |
| Snapshot README | `AuditaPatron_backup_20260411_1759_README.md` |
| README vigente en Dropbox | `/Backups/AuditaPatron/README.md` |
| Archivos incluidos en el ZIP | `548` |
| Tamaño del ZIP | `1,953,912` bytes |
| Ruta local temporal | `/home/ubuntu/complilink_operativo_v1/.manus-work/backups/AuditaPatron_backup_20260411_1759.zip` |

## Estado operativo actual

El frente específico del **401 en `create_folder_v2`** quedó resuelto para este flujo. El respaldo completo ya quedó ejecutado exitosamente en Dropbox con un ZIP compacto y sin la autorreferencia que estaba distorsionando la ejecución real.

## Pendientes todavía abiertos

Siguen pendientes algunos puntos de madurez operativa del esquema de respaldo, especialmente mantener un `README` de respaldo más completo por checkpoint, agregar `CONFIGURACION.md`, agregar `ARQUITECTURA.md`, documentar integraciones activas y decidir si se intentará incluir un export utilizable de base de datos cuando el entorno lo permita.

## Archivos de evidencia relacionados

| Archivo | Propósito |
| --- | --- |
| `.manus-work/multi_ai_dropbox_diagnosis.json` | Resultado comparado de OpenAI, Gemini y Grok |
| `.manus-work/last_dropbox_backup_result.json` | Resultado estructurado de la última ejecución exitosa |
| `.manus-work/dropbox_backup.py` | Script operativo corregido |
