# ARQUITECTURA.md

## Propósito

Este documento describe la **arquitectura operativa** de **AuditaPatron / CompliLink Operativo V1** tal como existe en el proyecto actual. Su objetivo es facilitar continuidad, mantenimiento, auditoría, recuperación y respaldo. La descripción privilegia los componentes realmente presentes en la base de código y evita tanto idealizaciones como exposición de secretos.

La plataforma está construida como una **web app full-stack** con **frontend React 19 + Vite + Tailwind 4**, un **backend Express** con **tRPC** como contrato principal, **Drizzle ORM** para acceso a datos y una base transaccional **MySQL/TiDB**. Sobre ese núcleo se montan autenticación Manus OAuth, almacenamiento de archivos en S3, integraciones operativas externas y una capa documental orientada al expediente laboral del usuario.

## Vista general del sistema

La arquitectura responde a un principio simple: **una sola aplicación central** con un núcleo de expediente laboral y varias capacidades acopladas de forma controlada. El frontend consume procedimientos tipados; el backend concentra autorización, reglas de negocio, persistencia, trazabilidad e integraciones; y los archivos viven fuera de la base de datos, con metadatos persistidos en tablas del dominio.

| Capa | Tecnología principal | Responsabilidad dominante |
| --- | --- | --- |
| Presentación | React 19, Vite, Tailwind 4 | UI pública, flujo `/auditar`, consola CEO, legal y navegación |
| Contrato aplicación | tRPC 11 | Comunicación tipada frontend-backend |
| Backend HTTP | Express 4 | Arranque, middlewares, OAuth callback, tRPC y webhooks |
| Dominio y persistencia | Drizzle ORM + MySQL/TiDB | Casos, documentos, consentimientos, auditoría y estado operativo |
| Almacenamiento binario | S3 helpers | Guardado y recuperación de archivos/documentos |
| Integraciones externas | Webhooks, HMAC, correo, IA, Dropbox | Motor documental, notificaciones, contraste multi-IA y backups |

## Estructura lógica principal

El proyecto se organiza alrededor de un conjunto reducido de directorios con responsabilidades diferenciadas. La estructura no separa microservicios: se trata de un **monolito modular**, adecuado para velocidad de iteración y control operativo en esta etapa.

| Ruta | Rol arquitectónico |
| --- | --- |
| `client/` | Interfaz web, páginas, componentes reutilizables, branding, dashboard y UX de AuditaPatron |
| `server/` | Reglas de negocio, routers tRPC, autenticación, validaciones, integraciones y pruebas backend |
| `drizzle/` | Esquema de datos y migraciones |
| `shared/` | Tipos, contratos y utilidades compartidas |
| `storage/` | Helpers de almacenamiento de archivos |
| `.manus-work/` | Automatización operativa local, incluyendo el flujo de backup a Dropbox |
| `scripts/` | Scripts auxiliares, como contraste multi-IA y utilidades de documentación |

## Capa de frontend

El frontend implementa la experiencia visible de AuditaPatron. La aplicación expone una **landing principal**, el flujo **`/auditar`** como centro de captura y claridad documental, módulos legales, componentes de branding y una **consola CEO** para administración operativa.

La UI no debe entenderse como un cliente autónomo: funciona como una capa delgada sobre procedimientos tipados. La mayor parte de la lógica crítica no queda en el navegador, sino en el backend. Esto reduce superficie de exposición, mejora trazabilidad y facilita endurecimiento progresivo sin duplicar lógica entre cliente y servidor.

| Elemento | Función |
| --- | --- |
| `client/src/App.tsx` | Orquestación de rutas y shells principales |
| `client/src/pages/` | Páginas de Home, `/auditar`, CEO y demás vistas del producto |
| `client/src/lib/trpc.ts` | Cliente tRPC y binding tipado al backend |
| `client/src/components/` | Componentes reutilizables, branding, layouts y piezas UX |
| `client/src/index.css` | Tokens visuales, theming y base global de estilo |

## Capa de backend

El backend concentra el valor estructural de la plataforma. Se encarga de autenticación, autorización, orquestación de workflows, persistencia, auditoría, integraciones salientes y recepción de eventos externos. La elección de **tRPC** reduce fricción entre frontend y backend al compartir contrato tipado sin introducir una capa REST manual adicional para el núcleo del producto.

El arranque se realiza desde `server/_core/index.ts`, donde se inicializa Express, se integra Vite en desarrollo, se habilitan rutas del sistema y se expone el árbol de procedimientos. El backend evita hardcodear un puerto único y parte de `PORT` o de un fallback operativo, facilitando despliegue y portabilidad.

| Módulo | Responsabilidad |
| --- | --- |
| `server/_core/index.ts` | Boot del servidor, integración con Vite y superficie HTTP principal |
| `server/routers.ts` | Procedimientos tRPC iniciales y composición del contrato backend |
| `server/db.ts` | Helpers de acceso a datos |
| `server/auditaPatronIntegrationService.ts` | Integración saliente con motor externo y lógica HMAC/documental |
| `server/_core/env.ts` | Tipado, lectura y validación de variables de entorno |

## Modelo de datos y dominio

El dominio persistente gira alrededor del **expediente laboral**, los **documentos del caso**, la **trazabilidad de auditoría**, los **consentimientos legales** y superficies administrativas relacionadas con operación y acceso. La persistencia sigue un enfoque de **metadatos en base de datos y bytes en storage**, evitando cargar la base con blobs pesados.

De acuerdo con la estrategia Helios-first ya formalizada dentro del proyecto, la aplicación reutiliza el núcleo actual de casos y documentos para representar expediente y documento laboral sin abrir una arquitectura paralela. Esto permite mantener continuidad funcional mientras se refuerza el dominio canónico.

| Entidad o agregado | Papel dentro del sistema |
| --- | --- |
| Expediente laboral / caso | Contenedor principal del contexto del usuario |
| Documento laboral | Evidencia, fuente de análisis y trazabilidad |
| Consentimiento legal | Base de licitud y versionado documental/legal |
| Auditoría / hash chain | Evidencia operativa y trazabilidad defensable |
| Alertas y vistas CEO | Observabilidad y control administrativo |

## Flujo documental principal

El flujo principal de negocio nace en la experiencia `/auditar`. La persona usuaria carga o captura un documento, el sistema realiza validaciones tempranas, persiste o prepara el activo, actualiza el expediente, produce claridad visible y, cuando aplica, coordina integraciones externas. El diseño operativo busca que el flujo sea simple en la UI, pero estricto en backend.

A nivel arquitectónico, este flujo combina cinco responsabilidades: recepción, validación, almacenamiento, análisis/derivación y actualización visible del expediente. El objetivo es que cada documento fortalezca el caso sin comprometer trazabilidad, consentimiento ni separación entre dato confirmado y estimado.

| Etapa | Responsable principal |
| --- | --- |
| Captura/subida desde UI | Frontend |
| Validaciones y autorización | Backend |
| Persistencia de metadatos | Base de datos |
| Persistencia del archivo | S3 |
| Integración, análisis y retorno | Backend + servicios externos |
| Visualización de hallazgos | Frontend |

## Integraciones externas

La plataforma ya contempla varias integraciones con funciones claramente separadas. El criterio general es que toda integración sensible ocurra desde backend y que, cuando haya intercambio con terceros, exista una política explícita de autenticación y trazabilidad.

La integración saliente más relevante en el núcleo documental es el **bridge de AuditaPatron**, que utiliza webhook y firma **HMAC** para intercambiar eventos y payloads de manera verificable. Además, el proyecto dispone de claves para contraste multi-IA, notificaciones por correo y respaldo obligatorio en Dropbox.

| Integración | Mecanismo | Propósito |
| --- | --- | --- |
| Manus OAuth | Callback + sesión | Autenticación de usuarios |
| S3 | Helpers server-side | Almacenamiento de archivos |
| Motor externo / bridge | Webhook + HMAC | Envío/recepción de eventos documentales |
| OpenAI / Gemini / Grok | APIs externas | Contraste multi-IA y arbitraje técnico-operativo |
| Resend | API de correo | Notificaciones operativas |
| Dropbox | API Files | Respaldo ZIP + README con retención |

## Seguridad y perímetro de confianza

La arquitectura asume que el **backend es el perímetro confiable**. Allí viven claves, firma de sesiones, HMAC, almacenamiento, validaciones fuertes y reglas de negocio. El frontend nunca debe asumir autoridad por sí mismo. Esta separación es especialmente importante en workflows de consentimientos, carga documental, exportes administrativos y sincronización con sistemas externos.

El sistema también privilegia autorización contextual. No basta con estar autenticado: varias operaciones dependen del expediente, del tenant, del caso, del rol y del estado del workflow. La consola CEO añade una capa adicional de control y guardrails para acciones sensibles.

| Riesgo | Respuesta arquitectónica |
| --- | --- |
| Exposición de secretos | Variables de entorno solo server-side cuando corresponde |
| Acciones no autorizadas | Procedimientos protegidos y validaciones por contexto |
| Duplicidad o reintento | Idempotencia, locks y trazabilidad |
| Corrupción por archivos hostiles | Validación temprana de MIME, nombre, tamaño y firma binaria |
| Falta de evidencia operativa | Auditoría, timestamps, historial y pruebas |

## Observabilidad y operación

El proyecto incorpora una orientación operativa clara. No se limita a mostrar datos de producto, sino que ya contempla salud funcional, monitoreo mínimo y superficies de administración a través de la consola CEO. A eso se suman pruebas Vitest, logs del entorno y scripts auxiliares para soporte, documentación y backup.

En esta etapa, la observabilidad no debe entenderse como una plataforma separada de APM, sino como una combinación de **trazabilidad de dominio, logs útiles, estados visibles y validaciones automatizadas**. Ese enfoque es suficiente para una fase piloto robusta si se mantiene disciplina documental y de pruebas.

| Recurso | Valor operativo |
| --- | --- |
| Vitest | Validación rápida de reglas críticas y secretos |
| Consola CEO | Supervisión y acciones administrativas seguras |
| Logs del entorno | Diagnóstico técnico y seguimiento de incidentes |
| Documentación operativa | Continuidad y recuperación |
| Backups en Dropbox | Resiliencia ante pérdida accidental |

## Respaldo y recuperación

La arquitectura de continuidad contempla un flujo externo al runtime principal: el script `.manus-work/dropbox_backup.py`. Este proceso comprime el proyecto, genera un ZIP con timestamp, sube snapshots documentales a **`/Backups/AuditaPatron/`**, mantiene un `README.md` operativo y aplica una política de retención de los últimos cinco respaldos.

Este mecanismo no sustituye buenas prácticas de código, pruebas o checkpoints, pero sí ofrece una red de seguridad adicional frente a pérdida de trabajo o necesidad de reconstrucción rápida. Su valor depende de tres factores: una credencial válida de Dropbox, documentación actualizada y disciplina de ejecución en hitos relevantes.

| Artefacto | Función dentro del backup |
| --- | --- |
| ZIP del proyecto | Snapshot integral del estado de trabajo |
| `README.md` | Contexto operativo resumido para recuperación |
| Documentación técnica | Continuidad de configuración y arquitectura |
| JSON de resultado | Evidencia del último intento de backup |

## Decisiones arquitectónicas dominantes

La arquitectura actual no persigue complejidad ornamental. Sus decisiones dominantes privilegian **centralización del dominio**, **backend fuerte**, **storage externo para archivos**, **contrato tipado** y **capas operativas explícitas**. Esto es coherente con un producto que necesita confiabilidad, trazabilidad y evolución controlada más que fragmentación prematura.

| Decisión | Beneficio | Costo asumido |
| --- | --- | --- |
| Monolito modular | Menor fricción y más control | Menor aislamiento por servicio |
| tRPC como contrato principal | Tipado extremo a extremo | Dependencia más estrecha entre cliente y servidor |
| Base para metadatos, S3 para bytes | Persistencia eficiente | Necesidad de coordinar dos superficies |
| Integraciones desde backend | Mayor seguridad | Más carga en la capa servidor |
| Backup externo a Dropbox | Resiliencia operativa | Dependencia de token y disciplina de ejecución |

## Recomendaciones operativas inmediatas

La arquitectura ya permite operar, pero su continuidad mejora si se mantiene una disciplina simple. Conviene sostener actualizadas `README.md`, `CONFIGURACION.md` y este archivo; validar secretos críticos con pruebas ligeras; ejecutar el backup en hitos relevantes; y evitar que nuevas integraciones bypassen el backend o dupliquen el dominio existente.

En particular, toda evolución futura debería reforzar el mismo principio rector: **un solo núcleo confiable de expediente y documentos**, con capas visibles y administrativas mejoradas, pero sin abrir arquitecturas paralelas que compliquen soporte, auditoría y continuidad.
