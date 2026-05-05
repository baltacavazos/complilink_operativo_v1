#!/usr/bin/env python3
import json
import os
import re
from pathlib import Path

import requests

ROOT = Path('/home/ubuntu/complilink_operativo_v1')
AUDITAR = ROOT / 'client/src/pages/Auditar.tsx'
HOME = ROOT / 'client/src/pages/Home.tsx'
OUT = ROOT / 'postupload_hero_home_model_compare.json'


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def extract_block(text: str, start_marker: str, end_marker: str, fallback_chars: int = 3000) -> str:
    start = text.find(start_marker)
    if start == -1:
        return text[:fallback_chars]
    end = text.find(end_marker, start + len(start_marker))
    if end == -1:
        return text[start:start + fallback_chars]
    return text[start:end]


auditar_text = read(AUDITAR)
home_text = read(HOME)

auditar_block = extract_block(
    auditar_text,
    'shouldCompactPostUploadExperience ? `${getSimpleDocumentTypeLabel(lastUpload.classification.documentType)} confirmado`',
    '<div className={shouldCompactPostUploadExperience ? "hidden" : "rounded-[1.7rem] border border-teal-100',
)

home_example_block = extract_block(
    home_text,
    'const activeReportDemoCopy = useMemo(() => {',
    'const activeHeroInsight = heroInsights[selectedHeroVariant];',
)

home_card_block = extract_block(
    home_text,
    '<div className="rounded-[1.4rem] border border-teal-100/80',
    '<div className="mt-5 rounded-[1.3rem] border border-white/90 bg-white/92 p-4 shadow-sm">',
)

system_prompt = (
    'Eres un director de producto y UX writer senior para una app móvil en México que audita documentos laborales. '
    'Tu tarea es proponer microajustes de alto impacto y bajo riesgo. Responde SIEMPRE en JSON válido.'
)

user_prompt = f'''Analiza estos dos frentes de UX y propone un corte de cambios mínimo, claro y muy accionable:

1) /auditar post-upload móvil: el hero del veredicto aún ocupa demasiado alto en el primer viewport. Queremos que estado, veredicto y CTA principal entren antes, sin perder claridad ni confianza.
2) Home: el ejemplo de resultado debe quedar alineado con el microcopy contextual por tipo de documento que ya existe en /auditar, para que la promesa pública no se sienta genérica.

Objetivo de negocio y UX:
- cercanía institucional, no frío ni técnico
- máxima claridad para usuario no experto
- móvil primero
- sin reintroducir ruido visual
- CTA dominante único
- consistencia narrativa entre Home y /auditar

Devuélveme JSON con esta estructura exacta:
{{
  "diagnosis": ["hallazgo 1", "hallazgo 2", "hallazgo 3"],
  "auditar_changes": [
    {{"priority": 1, "change": "...", "why": "...", "risk": "low|medium"}},
    {{"priority": 2, "change": "...", "why": "...", "risk": "low|medium"}},
    {{"priority": 3, "change": "...", "why": "...", "risk": "low|medium"}}
  ],
  "home_changes": [
    {{"priority": 1, "change": "...", "why": "...", "risk": "low|medium"}},
    {{"priority": 2, "change": "...", "why": "...", "risk": "low|medium"}},
    {{"priority": 3, "change": "...", "why": "...", "risk": "low|medium"}}
  ],
  "microcopy_examples": {{
    "auditar_status": "...",
    "auditar_cta": "...",
    "home_example_title": "...",
    "home_example_description": "..."
  }},
  "recommended_minimal_cut": ["cambio 1", "cambio 2", "cambio 3"]
}}

Fragmento actual de /auditar:
```tsx
{auditar_block}
```

Fragmentos actuales de Home:
```tsx
{home_example_block}
```

```tsx
{home_card_block}
```
'''


def call_openai():
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY missing'}
    r = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json={
            'model': 'gpt-4.1-mini',
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt},
            ],
            'temperature': 0.5,
        },
        timeout=90,
    )
    return {'status_code': r.status_code, 'body': r.json()}


def call_grok():
    api_key = os.getenv('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY missing'}
    r = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json={
            'model': 'grok-4-fast-non-reasoning',
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt},
            ],
            'temperature': 0.5,
        },
        timeout=90,
    )
    return {'status_code': r.status_code, 'body': r.json()}


def call_gemini():
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY missing'}
    payload = {
        'system_instruction': {'parts': [{'text': system_prompt}]},
        'generationConfig': {
            'temperature': 0.5,
            'responseMimeType': 'application/json',
        },
        'contents': [
            {
                'role': 'user',
                'parts': [{'text': user_prompt}],
            }
        ],
    }
    url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
    r = requests.post(url, params={'key': api_key}, json=payload, timeout=90)
    return {'status_code': r.status_code, 'body': r.json()}


result = {
    'inputs': {
        'auditar_excerpt': auditar_block,
        'home_copy_excerpt': home_example_block,
        'home_card_excerpt': home_card_block,
    },
    'openai': call_openai(),
    'grok': call_grok(),
    'gemini': call_gemini(),
}

OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(str(OUT))
