## Hallazgos iniciales - Home móvil

En la captura móvil local de la home se reproducen problemas reales de responsive. El **header no cabe completo**: el wordmark queda demasiado ancho y la CTA principal de la derecha aparece recortada, lo que sugiere falta de compresión horizontal y ausencia de una estrategia móvil más estricta para navegación superior.

También se ve que el **pill superior del hero** (“Sube una foto o PDF...”) se desborda hacia la derecha, indicando que algunos bloques conservan anchos o contenidos pensados para escritorio. El hero principal ya no coincide con la versión del screenshot del usuario, pero sí confirma que la home sigue teniendo **riesgo de overflow horizontal y recortes en viewport angosto**.

Siguiente foco de revisión: header, pill superior, CTA principal, wordmark y cualquier contenedor del hero con max-width insuficientemente adaptado a móvil.

## Hallazgos adicionales - Acceso y Auditar en móvil

La pantalla de **/acceso** se ve relativamente estable en móvil y no muestra, en esta captura, un desborde horizontal severo. El problema principal allí parece menor y se concentra más en proporciones generosas que en ruptura real del layout.

En cambio, **/auditar** reproduce casi exactamente el problema reportado por el usuario. El **wordmark dentro de la tarjeta principal se sale hacia la derecha**, el texto del cuerpo queda parcialmente cortado por falta de espacio horizontal y el botón secundario también aparece truncado. Además, la tarjeta siguiente (“Lo que pasa en cuanto subes”) empieza ya visualmente comprometida por el mismo desborde general. Esto confirma que el foco técnico prioritario está en la portada/hero de /auditar y en cualquier variante móvil que reutilice esa composición.

Prioridad inmediata de corrección: reducir el ancho efectivo del logo/wordmark en móvil, evitar filas rígidas en CTAs, imponer `overflow-hidden` solo donde corresponda, y revisar paddings + `max-width` de textos y chips dentro del hero oscuro de /auditar.

## Validación después de la primera ronda de fixes

La mejora en **/auditar móvil** es clara. El logo principal ya cabe bastante mejor dentro de la tarjeta, el título dejó de empujar tanto el ancho disponible y ambos botones ya se muestran como bloques usables dentro del viewport. Aun así, el copy largo del párrafo central sigue muy justo visualmente y conviene dejarlo más contenido o con un ancho efectivo todavía más controlado para evitar sensación de apretamiento.

En **Home móvil** el header mejoró, pero la CTA superior todavía aparece visualmente muy al borde derecho y transmite que el ajuste sigue siendo frágil. El logo ya no domina tanto, aunque la composición superior todavía necesita una segunda pasada conservadora: o bien una CTA aún más corta en móvil o bien más espacio reservado al bloque derecho para que nunca parezca recortado.

## Segunda validación visual

La segunda ronda mejoró proporciones internas, pero el patrón de recorte en Home y Auditar sigue viéndose demasiado global: no afecta solo a un botón o a una tarjeta, sino al viewport completo. Esto sugiere revisar una causa estructural de render móvil, no únicamente clases aisladas en componentes.

## Tercera validación visual

La tercera captura confirma que el patrón persiste en la herramienta de captura: los recortes globales apenas cambian pese a fixes locales y protección contra overflow. Esto obliga a revisar si hay una transformación, ancho calculado o comportamiento de render específico que esté afectando la composición móvil más arriba en la jerarquía.
