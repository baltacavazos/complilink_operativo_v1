# Auditoría visual de logotipos de AuditaPatron

## Hallazgos iniciales

| Asset | Resultado | Severidad |
|---|---|---|
| Logotipo completo | La firma es nítida, proporcionada y legible en su resolución fuente; el tagline conserva contraste suficiente. | Aprobado como asset maestro horizontal. |
| Icono base | El archivo no contiene un símbolo aislado: muestra fragmentos recortados del wordmark y del tagline detrás de la lupa, con gran espacio vacío. En app icon, favicon o avatar se verá roto y poco profesional. | **Crítico: requiere reemplazo del asset de icono.** |
| Wordmark | La palabra completa y la lupa son legibles y conservan la proporción correcta; no hay deformación visible. | Aprobado para contextos horizontales sin tagline. |
| Header sobre fondo claro | El lockup es nítido, tiene altura suficiente y preserva la firma completa. | Aprobado como fuente; falta validar el tamaño renderizado en cada encabezado. |
| Header sobre fondo oscuro | La firma blanca y el acento turquesa son correctos para fondos oscuros; sobre blanco parece invisible por diseño, no por corrupción del asset. | Aprobado únicamente para superficies oscuras. |
| Icono Android instalado | Conserva el icono azul genérico del scaffold, no la marca AuditaPatron. | **Crítico: reemplazar todas las densidades y variantes adaptativas.** |
| Icono iOS instalado | Conserva el mismo icono azul genérico del scaffold, no la marca AuditaPatron. | **Crítico: reemplazar AppIcon antes de distribución.** |
| Icono PWA 512/192 | Usa el asset de icono defectuoso: aparecen letras y tagline recortados detrás de la lupa. | **Crítico: la instalación web se ve rota.** |
| Favicon 32 px | El exceso de detalles y texto recortado vuelve la marca prácticamente ilegible al tamaño real. | **Alto: reemplazar por símbolo aislado y simplificado.** |
| Splash Android | Muestra el símbolo azul genérico del scaffold en un lienzo blanco; no identifica AuditaPatron. | **Crítico: sustituir antes de distribuir la nueva APK.** |
| Splash iOS | Muestra el mismo símbolo azul genérico y carece de continuidad con la identidad web. | **Crítico: sustituir antes de compilar iOS.** |

## Observación en páginas móviles

El wordmark del encabezado de Home es legible y proporcionado. El logotipo completo dentro del primer paso de `/auditar` tiene contraste alto y se ve nítido. En cambio, los iconos pequeños de Access y del app shell dependen del asset de icono defectuoso, por lo que muestran fragmentos de letras detrás de la lupa y deben corregirse desde la fuente común.

## Observación en escritorio

Home mantiene una firma horizontal clara, nítida y con contraste alto en el encabezado oscuro. El wordmark de `/auditar` también conserva proporción y legibilidad. En `/acceso`, la variante horizontal está correcta, pero el pequeño icono cuadrado repite el recorte defectuoso del asset común.

## Consenso tri-IA

ChatGPT, Gemini y Grok coinciden en conservar intactos el logo horizontal, el wordmark y los lockups aprobados. Gemini y Grok clasifican como críticos el icono recortado, los launchers/splash genéricos y la propagación del defecto a favicon, PWA, Access y app shell. La corrección mínima aceptada es un símbolo aislado de lupa, sin letras ni tagline, aplicado de forma uniforme a todos los contextos cuadrados.

## Criterios de aceptación

| Contexto | Criterio |
|---|---|
| Icono común de UI | Solo la lupa completa, centrada, sin letras o tagline detrás. |
| Favicon | Reconocible a 32 px, sin detalle fino ilegible. |
| PWA | Símbolo centrado con safe area suficiente en 192 y 512 px. |
| Android/iOS launcher | Identidad AuditaPatron, sin ningún remanente del icono azul genérico. |
| Splash | Continuidad visual con el launcher y la marca, sin texto pequeño. |
| Wordmarks horizontales | Permanecen sin cambios de diseño o proporción. |

## Verificación posterior a la corrección

El favicon corregido permanece reconocible a 32 px y contiene únicamente la lupa. El launcher Android de 192 px está centrado, conserva safe area y ya no contiene el símbolo azul genérico. En la captura móvil de `/acceso`, el icono común aparece limpio dentro de su contenedor y el wordmark horizontal permanece intacto. Home conserva la firma aprobada sin alteraciones.

El AppIcon iOS corregido coincide con Android y mantiene el símbolo dentro de márgenes seguros. La primera derivación del splash reveló un bloque marino apenas distinto alrededor del icono; el generador se ajustó para componer el símbolo transparente sobre un único fondo uniforme y eliminar esa discontinuidad estética.

La segunda inspección confirma que los splash de Android e iOS usan un fondo marino uniforme, la lupa está centrada y no quedan rastros del gráfico genérico ni del bloque de color anterior.

## Resultado final

| Superficie | Resultado verificado |
|---|---|
| Home y headers | Wordmarks aprobados, legibles y sin cambios de identidad. |
| Access, app shell y estados compactos | Icono aislado limpio, centrado y sin texto recortado. |
| Favicon y PWA | Lupa reconocible en 32, 192 y 512 px; referencias permanentes activas. |
| Android launcher/adaptive icon | Marca AuditaPatron uniforme, con fondo marino y safe area. |
| iOS AppIcon | Consistente con Android, 1024 px y sin gráficos genéricos. |
| Splash Android/iOS | Fondo uniforme, símbolo centrado y continuidad con el launcher. |
| Calidad técnica | TypeScript correcto, 67 archivos de Vitest y 346 pruebas aprobadas; build de producción completado. |

No se detectan fallos estéticos de logotipo pendientes en las superficies auditadas. Para observar launcher y splash corregidos en un teléfono ya instalado será necesario generar e instalar una nueva build nativa, porque el sistema operativo conserva esos assets dentro del paquete de la app.

No se ha rediseñado la identidad. La corrección necesaria consiste en derivar un icono limpio de la lupa existente, preservando sus colores y forma, sin texto fragmentado.
