import json
import os
from pathlib import Path

import requests

PROJECT_DIR = Path('/home/ubuntu/complilink_operativo_v1')
OUT_DIR = PROJECT_DIR / '.manus-ai'
TXT_PATH = OUT_DIR / 'auditapatron_transfer_prompt_source.txt'
OUT_PATH = OUT_DIR / 'reconstruct_consensus_gemini_retry.json'

VERIFIED_CONTEXT = """
Hechos verificados del proyecto CompliLink que deben conservarse si ayudan a la reconstrucción:
- Proyecto web actual: complilink_operativo_v1.
- Stack base verificado del proyecto: React 19 + Tailwind 4 + Express 4 + tRPC 11 + Drizzle ORM + Manus OAuth + base de datos.
- Rutas y superficies visibles verificadas: home publicada, /auditar, documentos legales publicados.
- Dominio final validado manualmente en esta iteración: https://compliapp-cgpjc3da.manus.space .
- Trabajo reciente ya validado: endurecimiento de idempotencia persistente en aceptación legal; lectura operativa mínima del embudo; validación de login, /auditar y páginas legales bajo el dominio final.
- Principio de producto recordado para CompliLink: diseño extremadamente intuitivo, limpio, mínimo y autoexplicativo.
- Principio de integración recordado: Auditapatrón aporta información documental valiosa que debe alimentar el motor de CompliLink, manteniendo identidad separada del producto Auditapatrón.
""".strip()

INSTRUCTION = """
Actúa como arquitecto de producto y continuidad técnica. Recibirás un PDF que en realidad contiene un prompt para extraer conocimiento de Auditapatrón y algunos hechos verificados del proyecto CompliLink.

Tu tarea NO es responder al prompt original, sino convertir ese material en un paquete más útil para reconstruir CompliLink en otro chat con el menor número de ambigüedades.

Devuelve JSON estricto con esta estructura:
{
  "title": "...",
  "objective": "...",
  "what_this_pdf_is_for": "...",
  "verified_facts": ["..."],
  "reconstruction_scope": ["..."],
  "architecture": {
    "frontend": "...",
    "backend": "...",
    "database": "...",
    "auth": "...",
    "integration_role_of_auditapatron": "..."
  },
  "critical_flows": [
    {
      "name": "...",
      "summary": "...",
      "priority": "alta|media|baja"
    }
  ],
  "required_modules": ["..."],
  "required_contracts": ["..."],
  "migration_order": ["..."],
  "unknowns": ["..."],
  "prompt_for_other_chat": "..."
}

Reglas obligatorias:
1. Escribe en español.
2. Separa claramente hechos verificados de supuestos.
3. Si algo no está claro, dilo como vacío o unknown, no lo inventes.
4. El campo prompt_for_other_chat debe ser un prompt copiable y muy accionable para reconstruir CompliLink.
5. Prioriza continuidad técnica, reconstrucción práctica y minimización de ambigüedad.
""".strip()


def main():
    api_key = os.environ.get('GEMINI_API_KEY')
    source_text = TXT_PATH.read_text(encoding='utf-8', errors='ignore')
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    body = {
        'system_instruction': {'parts': [{'text': INSTRUCTION}]},
        'generationConfig': {
            'temperature': 0.2,
            'responseMimeType': 'application/json',
        },
        'contents': [
            {
                'role': 'user',
                'parts': [{'text': f"CONTEXTO VERIFICADO:\n{VERIFIED_CONTEXT}\n\nTEXTO FUENTE DEL PDF:\n{source_text}"}],
            }
        ],
    }
    r = requests.post(url, headers={'Content-Type': 'application/json'}, json=body, timeout=180)
    payload = {'status_code': r.status_code}
    try:
        payload['raw'] = r.json()
    except Exception:
        payload['raw_text'] = r.text
    if r.ok:
        content = payload['raw']['candidates'][0]['content']['parts'][0]['text']
        payload['parsed'] = json.loads(content)
        payload['ok'] = True
    else:
        payload['ok'] = False
    payload['provider'] = 'gemini'
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'ok': payload['ok'], 'status_code': payload['status_code'], 'path': str(OUT_PATH)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
