# Brief técnico y prompt operativo para reconstruir CompliLink

**Autor:** Manus AI  
**Propósito:** servir como documento de transferencia para subirlo a otro chat y acelerar la reconstrucción de **CompliLink** con el menor nivel posible de ambigüedad.

Este documento convierte el PDF fuente aportado por el usuario en un paquete de continuidad más útil para reconstrucción operativa. El PDF original no describe directamente toda la aplicación CompliLink; en realidad contiene un **prompt de extracción técnica** orientado a recuperar desde otro chat todo lo ya definido sobre **Auditapatrón** y su relación con **Helios/CompliLink**. Por eso, el enfoque correcto no es copiarlo sin más, sino transformarlo en una guía de reconstrucción que deje claro qué ya está verificado, qué debe preservarse, qué depende de Auditapatrón y qué sigue pendiente de definir.

| Fuente interna usada | Rol en este brief | Nivel de confianza |
|---|---|---:|
| `Prompt_de_extracción_técnica_desde_el_chat_de_Auditapatrón.pdf` | Fuente primaria para entender el objetivo del paquete de transferencia y la estructura de extracción deseada | Alto |
| Estado heredado del proyecto `complilink_operativo_v1` | Fuente para los hechos ya verificados del stack, flujos visibles, dominio y validaciones recientes | Alto |
| Comparación multi-modelo con OpenAI, Grok y Gemini | Validación cruzada para reducir ambigüedad y priorizar consenso antes de redactar la versión final | Medio-Alto |

## 1. Qué debe entender el otro chat desde el principio

**CompliLink** debe reconstruirse como una aplicación web operativa mínima, ya alineada a un stack y a un conjunto de comportamientos visibles que sí están confirmados. La pieza aportada por **Auditapatrón** no es la app completa, sino una fuente de conocimiento documental, señales y contexto funcional que debe alimentar el motor de CompliLink sin diluir la identidad de cada producto. En paralelo, existe una referencia histórica a **Helios**, que aparece como capa o motor de procesamiento e interoperabilidad, por lo que cualquier reconstrucción debería preservar esa separación conceptual entre experiencia de producto, lógica operativa y procesamiento documental.

| Aspecto | Hecho verificado o decisión heredada | Qué implica para la reconstrucción |
|---|---|---|
| Proyecto actual | `complilink_operativo_v1` | El objetivo no es inventar una app nueva, sino reconstruir continuidad sobre una base ya conocida |
| Stack base | React 19, Tailwind 4, Express 4, tRPC 11, Drizzle ORM, Manus OAuth y base de datos | Conviene mantener el stack para reducir fricción, preservar contratos mentales y acelerar validación |
| Rutas verificadas | `home`, `/auditar` y documentos legales publicados | Estas superficies deben existir desde el primer corte funcional |
| Estado validado | Login, `/auditar`, legales y dominio final ya fueron revisados manualmente | El nuevo chat debe tratarlos como requisitos de paridad mínima |
| Flujo crítico endurecido | aceptación legal con idempotencia persistente | No debe reconstruirse como un flujo ingenuo ni duplicable |
| Señal operativa añadida | lectura mínima del embudo `home → expediente → aceptación legal → subida documental` | La reconstrucción debe dejar trazabilidad operativa, aunque sea mínima |
| Principio de producto | experiencia intuitiva, limpia, mínima y autoexplicativa | La UI no debe volverse compleja ni parecer herramienta interna confusa |
| Principio de integración | Auditapatrón aporta información documental valiosa al motor de CompliLink | La frontera entre productos e integración debe quedar explícita |

## 2. Consenso obtenido al contrastar OpenAI, Grok y Gemini

Se consultó a **OpenAI**, **Grok** y **Gemini** con el texto del PDF y con los hechos verificados del proyecto. Los tres coincidieron en la base arquitectónica, en la prioridad de reconstruir autenticación y rutas críticas, y en que el PDF original debe entenderse como una **guía de extracción**, no como una especificación cerrada del sistema completo. También coincidieron en que todavía faltan contratos detallados de integración con Auditapatrón y que dichos vacíos deben marcarse explícitamente como desconocidos, en lugar de inventarse.

| Tema contrastado | Consenso principal | Implicación práctica |
|---|---|---|
| Naturaleza del PDF fuente | Es un prompt de continuidad y extracción, no una definición completa del sistema | Debe reinterpretarse como insumo para reconstrucción, no como documento final |
| Núcleo técnico de CompliLink | El stack y las rutas visibles ya validadas deben preservarse | El otro chat debe reconstruir sobre esa base tecnológica, no cambiarla sin justificación |
| Flujos prioritarios | Login, `/auditar`, legales, aceptación legal e intake documental son prioritarios | La versión mínima operativa debe arrancar por ahí |
| Papel de Auditapatrón | Aporta datos/documentos y valor de entrada al motor de CompliLink | Debe modelarse como fuente e integración, no como sinónimo del producto final |
| Vacíos reales | APIs, payloads, eventos, reglas finas y modelo de datos detallado no están completamente definidos | Todo vacío debe etiquetarse como pendiente o `NO DEFINIDO`, sin improvisación |

## 3. Brief técnico de reconstrucción

La reconstrucción debe apuntar a un **CompliLink operativo mínimo**, orientado a intake documental, gestión de expediente, aceptación legal versionada, trazabilidad de avance del embudo y futura conexión a un motor compartido. El entregable inicial no necesita abarcar toda la ambición histórica del ecosistema, pero sí debe dejar correctamente montadas las bases para que Auditapatrón y el motor analítico puedan conectarse después sin rehacer la arquitectura.

| Capa | Qué debe existir en la reconstrucción | Observación de continuidad |
|---|---|---|
| Frontend | Home pública, acceso a `/auditar`, páginas legales, navegación clara y mensajes de confianza | Debe comunicar simplicidad y utilidad inmediata |
| Backend | Procedimientos tipados para auth, flujo legal, intake documental y lectura del embudo | Conviene conservar estilo tRPC/Express ya conocido |
| Datos | Entidades para usuario, expediente/caso, aceptación legal, documentos y eventos mínimos del embudo | El detalle fino puede crecer después, pero el vocabulario base debe quedar estable |
| Autenticación | Login con Manus OAuth | Ya forma parte del comportamiento validado |
| Legal | Publicación de documentos legales y aceptación idempotente persistente | Requisito de continuidad, no extra opcional |
| Intake documental | Subida o preparación para subida de documentos vinculada al expediente | Debe pensarse como insumo clave para análisis posterior |
| Analítica operativa | Lectura mínima del embudo | No hace falta una suite analítica compleja, pero sí eventos útiles |
| Integración futura | Punto de conexión con Auditapatrón y con el motor/Helios | Debe quedar preparada, aunque los contratos exactos sigan incompletos |

## 4. Frontera funcional recomendada para no mezclar conceptos

Aunque el PDF fuente pide extraer más detalle desde otro chat, ya es posible proponer una frontera funcional suficientemente útil para reconstrucción. Esta frontera debe tratarse como base operativa de trabajo y no como verdad absoluta si el otro chat aporta evidencia más precisa.

| Dominio funcional | Auditapatrón | Helios / motor compartido | CompliLink | Notas |
|---|---|---|---|---|
| Captura de valor documental | Sí | Parcial | Parcial | Auditapatrón parece originar o enriquecer información documental valiosa |
| Procesamiento e interpretación documental | Parcial | Sí | Parcial | La arquitectura heredada sugiere que el motor central procesa y almacena |
| Experiencia operativa del usuario | No principal | No principal | Sí | CompliLink debe ser la experiencia operativa mínima reconstruida |
| Login y sesiones | No principal | No principal | Sí | Ya verificado en la app actual |
| Flujo legal y consentimiento | Parcial como contexto | Posible soporte | Sí | En CompliLink ya existe aceptación legal endurecida |
| Expediente/caso documental | Parcial como fuente | Compartido | Sí | Debe vivir operativamente en CompliLink, con opción de interoperar |
| Analítica de embudo | No principal | No principal | Sí | Ya existe lectura mínima validada |
| Conocimiento regulatorio y señales externas | Sí, como fuente contextual | Sí, como motor | Parcial como consumo | Aquí es donde la extracción desde el otro chat sigue siendo valiosa |

## 5. Módulos que el otro chat debe reconstruir primero

La reconstrucción no debe comenzar por extras visuales ni por automatizaciones secundarias. Debe arrancar por los módulos que sostienen continuidad funcional y evitan rehacer después el esqueleto del producto.

| Prioridad | Módulo | Resultado esperado |
|---|---|---|
| 1 | Autenticación | Usuario puede iniciar sesión y acceder al flujo protegido |
| 1 | Home pública | Explica el valor del producto y conduce hacia `/auditar` |
| 1 | Módulo `/auditar` | Punto operativo principal para expediente, legal y documentos |
| 1 | Documentos legales públicos | Páginas visibles y enlazadas correctamente |
| 1 | Aceptación legal idempotente | Registro persistente, sin duplicados por reintento |
| 2 | Intake documental / expediente | Estructura base para carga documental y siguiente paso sugerido |
| 2 | Señales mínimas del embudo | Eventos o métricas para lectura operativa básica |
| 3 | Integración Auditapatrón / motor | Contratos de entrada y procesamiento una vez recuperados del otro chat |

## 6. Flujos que deben preservarse como paridad mínima

Los flujos más importantes no son complejos por cantidad de pantallas, sino por su carácter de continuidad. Si el otro chat reconstruye estos flujos de manera distinta, corre el riesgo de perder tanto la utilidad inmediata como la trazabilidad legal y operativa ya logradas.

| Flujo | Disparador | Resultado mínimo exigible |
|---|---|---|
| Home → acceso principal | Entrada al sitio | Usuario entiende el valor y tiene CTA claro hacia el flujo operativo |
| Login | Usuario necesita continuar o proteger sesión | Acceso controlado a superficies operativas |
| `/auditar` | Usuario abre su expediente o inicia auditoría | Vista clara del estado del caso y próximos pasos |
| Aceptación legal | Usuario debe aceptar paquete legal | Persistencia idempotente y trazabilidad de aceptación |
| Inicio de intake documental | Usuario aporta o prepara documentos | Expediente queda listo para seguir con carga, validación o análisis |
| Lectura mínima del embudo | Operación o equipo necesita ver avance | Existe señal legible entre home, expediente, legal y carga documental |

## 7. Incertidumbres que el otro chat debe respetar

El mayor riesgo de reconstrucción sería completar los huecos con imaginación. Este documento pretende ahorrar tiempo y créditos, pero no a costa de fabricar APIs o reglas de negocio inexistentes. Todo lo que sigue debe tratarse como **pendiente por confirmar** hasta que el otro chat lo pueda extraer desde la conversación histórica de Auditapatrón o desde artefactos previos.

| Área incierta | Estado actual | Regla de trabajo |
|---|---|---|
| Endpoints exactos entre sistemas | No definidos aquí | Marcar `NO DEFINIDO` hasta recuperar evidencia |
| Payloads, eventos y webhooks | No definidos aquí | No inventar contratos |
| Esquema fino de datos | Parcialmente inferible | Crear solo entidades mínimas necesarias para v1 |
| Reglas de negocio regulatorias detalladas | Incompletas | Dejar extensión preparada y documentar vacíos |
| Dependencias exactas con Helios anterior | Incompletas | Preservar separación conceptual y compatibilidad futura |
| Taxonomía documental completa IMSS/INFONAVIT/SAT/REPSE/ICSOE/SISUB | Mencionada como área de interés, no cerrada | Tratar como backlog de conocimiento a recuperar |

## 8. Recomendación de migración para reconstruir sin desperdiciar trabajo

La mejor estrategia es reconstruir primero el **cascarón operativo estable** de CompliLink y, en paralelo, usar el otro chat para recuperar la máxima precisión sobre Auditapatrón, Helios y contratos intersistema. Ese orden evita bloquear la app por falta de información histórica y, al mismo tiempo, reduce el riesgo de tener que rehacer el núcleo cuando reaparezcan detalles más finos.

| Fase | Objetivo | Criterio de salida |
|---|---|---|
| Fase 1 | Restablecer stack, auth, home, `/auditar` y legales | App navegable y coherente con el dominio ya validado |
| Fase 2 | Reinstalar aceptación legal idempotente y estructura de expediente/documentos | Continuidad funcional y legal mínima recuperada |
| Fase 3 | Reponer lectura mínima del embudo y señales operativas | Se puede observar el avance básico del usuario |
| Fase 4 | Incorporar resultados de extracción desde Auditapatrón/Helios | Contratos y entidades se refinan sin romper lo ya reconstruido |
| Fase 5 | Pruebas de compatibilidad y endurecimiento | Flujo legal, login, intake y consumo de señales quedan consistentes |

## 9. Prompt operativo listo para copiar en el otro chat

A continuación va el texto más útil para subir o pegar en el otro chat. Está redactado para que el otro entorno entienda el contexto, preserve lo ya validado y complete únicamente lo que todavía falta, sin gastar créditos en reinterpretaciones innecesarias.

> **PROMPT OPERATIVO PARA EL OTRO CHAT**
>
> Actúa como **arquitecto de continuidad técnica y reconstrucción de producto** para **CompliLink**. No quiero una propuesta creativa desde cero; quiero que reconstruyas con máxima fidelidad lo que ya estaba validado y dejes explícito todo lo que siga faltando por confirmar.
>
> Trabaja con estas reglas obligatorias:
>
> 1. **No inventes contratos, eventos, tablas ni reglas de negocio** que no estén sustentados por el contexto que te entregue.
> 2. Si un dato no está realmente definido, escribe **NO DEFINIDO**.
> 3. Separa en todo momento **hechos verificados**, **inferencias de alta confianza** y **pendientes por confirmar**.
> 4. Prioriza una **reconstrucción operativa mínima** que luego pueda crecer sin rehacer arquitectura.
> 5. Mantén a **Auditapatrón** como fuente de valor documental y a **CompliLink** como producto operativo con identidad propia.
> 6. Conserva la idea de un **motor compartido/Helios** como capa de análisis, almacenamiento o interoperabilidad cuando aplique, pero sin asumir detalles no verificados.
>
> **Hechos verificados que debes tomar como base de reconstrucción:**
>
> - El proyecto a reconstruir es **`complilink_operativo_v1`**.
> - El stack base ya verificado es **React 19 + Tailwind 4 + Express 4 + tRPC 11 + Drizzle ORM + Manus OAuth + base de datos**.
> - Ya estaban validadas las superficies **home**, **`/auditar`** y **documentos legales publicados**.
> - Ya se había validado manualmente el dominio **`https://compliapp-cgpjc3da.manus.space`**.
> - Ya se había endurecido la **idempotencia persistente** del flujo de aceptación legal para evitar duplicados.
> - Ya existía una lectura operativa mínima del embudo **home → expediente → aceptación legal → subida documental**.
> - Ya estaban revisados manualmente **login**, **`/auditar`** y **páginas legales** bajo el dominio final.
> - El principio de producto es una experiencia **intuitiva, limpia, mínima y autoexplicativa**.
> - El principio de integración es que **Auditapatrón aporta información documental valiosa que debe alimentar el motor de CompliLink**, manteniendo identidad separada.
>
> **Tu objetivo en este chat es devolverme una reconstrucción accionable con esta estructura exacta:**
>
> ## A. Resumen ejecutivo de reconstrucción
> Explica en un máximo de 12 líneas qué es CompliLink, qué parte ya está verificada, qué parte depende todavía de Auditapatrón/Helios y cuál es el objetivo de la reconstrucción mínima.
>
> ## B. Alcance de reconstrucción v1
> Entrega una tabla con columnas:
> `Área`, `Debe reconstruirse ahora`, `Base verificada`, `Dependencias`, `Notas`.
>
> ## C. Arquitectura mínima a preservar
> Entrega una tabla con columnas:
> `Capa`, `Tecnología o responsabilidad`, `Qué ya está verificado`, `Qué sigue pendiente`.
>
> ## D. Módulos prioritarios
> Entrega una tabla con columnas:
> `Prioridad`, `Módulo`, `Objetivo funcional`, `Estado esperado al terminar`.
>
> Incluye como mínimo:
> - autenticación,
> - home,
> - `/auditar`,
> - documentos legales,
> - aceptación legal idempotente,
> - expediente / intake documental,
> - lectura mínima del embudo,
> - puntos de integración con Auditapatrón y/o Helios.
>
> ## E. Flujos operativos mínimos a restituir
> Para cada flujo, entrega:
> `Nombre del flujo`, `Disparador`, `Actor principal`, `Pasos numerados`, `Entradas`, `Salidas`, `Persistencia`, `Riesgo si no se reconstruye bien`.
>
> Incluye como mínimo:
> - home → acceso principal,
> - login,
> - acceso a `/auditar`,
> - aceptación legal,
> - subida o preparación documental,
> - lectura del embudo.
>
> ## F. Frontera funcional entre Auditapatrón, Helios y CompliLink
> Entrega una tabla con columnas:
> `Dominio funcional`, `Auditapatrón`, `Helios`, `CompliLink`, `Nivel de certeza`, `Notas`.
>
> ## G. Modelo de datos mínimo para no bloquear la reconstrucción
> Entrega una tabla con columnas:
> `Entidad`, `Propósito`, `Campos mínimos`, `Relaciones`, `Nivel de certeza`.
>
> Como mínimo evalúa: usuario, expediente/caso, aceptación legal, documento, evento del embudo, estado del caso, fuente documental.
>
> ## H. Contratos e integraciones
> Separa en dos tablas:
>
> 1. **Contratos ya verificables en CompliLink**, con columnas:
> `Contrato`, `Responsable`, `Tipo`, `Qué asegura`, `Estado de definición`.
>
> 2. **Contratos pendientes de recuperar desde Auditapatrón/Helios**, con columnas:
> `Contrato o evento`, `Qué sabemos`, `Qué falta`, `Riesgo de no definirlo`.
>
> ## I. Reglas de negocio conocidas vs pendientes
> Tabla con columnas:
> `Regla`, `Estado`, `Impacto`, `Sistema responsable`, `Observaciones`.
>
> ## J. Orden recomendado de reconstrucción
> Describe una estrategia por fases, indicando qué construir primero, qué validar en cada fase y qué no conviene tocar hasta recuperar más información histórica.
>
> ## K. Riesgos, vacíos y supuestos
> Entrega una tabla con columnas:
> `Tema`, `Tipo (riesgo/vacío/supuesto)`, `Consecuencia`, `Mitigación`.
>
> ## L. Plan de ejecución inmediato para Manus
> Cierra con una secuencia accionable de implementación, indicando los archivos o capas que deberían tocarse primero dentro de una app basada en React + Express + tRPC + Drizzle + OAuth.
>
> Además, si el contexto incluye o se adjunta un documento sobre Auditapatrón, úsalo para **extraer conocimiento complementario**, pero no reemplaces con eso los hechos ya verificados de CompliLink. Tu prioridad es **reconstruir CompliLink con continuidad real**, no producir un documento bonito.

## 10. Recomendación final de uso

La mejor forma de usar este PDF es subirlo al otro chat junto con cualquier conversación previa, captura, README, checkpoint o artefacto que todavía exista. Si el otro chat puede leer también el PDF original de extracción de Auditapatrón, mejor todavía: este brief le da la **columna vertebral de reconstrucción**, mientras que el PDF original le da la **estructura de extracción profunda** para completar los vacíos sobre integración y conocimiento documental.

| Recurso a subir al otro chat | Prioridad | Motivo |
|---|---|---|
| Este brief en PDF | Muy alta | Resume continuidad y da un prompt operativo más directo |
| PDF original de extracción Auditapatrón | Alta | Permite recuperar detalle histórico adicional desde el otro chat |
| Cualquier checkpoint o referencia de versión | Alta | Ayuda a alinear reconstrucción con estado real ya validado |
| Capturas o archivos del proyecto anterior | Media-Alta | Reducen inferencias innecesarias |

## 11. Anexo breve de hallazgos multi-modelo

La consulta cruzada con **OpenAI**, **Grok** y **Gemini** reforzó tres conclusiones útiles. La primera es que el núcleo de reconstrucción debe centrarse en el stack verificado, en las rutas ya validadas y en la idempotencia del flujo legal. La segunda es que el papel de Auditapatrón debe modelarse como **fuente documental e integración**, no como sustituto de CompliLink. La tercera es que los vacíos sobre eventos, payloads, taxonomía documental completa y dependencias exactas con Helios deben tratarse como huecos documentales reales, no como espacios a rellenar creativamente.

| Modelo consultado | Resultado útil |
|---|---|
| OpenAI | Confirmó que el PDF fuente debía reinterpretarse como paquete de continuidad para reconstrucción, no como especificación cerrada |
| Grok | Reforzó la prioridad de rutas críticas, aceptación legal y separación entre Auditapatrón y CompliLink |
| Gemini | Coincidió en el stack, en el orden de reconstrucción y en que los contratos detallados siguen pendientes por recuperar |
