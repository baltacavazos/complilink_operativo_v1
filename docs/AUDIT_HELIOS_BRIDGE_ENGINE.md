# Auditoría Helios / bridge / motor compartido

Mapa técnico **autoritativo** de cómo AuditaPatrón habla con HELIOS y el Shared Engine. El endurecimiento está en este PR; **no hay merge a `main`**.

## Mapa de integración

```
Trabajador (/auditar)
        │  tRPC
        ▼
server/routers.ts
  1. clasifica (caseContracts.classifyMexicanLaborDocument)
  2. extrae (buildPreliminaryLaborAnalysis)
  3. arma contratos canónicos:
       document + classification + shared_engine + helios_v1
  4. despacha sendDocumentToAuditaPatronEngine()
        │
        │  POST event = document.uploaded
        │  HMAC-SHA256(timestamp + '.' + body)
        │  headers X-AuditaPatron-Signature + X-AuditaPatron-Timestamp
        │  reintentos 30/60/120s ante 5xx o error de red
        ▼
Bridge remoto (si existe AUDITAPATRON_ENGINE_WEBHOOK_URL)
        │
        │  retorno async
        ▼
POST /api/auditapatron/webhook
POST /api/auditapatron/complilink-webhook
POST /api/internal/helios/bridge
POST /api/integrations/auditapatron/bridge
        │
        ▼
auditaPatronReturnWebhook.ingestCompliLinkReturnPayload()
  → actualiza documento, contrato audit, opinión remota Helios
```

### Catálogo de eventos

| Dirección | Evento | Dónde se acepta |
| --- | --- | --- |
| Saliente | `document.uploaded` | Tras guardar, `sendDocumentToAuditaPatronEngine` |
| Entrante | `document.processed.v1` | `/api/auditapatron/webhook` y `/api/auditapatron/complilink-webhook` |
| Entrante | `document.rejected.v1` | mismos endpoints |
| Entrante | `document.retry_requested.v1` | mismos endpoints |

Cualquier otro nombre se rechaza con `unknown_event` y se registra en log. No se muestra Helios, CompliLink ni “webhook” al trabajador.

`/api/auditapatron/webhook` también sigue reenviando `document.uploaded` al remoto (intake). Los tres eventos de retorno se ingieren en local.

| Superficie | Archivo | Qué hace |
| --- | --- | --- |
| Cliente bridge saliente | `server/auditaPatronIntegrationService.ts` | Firma HMAC, Bearer, reintentos 5xx/red, health **suave**, catálogo de eventos, acuse `auditapatron.bridge.ack.v1` |
| Intake + retorno | `POST /api/auditapatron/webhook` | HMAC. `document.uploaded` se reenvía; los eventos v1 se ingieren |
| Retorno | `POST /api/auditapatron/complilink-webhook` | HMAC **o** secreto compartido; idempotencia por `eventKey` con replay seguro |
| Opinión Helios | `server/heliosIntegrationService.ts` | URL presente → remoto. Envío OK → `processing`. Envío fallido → `error` en español, **sin dictamen inventado**. Sin URL → plantilla `mock` (no es el cerebro en vivo) |
| Shared Engine | `caseContracts.buildSharedEngineEnvelope` | Sobre `document_contracts`; no es un motor externo aparte |
| Señales laborales/fiscales | `server/laborFiscalSignals.ts` | Lee recibo/CFDI: periodo, montos, retenciones, RFC/NSS si aparecen, con explicación en español. **No** consulta IMSS/SAT/Infonavit en vivo. Si el cerebro remoto ya devolvió opinión, se prefiere. Si solo hay plantilla, se etiqueta **revisión local**. |
| Sanitización al trabajador | `server/workerVisibleExtraction.ts` + `/auditar` | Quita MIME, enums, banderas, nombres de evento y hashes |
| Inventario Fase 0 | `server/auditaPatronBridgeInventory.ts` | Completitud = URL + HMAC. No exige `API_KEY_HELIOS` |

### HMAC

- Base: `HMAC-SHA256(timestamp + '.' + rawBody)`
- Headers: `X-AuditaPatron-Timestamp`, `X-AuditaPatron-Signature` (acepta prefijo `hmac-sha256:` y hex en mayúsculas)
- Ventana: 300 segundos (~5 min)
- Compare: `timingSafeEqual`
- El retorno en `/complilink-webhook` también acepta `Authorization: Bearer <mismo secreto>` — contrato legado, no es un segundo secreto
- `/api/auditapatron/webhook` exige HMAC

### Modo remoto vs mock

- Si `AUDITAPATRON_ENGINE_WEBHOOK_URL` está definida → remoto (en progreso + despacho).
- Si no → plantilla local mock. **No es el cerebro en vivo.**
- Railway web tiene: `AUDITAPATRON_ENGINE_WEBHOOK_URL`, `AUDITAPATRON_ENGINE_HMAC_SECRET`, `OPENAI_API_KEY`, `GEMINI_API_KEY`.
- **No** usa `API_KEY_HELIOS`. Esa clave no decide el modo ni la completitud del puente.

### Qué usa del cerebro

Resumen, opinión jurídica, riesgo, confianza, hechos clave, incertidumbre, tarjeta de resultado, bases legales y siguiente paso. `heliosCalculatorService` lee montos de `heliosOpinion`. Freemium: 1 documento básico.

### Idempotencia de retorno

Tabla `complilink_webhook_events`, llave única `eventKey`.

- Ya `processed` → acuse duplicado, no se vuelve a aplicar.
- `failed_processing` o `processing` estancado (>2 min) → replay seguro.
- `processing` fresco → se trata como en vuelo.

## Hallazgos

### P0

1. **Health duro fingía indisponibilidad.** Corregido: health suave (`mode: "soft"`).
2. **«Revalidar IMSS e Infonavit» sonaba a consulta oficial.** Corregido: copy honesto + `liveImssValidation: false`.
3. **Campos de sistema al trabajador.** Corregido en servidor y cliente; se ocultan también eventos internos y hashes.

### P1

4. **Señales IMSS débiles.** Corregido en `laborFiscalSignals`.
5. **SBC/SDI de XML iban como «estimado».** Corregido.
6. **Forward del intake sin Bearer.** Corregido.
7. **Firma hex sensible a mayúsculas.** Corregido.
8. **Error de red no se reintentaba.** Corregido.
9. **`/webhook` no aceptaba el catálogo de retorno.** Corregido: mismos eventos v1 que `/complilink-webhook`.
10. **Replay de retorno inseguro.** Un `failed_processing` se tragaba como duplicado. Corregido.
11. **Opinión pendiente se quedaba aunque el puente fallara.** Corregido: mensaje honesto en español, sin dictamen inventado.

### P2

12. **Helios remoto sigue siendo adaptador + pendiente.** No hay cliente HELIOS distinto del bridge.
13. **Dependencias Manus.** No se tocó el login.
14. **Health del intake local no exige HMAC.** `GET /api/auditapatron/health` es liveness + inventario booleano Fase 0.

## Qué no se inventó

- No hay cliente IMSS/SIPARE/IDSE.
- No hay opinión de cumplimiento SAT en vivo.
- No hay «alta vigente» ni semanas cotizadas oficiales.
- Un recibo con cuota IMSS $0.00 solo prueba que el **concepto aparece** en el papel, no que el patrón esté al corriente.
- No se tocó la base del motor Helios de CompliLink.

## Checklist E2E para Tester (después de aterrizar el PR)

Corrida controlada, no automática en este agente:

1. Subir un recibo o contrato en `/auditar` (cuenta de prueba).
2. Confirmar que el acuse de envío aparece en lenguaje de trabajador: “revisión avanzada”, **sin** Helios / CompliLink / webhook.
3. Verificar en logs/ops que salió `document.uploaded` firmado (headers `X-AuditaPatron-Signature` + `X-AuditaPatron-Timestamp`).
4. Disparar (o esperar) un retorno `document.processed.v1` al webhook.
5. Recargar `/auditar`: resumen, opinión, riesgo, confianza, hechos, incertidumbre, tarjeta, bases y siguiente paso deben verse.
6. Repetir el mismo `eventId`: la UI no debe duplicar el resultado (replay idempotente).
7. Caso de fallo del puente: el trabajador ve que el archivo **sí se guardó** y que **no hay dictamen inventado**.
8. No debe aparecer MIME, enums internos ni `document.processed.v1` en la vista del trabajador.
