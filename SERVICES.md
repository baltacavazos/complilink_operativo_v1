# Inventario de servicios (Independencia 2026-09-04)

| Servicio | Clasificación | Estado independencia | Notas |
| --- | --- | --- | --- |
| Railway web | Propio | Paralelo temporal | `https://web-production-0391e.up.railway.app` — `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENABLE_LOCAL_PASSWORD_AUTH=1` ya en panel; desplegado tip `e280a4d` |
| Railway MySQL | Propio | **Servicio sano en el proyecto** | `5ff3f64a-542d-4a23-b500-a430c3054daa`; backups Daily en pestaña **Backups** (staged / OK Baltasar) |
| GitHub | Propio | Activo | Repo `complilink_operativo_v1` |
| Auth email/password propia | Propio | **Tester PASS** (2026-09-04) | [PR #3](https://github.com/baltacavazos/complilink_operativo_v1/pull/3) · rama `railway-local-password` · tip `e280a4d…`. Alta → entrar → `/auditar` sin OTP. **Merge pendiente** OK Baltasar/Chief. Nota UX: sin botón Salir visible en `/auditar` (no bloqueante). Live Manus no cambia. |
| Manus OAuth | Dependiente | Live en Manus | DNS no cortado |
| S3 / Forge | Dependiente | Live Manus | En copia Railway dejar OAuth/Forge vacíos |
| Dropbox | Dependiente | Era Manus (scripts README) | Independencia: dumps + off-platform |
| OpenAI | Dependiente | Según vars | |
| Gemini | Dependiente | Según vars | |
| xAI / Grok | Dependiente | Contraste multi-IA | |
| Resend | Dependiente | Correo OTP live | Sin `RESEND_API_KEY` en Railway ⇒ modo contraseña auto |
| Stripe | Dependiente | **PAUSA** | No tocar vars hasta instrucción de Chief |
| WhatsApp | Dependiente | Si se activa | |
| Bridge AuditaPatrón (HMAC/webhook) | Mixto | Config en live | Secretos fuera de Git |
| DNS `auditapatron.com` | Crítico | Sigue a Manus | **Nunca** cambiar sin OK |

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) y [docs/INDEPENDENCE_AUDIT_2026-09-04.md](./docs/INDEPENDENCE_AUDIT_2026-09-04.md).
