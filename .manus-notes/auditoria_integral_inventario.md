# Inventario real de la plataforma para auditoría integral

## Superficies activas detectadas

La aplicación expone actualmente estas rutas principales: `/` como landing pública, `/acceso` como entrada por correo y recuperación de continuidad, `/auditar` como experiencia operativa principal para subir, analizar, guardar y profundizar documentos, `/ceo` y sus subsecciones como consola ejecutiva, además de `/legal/privacidad` y `/legal/terminos` como capas legales de soporte.

## Identidad y promesa general

La plataforma mantiene una identidad visual bastante consistente entre la landing y la experiencia de Auditar: paleta sobria, acentos teal, sensación de cuidado y promesa centrada en claridad, privacidad y lectura guiada de documentos. Esa base estética es sólida y transmite confianza.

## Hallazgos estructurales iniciales por superficie

En la **landing**, la promesa principal es clara, pero se repiten varias ideas con diferente redacción: empezar con un archivo, recibir una primera lectura, proteger privacidad y luego guardar en la bóveda. También hay múltiples llamadas a la acción muy parecidas, lo que reduce la nitidez del camino principal.

En **/acceso**, el código confirma que existe una pantalla diferenciada y bastante enfocada en continuar con correo y código de 6 dígitos. Sin embargo, la navegación observada en preview no mostró una separación visual clara, lo que hace necesario validar si existe un bug real de enrutado, un redirect inesperado o simplemente una inconsistencia de rendering.

En **/auditar**, se concentra la mayor densidad funcional del producto. Coexisten captura, expediente, timeline, filtros, lecturas preliminares, comparación, bóveda, privacidad/consentimiento, asesor y monetización. Esta acumulación sugiere que la plataforma resuelve demasiadas necesidades en una sola pantalla, mezclando tareas iniciales, trabajo en progreso y herramientas de profundización.

En **/ceo**, la consola incorpora navegación lateral, resumen ejecutivo, bitácora, alertas, accesos, bridge, documentos, exportes y un chat CEO. Aunque esto tiene sentido para un owner avanzado, la primera vista sigue siendo muy densa y probablemente explica demasiado antes de ayudar a decidir qué hacer primero.

## Hipótesis de redundancia o sobreexposición

Hay una hipótesis clara de repetición de funciones o, al menos, de repetición de superficies para una misma intención del usuario. En particular, parecen convivir varias formas de explicar el expediente, varias maneras de abrir profundización documental, varios bloques que persiguen el mismo objetivo de orientación, y distintos puntos donde el usuario puede sentir que debe decidir más de lo necesario.

## Preguntas a validar con las tres IAs

La auditoría comparada debe responder cuatro preguntas concretas. Primero, qué partes de la estética actual son realmente fuertes y cuáles ya generan ruido. Segundo, qué pantallas o módulos deberían fusionarse, esconderse o simplificarse. Tercero, qué acciones son verdaderamente primarias para un usuario nuevo frente a cuáles deberían revelarse progresivamente. Cuarto, si `/acceso` y ciertas capas de `/auditar` y `/ceo` están aportando claridad o agregando complejidad evitable.
