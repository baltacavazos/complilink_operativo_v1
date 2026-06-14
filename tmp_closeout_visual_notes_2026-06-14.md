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
