# Prompt maestro para el otro chat: integración de AuditaPatron con el motor inteligente

Quiero que actúes como **arquitecto principal del motor inteligente** que ya existe en este proyecto o chat, con un objetivo muy concreto: **explicar todo lo necesario para integrar AuditaPatron a tu motor sin rehacer lo ya construido**.

Tu respuesta debe ser **técnica, completa, accionable y sin ambigüedades**, porque va a ser utilizada por otro chat de Manus para ejecutar la integración real dentro de un proyecto activo.

## Contexto completo que debes entender antes de responder

Estamos trabajando sobre **AuditaPatron**, un producto enfocado en la defensa documental y auditoría laboral del trabajador mexicano. Su propósito es permitir que una persona suba recibos de nómina, CFDI, constancias, movimientos y otros documentos laborales para detectar posibles incumplimientos del patrón, generar hallazgos útiles, producir reportes con valor probatorio y construir un expediente digital trazable.

La intención **no es rediseñar ni reinventar AuditaPatron desde cero**. Ya existe una base previa de interfaz, rutas y experiencia, y la instrucción es **reutilizar al máximo lo ya hecho**. Lo que se busca ahora es que **AuditaPatron se conecte a tu motor inteligente**, de forma que el producto visible aproveche una capa de inteligencia real y acumulativa.

Hoy, la base funcional y visible de AuditaPatron gira alrededor de estas superficies:

- `/` como home o landing principal;
- `/auditar` como flujo principal de auditoría de recibos y documentos;
- `/historial` como historial de auditorías;
- `/comparar` como comparación de recibos o documentos entre periodos;
- `/documentos` como centro documental, expediente o legal center;
- eventualmente una superficie administrativa o interna.

El valor central del producto es que el usuario no solo suba documentos, sino que obtenga una interpretación útil, confiable y acumulativa de su situación laboral.

## Requisito estratégico no negociable

La integración debe diseñarse bajo esta premisa central y obligatoria:

> **Todos los archivos que suban los usuarios de AuditaPatron deben alimentar el motor inteligente, de forma trazable, segura, versionada y útil para análisis presente y futuro.**

Esto significa que el motor **no debe limitarse a responder consultas puntuales**, sino que debe operar como una capa inteligente alimentada continuamente por la evidencia documental del usuario.

En otras palabras, cada archivo subido en AuditaPatron debe dejar de ser un archivo muerto en storage y convertirse en una unidad de contexto útil para el motor.

## Qué necesito que me respondas

Responde obligatoriamente en las siguientes secciones, en este mismo orden, y con el mayor nivel de precisión posible.

### 1. Resumen ejecutivo

Quiero un resumen inicial que explique, en lenguaje claro pero técnico:

- qué es el motor;
- cuál es su función principal;
- si realmente es integrable con AuditaPatron hoy;
- cuál sería la vía recomendada de integración;
- qué condición crítica tendría que cumplirse para hacerlo bien.

### 2. Identidad y estado real del motor

Explica claramente:

- cómo se llama el motor;
- en qué proyecto, sistema o chat vive;
- si existe como código real, servicio desplegado, módulo backend, colección de funciones, flujo interno o solo como lógica parcial;
- cuál es su propósito central;
- qué problema resuelve mejor que un módulo convencional;
- qué partes están verdaderamente implementadas hoy;
- qué partes son prototipo o placeholder;
- qué partes faltan;
- si está listo para integrarse ya o si primero necesita endurecimiento técnico.

### 3. Arquitectura técnica del motor

Describe con precisión:

- lenguaje, framework y runtime;
- si vive en frontend, backend o ambos;
- módulos principales;
- dependencias importantes;
- servicios externos que usa;
- base de datos, colas, storage, índices o componentes de memoria que utiliza;
- si expone API REST, tRPC, GraphQL, funciones internas, jobs o webhooks;
- cómo separa procesamiento, almacenamiento, orquestación, análisis y entrega de resultados.

### 4. Interfaces reales de integración disponibles

Necesito una tabla con este formato:

| Interfaz | Tipo | Ruta o nombre | Entrada | Salida | Auth requerida | Estado |
|---|---|---|---|---|---|---|

Debes listar todas las interfaces reales disponibles para integrar AuditaPatron con el motor, incluyendo:

- endpoints;
- funciones internas reutilizables;
- jobs;
- webhooks;
- colas;
- adaptadores;
- SDKs;
- cualquier punto real de integración.

No describas posibilidades hipotéticas como si ya existieran. Diferencia claramente entre lo existente y lo propuesto.

### 5. Método recomendado de integración con AuditaPatron

Debes elegir una opción principal y, si aplica, una secundaria.

Evalúa explícitamente estas posibilidades:

- **A. Integración por función o módulo interno dentro del mismo proyecto**
- **B. Integración por API entre proyectos**
- **C. Integración por webhook o eventos**
- **D. Integración híbrida**

Quiero que indiques:

- cuál recomiendas;
- por qué;
- qué ventajas tiene;
- qué riesgos tiene;
- qué se gana y qué se pierde con cada alternativa;
- cuál elegirías si la integración tuviera que comenzar hoy.

### 6. Requisito crítico: diseño de ingesta documental total

Responde específicamente cómo el motor recibiría, registraría y procesaría **todos los archivos que suban los usuarios de AuditaPatron**.

Debes explicar:

- qué tipos de archivo puede ingerir;
- en qué momento entra cada archivo al motor;
- si la ingesta es síncrona, asíncrona o híbrida;
- cómo se detecta tipo documental;
- cómo se extrae texto, datos y metadatos;
- cómo se relaciona cada archivo con usuario, expediente, auditoría y línea de tiempo;
- cómo se evita que los archivos queden como objetos pasivos sin alimentar el sistema inteligente.

### 7. Persistencia y trazabilidad documental

Necesito una tabla obligatoria con, al menos, estos campos:

| Campo | Descripción | Obligatorio | Dónde vive | Observaciones |
|---|---|---|---|---|
| document_id | identificador único del documento | sí |  |  |
| user_id | usuario propietario | sí |  |  |
| case_id o audit_id | expediente o auditoría relacionada | sí |  |  |
| file_key o url | ubicación del archivo | sí |  |  |
| mime_type | tipo MIME | sí |  |  |
| sha256 o hash equivalente | huella de integridad | sí |  |  |
| source | origen del archivo | sí |  |  |
| uploaded_at | fecha/hora de carga | sí |  |  |
| processed_at | fecha/hora de procesamiento | sí o condicional |  |  |
| extraction_status | estado de extracción | sí |  |  |
| analysis_status | estado de análisis | sí |  |  |
| version | versión del documento | sí |  |  |
| visibility o permissions | permisos de acceso | sí |  |  |

Si tu motor usa otros campos críticos, inclúyelos también.

### 8. Cómo cada documento alimenta al motor

Quiero una explicación concreta de cómo cada archivo subido se convierte en inteligencia útil.

Debes responder si cada documento:

- crea memoria o contexto acumulado del usuario;
- actualiza un expediente estructurado;
- dispara análisis automáticos;
- enriquece índices, embeddings, knowledge base, memoria documental o estructuras equivalentes;
- habilita análisis comparativos entre documentos del mismo usuario;
- produce alertas, hallazgos, tareas o recomendaciones automáticas;
- modifica un score, perfil de riesgo o entendimiento progresivo del caso.

Si esto no existe todavía, dilo claramente y propón la forma correcta de implementarlo.

### 9. Mapeo funcional AuditaPatron → Motor

Quiero una tabla con este formato:

| Función de AuditaPatron | ¿La cubre el motor? | Cómo la cubre | Gap actual | Prioridad |
|---|---|---|---|---|

Incluye al menos estos frentes:

- análisis de recibo de nómina;
- validación documental;
- extracción de datos;
- detección de discrepancias;
- generación de recomendaciones;
- generación de reportes;
- historial y trazabilidad;
- expediente o documentos;
- explicaciones legales o de riesgo;
- comparación entre documentos;
- enriquecimiento progresivo del caso.

### 10. Contratos de datos y payloads

Necesito que entregues **payloads exactos o propuestos** para integrar AuditaPatron con el motor.

Incluye ejemplos JSON de:

1. entrada mínima para analizar un recibo de nómina;
2. entrada para analizar múltiples documentos del trabajador;
3. evento o payload de ingesta documental al subir un archivo;
4. salida esperada del motor;
5. estructura de hallazgos, discrepancias, alertas, score, referencias y recomendaciones;
6. estructura de error;
7. estructura de actualización de contexto acumulado del expediente.

Si ya existen schemas, tipos o contratos, quiero que los muestres. Si no existen, quiero que los propongas de manera realista.

### 11. Seguridad, privacidad y permisos

Explica con precisión:

- cómo autentica hoy el motor;
- si requiere API keys, JWT, cookies, firma o auth interna;
- qué secretos necesita;
- qué debe ocurrir exclusivamente del lado servidor;
- qué jamás debe exponerse al frontend;
- cómo se controla el acceso por usuario, expediente, tenant o caso, si aplica;
- cómo se evita mezclar información entre usuarios;
- cómo se audita el acceso, la lectura, la extracción y el análisis documental;
- qué riesgos existen al usar documentos laborales sensibles y cómo los mitigarías.

### 12. Dependencias y precondiciones para integrar hoy

Haz una tabla con este formato:

| Requisito | Obligatorio | Estado actual | Cómo se resuelve |
|---|---|---|---|

Incluye:

- archivos o módulos que habría que exportar o compartir;
- variables de entorno;
- migraciones o tablas necesarias;
- servicios externos;
- librerías;
- adaptadores;
- colas o workers;
- cambios de infraestructura si fueran necesarios.

### 13. Riesgos reales de integración

Quiero que enumeres riesgos reales, no genéricos, distinguiendo entre:

- riesgos técnicos;
- riesgos de producto o experiencia de usuario;
- riesgos de seguridad y privacidad;
- riesgos de mantenimiento y escalabilidad.

Para cada riesgo, indica mitigación concreta.

### 14. Plan de integración por fases

Propón un plan por fases con este formato:

| Fase | Objetivo | Cambios en AuditaPatron | Cambios en el motor | Resultado esperado |
|---|---|---|---|---|

El plan debe estar optimizado para empezar con el mayor valor y la menor fricción, sin rehacer AuditaPatron desde cero.

### 15. Recomendación ejecutiva final

Quiero una conclusión cerrada y concreta en este formato:

- **Sí se puede integrar ahora / No todavía / Sí, pero con condiciones**
- vía recomendada;
- piezas exactas que deben compartirse, exponerse o migrarse;
- primer paso ejecutable.

### 16. Paquete mínimo para integración

Cierra con una sección final titulada exactamente así:

## Paquete mínimo para integración

Y dentro incluye:

- archivos que el otro chat debe entregarme, exportar o copiar;
- endpoints que debe exponer o que AuditaPatron debe consumir;
- secretos que el otro proyecto tendría que proporcionar;
- contratos JSON que deben respetarse;
- orden recomendado de implementación;
- cualquier restricción crítica que no deba romperse.

## Reglas obligatorias de respuesta

1. **No respondas con generalidades**.
2. **No digas “depende” sin cerrar con una recomendación concreta**.
3. **No propongas rehacer AuditaPatron desde cero**.
4. **Piensa como si la integración tuviera que empezar hoy**.
5. Si algo no existe, dilo claramente como **faltante**, pero propone la forma correcta de crearlo.
6. Si el motor ya tiene capacidades reutilizables, identifícalas con precisión.
7. Si AuditaPatron debe conectarse solo a una parte del motor y no a todo, dilo explícitamente.
8. Toda tu respuesta debe asumir que **cada archivo subido por el usuario debe alimentar el motor** de forma segura, acumulativa y trazable.
9. Debes priorizar una arquitectura donde el documento no solo se almacene, sino que **genere contexto, análisis y valor acumulativo**.
10. Debes dejar claro qué piezas serían utilizables inmediatamente por otro chat de Manus para ejecutar la integración real.

## Formato de salida obligatorio

Tu respuesta debe venir exactamente en este orden:

1. Resumen ejecutivo
2. Identidad y estado real del motor
3. Arquitectura técnica
4. Tabla de interfaces reales de integración
5. Método recomendado de integración
6. Diseño de ingesta documental total
7. Tabla de persistencia y trazabilidad documental
8. Cómo cada documento alimenta al motor
9. Tabla de mapeo AuditaPatron → Motor
10. Contratos JSON de ejemplo
11. Seguridad, privacidad y permisos
12. Tabla de dependencias y precondiciones
13. Riesgos y mitigaciones
14. Plan de integración por fases
15. Recomendación ejecutiva final
16. Paquete mínimo para integración

Si puedes, incluye nombres de archivos, rutas, funciones, endpoints y ejemplos de payload reales o plausibles.
