# CONFIGURACION.md

## Propósito

Este documento resume la **configuración operativa** de **AuditaPatron / CompliLink Operativo V1** para facilitar mantenimiento, respaldo, auditoría y recuperación del entorno. Describe **variables de entorno, puertos, URLs, integraciones y validaciones mínimas**, sin exponer secretos ni valores reales.

El proyecto opera con **React 19 + Vite + Tailwind 4** en frontend y **Express + tRPC + Drizzle ORM + MySQL/TiDB** en backend. La autenticación usa **Manus OAuth**, el almacenamiento documental usa **S3**, y existen integraciones externas para correo, consenso multi-IA, bridge de AuditaPatron y respaldo en Dropbox.

## Principios de seguridad

La configuración debe tratarse como material sensible. Los secretos deben existir únicamente como variables de entorno gestionadas por la plataforma. Este archivo documenta propósito, criticidad y superficie de uso, pero **nunca** debe incluir tokens, secretos HMAC, cadenas de conexión completas ni credenciales reales.

| Regla | Aplicación |
| --- | --- |
| No exponer valores reales | Nunca copiar secretos en Markdown, logs o pruebas |
| Documentar por propósito | Describir para qué sirve cada variable y quién la consume |
| Distinguir criticidad | Separar variables obligatorias de opcionales |
| Validar antes de operar | Verificar configuración antes de pruebas, hitos y respaldos |
| Mantener sincronía | Actualizar este archivo junto con README cuando cambie una integración |

## Variables de entorno identificadas

Las siguientes variables se identificaron a partir del entorno del proyecto, `server/_core/env.ts`, el README operativo y la configuración de la plataforma.

| Variable | Categoría | Obligatoria | Uso principal | Superficie |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Base de datos | Sí | Conexión a MySQL/TiDB | Backend, Drizzle |
| `JWT_SECRET` | Seguridad | Sí | Firma de sesión y autenticación | Backend |
| `VITE_APP_ID` | OAuth | Sí | Identificador de app para OAuth | Frontend/Backend |
| `OAUTH_SERVER_URL` | OAuth | Sí | Backend del portal OAuth | Backend |
| `VITE_OAUTH_PORTAL_URL` | OAuth | Sí | Portal de login para frontend | Frontend |
| `OWNER_OPEN_ID` | Administración | Sí | Identificación del propietario | Backend |
| `OWNER_NAME` | Administración | Sí | Nombre del propietario | Plataforma/UI |
| `BUILT_IN_FORGE_API_URL` | APIs integradas | Sí | URL base de APIs internas | Backend |
| `BUILT_IN_FORGE_API_KEY` | APIs integradas | Sí | Token servidor para APIs internas | Backend |
| `VITE_FRONTEND_FORGE_API_URL` | APIs integradas | Sí | URL frontend para APIs integradas | Frontend |
| `VITE_FRONTEND_FORGE_API_KEY` | APIs integradas | Sí | Token frontend para APIs integradas | Frontend |
| `AUDITAPATRON_ENGINE_WEBHOOK_URL` | Integración externa | Sí | Destino del bridge/motor externo | Backend |
| `AUDITAPATRON_ENGINE_HMAC_SECRET` | Integración externa | Sí | Firma HMAC para tráfico del bridge | Backend |
| `OPENAI_API_KEY` | IA | Sí para consenso multi-IA | Contraste y validación con OpenAI | Herramientas/servicios auxiliares |
| `GEMINI_API_KEY` | IA | Sí para consenso multi-IA | Contraste y validación con Gemini | Herramientas/servicios auxiliares |
| `DROPBOX_API_KEY` | Respaldo | Sí para backup | Respaldo obligatorio en Dropbox | Validación y backup |
| `RESEND_API_KEY` | Correo | Sí si hay notificaciones | Envío de correo | Backend |
| `RESEND_FROM_EMAIL` | Correo | Sí si hay notificaciones | Remitente operativo | Backend |
| `VITE_ANALYTICS_ENDPOINT` | Analítica | Recomendable | Endpoint de eventos | Frontend |
| `VITE_ANALYTICS_WEBSITE_ID` | Analítica | Recomendable | Identificador del sitio | Frontend |
| `VITE_APP_TITLE` | Branding | Recomendable | Título de la app | Frontend |
| `VITE_APP_LOGO` | Branding | Recomendable | Logo de la app | Frontend |
| `PORT` | Runtime | No | Puerto preferido del backend | Backend |
| `NODE_ENV` | Runtime | Sí | Define desarrollo o producción | Backend |
| `GOOGLE_CLIENT_ID` | OAuth adicional | Opcional/legacy | Reserva para integración futura | Backend |
| `GOOGLE_CLIENT_SECRET` | OAuth adicional | Opcional/legacy | Reserva para integración futura | Backend |

## Agrupación por dominio operativo

| Grupo | Variables | Impacto si faltan |
| --- | --- | --- |
| Núcleo transaccional | `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV` | El sistema no debe operar normalmente |
| Acceso y sesión | `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `OWNER_OPEN_ID` | Fallos de login o callback |
| Plataforma integrada | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, `VITE_FRONTEND_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_KEY` | Se degradan APIs internas y conectores |
| Bridge AuditaPatron | `AUDITAPATRON_ENGINE_WEBHOOK_URL`, `AUDITAPATRON_ENGINE_HMAC_SECRET` | Se rompe el flujo documental externo |
| Consenso multi-IA | `OPENAI_API_KEY`, `GEMINI_API_KEY` | Se pierde el contraste multimodelo solicitado |
| Respaldo | `DROPBOX_API_KEY` | No pueden ejecutarse respaldos automáticos |
| Comunicación | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Fallan correos y avisos operativos |
| Branding y medición | `VITE_APP_TITLE`, `VITE_APP_LOGO`, `VITE_ANALYTICS_ENDPOINT`, `VITE_ANALYTICS_WEBSITE_ID` | No bloquea el núcleo, pero afecta identidad y medición |

## Puertos, rutas y URLs relevantes

El backend arranca desde `server/_core/index.ts`. Intenta usar el puerto definido en `PORT` y, si no existe, parte de **`3000`** y busca uno disponible. En desarrollo, Vite se integra con el servidor Express.

| Superficie | Fuente | Uso |
| --- | --- | --- |
| Backend local preferido | `PORT` o fallback `3000` | Arranque de Express |
| API tipada | `/api/trpc` | Comunicación frontend-backend |
| Callback OAuth | `/api/oauth/callback` | Finalización de autenticación |
| Webhook entrante | `/api/auditapatron/complilink-webhook` | Recepción de resultados externos |
| OAuth servidor | `OAUTH_SERVER_URL` | Autenticación de usuarios |
| Portal OAuth frontend | `VITE_OAUTH_PORTAL_URL` | Inicio de login en UI |
| APIs integradas backend | `BUILT_IN_FORGE_API_URL` | Servicios internos de plataforma |
| APIs integradas frontend | `VITE_FRONTEND_FORGE_API_URL` | Servicios internos consumidos desde UI |
| Bridge saliente | `AUDITAPATRON_ENGINE_WEBHOOK_URL` | Envío de documentos al motor |
| Dropbox backup path | `/Backups/AuditaPatron/` | Destino obligatorio de respaldos |

## Variables especialmente sensibles

| Variable | Riesgo principal | Requisito documental |
| --- | --- | --- |
| `DATABASE_URL` | Exposición de base de datos | Documentar solo propósito, nunca la cadena |
| `JWT_SECRET` | Suplantación de sesión | No imprimir ni copiar |
| `AUDITAPATRON_ENGINE_HMAC_SECRET` | Falsificación de tráfico firmado | Mantener solo en entorno seguro |
| `DROPBOX_API_KEY` | Acceso indebido o bloqueo de backup | Validar antes de automatizar |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | Uso no autorizado y costos | Mantener fuera de repo y logs |
| `BUILT_IN_FORGE_API_KEY` | Acceso indebido a APIs internas | Restringir a backend |

## Validaciones mínimas antes de operar

| Validación | Resultado esperado |
| --- | --- |
| `DATABASE_URL` presente y válida | Persistencia disponible |
| `JWT_SECRET` presente y no vacío | Sesiones firmadas correctamente |
| Variables OAuth presentes | Login y callback operativos |
| Variables del bridge presentes | Integración documental operativa |
| `DROPBOX_API_KEY` válido | La API de Dropbox responde correctamente |
| Variables de correo presentes si aplica | Notificaciones disponibles |
| Variables de analítica alineadas | Eventos de medición no se pierden |

## Estado actual del respaldo obligatorio

La política aprobada exige generar, en cada milestone o cada treinta minutos de trabajo activo, un ZIP con formato **`AuditaPatron_backup_YYYYMMDD_HHMM.zip`** y subirlo a **`/Backups/AuditaPatron/`** junto con la documentación requerida. Para ello, `DROPBOX_API_KEY` debe ser un **access token válido** de Dropbox y no un App key.

La credencial de Dropbox ya fue **revalidada correctamente** mediante una prueba técnica contra el endpoint ligero de cuenta. Con ello, el flujo de respaldo queda **desbloqueado** y listo para ejecutar el backup completo hacia `/Backups/AuditaPatron/` con la política de retención aprobada.

## Estado actual por integración

| Integración | Estado | Observación |
| --- | --- | --- |
| Base de datos | Configurada | No exponer cadena real |
| Manus OAuth | Configurado | Núcleo de autenticación |
| Forge APIs | Configuradas | Soporte interno de plataforma |
| Bridge AuditaPatron | Configurado | Depende de webhook y HMAC |
| OpenAI | Disponible | Se usa para contraste multi-IA |
| Gemini | Disponible | Se usa para contraste multi-IA |
| Dropbox | Validado | La credencial respondió correctamente y permite continuar con el backup |
| Resend | Configurado | Útil para comunicación operativa |

## Riesgos operativos de configuración

| Riesgo | Consecuencia |
| --- | --- |
| Documentar variables desactualizadas | Diagnóstico incorrecto |
| Omitir variables activas | Fallos silenciosos |
| Exponer valores reales | Incidente de seguridad |
| No validar Dropbox antes del backup | Respaldo fallido en momento crítico |
| No distinguir obligatorio de opcional | Tiempo perdido en soporte y revisión |

## Mantenimiento de este archivo

Este archivo debe actualizarse cada vez que cambie una integración, un secreto, una ruta de webhook, la política de respaldo o la superficie de red del proyecto.

| Evento | Acción requerida |
| --- | --- |
| Nueva integración | Añadir variable, propósito y riesgo |
| Cambio de callback o webhook | Actualizar tabla de rutas y URLs |
| Cambio de política de backup | Revisar sección de respaldo obligatorio |
| Alta de nuevo secreto | Clasificar criticidad y uso |
| Variable en desuso | Marcarla como legacy o retirarla |
