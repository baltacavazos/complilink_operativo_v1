# Architecture (Independencia 2026-09-04)

Resumen sencillo. Detalle histórico en [ARQUITECTURA.md](./ARQUITECTURA.md).

## Vista actual (dos tracks)

```
Usuarios ──DNS──► auditapatron.com (Manus LIVE)
                      │
                      └── OAuth Manus, Forge/S3, integraciones live

Dueño / QA ──────► web-production-0391e.up.railway.app (Railway PARALELO)
                      │
                      ├── Auth propia email/password: PENDIENTE
                      └── MySQL Railway (proyecto 5ff3f64a-…)
```

## Capas

| Capa | Tecnología | Notas independencia |
| --- | --- | --- |
| Frontend | React 19 + Vite + Tailwind | Flujo `/auditar` |
| API | Express + tRPC | |
| Datos | Drizzle + MySQL | Railway en paralelo |
| Auth | Manus OAuth en live; propia pendiente en Railway | Bloqueante para cutover |
| Storage | S3/Forge Manus-era | Migrar cuando se defina |
| Correo / IA | Resend, OpenAI, Gemini, xAI | Dependientes |

## Documentos cruzados

- [ARQUITECTURA.md](./ARQUITECTURA.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [SERVICES.md](./SERVICES.md)
- [docs/INDEPENDENCE_AUDIT_2026-09-04.md](./docs/INDEPENDENCE_AUDIT_2026-09-04.md)
