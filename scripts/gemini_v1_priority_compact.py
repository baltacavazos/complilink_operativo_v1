#!/usr/bin/env python3
import json
import os
from pathlib import Path

import requests

BASE = Path('/home/ubuntu/complilink_operativo_v1/.manus-ai')
BASE.mkdir(exist_ok=True)
api_key = os.environ['GEMINI_API_KEY']

prompt = '''
Eres un arquitecto senior de SaaS legal B2B.

Contexto real resumido:
- Producto: ecosistema AuditaPatron + CompliLink + Helios.
- Objetivo: cerrar V1 robusta y lista para piloto web controlado.
- Restricción: no agregar features nuevas; solo robustecer lo existente.
- Flujo crítico validado: login -> /auditar -> aceptación legal -> carga documental.
- Backlog abierto: hash chain de auditoría, alertas operativas accionables, RBAC granular tenant/caso, validaciones de workflows, bitácora/monitoreo, backup/recuperación, integración Helios/AuditaPatron/CompliLink, simplificación UX, pruebas E2E críticas, preparación móvil sin rehacer arquitectura.
- Prioridad de negocio: seguridad, operación, integración completa y pruebas.

Devuelve SOLO JSON con esta forma exacta:
{
  "top_5": [
    {"rank":1,"name":"...","category":"security|ops|integration|ux|testing|mobile","why_now":"...","deliverables":["..."],"risk_if_skipped":"..."}
  ],
  "recommended_next_block": {"name":"...","why":"...","deliverables":["..."],"tests":["..."]},
  "mobile_transition_note":"...",
  "warnings":["..."]
}
'''.strip()

url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
body = {
    'contents': [{'parts': [{'text': prompt}]}],
    'generationConfig': {'temperature': 0.15, 'responseMimeType': 'application/json'}
}
r = requests.post(url, headers={'Content-Type': 'application/json'}, json=body, timeout=60)
r.raise_for_status()
data = r.json()
text = data['candidates'][0]['content']['parts'][0]['text']
parsed = json.loads(text)
(BASE / 'v1_priority_gemini_compact.json').write_text(json.dumps(parsed, ensure_ascii=False, indent=2))
print(json.dumps(parsed, ensure_ascii=False, indent=2))
