# AuditaPatron / CompliLink Operativo V1

**Estado actual:** operativo en entorno de desarrollo, con foco funcional en la experiencia de **AuditaPatron** y el flujo **`/auditar`**.

## Resumen del estado actual

Este proyecto corre sobre una base **React 19 + Vite + Tailwind 4** en frontend y **Express + tRPC + Drizzle ORM + MySQL/TiDB** en backend. La autenticación usa **Manus OAuth** ya integrado en la plantilla y el almacenamiento documental se apoya en **S3** a través de helpers del proyecto.

En el estado actual, la experiencia de **`/auditar`** ya distingue visualmente entre **borradores analizados** y **documentos confirmados**, incorpora un CTA único de **Reanalizar** sin alterar documentos ya confirmados, y registra métricas del embudo desde la selección del archivo hasta la confirmación final. La suite de **Vitest** se encuentra pasando para la cobertura añadida en este checkpoint.

## Stack técnico

| Capa | Tecnología principal | Uso actual |
| --- | --- | --- |
| Frontend | React 19, Vite 7, Tailwind 4 | Interfaz operativa, vistas de auditoría y navegación |
| UI | Radix UI, shadcn/ui, Framer Motion, Lucide | Componentes accesibles, microinteracciones e iconografía |
| Datos cliente | TanStack Query, tRPC client | Consumo tipado de procedimientos |
| Backend | Express 4, tRPC 11 | API y lógica de aplicación |
| Base de datos | Drizzle ORM, MySQL/TiDB | Persistencia operativa y contratos de datos |
| Auth | Manus OAuth | Sesión de usuario y protección de rutas |
| Storage | Helpers S3 del proyecto | Carga y acceso de archivos |
| Testing | Vitest, Playwright | Pruebas unitarias e integración ligera |

## Instrucciones de instalación y ejecución

El proyecto está preparado para trabajar con **pnpm**.

| Acción | Comando |
| --- | --- |
| Instalar dependencias | `pnpm install` |
| Ejecutar en desarrollo | `pnpm dev` |
| Verificar tipos | `pnpm check` |
| Ejecutar pruebas unitarias | `pnpm test` |
| Construir producción | `pnpm build` |
| Iniciar build de producción | `pnpm start` |

## Variables de entorno necesarias

El proyecto recibe varias variables desde la plataforma. Para una instalación equivalente, estas son las más relevantes para dejar operativa la aplicación.

| Variable | Propósito |
| --- | --- |
| `DATABASE_URL` | Conexión a MySQL/TiDB |
| `JWT_SECRET` | Firma de sesión/autenticación |
| `VITE_APP_ID` | Identificador de la app para OAuth |
| `OAUTH_SERVER_URL` | Backend del portal OAuth |
| `VITE_OAUTH_PORTAL_URL` | URL del portal de login |
| `OWNER_OPEN_ID` | Identificador del propietario |
| `OWNER_NAME` | Nombre del propietario |
| `BUILT_IN_FORGE_API_URL` | URL base de APIs integradas de plataforma |
| `BUILT_IN_FORGE_API_KEY` | Token servidor para APIs integradas |
| `VITE_FRONTEND_FORGE_API_URL` | URL frontend para APIs integradas |
| `VITE_FRONTEND_FORGE_API_KEY` | Token frontend para APIs integradas |
| `OPENAI_API_KEY` | Consultas LLM auxiliares del proyecto |
| `GEMINI_API_KEY` | Consultas Gemini y validaciones multimodelo |
| `RESEND_API_KEY` | Envío de correos |
| `RESEND_FROM_EMAIL` | Remitente configurado para correo |
| `AUDITAPATRON_ENGINE_HMAC_SECRET` | Firma para integración con motor externo |
| `AUDITAPATRON_ENGINE_WEBHOOK_URL` | Webhook del motor/bridge |
| `DROPBOX_API_KEY` | Respaldo obligatorio de checkpoints en Dropbox |

## Estructura operativa relevante

| Ruta | Función |
| --- | --- |
| `client/src/pages/Auditar.tsx` | Flujo principal de auditoría documental |
| `client/src/pages/Auditar.alerts.test.ts` | Cobertura unitaria del flujo y helpers de `/auditar` |
| `client/src/lib/analytics.ts` | Contrato de analítica del frontend |
| `server/routers.ts` | Procedimientos tRPC principales |
| `server/db.ts` | Helpers de acceso a datos |
| `drizzle/schema.ts` | Esquema de base de datos |
| `todo.md` | Historial de tareas y cambios pendientes/completados |

## Changelog del checkpoint actual

### Checkpoint reciente

En este checkpoint se reforzó la claridad operativa del flujo de **`/auditar`**. El timeline ahora distingue el estado de cada pieza documental entre **borrador** y **confirmado**, lo que reduce el riesgo de confundir lectura temporal con evidencia ya integrada. También se consolidó un único botón de **Reanalizar**, pensado para reiniciar el ciclo desde un borrador activo sin alterar documentos previamente confirmados. Además, se añadieron métricas de conversión para seguir el recorrido desde la selección del archivo hasta el guardado confirmado y se amplió la cobertura de **Vitest** para validar estos cambios.

## Política de respaldo operativo

A partir de este punto, cada milestone importante debe generar un respaldo con dos artefactos: un **ZIP completo del proyecto** y este **README actualizado**. Ambos deben enviarse a **`/Backups/AuditaPatron/`** en Dropbox, manteniendo únicamente los **últimos cinco respaldos** cuando el total exceda ese límite.
