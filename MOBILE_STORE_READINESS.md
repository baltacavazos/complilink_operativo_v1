# Preparación móvil para tiendas

## Estado actual de identidad

| Campo | Valor actual | Comentario |
|---|---|---|
| Nombre visible | `Auditapatron` | Ya definido en la base móvil actual. |
| App ID base | `com.auditapatron.mobile` | Se usa como identidad nativa actual. |
| Dominio web principal | `https://auditapatron.com` | Shell remoto por defecto. |
| Esquema de retorno | `auditapatron://` | Ya registrado para el flujo móvil de Google. |

## Lo que ya quedó preparado en esta ronda

| Frente | Estado | Alcance |
|---|---|---|
| Google móvil | Base lista | El inicio desde móvil usa URL pública absoluta y marca la solicitud como nativa. |
| Retorno a la app | Base lista | El callback exitoso o fallido puede regresar a la app por `auditapatron://`. |
| Linking de cuentas | Base lista | Se prioriza la identidad existente por proveedor o por correo para evitar duplicados. |
| Checklist operativo | Base lista | Queda identificada la siguiente validación real antes de publicar. |

## Pendientes antes de publicación

| Prioridad | Pendiente | Resultado esperado |
|---|---|---|
| Alta | Probar login Google en iPhone y Android reales | Confirmar regreso correcto al punto final y cierre del navegador externo. |
| Alta | Verificar persistencia de sesión al reabrir la app | Confirmar que el usuario no tenga que volver a autenticarse sin motivo. |
| Alta | Producir icono final y splash final | Dejar coherente la identidad visual en ambas tiendas. |
| Media | Preparar capturas de pantalla reales de producto | Tener material listo para la ficha de publicación. |
| Media | Revisar firma, privacidad móvil y textos de store | Cerrar el paquete de publicación no técnico. |
| Media | Evaluar si conviene añadir universal links más adelante | Decidir si el esquema actual es suficiente o si se endurece la distribución futura. |

## Siguiente validación recomendada

La siguiente ronda práctica conviene hacerla con pruebas en dispositivo real. El objetivo ya no es construir más infraestructura base, sino confirmar que el regreso desde Google, la sesión posterior y la experiencia de reapertura se comportan de forma consistente en iPhone y Android.
