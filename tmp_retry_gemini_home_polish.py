import json
import os
import time
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

PROMPT = (
    'Actúa como consultor senior de producto, UX writing y posicionamiento para una landing legal-tech orientada a trabajadores en México.\n\n'
    'Necesito una recomendación de alto nivel para pulir el hero principal de AuditaPatron.\n\n'
    'Contexto actual:\n'
    + json.dumps(CURRENT_HOME_CONTEXT, ensure_ascii=False, indent=2)
    + '\n\nQuiero reforzar que Helios es el cerebro central que recopila, interpreta y ordena la información del expediente, pero sin romper la simpleza actual ni volver la interfaz intimidante.\n\n'
    + 'Devuélveme ÚNICAMENTE JSON válido con esta forma exacta:\n'
    + '{\n'
    + '  "overall_verdict": "string breve",\n'
    + '  "what_to_keep": ["string", "string", "string"],\n'
    + '  "what_to_change": ["string", "string", "string"],\n'
    + '  "hero_copy": {\n'
    + '    "badge": "string",\n'
    + '    "headline": "string",\n'
    + '    "subheadline": "string",\n'
    + '    "primary_cta": "string",\n'
    + '    "secondary_cta": "string",\n'
    + '    "trust_chips": ["string", "string", "string"]\n'
    + '  },\n'
    + '  "hero_card": {\n'
    + '    "eyebrow": "string",\n'
    + '    "title": "string",\n'
    + '    "status_label": "string",\n'
    + '    "metric_label": "string",\n'
    + '    "metric_caption": "string",\n'
    + '    "steps": ["string", "string", "string"]\n'
    + '  },\n'
    + '  "layout_guidance": ["string", "string", "string"],\n'
    + '  "risks_to_avoid": ["string", "string", "string"],\n'
    + '  "confidence": "high|medium|low"\n'
    + '}'
)

api_key = os.getenv('GEMINI_API_KEY')
result = None
error = None
if not api_key:
    result = {'error': 'GEMINI_API_KEY missing'}
else:
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    payload = {
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
    }
    for attempt in range(4):
        try:
            response = requests.post(url, headers={'Content-Type': 'application/json'}, json=payload, timeout=120)
            if response.status_code >= 500:
                raise requests.HTTPError(f'{response.status_code} Server Error: {response.text[:500]}', response=response)
            response.raise_for_status()
            data = response.json()
            content = data['candidates'][0]['content']['parts'][0]['text']
            result = {'raw': data, 'parsed': json.loads(content), 'attempts': attempt + 1}
            break
        except Exception as exc:
            error = str(exc)
            time.sleep(4 * (attempt + 1))
    if result is None:
        result = {'error': error, 'attempts': 4}

(OUT_DIR / 'gemini_retry.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'status': 'ok' if 'parsed' in result else 'error', 'attempts': result.get('attempts')}, ensure_ascii=False))
