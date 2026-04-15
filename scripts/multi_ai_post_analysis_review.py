import json
import os
from pathlib import Path
import requests

FINDINGS_PATH = Path('/home/ubuntu/complilink_operativo_v1/.manus-logs/post_analysis_pdf_findings_2026-04-15.txt')
OUTPUT_PATH = Path('/home/ubuntu/complilink_operativo_v1/.manus-logs/multi_ai_post_analysis_review.json')

findings = FINDINGS_PATH.read_text(encoding='utf-8')

prompt = f"""
Eres un experto en UX móvil para productos legales/documentales.

Contexto:
- Un usuario sube un documento en la pantalla /auditar de AuditaPatron.
- El documento sí se analiza, pero la experiencia posterior no se siente mágica.
- El usuario se queja de que la pantalla resultante es demasiado larga y rompe la regla de experiencia compacta.

Hallazgos observados en la evidencia visual:
{findings}

Necesito una respuesta breve y concreta en JSON con esta forma exacta:
{{
  "root_cause": "texto corto",
  "why_no_magic": ["punto 1", "punto 2", "punto 3"],
  "keep_visible_above_fold": ["elemento 1", "elemento 2", "elemento 3", "elemento 4"],
  "move_below_fold_or_collapse": ["elemento 1", "elemento 2", "elemento 3", "elemento 4"],
  "ux_principle": "una sola frase",
  "recommended_layout": "una sola frase",
  "first_fix": "una sola acción prioritaria"
}}

Reglas:
- Enfócate en móvil.
- No propongas features nuevas.
- Prioriza jerarquía, longitud, claridad inmediata y sensación de resultado instantáneo.
- Responde solo JSON válido.
""".strip()


def call_openai():
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        return {"error": "OPENAI_API_KEY missing"}
    r = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'gpt-4.1-mini',
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Responde únicamente JSON válido.'},
                {'role': 'user', 'content': prompt},
            ],
        },
        timeout=90,
    )
    return {'status_code': r.status_code, 'body': r.json()}


def call_grok():
    api_key = os.getenv('XAI_API_KEY')
    if not api_key:
        return {"error": "XAI_API_KEY missing"}
    r = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'grok-4-0709',
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Responde únicamente JSON válido.'},
                {'role': 'user', 'content': prompt},
            ],
        },
        timeout=90,
    )
    return {'status_code': r.status_code, 'body': r.json()}


def call_gemini():
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        return {"error": "GEMINI_API_KEY missing"}
    r = requests.post(
        f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}',
        headers={'Content-Type': 'application/json'},
        json={
            'generationConfig': {
                'temperature': 0.2,
                'responseMimeType': 'application/json',
            },
            'contents': [
                {
                    'role': 'user',
                    'parts': [{'text': prompt}],
                }
            ],
        },
        timeout=90,
    )
    return {'status_code': r.status_code, 'body': r.json()}


results = {
    'openai': call_openai(),
    'grok': call_grok(),
    'gemini': call_gemini(),
}

OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(str(OUTPUT_PATH))
