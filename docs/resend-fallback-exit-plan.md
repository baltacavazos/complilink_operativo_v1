# Salida del fallback temporal de correo para acceso CEO

## Estado actual

La cuenta de Resend usada por el proyecto no tiene dominios configurados ni verificados en este momento. La consulta a `GET https://api.resend.com/domains` devolvió una lista vacía el 2026-04-14, por lo que el envío a correos corporativos externos sigue limitado al modo de pruebas.

## Consecuencia operativa

Mientras no exista un dominio verificado en Resend, el flujo de acceso CEO necesita conservar el fallback temporal al buzón permitido del propietario para evitar errores 403 al solicitar códigos por correo desde un dominio corporativo.

## Condición para retirar el fallback

El fallback solo debe retirarse cuando se cumplan las tres condiciones siguientes:

1. Exista al menos un dominio verificado en Resend.
2. `RESEND_FROM_EMAIL` use una dirección perteneciente a ese dominio verificado.
3. La prueba de secretos de correo y la prueba E2E del acceso CEO por código pasen sin activar el buzón de respaldo.

## Pasos sugeridos para la retirada

1. Crear el dominio en Resend.
2. Configurar y propagar los registros DNS requeridos.
3. Confirmar que el dominio aparezca como verificado en la API de Resend.
4. Actualizar `RESEND_FROM_EMAIL` a una dirección del dominio verificado.
5. Ejecutar:
   - `pnpm exec vitest run server/resend.secret.test.ts server/auth.email-owner-fallback.test.ts server/auth.routes.test.ts`
   - `pnpm exec playwright test tests/e2e/ceo-email-code-flow.spec.ts`
6. Si el acceso CEO ya entrega directamente al correo corporativo sin fallback, retirar el mensaje de respaldo y simplificar la rama temporal del servicio.

## Criterio de rollback

Si después del cambio vuelve a aparecer un 403 de Resend o falla la E2E del acceso CEO, se debe restaurar inmediatamente el fallback temporal y revisar la verificación del dominio y la dirección remitente.
