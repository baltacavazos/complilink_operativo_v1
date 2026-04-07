import json
import os
from pathlib import Path

import requests

BASE_DIR = Path('/home/ubuntu/complilink_operativo_v1')
OUT_DIR = BASE_DIR / 'research' / 'home_helios_polish'
OUT_DIR.mkdir(parents=True, exist_ok=True)

CURRENT_HOME_CONTEXT = {
    'brand': 'AuditaPatron',
    'goal': 'Reforzar a Helios como cerebro central que interpreta el expediente, sin perder sencillez, confianza y lenguaje humano.',
    'current_header_nav': ['Cómo funciona', 'Tu expediente', 'Hallazgos', 'Privacidad', 'Preguntas'],
    'current_hero_badge': 'Diseñado para trabajadores, no para expertos',
    'current_hero_title_mobile': 'Derechos claros y protegidos',
    'current_hero_title_desktop': 'Tus derechos laborales, claros, protegidos y mejor respaldados.',
    'current_hero_subtitle': 'Entiende tus documentos, separa lo claro de lo estimado y fortalece tu expediente sin complicaciones.',
    'current_ctas': ['Auditar mis documentos', 'Ver cómo funciona'],
    'current_trust_chips': ['100% confidencial', 'Sin jerga legal', 'Separa hechos de suposiciones'],
    'current_card_eyebrow': 'Fortaleza inicial del expediente',
    'current_card_title': 'Tu expediente empieza a fortalecerse',
    'current_card_status': 'Protegido',
    'current_card_metric_label': 'Claridad acumulada',
    'current_card_metric_value': '58%',
    'current_card_metric_caption': 'Más documentos útiles te dan más claridad para comparar cambios y cuidar tu respaldo.',
    'current_card_steps': [
        'Sube recibo, contrato o CFDI.',
        'Ve lo importante con palabras simples.',
        'Sabe qué documento puede ayudarte después.'
    ],
    'constraints': [
        'No sonar técnico ni grandilocuente.',
        'Helios debe sentirse como motor central, no como gadget separado.',
        'La experiencia debe seguir siendo mobile-first y autoexplicativa.',
        'Evitar promesas legales absolutas o lenguaje que parezca asesoría definitiva.',
        'Mantener una estética sobria, clara y moderna.'
    ],
}

PROMPT = f"""
Actúa como consultor senior de producto, UX writing y posicionamiento para una landing legal-tech orientada a trabajadores en México.

Necesito una recomendación de alto nivel para pulir el hero principal de AuditaPatron.

Contexto actual:
{json.dumps(CURRENT_HOME_CONTEXT, ensure_ascii=False, indent=2)}

Quiero reforzar que Helios es el cerebro central que recopila, interpreta y ordena la información del expediente, pero sin romper la simpleza actual ni volver la interfaz intimidante.

Devuélveme ÚNICAMENTE JSON válido con esta forma exacta:
{{
  "overall_verdict": "string breve",
  "what_to_keep": ["string", "string", "string"],
  "what_to_change": ["string", "string", "string"],
  "hero_copy": {{
    "badge": "string",
    "headline": "string",
    "subheadline": "string",
    "primary_cta": "string",
    "secondary_cta": "string",
    "trust_chips": ["string", "string", "string"]
  }},
  "hero_card": {{
    "eyebrow": "string",
    "title": "string",
    "status_label": "string",
    "metric_label": "string",
    "metric_caption": "string",
    "steps": ["string", "string", "string"]
  }},
  "layout_guidance": ["string", "string", "string"],
  "risks_to_avoid": ["string", "string", "string"],
  "confidence": "high|medium|low"
}}
""".strip()


def save(name: str, payload: dict):
    path = OUT_DIR / f'{name}.json'
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return str(path)


def call_openai():
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY missing'}
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'gpt-4.1-mini',
            'temperature': 0.4,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Eres un experto en UX writing, producto y positioning. Responde solo JSON válido.'},
                {'role': 'user', 'content': PROMPT},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    content = data['choices'][0]['message']['content']
    return {'raw': data, 'parsed': json.loads(content)}


def call_gemini():
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY missing'}
    response = requests.post(
        f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}',
        headers={'Content-Type': 'application/json'},
        json={
            'generationConfig': {
                'temperature': 0.4,
                'responseMimeType': 'application/json',
            },
            'contents': [
                {
                    'role': 'user',
                    'parts': [{'text': PROMPT}],
                }
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    content = data['candidates'][0]['content']['parts'][0]['text']
    return {'raw': data, 'parsed': json.loads(content)}


def call_grok():
    api_key = os.getenv('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY missing'}
    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'grok-4',
            'temperature': 0.4,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Eres un experto en UX writing, producto y positioning. Responde solo JSON válido.'},
                {'role': 'user', 'content': PROMPT},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    content = data['choices'][0]['message']['content']
    return {'raw': data, 'parsed': json.loads(content)}


results = {}
for name, fn in [('openai', call_openai), ('gemini', call_gemini), ('grok', call_grok)]:
    try:
        result = fn()
    except Exception as exc:
        result = {'error': str(exc)}
    results[name] = result
    save(name, result)

summary = {
    'prompt_context': CURRENT_HOME_CONTEXT,
    'outputs': {k: ('ok' if 'parsed' in v else 'error') for k, v in results.items()},
}
save('summary', summary)
print(json.dumps(summary, ensure_ascii=False, indent=2))
