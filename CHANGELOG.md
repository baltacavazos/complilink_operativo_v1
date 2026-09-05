# Changelog

## 2026-09-04 — Auth propia: Tester PASS (tip e280a4d)

- Copia Railway en `railway-local-password` tip `e280a4d…`: alta → entrar → `/auditar` **sin OTP** (Tester PASS).
- Fix previo: FormData/onInput del correo + botón «Crear mi cuenta» cambia a modo registro.
- [PR #3](https://github.com/baltacavazos/complilink_operativo_v1/pull/3) **sin merge** hasta OK Baltasar/Chief.
- Nota UX: sin Salir visible en `/auditar` (no bloqueante).
- Stripe en **pausa**. DNS/Manus intactos.

## 2026-09-04 — Auth propia (PR #3)

- Código correo+contraseña en [PR #3](https://github.com/baltacavazos/complilink_operativo_v1/pull/3) (`railway-local-password`).
- Documentado en SERVICES / DEPLOYMENT / ENVIRONMENT: `ENABLE_LOCAL_PASSWORD_AUTH`; auto si no hay Resend; ya en panel web = `1`.
- Chief despliega la rama en Railway; Tester valida. **No merge** sin OK.
- Stripe en **pausa**. DNS/Manus intactos.

## 2026-09-04 — Paquete de independencia

- Documentación de despliegue paralelo Railway vs live Manus (`auditapatron.com` sigue en Manus; DNS no cortado).
- Inventario de variables (nombres only) según README/CONFIGURACION.
- Inventario de servicios propios vs dependientes.
- Procedimiento de respaldo/recuperación Railway MySQL (pestaña **Backups** + mysqldump outline + drill).
- Auditoría en `docs/INDEPENDENCE_AUDIT_2026-09-04.md`.
- `ARCHITECTURE.md` resumen + enlace a `ARQUITECTURA.md`.
- Bloque «Independencia 2026-09-04» al inicio de `README.md`.
- Proyecto Railway `5ff3f64a-542d-4a23-b500-a430c3054daa`; URL temp `https://web-production-0391e.up.railway.app`.
