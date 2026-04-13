# Deliberación cruzada multi-IA sobre AuditaPatron

## Objetivo

Tienes delante tres auditorías independientes sobre toda la app de AuditaPatron con criterio **mobile-first**. Tu tarea ahora no es repetir la auditoría original, sino actuar como revisor de consenso: comparar coincidencias, detectar exageraciones, resolver contradicciones y producir una postura final más rigurosa.

## Reglas

1. Debes buscar el **consenso más sólido** entre los tres dictámenes.
2. Si una crítica aparece en los tres, trátala como señal muy fuerte.
3. Si una crítica aparece sólo en uno, indícala como hipótesis secundaria o descártala si no está suficientemente sustentada.
4. No rebajes la severidad por diplomacia.
5. Mantén el foco en **mobile-first**: celular primero, escritorio después.
6. Debes terminar con una calificación global de consenso y un plan priorizado de intervención.

## Auditoría 1: ChatGPT

### 1. Calificación global

**7.2 / 10**

**Justificación:**  
AuditaPatron ha avanzado notablemente en claridad de propuesta y robustez percibida, pero la experiencia mobile-first aún sufre por densidad informativa, jerarquía visual insuficiente y recorridos demasiado largos antes de la acción primaria. El flujo operativo principal y la consola ejecutiva requieren una reestructuración agresiva para priorizar tareas y reducir el esfuerzo cognitivo en pantallas pequeñas. El copy es confiable y preciso, pero la arquitectura y la priorización de módulos no están plenamente optimizadas para el usuario móvil.

---

### 2. Fortalezas reales

1. **Propuesta de valor clara y confiable:**  
   El mensaje central (“sube un documento y recibe una auditoría clara”) es inequívoco y se sostiene en todas las rutas públicas.

2. **Robustez y seriedad percibida:**  
   La app transmite orden, resguardo y trazabilidad, generando confianza desde el primer contacto.

3. **Copy preciso y sin tecnicismos innecesarios:**  
   El lenguaje es claro, orientado a la acción y evita el ruido legal o técnico que suele abrumar en este tipo de productos.

4. **Prueba social y señales de confianza bien integradas:**  
   Los casos anónimos y las señales verificadas refuerzan la credibilidad sin depender de testimonios dudosos.

5. **Guía contextual y sugerencias personalizadas:**  
   El sistema de recomendaciones de documentos y el asistente laboral contextualizan bien el siguiente paso útil.

6. **Estados y feedback operativo visibles:**  
   El usuario ve claramente el progreso, los pendientes y la cobertura de su expediente.

---

### 3. Debilidades críticas

1. **Densidad excesiva en el primer scroll (mobile):**  
   En la homepage y en `/auditar`, demasiados módulos compiten por atención antes de la acción primaria, obligando a scrollear y leer más de lo tolerable en móvil.

2. **Jerarquía visual insuficiente para la acción principal:**  
   El CTA de subir documento y la explicación de “qué subo y qué obtengo” no están lo suficientemente destacadas ni adelantadas en el recorrido.

3. **Recorridos verticales demasiado largos:**  
   El usuario móvil enfrenta scrolls extensos y repetición de conceptos antes de llegar a la tarea clave.

4. **Consola CEO sobrecargada y poco escaneable en móvil:**  
   La densidad de KPIs, filtros y paneles simultáneos dificulta la consulta rápida y puede colapsar la atención en pantallas pequeñas.

5. **Duplicación y falta de diferenciación en `/acceso`:**  
   La ruta `/acceso` replica la homepage sin propósito claro, generando confusión arquitectónica y desperdicio de espacio.

6. **Fricción en la continuidad del flujo operativo:**  
   El usuario puede perder el hilo entre explicación, sugerencias y el inicio real de la auditoría, especialmente si no detecta rápido el CTA principal.

7. **Estados vacíos y feedback intermedio poco jerarquizado:**  
   Los estados de “sin documentos”, “sin revalidaciones” o “sin comparaciones” ocupan espacio valioso y no siempre guían a la acción inmediata.

8. **Módulos secundarios compiten con la tarea primaria:**  
   Elementos como historial, bitácora, detalles legales y explicaciones de privacidad aparecen demasiado pronto o con igual peso visual que la acción principal.

9. **Poca adaptación visual de tablas y filtros en consola CEO:**  
   Los listados y paneles laterales no se adaptan bien a mobile, forzando zoom o scroll horizontal.

10. **Copy redundante en algunos bloques:**  
    Aunque el tono es bueno, hay repeticiones de conceptos (“sube lo que ya tienes”, “expediente digital 24/7”) que podrían comprimirse para liberar espacio.

---

### 4. Tabla de auditoría priorizada

| Prioridad | Ruta o superficie | Problema | Impacto móvil | Recomendación precisa |
|-----------|------------------|----------|--------------|----------------------|
| **P0** | `/`, `/auditar` | Densidad excesiva y scroll largo antes de la acción principal | Alto: el usuario móvil puede abandonar antes de interactuar | Reorganizar el primer scroll para que el CTA de subir documento y la explicación “qué subo y qué obtengo” sean lo primero visible, relegando módulos secundarios a tabs o acordeones |
| **P0** | `/auditar` | Jerarquía visual insuficiente para la tarea clave | Alto: la acción primaria se diluye entre módulos informativos | Rediseñar la arquitectura para que el formulario de subida y la sugerencia de documento sean el foco absoluto en mobile; mover historial, bitácora y detalles legales a secciones colapsables |
| **P0** | `/ceo` | Consola ejecutiva sobrecargada y poco escaneable | Muy alto: la consulta rápida es inviable en móvil | Crear una versión mobile-first de la consola: KPIs resumidos, filtros compactos y paneles colapsables; priorizar vistas de “estado actual” y “acciones rápidas” |
| **P1** | `/acceso` | Ruta duplicada sin diferenciación funcional ni visual | Medio: genera confusión y desperdicio de navegación | Redefinir el propósito de `/acceso` o eliminarla; si es para onboarding, diferenciar visual y funcionalmente del home |
| **P1** | `/auditar` | Estados vacíos y feedback intermedio poco accionable | Medio: ocupan espacio y no guían a la acción | Comprimir estados vacíos en mensajes breves y siempre acompañar de CTA directo (“Sube tu primer documento ahora”) |
| **P1** | `/`, `/auditar` | Copy redundante y bloques explicativos extensos | Medio: aumenta el esfuerzo de lectura | Sintetizar mensajes clave y eliminar repeticiones; usar bullets o frases cortas para lo esencial |
| **P2** | `/ceo` | Tablas y filtros no adaptados a mobile | Bajo: afecta usabilidad en consulta, no bloquea tareas críticas | Rediseñar tablas para scroll horizontal controlado o vistas resumidas tipo “cards” en mobile |
| **P2** | General | Módulos secundarios compiten visualmente con la acción principal | Bajo: distraen pero no bloquean | Relegar módulos secundarios a tabs, acordeones o secciones al final del scroll |

---

### 5. Qué arreglaría primero para acercarse a 10/10

1. **Reestructurar el primer scroll de homepage y `/auditar`**  
   CTA de subir documento y explicación de “qué subo y qué obtengo” deben ser lo primero, con todo lo demás colapsado o en tabs.

2. **Rediseñar la jerarquía visual en `/auditar`**  
   El formulario de subida y la sugerencia de documento deben dominar la pantalla; historial, bitácora y detalles legales deben ser secundarios y colapsables.

3. **Crear una versión mobile-first de la consola CEO**  
   KPIs y acciones rápidas arriba, filtros y paneles colapsables, tablas adaptadas a mobile, y priorización de “estado actual” sobre exhaustividad.

4. **Eliminar o diferenciar radicalmente la ruta `/acceso`**  
   Si no tiene propósito propio, debe eliminarse; si es para onboarding, debe tener identidad visual y funcional distinta.

5. **Comprimir y sintetizar el copy en todos los recorridos**  
   Eliminar repeticiones, reducir bloques explicativos y usar frases cortas y bullets para lo esencial.

---

### 6. Qué NO cambiar todavía

- **Copy central y tono de confianza:**  
  El lenguaje es claro, confiable y evita tecnicismos; sólo requiere síntesis, no un cambio de tono.

- **Sistema de recomendaciones y guía contextual:**  
  Las sugerencias de documentos y el asistente laboral están bien integrados y aportan valor real.

- **Prueba social y señales de confianza:**  
  Los casos anónimos y señales verificadas funcionan bien y refuerzan la credibilidad.

- **Feedback de estados y robustez operativa:**  
  La visibilidad de progreso, pendientes y cobertura es un diferenciador positivo; sólo requiere mejor jerarquía y compresión visual.

---

### 7. Veredicto final

AuditaPatron está cerca de una experiencia mobile-first sobresaliente, pero aún arrastra vicios de arquitectura de escritorio: demasiada explicación, módulos simultáneos y recorridos largos antes de la acción primaria. La robustez y la confianza ya están, pero la jerarquía visual y la velocidad de acción en móvil requieren una reingeniería agresiva. Si se prioriza la tarea clave y se compactan los recorridos, puede alcanzar un 9+ en mobile. Hoy, la experiencia es sólida pero todavía exige demasiado esfuerzo al usuario móvil para ser considerada 10/10.

## Auditoría 2: Grok

### 1. Calificación global
6.5/10. La app muestra avances en claridad pública y confianza inicial, pero falla en jerarquía mobile-first, con superficies densas que exigen scrolls excesivos y compiten por atención en pantallas pequeñas, reduciendo velocidad de acción y robustez percibida en flujos operativos.

### 2. Fortalezas reales
- La homepage integra una demo interactiva de reporte por estados, que acelera la comprensión del valor sin requerir interacción, transmitiendo confianza inmediata en móvil.
- Las señales de confianza anónimas en la homepage usan casos verificados y copy conciso, fortaleciendo la credibilidad sin sobrecargar el primer scroll.
- En /auditar, la arquitectura visible de expediente (progreso por tipos de documento) comunica orden y trazabilidad, percibiéndose robusta incluso en vistas iniciales vacías.
- El copy en todas las rutas prioriza lenguaje simple y prudente, evitando tecnicismos y enfocándose en beneficios reales como resguardo 24/7.
- La continuidad del flujo desde homepage a /auditar es fluida, con sugerencias documentales que guían sin fricción, asumiendo buen intent mobile-first en transiciones.

### 3. Debilidades críticas
- Densidad excesiva en el primer scroll de /auditar: múltiples bloques (progreso, sugerencias, formulario, historial) compiten visualmente, forzando scrolls largos en móvil que diluyen la tarea primaria de subida y aumentan esfuerzo cognitivo.
- Jerarquía visual pobre en /ceo: barra lateral, filtros, KPIs y tablas se apilan verticalmente en móvil, colapsando la atención en consultas rápidas y haciendo que parezca un dashboard de escritorio forzado en pantallas pequeñas.
- Duplicación percibida entre / y /acceso: ambas rutas muestran contenido casi idéntico, confundiendo al usuario móvil que espera diferenciación (e.g., /acceso como entrada dedicada), lo que erosiona confianza en la arquitectura.
- CTAs secundarias diluidas en /auditar: opciones como "Revalidar IMSS" o "Abrir asistente" se pierden en bloques densos, retrasando acciones clave en móvil donde el usuario busca velocidad sobre exploración.
- Fricción en estados vacíos de /auditar: mensajes como "Todavía no hay documentos" son genéricos y no guían agresivamente a la acción primaria, dejando al usuario móvil en un limbo perceptivo sin robustez inmediata.
- Copy sobreexplicado en homepage: secciones como "Cómo funciona en 3 pasos" y "Documentos que más pueden ayudarte" extienden el scroll inicial, fatigando al usuario móvil que prioriza acción sobre lectura.
- Incapacidad de /ceo para escaneo móvil: listados como bitácora operativa y alertas requieren zoom o scrolls horizontales implícitos, reduciendo percepción de control en consultas urgentes desde celular.
- Inconsistencia en robustez percibida: /auditar transmite seriedad operativa, pero /ceo parece inestable con métricas globales que no responden bien a filtros en móvil, generando desconfianza en datos críticos.
- Longitud de recorridos en /auditar: el flujo mezcla información contextual (e.g., privacidad, ciclo de valor) con acciones primarias, haciendo que en móvil el usuario deba navegar bloques irrelevantes antes de subir un documento.

### 4. Tabla de auditoría priorizada

| Prioridad | Ruta o superficie | Problema | Impacto móvil | Recomendación precisa |
|-----------|-------------------|----------|--------------|-----------------------|
| P0 | /auditar | Densidad de bloques en scroll vertical (progreso, sugerencias, formulario, historial) compite por atención. | En pantallas pequeñas, fuerza scrolls >3 pantallas para acción primaria, aumentando abandono por fatiga cognitiva. | Colapsar secciones secundarias en accordions plegables, priorizando formulario de subida en top-fold con CTA fija sticky. |
| P0 | /ceo | Diseño orientado a escritorio con barra lateral y tablas anchas que no se adaptan. | Colapso de atención en móvil: zoom requerido para filtros/KPIs, reduciendo escaneo rápido y confianza en consultas urgentes. | Convertir barra lateral en menú hamburguesa mobile-only, y tablas en cards verticales con paginación touch-friendly. |
| P1 | / | Copy extenso en secciones como "Cómo funciona" y "Documentos que más pueden ayudarte" alarga el primer scroll. | Usuario móvil pierde CTA principal bajo pliegue, diluyendo velocidad de conversión a /auditar. | Comprimir copy a bullets cortos y mover secciones explicativas a un modal o accordion accesible vía CTA secundaria. |
| P1 | /acceso | Contenido casi idéntico a /, sin identidad diferenciada visible. | Confusión en navegación móvil: usuario percibe redundancia, erosionando confianza en rutas públicas y aumentando rebote. | Diferenciar /acceso con flujo de login/onboarding exclusivo, eliminando duplicados y enfocando en CTA de acceso rápido. |
| P1 | /auditar | Estados vacíos genéricos sin guía agresiva a acción primaria. | En móvil, deja al usuario en limbo, reduciendo robustez percibida y continuidad del flujo. | Agregar placeholders interactivos con CTA directa "Sube tu primer documento ahora" y preview visual de beneficio. |
| P2 | /ceo | Filtros y métricas no responden fluidamente a interacciones touch. | Dificultad en escaneo: toques imprecisos en dropdowns largos generan fricción operativa en móvil. | Optimizar filtros con selectores mobile-native (e.g., bottom sheets) y actualizar métricas en tiempo real con loaders visibles. |
| P2 | Todas | CTAs secundarias (e.g., "Revalidar IMSS") no destacan visualmente en fondos claros. | En móvil, se pierden en densidad, retrasando acciones y confianza en jerarquía. | Aumentar contraste y tamaño de CTAs secundarias, usando iconos y hover/tap feedback para resaltar en touch. |
| P2 | /auditar | Copy de privacidad y consentimiento interrumpe flujo principal. | Scroll adicional en móvil distrae de subida documental, percibiéndose como fricción legal innecesaria. | Mover a un drawer lateral accesible vía icono, activado solo en primera interacción. |

### 5. Qué arreglaría primero para acercarse a 10/10
1. En /auditar, priorizar jerarquía agresiva: elevar formulario de subida al top-fold, colapsando todo lo demás en secciones plegables para reducir scrolls y enfocar acción primaria en móvil.
2. Optimizar /ceo para mobile: rediseñar como vista vertical con menús colapsables y cards en lugar de tablas, asegurando escaneo en <2 scrolls para consultas rápidas.
3. Eliminar duplicación en /acceso: diferenciarla con contenido exclusivo de acceso/onboarding, redirigiendo o fusionando si no añade valor único, para clarificar arquitectura pública.
4. Comprimir copy en homepage: reducir secciones explicativas a resúmenes cortos con CTAs integradas, moviendo detalles a modales para acortar el primer scroll en pantallas pequeñas.
5. Mejorar estados vacíos en /auditar: implementar guías interactivas con CTAs directas y previews visuales, fortaleciendo robustez percibida y continuidad del flujo operativo.

### 6. Qué NO cambiar todavía
Conservaría la demo interactiva de reporte en homepage, ya que transmite valor de forma efectiva sin sobrecarga; las señales de confianza anónimas, por su rol en construir credibilidad temprana; la arquitectura de progreso por tipos de documento en /auditar, que ya percibe robustez operativa; y el copy prudente y simple transversal, que evita ruido y prioriza confianza sin necesidad de ajustes inmediatos, ya que no son la prioridad actual frente a problemas de jerarquía móvil.

### 7. Veredicto final
AuditaPatron está a medio camino de una experiencia 10/10 mobile-first, con fortalezas en confianza inicial y continuidad, pero lejos por densidad y jerarquía deficientes que fatigan al usuario en scrolls eternos y superficies no adaptadas, exigiendo fixes agresivos en /auditar y /ceo para alcanzar robustez real y velocidad en pantallas pequeñas.

## Auditoría 3: Gemini

### 1. Calificación global
**6/10**

AuditaPatron tiene una propuesta de valor excepcionalmente clara y un copy que inspira confianza y profesionalismo. La robustez funcional y la profundidad de la información que maneja son evidentes y muy valiosas. Sin embargo, la ejecución actual de la interfaz, especialmente en el flujo operativo principal y la consola ejecutiva, demuestra una severa falta de adaptación mobile-first. La sobrecarga visual y cognitiva en pantallas pequeñas es un obstáculo crítico que impide que el usuario experimente la verdadera potencia y simplicidad que el producto promete, generando una fricción innecesaria y diluyendo la claridad en la acción.

### 2. Fortalezas reales
1.  **Claridad de la Propuesta de Valor:** El mensaje principal de "Sube un documento laboral y recibe una auditoría clara" es potente, directo y resuena con una necesidad real.
2.  **Calidad del Copy y Tono:** El lenguaje es consistentemente profesional, empático, claro y libre de jerga legal o técnica innecesaria. Genera confianza y guía al usuario.
3.  **Mecanismos de Confianza Visibles:** Las "Señales de confianza" en la homepage y el "Centro de privacidad" en `/auditar` y `/acceso` están bien pensados, abordando proactivamente las preocupaciones del usuario sobre sus datos.
4.  **Demostración de Valor en Homepage:** La "Vista previa del reporte" con sus estados (Documento recibido, Hallazgo preliminar, Siguiente paso sugerido) es una forma excelente de visualizar el resultado y el valor de la auditoría.
5.  **Robustez Operativa Subyacente:** La cantidad de detalle, trazabilidad y módulos en `/auditar` y `/ceo` demuestra un sistema backend potente y bien estructurado, capaz de manejar información compleja.
6.  **Guía Documental Contextual:** Las sugerencias de documentos en `/auditar` ("Documentos que más enriquecen...") son muy útiles para orientar al usuario sobre cómo fortalecer su expediente.

### 3. Debilidades críticas
1.  **Fricción Extrema en `/auditar` (Mobile-First):** La pantalla de auditoría es un dashboard completo que entierra la acción principal (subir documento) bajo una avalancha de información, estados, guías y módulos. En móvil, esto es inmanejable y genera un colapso cognitivo inmediato.
2.  **Sobrecarga Visual en Homepage (Mobile-First):** El primer scroll de la homepage es demasiado denso. La combinación de navegación, título, subtítulo, párrafo largo, tarjetas de situación y demo de reporte compite por la atención, abrumando al usuario móvil antes de que pueda comprender o actuar.
3.  **Consola CEO Inutilizable en Móvil:** La consola ejecutiva `/ceo` está claramente diseñada para escritorio. Su densidad de filtros, KPIs, tablas y la barra lateral la hacen prácticamente inoperable para una consulta rápida o toma de decisiones desde un celular.
4.  **Duplicación de Contenido en `/acceso`:** La ruta `/acceso` replica la homepage, lo que genera confusión sobre su propósito y diluye la arquitectura de información, especialmente si se espera que sea una puerta de entrada para login/registro.
5.  **CTAs Dispersas y Jerarquía Confusa:** Tanto en la homepage como en `/auditar`, existen múltiples llamadas a la acción que compiten entre sí, sin una clara priorización de la acción primaria para el usuario móvil. Esto genera indecisión y ralentiza el flujo.
6.  **Longitud Excesiva de Scroll:** Los recorridos en `/` y `/auditar` son excesivamente largos, requiriendo un scroll considerable para llegar a información clave o a la acción principal, lo cual es una barrera significativa en móvil.
7.  **Confianza Basada en Lectura Densa:** Aunque el copy es excelente, la construcción de confianza y la explicación del valor dependen de bloques de texto extensos, lo cual es una fricción para el usuario móvil que busca información rápida y accionable.
8.  **Ruido Visual por Estados Vacíos/Pendientes en `/auditar`:** La pantalla de auditoría muestra muchos módulos con estados "0 documentos", "Pendiente", "Sin actividad reciente" o "Aceptación legal pendiente" de forma muy prominente, lo que añade ruido visual y puede generar ansiedad o confusión en un usuario que recién empieza.

### 4. Tabla de auditoría priorizada

| Prioridad | Ruta o superficie | Problema | Impacto móvil | Recomendación precisa |
|:----------|:------------------|:---------|:--------------|:----------------------|
| P0        | `/auditar`        | La acción principal (subir documento) está enterrada bajo una avalancha de información contextual y de dashboard. | El usuario se pierde, se siente abrumado y abandona la tarea principal. La fricción es máxima. | Reestructurar `/auditar` para que el formulario de subida documental sea el elemento más prominente y accesible en el primer scroll. Mover el dashboard, el progreso del expediente y la información contextual a secciones colapsables, tabs o pantallas secundarias post-subida. |
| P0        | `/ceo`            | Consola no optimizada para móvil; densidad de información, barra lateral y múltiples paneles simultáneos. | Inutilizable para consulta rápida. El CEO no puede obtener información clave de un vistazo ni realizar acciones urgentes. | Crear una vista "Resumen Rápido" o "Alertas Críticas" específica para móvil, mostrando solo los KPIs esenciales, alertas prioritarias y acciones urgentes. La navegación lateral debe ser un menú hamburguesa o tabs inferiores. |
| P1        | `/` (Homepage)    | Densidad visual y cognitiva excesiva en el primer scroll (hero). | El usuario se siente abrumado, puede no comprender el valor rápidamente o no saber dónde empezar. | Simplificar drásticamente el hero: reducir el copy a una frase concisa, hacer el CTA principal (ej. "Empieza a auditar") singular y muy prominente. Mover las tarjetas de "Elige la situación" y el demo de reporte a un segundo scroll o a un flujo guiado post-CTA. |
| P1        | `/acceso`         | Duplicación de contenido con la homepage, sin propósito diferenciado. | Confusión sobre la función de la ruta, experiencia inconsistente y redundante. | Rediseñar `/acceso` para que sea una pantalla de login/registro clara y concisa, enfocada en la autenticación. Incluir un enlace discreto a la homepage si el usuario necesita más información. |
| P1        | `/auditar`        | Múltiples módulos informativos compitiendo por atención y generando un scroll excesivo. | Dificulta el escaneo, aumenta el esfuerzo cognitivo y la sensación de complejidad, incluso para información útil. | Consolidar o colapsar módulos. Por ejemplo, "ASÍ VA TU EXPEDIENTE LABORAL" y "ESTADO DE TU EXPEDIENTE LABORAL" pueden ser uno. Las "Recomendaciones" pueden ser un carrusel o un módulo colapsable. Priorizar la información más relevante para el estado actual del usuario. |
| P2        | `/` (Homepage)    | Múltiples CTAs en el hero y primer scroll, sin una jerarquía clara. | El usuario puede dudar sobre qué acción tomar primero, ralentizando la conversión. | Consolidar las CTAs principales en el hero a una sola "Empieza a auditar" o "Sube tu primer documento". Las secundarias (ej. "Ver qué documento subir primero") deben ser enlaces menos prominentes o parte de un flujo posterior. |
| P2        | `/auditar`        | Presentación prominente de "Actualización legal pendiente" y estados "0" o "Pendiente" antes de la primera interacción. | Puede generar fricción, ansiedad o confusión en el primer contacto, antes de que el usuario haya subido algo. | Integrar la aceptación legal de forma más contextual al momento de la subida (ej. un modal o checkbox justo antes de confirmar). Ocultar o minimizar los estados "0" o "Pendiente" hasta que haya actividad real en el expediente. |

### 5. Qué arreglaría primero para acercarse a 10/10
1.  **Reestructuración radical de `/auditar` para la acción primaria:** Haría que el formulario de subida de documentos sea el protagonista absoluto en el primer scroll. Todo lo demás (estado del expediente, recomendaciones, historial) se movería a secciones secundarias, accesibles mediante tabs, acordeones o un flujo guiado posterior a la subida. El usuario llega a auditar, no a leer un dashboard.
2.  **Diseño de una vista móvil para `/ceo`:** Crearía un "Resumen Ejecutivo Móvil" que muestre solo los 3-5 KPIs más críticos, las alertas P0/P1 y un acceso rápido a las acciones administrativas más urgentes. La navegación lateral se transformaría en un menú hamburguesa o tabs inferiores, y las tablas densas se reemplazarían por resúmenes o gráficos simples.
3.  **Simplificación extrema del hero de la Homepage:** Reduciría el copy del hero a una frase de valor concisa y un solo CTA principal y muy visible (ej. "Sube tu primer documento"). Las "tarjetas de situación" y el "mini diagnóstico" se moverían a un segundo scroll o a un flujo guiado post-clic, para no abrumar al usuario inicial.
4.  **Rediseño de `/acceso` como pantalla de autenticación:** Transformaría `/acceso` en una pantalla de login/registro limpia y enfocada, sin replicar la homepage. Su propósito debe ser inequívocamente la entrada al sistema.
5.  **Optimización de la presentación de información en `/auditar`:** Consolidaría los módulos redundantes y utilizaría componentes colapsables (acordeones) o tabs para la información contextual (ej. "Así va tu expediente", "Documentos que más enriquecen", "Historial"). La información se revelaría progresivamente, priorizando la acción y el progreso del usuario.

### 6. Qué NO cambiar todavía
*   **La calidad y el tono del copy:** Es un activo fundamental. El lenguaje es claro, profesional y genera confianza. No debe alterarse, solo optimizarse en su cantidad y jerarquía visual.
*   **El concepto de "Señales de confianza" y la "Vista previa del reporte":** Son excelentes para construir credibilidad y visualizar el valor. Su contenido es valioso, pero su ubicación y presentación en móvil necesitan ser revisadas.
*   **La robustez funcional y la riqueza de datos:** La capacidad de AuditaPatron para analizar, ordenar y trazar documentos es impresionante. La profundidad de la información en `/auditar` y `/ceo` es un diferenciador; el desafío es cómo presentarla de manera accesible, no si existe.
*   **La estructura de los "Dossier Targets" y "Priority Upload Guides":** Son muy útiles para guiar al usuario sobre qué documentos subir. Su contenido es valioso, pero su presentación en `/auditar` necesita ser más concisa y contextual.

### 7. Veredicto final
AuditaPatron es un producto con una base sólida y una promesa de valor excepcional, pero sufre de una miopía mobile-first que lo aleja significativamente de una experiencia 10/10. La sobrecarga de información y la falta de jerarquía visual en sus flujos clave lo convierten en un sistema potente pero frustrante en pantallas pequeñas. Para alcanzar su potencial, debe priorizar la simplicidad y la acción inmediata, transformando su riqueza funcional en una claridad operativa que el usuario móvil pueda abrazar sin esfuerzo.

## Formato de respuesta requerido

Responde en español usando exactamente esta estructura:

### 1. Consenso principal
Un párrafo con la lectura compartida más sólida.

### 2. Coincidencias de alto consenso
Entre 5 y 8 puntos con muy alta coincidencia entre los tres modelos.

### 3. Diferencias relevantes
Tabla con columnas:
- `Tema`
- `ChatGPT`
- `Grok`
- `Gemini`
- `Resolución del consenso`

### 4. Calificación global de consenso
Da una nota única de 0 a 10 y explica por qué.

### 5. Prioridades finales
Tabla con columnas:
- `Prioridad`
- `Ruta`
- `Qué cambiar`
- `Por qué importa más en móvil`
- `Complejidad estimada` (Baja, Media, Alta)

### 6. Qué conservar
Lista corta de activos que ya funcionan y deben preservarse.

### 7. Veredicto final hacia 10/10
Un párrafo firme diciendo qué tan lejos está realmente la app del 10/10 mobile-first y qué tendría que pasar para acercarse.
