import json
import os
import subprocess
from pathlib import Path

import requests

PROJECT_DIR = Path('/home/ubuntu/complilink_operativo_v1')
OUT_DIR = PROJECT_DIR / '.manus-ai'
OUT_DIR.mkdir(parents=True, exist_ok=True)
PDF_PATH = Path('/home/ubuntu/upload/Prompt_de_extracción_técnica_desde_el_chat_de_Auditapatrón.pdf')
TXT_PATH = OUT_DIR / 'auditapatron_transfer_prompt_source.txt'

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


def extract_pdf_text():
    subprocess.run(['pdftotext', str(PDF_PATH), str(TXT_PATH)], check=True)
    return TXT_PATH.read_text(encoding='utf-8', errors='ignore')


def write_json(path: Path, payload):
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def call_openai(source_text: str):
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {"ok": False, "provider": "openai", "error": "OPENAI_API_KEY no disponible"}
    body = {
        "model": "gpt-4.1-mini",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": INSTRUCTION},
            {"role": "user", "content": f"CONTEXTO VERIFICADO:\n{VERIFIED_CONTEXT}\n\nTEXTO FUENTE DEL PDF:\n{source_text}"},
        ],
        "temperature": 0.2,
    }
    r = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json=body,
        timeout=120,
    )
    data = {'status_code': r.status_code}
    try:
        data['raw'] = r.json()
    except Exception:
        data['raw_text'] = r.text
    if r.ok:
        content = data['raw']['choices'][0]['message']['content']
        data['parsed'] = json.loads(content)
        data['ok'] = True
    else:
        data['ok'] = False
    data['provider'] = 'openai'
    return data


def call_xai(source_text: str):
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {"ok": False, "provider": "grok", "error": "XAI_API_KEY no disponible"}
    body = {
        "model": "grok-3-beta",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": INSTRUCTION},
            {"role": "user", "content": f"CONTEXTO VERIFICADO:\n{VERIFIED_CONTEXT}\n\nTEXTO FUENTE DEL PDF:\n{source_text}"},
        ],
        "temperature": 0.2,
    }
    r = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json=body,
        timeout=120,
    )
    data = {'status_code': r.status_code}
    try:
        data['raw'] = r.json()
    except Exception:
        data['raw_text'] = r.text
    if r.ok:
        content = data['raw']['choices'][0]['message']['content']
        data['parsed'] = json.loads(content)
        data['ok'] = True
    else:
        data['ok'] = False
    data['provider'] = 'grok'
    return data


def call_gemini(source_text: str):
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {"ok": False, "provider": "gemini", "error": "GEMINI_API_KEY no disponible"}
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
    r = requests.post(url, headers={'Content-Type': 'application/json'}, json=body, timeout=120)
    data = {'status_code': r.status_code}
    try:
        data['raw'] = r.json()
    except Exception:
        data['raw_text'] = r.text
    if r.ok:
        content = data['raw']['candidates'][0]['content']['parts'][0]['text']
        data['parsed'] = json.loads(content)
        data['ok'] = True
    else:
        data['ok'] = False
    data['provider'] = 'gemini'
    return data


def main():
    source_text = extract_pdf_text()
    providers = {
        'openai': call_openai(source_text),
        'grok': call_xai(source_text),
        'gemini': call_gemini(source_text),
    }
    for name, result in providers.items():
        write_json(OUT_DIR / f'reconstruct_consensus_{name}.json', result)

    summary = {
        'source_pdf': str(PDF_PATH),
        'source_txt': str(TXT_PATH),
        'providers_ok': {name: result.get('ok', False) for name, result in providers.items()},
        'available_parsed': {
            name: result.get('parsed', {})
            for name, result in providers.items()
            if result.get('ok') and result.get('parsed')
        },
    }
    write_json(OUT_DIR / 'reconstruct_consensus_summary.json', summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
