# Validación controlada de documento existente — Helios

**Fecha:** 22 de agosto de 2026

## Alcance

Se reutilizó un recibo de nómina PDF ya almacenado en un expediente existente. La prueba no creó archivos, no sustituyó el documento, no alteró su hash ni modificó su registro documental. El despacho se ejecutó bajo autorización explícita del propietario y con una guarda de entorno que exige confirmación literal antes de enviar un documento existente.

## Evidencia obtenida

| Comprobación | Resultado |
|---|---|
| Integridad local del recibo | Verificada previamente en el expediente |
| Contratos canónicos de caso, documento, clasificación y auditoría | Disponibles en estado `ready` |
| Health público de retorno de AuditaPatron | `200` con JSON contractual |
| Health autenticado del bridge canónico de Helios | `200` |
| Despacho real del recibo existente | `200` |
| Acuse del bridge | `received: true` |
| Estado inicial de procesamiento | `pending` |
| Host y ruta usados | `complilink.mx` / `/api/integrations/auditapatron/bridge` |

## Correcciones aplicadas

La validación encontró que el smoke histórico consultaba rutas antiguas que devolvían el HTML de la aplicación con estado `200`. Se corrigió para usar el contrato canónico de Helios, exigir JSON y considerar cualquier HTML como fallo de contrato.

También se alineó el payload documental real. El bridge requiere `providerId`, `userId` y `documentId` numéricos, además de un `title` obligatorio. AuditaPatron ya guardaba el identificador numérico interno del documento; la corrección evita convertirlo a texto antes del envío. Se propagó este identificador desde las rutas principales de carga y desde la confirmación de vista previa.

## Verificación técnica

La verificación posterior completó TypeScript, Vitest y build de producción correctamente. Las suites focalizadas de integración, smoke, monitoreo y workflows pasaron después del ajuste.

## Pendiente controlado

El acuse síncrono fue correcto y el documento quedó aceptado para procesamiento. Esta utilidad de validación se diseñó para no escribir en la base local, por lo que no persiste artificialmente el acuse ni fabrica un callback remoto. La confirmación final pendiente consiste en cargar o confirmar un documento desde el flujo normal de la aplicación, con consentimiento válido, y verificar que el callback asíncrono de Helios se persista en `compliLink_webhook_events`.
