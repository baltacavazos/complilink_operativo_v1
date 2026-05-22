# Hallazgos base para assets de stores

## Identidad visual observada

La captura vigente de Auditapatron muestra una dirección visual sobria y confiable. Predominan un fondo verde muy claro con sensación clínica y limpia, una barra superior en azul grisáceo oscuro, tipografía negra de alto contraste y un acento turquesa en CTA y detalles del logotipo. La promesa visual es seria, simple y orientada a confianza laboral, no a estilo lúdico.

## Assets oficiales ya definidos en frontend

El componente `client/src/components/AuditaPatronLogo.tsx` ya declara cinco activos oficiales remotos: logo completo, wordmark, icono base y dos lockups de header. Esto confirma que la base gráfica principal ya existe y conviene reutilizarla para icono, splash y composiciones de capturas, en lugar de inventar una marca nueva.

## Restricción oficial verificada de Apple

La referencia oficial abierta de App Store Connect confirma que las screenshots deben cargarse en formatos `.jpeg`, `.jpg` o `.png`, y que Apple organiza los requisitos por familia de dispositivo dentro de la sección de screenshots. En la siguiente revisión conviene extraer específicamente la familia de iPhone más práctica para una primera entrega.

## Requisitos oficiales verificados para screenshots e iconos

La referencia oficial de Apple ya expandida muestra que una familia práctica para iPhone es **6.9 pulgadas**, con capturas de **1260 × 2736 px** en vertical y **2736 × 1260 px** en horizontal. La misma tabla también incluye otras familias como **6.5 pulgadas**, pero para una primera tanda conviene tomar 6.9 pulgadas como base principal porque cubre la familia grande actual visible en la guía oficial.

La ayuda oficial de Google Play confirma que el listing usa icono, screenshots, feature graphic y otros recursos promocionales dentro de la sección de preview assets. La página abierta no mostró el tamaño del icono en el primer bloque visible, así que conviene leer o enfocar la subsección específica de `App icon` para extraer el tamaño exacto oficial antes de producir la versión final de Android.

La subsección oficial de **App icon** de Google Play ya mostró el requisito exacto del icono Android: **PNG de 32 bits con alpha, 512 × 512 px y tamaño máximo de 1024 KB**. También indica que no deben incluirse badges, ranking, precio ni textos engañosos dentro del icono.

La subsección oficial de **Screenshots** de Google Play confirma que para teléfono se pueden subir hasta 8 capturas por tipo de dispositivo y que en formatos grandes se usan relaciones **16:9** en horizontal y **9:16** en vertical. También refuerza que conviene evitar texto adicional que pueda recortarse en ciertas superficies promocionales.

## Capturas reales del producto tomadas del preview

La homepage actual ofrece una composición fuerte para stores: hero con titular muy claro, fondo verde suave, CTA turquesa y una tarjeta visible de resultado inicial en la parte inferior derecha. Esta vista sirve bien para una screenshot de propuesta de valor o de primer contacto.

La pantalla `/acceso` actual muestra una tarjeta muy limpia y centrada con estado positivo y CTA único. Sirve mejor como apoyo secundario o como base para una captura de continuidad de sesión, no como imagen principal de venta.

## Revisión del primer render generado

El icono iOS generado no es apto todavía: el recorte actual deja visible solo una parte del lockup y no prioriza el símbolo central con suficiente limpieza. La primera screenshot iOS también necesita una segunda iteración porque el marco del teléfono quedó demasiado grande respecto al copy, el texto resulta pequeño y la captura real quedó mal encuadrada. Antes de entregar, conviene rehacer el icono usando exclusivamente el símbolo base y recomponer las screenshots con jerarquía tipográfica mucho más dominante y un frame más compacto.

## Segunda revisión visual

El icono ya quedó mucho más limpio y entendible: funciona como documento + auditoría, con mejor legibilidad que la primera versión. Sin embargo, las screenshots todavía se ven demasiado técnicas y con texto demasiado pequeño, porque la captura real sigue dominando el layout y el copy de venta no tiene la jerarquía suficiente. Para cerrar bien esta ronda, conviene rehacer las screenshots como piezas más cercanas a marketing static, usando crops más abiertos, texto grande y menos elementos secundarios.

## Validación de la iteración utilizable

La iteración actual ya es presentable como paquete base: el icono comunica documento + revisión, la splash mantiene continuidad de marca con el wordmark oficial, y la primera screenshot ya tiene titular dominante y mejor legibilidad comercial. No es todavía un paquete final de marketing premium, pero sí una base sólida y coherente para revisión interna, pruebas de listing y siguiente ronda de refinamiento.
