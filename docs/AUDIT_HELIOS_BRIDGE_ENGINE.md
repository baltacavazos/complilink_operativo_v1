# Auditoría Helios / bridge / motor compartido

Mapa técnico de cómo AuditaPatrón habla con HELIOS y el Shared Engine, con hallazgos P0–P2. El endurecimiento de esta ronda está en el mismo PR; no hay merge a `main`.

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
        │  POST HMAC-SHA256(timestamp + '.' + body)
        │  + Bearer <AUDITAPATRON_ENGINE_HMAC_SECRET>
        ▼
Bridge remoto (AUDITAPATRON_ENGINE_WEBHOOK_URL)
        │
        │  retorno async
        ▼
POST /api/auditapatron/complilink-webhook
POST /api/internal/helios/bridge
POST /api/integrations/auditapatron/bridge
        │
        ▼
auditaPatronReturnWebhook.ingestCompliLinkReturnPayload()
  → actualiza documento, contrato audit, opinión remota Helios
```

| Superficie | Archivo | Qué hace |
| --- | --- | --- |
| Cliente bridge saliente | `server/auditaPatronIntegrationService.ts` | Firma HMAC, Bearer, reintentos 5xx/red, health **suave**, acuse `auditapatron.bridge.ack.v1` |
| Intake local | `POST /api/auditapatron/webhook` | Valida HMAC y reenvía al bridge remoto |
| Retorno | `server/auditaPatronReturnWebhook.ts` | HMAC **o** secreto compartido; idempotencia por `eventKey` |
| Opinión Helios | `server/heliosIntegrationService.ts` | Si hay URL de bridge: estado `processing` (no inventa dictamen remoto). Si no hay URL: opinión local `mock` |
| Shared Engine | `caseContracts.buildSharedEngineEnvelope` | Sobre `document_contracts`; no es un motor externo aparte |
| Señales laborales/fiscales | `server/laborFiscalSignals.ts` | Lee recibo/CFDI. **No** consulta IMSS/SAT/Infonavit en vivo |
| Sanitización al trabajador | `server/workerVisibleExtraction.ts` + `/auditar` | Quita MIME, enums, banderas internas |

### HMAC

- Base: `HMAC-SHA256(timestamp + '.' + rawBody)`
- Headers: `X-AuditaPatron-Timestamp`, `X-AuditaPatron-Signature` (acepta prefijo `hmac-sha256:` y hex en mayúsculas)
- Ventana: 300 segundos
- Compare: `timingSafeEqual`
- El retorno también acepta `Authorization: Bearer <mismo secreto>` — contrato legado, no es un segundo secreto

## Hallazgos

### P0

1. **Health duro fingía indisponibilidad.** El preflight `/api/auditapatron/health` abortaba el despacho si devolvía HTML o un contrato distinto. Un landing 200 bloqueaba un webhook válido. **Corregido:** health es suave (`mode: "soft"`), se registra y no impide el POST.
2. **«Revalidar IMSS e Infonavit» sonaba a consulta oficial.** El cruce solo cuenta documentos y texto. **Corregido:** copy honesto + `liveImssValidation: false` + `validationMode: "document_signals"`.
3. **Campos de sistema al trabajador.** `mimeType`, `processingProfile`, `hasInfonavitSignal=true`, enums (`other`, `expanded`) filtrados de forma incompleta. **Corregido:** lista ampliada en servidor y cliente; el recibo muestra NSS/IMSS/ISR/Infonavit en lenguaje humano.

### P1

4. **Señales IMSS débiles.** Solo contaba `documentType === "imss"`. Un recibo/CFDI con NSS, cuota IMSS, SBC/SDI o registro patronal no sumaba. **Corregido** en `laborFiscalSignals`.
5. **SBC/SDI de XML iban como «estimado».**** Corregido:** atributo XML = confirmado; etiqueta de texto = estimado.
6. **Forward del intake sin Bearer.** El remoto a veces exige Bearer además de HMAC. **Corregido.**
7. **Firma hex sensible a mayúsculas.** **Corregido.**
8. **Error de red no se reintentaba.** Solo 5xx. **Corregido.** Fetch con timeout 15s.

### P2

9. **Helios remoto sigue siendo adaptador + pendiente.** No hay cliente HELIOS distinto del bridge. La opinión «completa» local es `mock` cuando no hay URL. Eso es honesto si no se vende como dictamen en vivo.
10. **Dependencias Manus.** Loopback/health para `*.manus.space` / `*.manus.computer`; OAuth Manus; keys `complilink/` en storage. No se tocó el login en esta ronda.
11. **CompliLink en eventos internos / CEO.** Títulos como «Callback de CompliLink» y `sourceModule: complilink_operativo` quedan en backend/CEO. La UI del trabajador no debe mostrar esa marca (ya hay sanitizador).
12. **Health del intake local no exige HMAC.** `GET /api/auditapatron/health` es público y solo dice «ok». Aceptable como liveness; no es prueba de que el remoto firme bien.

## Qué no se inventó

- No hay cliente IMSS/SIPARE/IDSE.
- No hay opinión de cumplimiento SAT en vivo.
- No hay «alta vigente» ni semanas cotizadas oficiales.
- Un recibo con cuota IMSS $0.00 solo prueba que el **concepto aparece** en el papel, no que el patrón esté al corriente.
