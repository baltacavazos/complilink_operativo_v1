# Conectar los dominios comprados de AuditaPatron en Manus

Esta guía asume que el proyecto ya existe en Manus y que actualmente tienes un dominio temporal similar a `compliapp-cgpjc3da.manus.space`. El objetivo es enlazar tus dominios comprados de **AuditaPatron** al proyecto publicado sin mover el sitio a otro hosting.

| Paso | Qué hacer en Manus | Qué revisar en tu registrador DNS |
| --- | --- | --- |
| 1 | Abre el proyecto y entra a **Settings → Domains**. | Ten a la mano acceso al panel DNS donde compraste el dominio. |
| 2 | Agrega primero el dominio principal, por ejemplo `auditapatron.mx` o `auditapatron.com.mx`, según el que hayas comprado. | Confirma que el dominio esté activo y desbloqueado para cambios DNS. |
| 3 | Agrega después el subdominio público que quieras usar, normalmente `www.auditapatron...`. | Revisa si ya existen registros viejos `A`, `AAAA` o `CNAME` para `@` o `www`. |
| 4 | Copia exactamente los registros que Manus te muestre para validación y enrutamiento. | Pega esos valores sin modificarlos. Si Manus muestra varios registros, crea todos. |
| 5 | Guarda los cambios y vuelve a la pantalla de dominios en Manus para iniciar o esperar la verificación. | Espera propagación DNS. Puede tardar desde minutos hasta 24–48 horas, según el registrador. |
| 6 | Cuando Manus confirme la verificación, deja un dominio como principal y redirige el secundario si así lo deseas. | Si el registrador permite proxy o CDN, desactívalo durante la validación inicial. |

## Orden recomendado

1. **Conecta primero `www`** porque suele ser el caso más estable cuando Manus entrega un `CNAME`.
2. **Después conecta el dominio raíz** (`@`) con los registros exactos que Manus muestre en la interfaz.
3. Cuando ambos verifiquen, define cuál será el dominio canónico público de AuditaPatron.

| Escenario | Configuración sugerida |
| --- | --- |
| Quieres una marca más clásica | Deja `www.tudominio` como principal y redirige el raíz hacia `www`. |
| Quieres una URL corta | Deja el raíz (`auditapatron...`) como principal y redirige `www` al raíz. |

## Qué registros esperar

Manus te mostrará los valores concretos dentro de **Settings → Domains**. Según el caso, normalmente verás alguno de estos patrones:

| Tipo de dominio | Registro frecuente |
| --- | --- |
| Subdominio `www` | `CNAME` apuntando al destino indicado por Manus |
| Dominio raíz `@` | `A`, `ALIAS`, `ANAME` o un conjunto de registros de verificación/ruteo indicados por Manus |
| Verificación | `TXT` o CNAME adicional, si Manus lo solicita |

> La referencia correcta siempre es la que Manus muestre dentro del panel del proyecto. No conviene inventar valores genéricos si la interfaz ya te entrega registros exactos.

## Checklist de validación

| Verificación | Resultado esperado |
| --- | --- |
| El dominio aparece en Manus | Estado pendiente o verificado |
| Los registros DNS coinciden exactamente | Sin errores de host, tipo o valor |
| No hay conflictos previos | Sin `A/AAAA/CNAME` viejos compitiendo en `@` o `www` |
| SSL se emite correctamente | El sitio abre con `https://` sin advertencias |
| El dominio principal queda definido | Solo una URL pública canónica |

## Problemas comunes

| Problema | Causa típica | Qué hacer |
| --- | --- | --- |
| Manus no verifica el dominio | Registro mal copiado o propagación incompleta | Revisa host, tipo y valor exactos; espera más tiempo |
| `www` funciona pero el raíz no | El registrador no soporta bien ciertos alias en apex | Usa temporalmente `www` como principal y luego ajusta el raíz |
| SSL no aparece aún | El dominio no ha terminado de verificar | Espera la verificación completa antes de probar otra vez |
| Hay conflictos DNS | Ya existían registros anteriores del proveedor viejo | Elimina o reemplaza los registros que compiten |

## Recomendación operativa para AuditaPatron

Para minimizar fricción, mi recomendación es esta secuencia:

1. Publicar o conservar el checkpoint estable más reciente.
2. Entrar a **Settings → Domains**.
3. Conectar primero `www.auditapatron...`.
4. Verificar que abra con HTTPS.
5. Conectar después el dominio raíz `auditapatron...`.
6. Definir la URL canónica final y probar login, carga documental y la ruta `/auditar`.

## Prueba final mínima

Una vez verificado el dominio, conviene probar lo siguiente:

| Ruta | Qué validar |
| --- | --- |
| `/` | Carga de la home de AuditaPatron |
| `/auditar` | Apertura del expediente y guardas legales |
| páginas legales | Aviso de privacidad y términos accesibles |
| login/logout | Sesión funcionando ya bajo el dominio final |

Si quieres, en la siguiente ronda puedo dejarte también una **lista exacta de pruebas post-dominio** para AuditaPatron, enfocada en login, expedientes, consentimientos y subida documental.
