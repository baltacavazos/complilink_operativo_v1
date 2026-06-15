# Notas visuales para ronda de cierre total

## Home pública

La home abre con una propuesta clara y fuerte: `Sube tu recibo y te decimos qué revisar.` El primer impacto es bueno, pero todavía hay una sensación de longitud excesiva y de narrativa acumulada. El hero comunica utilidad real, aunque la extracción visual sigue confirmando que el producto intenta probar la misma tesis demasiadas veces: empezar con un recibo, ver una señal, seguir después, privacidad, confianza, bóveda y nuevos documentos.

La jerarquía actual prioriza bien el beneficio inicial, pero todavía no llega a una sensación de `no brainer`. Falta una estructura más decidida alrededor de tres ideas: **qué gano ya**, **qué tan real es el resultado** y **por qué confiar ahora mismo**. Hoy esas tres ideas existen, pero están repartidas en demasiados bloques.

También persiste una anomalía visible o de extracción en el enlace `Salida rápida`, que aparece apuntando a `https://news.google.com/`. Eso debe verificarse en código porque degrada confianza y transmite descuido si es real.

## Acceso público

`/acceso` ya se siente mucho más limpio y simple que antes. El titular `Entra y sigue donde te quedaste` funciona bien, y la explicación `Aquí solo resolvemos el acceso` reduce ruido. La pantalla transmite más producto terminado que otras superficies.

Aun así, la experiencia podría elevarse si el acceso se percibe menos como formulario aislado y más como continuidad natural del valor ya ganado. Hoy es claro, pero no necesariamente deseable ni premium. Se siente correcto; todavía no se siente memorable.

## Lectura de conversión para la siguiente ronda

La home necesita una edición más agresiva para convertirse en una experiencia que parezca obvia de probar y suficientemente seria como para pagar. El acceso necesita reforzar continuidad y confianza, no más complejidad. La siguiente deliberación multi-IA debe producir una lista corta de cambios de alto impacto, no otra expansión de superficie.

## Validación visual posterior a la implementación

La home ya se ve más compacta desde el primer pantallazo. El header cambió a `Resultado real`, `Cómo funciona` y `Privacidad`, lo cual mejora la sensación de foco. El hero mantiene fuerza y ahora se siente más orientado a resultado inmediato.

La pantalla `/acceso?returnTo=/auditar` sí mejoró. El nuevo bloque `Tu avance sigue listo` aporta continuidad, baja ansiedad y hace que el login parezca una puerta de retorno al valor, no un formulario aislado.

La anomalía del enlace `Salida rápida` sigue apareciendo en la extracción del navegador apuntando a `https://news.google.com/`. No apareció en el código mediante búsqueda textual, por lo que probablemente sea un artefacto del entorno de extracción; aun así, debe quedar registrada como anomalía observacional para futuras revisiones visuales.

## Rastreo técnico del artefacto en la ronda extrema

La inspección más reciente confirmó que en la **preview técnica** el navegador sí ve un enlace flotante con texto `Salida rápida` en la esquina inferior derecha y lo lista como elemento interactivo. Sin embargo, una solicitud directa al HTML servido por esa misma URL no devolvió ninguna coincidencia para `Salida rápida` ni `news.google.com`.

La conclusión provisional es más fuerte que antes: el artefacto **sí aparece visualmente en la preview**, pero **no forma parte del HTML entregado por la aplicación**, por lo que muy probablemente proviene de una capa externa del entorno de visualización. En una navegación al dominio público `auditapatron.com` tampoco apareció este elemento; allí se abrió una pantalla de login de Manus sin ese overlay. Eso permite tratar el problema como un contaminante del entorno de preview, no como un bug confirmado del repositorio.

La revisión del HTML inicial servido por la preview mostró una referencia externa adicional: `'/__manus__/debug-collector.js'`. No aparecieron bundles propios del frontend con el texto `Salida rápida` en esa primera inspección del documento. Esto refuerza la hipótesis de que la preview está instrumentada por una capa externa de debug o colección que no forma parte del código del producto y que puede contaminar la percepción visual de la demo.

Validación visual posterior a la micro-ronda de transparencia en la preview de Home: el bloque `Privacidad visible y auditada` ahora muestra explícitamente `Transparencia visible`, `Guardado manual`, `Acceso con rastro útil` y `Borrado y privacidad visibles`, por lo que la prueba de control ya subió al primer scroll. Sin embargo, en la misma preview sigue apareciendo el overlay externo `Salida rápida` en la esquina inferior derecha, visible como elemento independiente del resto de la experiencia. La landing se siente más blindada, pero la demo técnica sigue contaminada por ese artefacto perceptual ajeno al producto.

Validación visual posterior a la eliminación de `QuickExitButton` en `client/src/App.tsx`: la preview de Home ya no muestra el botón ni overlay de `Salida rápida` en la esquina inferior derecha. El navegador lista únicamente los elementos esperados de la navegación y de la landing, y el contenido extraído confirma explícitamente que `No se menciona ni se muestra el botón o overlay de 'Salida rápida' en ninguna parte del documento proporcionado.` Con esto, el bloqueo perceptual más severo de la demo quedó resuelto dentro del propio código del producto.

Validación visual tras la micro-ronda premium final: la home ahora muestra la superficie `Qué verás en tu primer uso` dentro del primer scroll útil. El navegador extrajo explícitamente `Subes y revisas` y `Primero ves una señal clara. Todavía no guardas nada`, confirmando que el flujo de control ya no depende solo del microcopy disperso. La esquina inferior derecha sigue limpia; el botón `Salida rápida` no reapareció. El primer scroll se siente más guiado y más pedagógico sobre guardar, borrar o salir.

Validación visual tras añadir `Registro visible de tu control`: la home ya exhibe en el primer scroll una capa más tangible de auditoría personal. El navegador extrajo explícitamente `Antes de guardar, ves una lectura preliminar sin integrar nada a tu expediente` y `Si aceptas el paquete legal, queda rastro visible de versión, fecha y navegador`, lo que confirma que la nueva superficie sí quedó visible sin romper la jerarquía principal. La esquina inferior derecha permanece limpia.

## Validación visual adicional de /acceso tras compactación

La tarjeta principal de `/acceso` ya se siente más corta y más escaneable en móvil. El bloque de correo explica su uso con menos texto y con tres cápsulas más fáciles de leer: `Solo para entrar`, `Código temporal` y `Regreso a tu revisión`.

El bloque `Qué pasará después` mantiene continuidad operativa con menos ruido visual y con pasos más fáciles de recorrer de izquierda a derecha. En conjunto, la jerarquía del flujo por correo se percibe más premium y menos administrativa que en la iteración anterior.

## Validación visual de la micro-ronda final de control verificable

Fecha de validación: 2026-06-14
Preview revisada: https://3000-iia5azgm81nj07x51v6pm-df2623bd.us2.manus.computer

La home mantiene un primer viewport limpio, sin el artefacto `Salida rápida`, y el header sigue transmitiendo foco con `Resultado real`, `Cómo funciona` y `Privacidad`.

La extracción del navegador confirmó la presencia del nuevo bloque de confianza con el copy exacto `Control visible desde el primer archivo.` y la línea `Tu empresa nunca ve lo que subes. Primero revisas la señal, luego decides si la guardas en tu expediente.`. Esto confirma que la última micro-ronda sí quedó publicada en preview y no solo en el código fuente.

También quedó confirmada la continuidad del patrón de valor antes del expediente mediante la presencia visible de `Sube un archivo y mira una señal real antes de decidir.`. La sensación general del primer scroll sigue siendo más limpia y más seria que en rondas previas, con menos ruido lateral y mejor lectura de confianza.

Para la siguiente mesa crítica externa, el punto a validar ya no es si existe control visible, sino si la nueva superficie compacta (`Nada se guarda solo`, `Rastro legal versionado`, `Privacidad accionable`, `3 señales claras`) ya basta para mover la percepción estricta de producto terminado hacia 9/10.

## Validación visual de la demo interactiva de control

La preview ya muestra los tres estados clicables `Antes de guardar`, `Si aceptas` y `Si resguardas` como botones reales dentro del bloque `Registro visible de tu control`.

Al activar `Si aceptas`, la interfaz sí cambia de estado y la tarjeta inferior actualiza el contenido a `Aceptación registrada` con badge `Versión visible`. También aparecen campos explícitos de lectura: `Qué queda visible para ti`, `Qué no ve tu empresa`, `Rastro verificable` y `Siguiente estado`.

Esto confirma que la última micro-ronda ya no es solo copy estático: ahora existe una demostración tangible de qué cambia, qué queda privado y qué se traza para la propia persona usuaria. Visualmente, el bloque sigue cabiendo en la narrativa premium sin romper la jerarquía general ni reintroducir el artefacto `Salida rápida`.

## Validación visual de /auditar en esta ronda

La preview pública de `/auditar` sin sesión no entra al workspace autenticado; solo muestra la capa inicial `Revisión rápida y privada` con CTAs de `Empezar gratis` y `Ya tengo cuenta · iniciar sesión`. Por lo tanto, la nueva señal persistente de privacidad activa no pudo validarse visualmente en navegador dentro del workspace real usando esta sesión anónima.

Aun así, la intervención quedó confirmada por código y pruebas: `/auditar` ahora contiene una banda persistente con el copy `Privacidad activa en este expediente`, más estados explícitos como `Privacidad activa dentro del expediente`, `Empresa sin acceso`, `Tú conservas el mando` y `Versión y estado visibles`.
