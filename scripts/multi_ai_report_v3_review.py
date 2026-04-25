import json
import os
import re
import time
from pathlib import Path

import requests

ROOT = Path('/home/ubuntu/complilink_operativo_v1')
ATTACHMENT = Path('/home/ubuntu/upload/pasted_content_3.txt')
OUT = ROOT / 'tmp' / 'multi_ai_report_v3_review.json'
OUT.parent.mkdir(parents=True, exist_ok=True)

report_text = ATTACHMENT.read_text(encoding='utf-8')

home_text = (ROOT / 'client/src/pages/Home.tsx').read_text(encoding='utf-8')
auditar_text = (ROOT / 'client/src/pages/Auditar.tsx').read_text(encoding='utf-8')
ceo_text = (ROOT / 'client/src/pages/CeoDashboard.tsx').read_text(encoding='utf-8')
app_text = (ROOT / 'client/src/App.tsx').read_text(encoding='utf-8')

checks = {
    'privacy_route_public': '/legal/privacidad' in app_text,
    'cta_revisar_recibo_gratis': 'Revisar mi recibo gratis' in home_text and 'Revisar mi recibo gratis' in auditar_text,
    'hero_question_exact': '¿Tu recibo de nómina está bien o hay algo raro?' in home_text,
    'privacy_human_copy_exact': 'Tu jefe nunca se enterará. Tus documentos son tuyos. Puedes borrarlos cuando quieras. Cumplimos LFPDPPP + cifrado AES-256.' in home_text,
    'expediente_defensa_visible': 'Mi Expediente de Defensa' in ceo_text,
    'ceo_label_public_residual': 'Consola CEO' in home_text or 'Consola CEO' in auditar_text,
    'home_example_visible': 'Ver ejemplo de resultado' in home_text,
    'home_photo_hint': 'Empieza con una foto' in home_text or 'Empieza con una foto' in auditar_text,
    'social_counter_visible': 'Documentos auditados hoy' in home_text,
    'prelogin_upload_home_visible': 'type="file"' in home_text or 'capture' in home_text,
    'auditar_stepper_visible': 'Semáforo' in auditar_text and 'Siguiente paso' in auditar_text,
}

current_state = {
    'hero_summary': 'Home ya usa CTA dominante “Revisar mi recibo gratis” y un hero orientado a recibo de nómina, pero no con la pregunta exacta sugerida por el nuevo reporte.',
    'privacy_summary': 'La ruta /legal/privacidad existe como ruta pública. Hay señales de privacidad en Home y Auditar, pero no necesariamente el copy exacto de privacidad radical que pide el nuevo reporte.',
    'private_area_summary': 'La semántica visible del área privada ya fue neutralizada hacia “Mi Expediente de Defensa”.',
    'home_structure_summary': 'Home ya muestra CTA, ejemplo visual y narrativa centrada en recibo, pero aún debe medirse si realmente quedó reducida a 6-7 bloques y si el ejemplo con monto ya está en el primer scroll.',
    'prelogin_flow_summary': 'No hay evidencia concluyente en Home de un flujo de subida pre-login con hallazgo parcial inmediato; esto parece seguir pendiente o requerir implementación específica.',
    'auditar_summary': 'Auditar ya usa el CTA nuevo y tiene narrativa orientada a recibo, pero el reporte pide llevarlo a una pantalla todavía más pura de acción con stepper mínimo arriba y explicación debajo.',
    'quick_win_summary': 'No se detectó contador “Documentos auditados hoy” y no está confirmado el copy exacto “Empieza con una foto”.',
}

PROMPT = f'''Eres un auditor de producto y growth UX. Evalúa una síntesis externa de cambios para una web legal-laboral mexicana.

Necesito que clasifiques cada recomendación del reporte en cuatro grupos:
1) ya_cubierto
2) implementar_ahora
3) diferir_por_riesgo
4) no_recomendado_ahora

También necesito:
- top_5_prioridades: cinco cambios priorizados por impacto y bajo riesgo
- riesgos_clave: lista breve de riesgos concretos
- fase_1_recomendada: lote de cambios que sí ejecutarías en la siguiente ronda
- resumen_ejecutivo: máximo 180 palabras

Responde SOLO JSON válido con esta forma exacta:
{{
  "ya_cubierto": [{{"item": "", "razon": ""}}],
  "implementar_ahora": [{{"item": "", "razon": ""}}],
  "diferir_por_riesgo": [{{"item": "", "razon": ""}}],
  "no_recomendado_ahora": [{{"item": "", "razon": ""}}],
  "top_5_prioridades": [{{"item": "", "impacto": "alto|medio|bajo", "riesgo": "alto|medio|bajo"}}],
  "riesgos_clave": [""],
  "fase_1_recomendada": [""],
  "resumen_ejecutivo": ""
}}

Reporte externo:\n{report_text}\n\nEstado actual observado:\n{json.dumps(current_state, ensure_ascii=False, indent=2)}\n\nChecks rápidos del código:\n{json.dumps(checks, ensure_ascii=False, indent=2)}\n'''


def extract_json(text: str):
    text = text.strip()
    if text.startswith('```'):
        text = re.sub(r'^```(?:json)?\\s*', '', text)
        text = re.sub(r'\\s*```$', '', text)
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        text = text[start:end+1]
    return json.loads(text)


def call_openai():
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        return {'error': 'OPENAI_API_KEY missing'}
    models = ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini']
    headers = {'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}
    for model in models:
        try:
            r = requests.post(
                'https://api.openai.com/v1/chat/completions',
                headers=headers,
                json={
                    'model': model,
                    'temperature': 0.2,
                    'response_format': {'type': 'json_object'},
                    'messages': [
                        {'role': 'system', 'content': 'Responde solo JSON válido.'},
                        {'role': 'user', 'content': PROMPT},
                    ],
                },
                timeout=120,
            )
            if r.ok:
                data = r.json()
                content = data['choices'][0]['message']['content']
                return {'model': model, 'result': extract_json(content)}
            last_error = {'model': model, 'status': r.status_code, 'body': r.text[:1200]}
        except Exception as e:
            last_error = {'model': model, 'error': str(e)}
    return {'error': last_error}


def call_xai():
    key = os.environ.get('XAI_API_KEY')
    if not key:
        return {'error': 'XAI_API_KEY missing'}
    models = ['grok-4', 'grok-3-mini', 'grok-3-mini-beta']
    headers = {'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}
    for model in models:
        try:
            r = requests.post(
                'https://api.x.ai/v1/chat/completions',
                headers=headers,
                json={
                    'model': model,
                    'temperature': 0.2,
                    'response_format': {'type': 'json_object'},
                    'messages': [
                        {'role': 'system', 'content': 'Responde solo JSON válido.'},
                        {'role': 'user', 'content': PROMPT},
                    ],
                },
                timeout=120,
            )
            if r.ok:
                data = r.json()
                content = data['choices'][0]['message']['content']
                return {'model': model, 'result': extract_json(content)}
            last_error = {'model': model, 'status': r.status_code, 'body': r.text[:1200]}
        except Exception as e:
            last_error = {'model': model, 'error': str(e)}
    return {'error': last_error}


def call_gemini():
    key = os.environ.get('GEMINI_API_KEY')
    if not key:
        return {'error': 'GEMINI_API_KEY missing'}
    models = ['gemini-2.5-flash', 'gemini-2.0-flash']
    for model in models:
        try:
            url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}'
            r = requests.post(
                url,
                headers={'Content-Type': 'application/json'},
                json={
                    'generationConfig': {
                        'temperature': 0.2,
                        'responseMimeType': 'application/json',
                    },
                    'contents': [
                        {'parts': [{'text': PROMPT}]}
                    ],
                },
                timeout=120,
            )
            if r.ok:
                data = r.json()
                content = data['candidates'][0]['content']['parts'][0]['text']
                return {'model': model, 'result': extract_json(content)}
            last_error = {'model': model, 'status': r.status_code, 'body': r.text[:1200]}
        except Exception as e:
            last_error = {'model': model, 'error': str(e)}
    return {'error': last_error}


results = {
    'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
    'checks': checks,
    'current_state': current_state,
    'report_excerpt': report_text[:5000],
    'chatgpt': call_openai(),
    'grok': call_xai(),
    'gemini': call_gemini(),
}

OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(str(OUT))
