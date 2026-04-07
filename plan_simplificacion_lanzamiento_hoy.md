# Plan de simplificación y salida operativa hoy para CompliLink

**Autor:** Manus AI

## Dictamen ejecutivo

Tras consultar y contrastar a **ChatGPT, Grok y Gemini**, el consenso es claro: **CompliLink sí puede operar hoy mismo**, pero solo si se le aplica una **simplificación radical de la experiencia visible** y se restringe el producto a lo indispensable para una sola persona operándolo desde el primer día. Los tres modelos coinciden en que el problema principal no es técnico, sino de **percepción de complejidad**, lenguaje expuesto y densidad de interfaz. En otras palabras, la base ya existe, pero hoy debe sentirse menos como una plataforma compleja y más como una herramienta directa para abrir casos, subir documentos, aprobar visibilidad y revisar historial.

También revisé el estado heredado del proyecto y el consenso tri-IA. La aplicación ya cuenta con autenticación, backend, base de datos, trazabilidad y pruebas técnicas pasando, por lo que el cuello de botella inmediato para salir hoy no es rehacer el sistema, sino **reducir fricción visual, navegación y terminología** antes de publicar la versión operativa mínima.

## Lo que concluyeron ChatGPT, Grok y Gemini

| IA | Veredicto de salida | Coincidencia principal |
|---|---|---|
| ChatGPT | Listo para operar hoy con cambios mínimos | Mantener solo las funciones esenciales y simplificar la experiencia |
| Grok | Sí, con simplificaciones inmediatas | Reducir la interfaz a gestión básica de casos y lenguaje simple |
| Gemini | Factible hoy mismo con simplificación radical | Ocultar complejidad y dejar únicamente lo esencial para operar |

El consenso práctico es que **no debemos reconstruir CompliLink**, sino **re-encuadrarlo como un operativo mínimo**. Por eso, la recomendación no es ampliar alcance, sino **quitar, ocultar y renombrar**.

## Qué debe quedarse hoy

Para que CompliLink opere hoy con el menor esfuerzo cognitivo posible, la versión visible debe quedarse únicamente con el siguiente núcleo funcional:

| Debe quedarse | Razón operativa |
|---|---|
| Ver casos activos | Es la vista principal del trabajo diario |
| Crear nuevo caso | Es la entrada básica al flujo operativo |
| Abrir detalle de caso | Permite continuar trabajo existente sin navegar de más |
| Subir documentos del caso | Es indispensable para la operación real |
| Confirmar consentimiento o visibilidad cuando aplique | Mantiene la capa mínima de control y cumplimiento |
| Ver historial del caso | Conserva trazabilidad sin exponer arquitectura técnica |

Este recorte deja a CompliLink como una herramienta enfocada en una sola pregunta: **“¿Qué caso tengo abierto, qué documento debo subir y qué seguimiento tuvo?”**

## Qué debe ocultarse por ahora

La consulta comparada fue muy consistente en señalar que la experiencia actual comunica más complejidad de la necesaria. Por eso, la simplificación aprobable debería ocultar temporalmente los siguientes elementos del frente visible:

| Ocultar o sacar de la vista inicial | Motivo |
|---|---|
| Command Center / hub / visión de arquitectura | No aporta al uso operativo de hoy |
| Terminología técnica como `tenant_id`, `case_id`, `trace_id` | Confunde al usuario final |
| Dashboard denso con varios KPIs | Añade ruido visual innecesario |
| Módulos futuros o integraciones posteriores | Desvía foco del objetivo de hoy |
| Configuración avanzada en pantalla inicial | Aumenta ansiedad y fricción |
| Lenguaje de “gobernanza”, “base canónica”, “multi-tenant” en la UI principal | Es correcto técnicamente, pero no ayuda a operar |

La regla recomendada es simple: **si una sección no ayuda a crear, abrir, documentar o revisar un caso hoy, debe salir de la primera capa visual**.

## Navegación recomendada para la versión operativa de hoy

El consenso más útil fue reducir CompliLink a una navegación extremadamente corta. La propuesta recomendada es la siguiente:

| Orden | Sección | Función |
|---|---|---|
| 1 | **Inicio** | Muestra casos activos y accesos rápidos |
| 2 | **Nuevo caso** | Abre el formulario mínimo para crear un caso |
| 3 | **Documentos** | Permite subir y consultar archivos del caso seleccionado |
| 4 | **Historial** | Muestra movimientos recientes del caso |

En la práctica, incluso esto podría compactarse en una sola pantalla si deseas el máximo nivel de simplicidad: una portada con **casos activos**, un botón prominente de **“Crear nuevo caso”**, un bloque de **documentos** y un bloque de **historial reciente**.

## Lenguaje recomendado para que la interfaz sea autoexplicativa

Una de las coincidencias más fuertes entre los tres modelos fue que el lenguaje actual debe bajar de nivel técnico a lenguaje natural. La recomendación es renombrar la interfaz visible de la siguiente forma:

| Concepto actual | Etiqueta visible recomendada |
|---|---|
| Expedientes | **Casos** |
| Documentos del expediente | **Documentos del caso** |
| Consentimientos | **Aprobaciones** o **Vistos buenos** |
| Auditoría | **Historial del caso** |
| trace_id | **Registro de actividad** |
| tenant_id / case_id / trace_id | **Información interna del sistema** |
| Control de acceso | **Permisos** |

La lógica técnica puede quedarse intacta en backend. Lo que cambia es la **capa de traducción para el usuario**.

## Servicios mínimos para que opere hoy

Aquí conviene separar dos cosas: lo que sugirió de forma general la consulta tri-IA y lo que ya estaba mejor aterrizado en el trabajo previo del proyecto. La recomendación final, optimizada para **salir hoy con gasto mínimo razonable**, es mantener el stack mínimo que ya habíamos definido previamente y no abrir servicios extra innecesarios.

| Servicio | Recomendación para hoy | Motivo |
|---|---|---|
| Cloudflare | **Free** | Dominio, DNS y capa inicial de protección sin costo base para el arranque [1] |
| Supabase | **Pro** | Es la pieza que más sentido tiene pagar desde el día uno si quieres una base estable y seria para operar casos y documentos con margen de crecimiento; el pricing oficial parte del nivel Free y su documentación de facturación referencia el plan **Pro de USD 25/mes** [2] [3] |
| Resend | **Free al inicio** | Suficiente para notificaciones transaccionales tempranas si realmente las activamos en esta fase |
| Sentry | **Free al inicio** | Útil como monitoreo básico sin costo para una operación temprana; Sentry publica un plan **Free de USD 0** para un usuario [4] |

Con ese enfoque, el costo mínimo recomendado para que salga hoy sigue siendo aproximadamente **USD 25/mes**, asumiendo que arrancamos con **Cloudflare Free + Supabase Pro + Resend Free + Sentry Free**. Ese sigue siendo el punto más sensato entre costo, velocidad y operabilidad.

## Qué no contratar hoy

Para respetar tu instrucción de operar ya y no sobrecargar el proyecto, estos componentes deberían aplazarse:

| Dejar para después | Razón |
|---|---|
| Shared Engine / integración AuditaPatron | Es fase 2, no condición de salida hoy |
| Analítica avanzada o BI | No es necesaria para operar casos hoy |
| Automatizaciones sofisticadas | Se pueden añadir cuando exista uso real continuo |
| Capas adicionales de observabilidad pagada | El nivel gratuito basta para el arranque |
| Integraciones con HRIS, nómina o terceros | Elevan complejidad sin resolver el objetivo inmediato |
| Paneles ejecutivos o command center | Van contra el mandato de simplicidad extrema |

## Bloqueos reales para salir hoy

Después de revisar el consenso y el estado del proyecto, mi lectura es que **no hay un bloqueo técnico estructural** que impida la salida hoy. Los bloqueos reales son de producto y presentación:

| Bloqueo real | Impacto |
|---|---|
| La interfaz actual se percibe más compleja de lo necesario | Baja adopción inmediata |
| La vista inicial comunica arquitectura y capacidad, no acción inmediata | Dificulta el entendimiento autónomo |
| Hay demasiadas piezas visibles en simultáneo | Aumenta carga cognitiva |
| El lenguaje técnico aparece donde debería haber lenguaje operativo | Rompe la sensación de herramienta simple |

Por ello, el trabajo correcto **no es ampliar funciones**, sino **simplificar la primera experiencia**.

## Plan de cambios propuesto para aprobar antes de implementar

Este es el plan que te propongo ejecutar **solo después de tu aprobación**:

| Prioridad | Cambio | Resultado esperado |
|---|---|---|
| **P0** | Rediseñar la pantalla principal para que muestre solo casos activos, botón de nuevo caso, documentos e historial | La app se entiende sola en segundos |
| **P0** | Reemplazar toda terminología técnica por lenguaje natural en la UI visible | La interfaz se vuelve autoexplicativa |
| **P0** | Ocultar command center, integraciones futuras, KPIs densos y módulos no esenciales | Disminuye la sensación de complejidad |
| **P1** | Reducir la navegación lateral a 3–4 entradas máximo | Menos clics y menos ruido |
| **P1** | Acortar el flujo de crear caso y subir documento a la mínima cantidad de campos y pasos | Operación más rápida desde hoy |
| **P1** | Mantener historial y aprobaciones, pero presentados como bloques simples del caso | Se conserva cumplimiento sin abrumar |
| **P2** | Añadir ayuda contextual muy breve o microcopys orientativos | Refuerza autonomía sin recargar la interfaz |

## Mi recomendación final

Mi recomendación es aprobar un enfoque de **“CompliLink Operativo Hoy”** con esta definición:

> **Una herramienta simple para abrir casos laborales, subir documentos, registrar aprobaciones y revisar historial, sin exponer complejidad técnica ni módulos futuros.**

Si apruebas este plan, el siguiente paso sería implementar una **versión simplificada de la interfaz actual**, no una reescritura total, y dejarla lista para operar hoy mismo sobre el stack mínimo recomendado.

## Referencias

[1]: https://www.cloudflare.com/plans/ "Cloudflare Pricing"
[2]: https://supabase.com/pricing "Supabase Pricing & Fees"
[3]: https://supabase.com/docs/guides/platform/billing-faq "Supabase Billing FAQ"
[4]: https://sentry.io/pricing/ "Sentry Pricing"
