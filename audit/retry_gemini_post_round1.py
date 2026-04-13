import json
import os
from pathlib import Path

import requests

BASE = Path('/home/ubuntu/complilink_operativo_v1/audit')
OUT = BASE / 'outputs'

SYSTEM_MSG = (
    'Eres un auditor senior de producto digital. Analizas con severidad profesional, '
    'prioridad mobile-first y foco en claridad, confianza, jerarquía visual, arquitectura visible y robustez percibida.'
)


def safe_read(path: Path, limit: int | None = None) -> str:
    text = path.read_text(encoding='utf-8')
    return text[:limit] if limit else text


prompt = '\n\n'.join(
    [
        '## OBJETIVO\nCompleta una reauditoría post-ronda de AuditaPatron y emite una calificación global sobre 10.',
        '## HALLAZGOS_DE_VALIDACION_VIVA\n' + safe_read(BASE / 'post_round1_live_notes.md', 8000),
        '## CHATGPT_POST_RONDA\n' + safe_read(OUT / 'chatgpt_audit.md', 8000),
        '## GROK_POST_RONDA\n' + safe_read(OUT / 'grok_audit.md', 8000),
        '## ACCESS_SOURCE\n' + safe_read(Path('/home/ubuntu/complilink_operativo_v1/client/src/pages/Access.tsx'), 9000),
        '## AUDITAR_SOURCE\n' + safe_read(Path('/home/ubuntu/complilink_operativo_v1/client/src/pages/Auditar.tsx'), 9000),
        '## CEO_SOURCE\n' + safe_read(Path('/home/ubuntu/complilink_operativo_v1/client/src/pages/CeoDashboard.tsx'), 9000),
        '## INSTRUCCION\nResponde en español con estas secciones exactas: 1. Calificación global, 2. Coincidencias con ChatGPT y Grok, 3. Diferencias relevantes, 4. Top 5 cambios de mayor impacto para subir la nota, 5. Veredicto final.'
    ]
)

api_key = os.environ.get('GEMINI_API_KEY')
if not api_key:
    raise SystemExit('GEMINI_API_KEY no disponible')

url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
payload = {
    'system_instruction': {'parts': [{'text': SYSTEM_MSG}]},
    'contents': [{'role': 'user', 'parts': [{'text': prompt}]}],
    'generationConfig': {'temperature': 0.2},
}

response = requests.post(url, headers={'Content-Type': 'application/json'}, json=payload, timeout=180)
response.raise_for_status()
data = response.json()
parts = []
for candidate in data.get('candidates', []):
    for part in candidate.get('content', {}).get('parts', []):
        text = part.get('text')
        if text:
            parts.append(text)
content = '\n'.join(parts).strip()
(OUT / 'gemini_post_round1_retry.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
(OUT / 'gemini_post_round1_retry.md').write_text(content, encoding='utf-8')
print(content)
