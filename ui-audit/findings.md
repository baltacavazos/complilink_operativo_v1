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

## Inspección de superficies pendientes tras el segundo corte

La home pública ya se ve estable en escritorio y no muestra el recorte móvil severo reportado inicialmente. La ruta /auditar sí está accesible para revisión y ahora presenta una jerarquía más clara, aunque sigue cargada de texto en varios bloques introductorios y secundarios. El dashboard /ceo abre correctamente con sesión disponible; en escritorio la estructura lateral y el héroe principal se sostienen, pero la densidad verbal sigue siendo alta y hay varias CTA y etiquetas compitiendo entre sí. El siguiente foco debe ser simplificar copies, bajar ruido visual y confirmar en móvil si los anchos mínimos internos del dashboard ya no empujan el viewport.

## Capturas móviles autenticadas para pulido final

En /auditar ya no se aprecia el desborde grave original, pero el bloque superior sigue sintiéndose apretado: el logo ocupa demasiado ancho, el subtítulo suma ruido y el párrafo principal todavía es largo para el primer pantallazo. El CTA secundario de iniciar sesión sigue ocupando demasiado peso visual debajo de la acción principal.

En /ceo la sesión móvil no está entrando a la consola; la captura muestra una pantalla de acceso seguro con copy excesivamente técnico y largo para celular. El primer titular también es más largo de lo conveniente y la caja descriptiva inferior agrega densidad sin ayudar a la decisión inmediata. El pulido debe simplificar el mensaje de acceso y compactar el héroe móvil del área privada.

## Validación visual tras el pulido final de copy

La versión móvil de /auditar ya se ve más ordenada en el primer pantallazo: el logo ocupa menos, el pill es más breve, el título entra mejor y la CTA secundaria dejó de competir con la principal. Aun así, el párrafo central sigue cortándose un poco en la captura por el viewport de validación, así que conviene revisar si hace falta una reducción adicional de ancho o tamaño de texto.

La pantalla de acceso privado también mejoró: desapareció la jerga técnica y el mensaje ahora se entiende rápido. Todavía el título queda algo largo para un viewport tan estrecho, pero el bloque completo ya transmite mucha más claridad y confianza que antes.

## Verificación estructural en navegador

La comprobación directa en navegador sobre /auditar arroja `scrollWidth == clientWidth` en escritorio, sin elementos desbordados detectables. Esto confirma que el desborde horizontal ya no aparece como problema estructural global en la vista actual; el resto del trabajo pendiente es principalmente de pulido visual y jerarquía de contenido en móvil extremo.
