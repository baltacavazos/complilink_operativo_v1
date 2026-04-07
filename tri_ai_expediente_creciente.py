import json
import os
from datetime import datetime, timezone
from pathlib import Path

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
REPORT_PATH = PROJECT_ROOT / 'tri_ai_expediente_creciente.md'
JSON_PATH = PROJECT_ROOT / 'tri_ai_expediente_creciente_output.json'
HOME_PATH = PROJECT_ROOT / 'client/src/pages/Home.tsx'
STATE_BRIEF_PATH = Path('/home/ubuntu/upload/auditapatron_state_brief.md')


def read_text(path: Path, limit: int = 18000) -> str:
    try:
        content = path.read_text(encoding='utf-8')
    except FileNotFoundError:
        return f'[missing file: {path}]'
    if len(content) <= limit:
        return content
    return content[:limit] + '\n\n[truncated]'


HOME_CONTENT = read_text(HOME_PATH, 18000)
STATE_BRIEF = read_text(STATE_BRIEF_PATH, 14000)

SYSTEM_PROMPT = '''
Eres un estratega de producto, growth ético, UX writing y confianza del usuario.
Tu tarea es evaluar una decisión de producto para AuditaPatron.

AuditaPatron ayuda a trabajadores mexicanos a subir recibos, CFDI y documentos laborales para entender su situación, detectar posibles incumplimientos, conservar evidencia y construir un expediente útil.

Debes evaluar si conviene reforzar esta idea dentro del producto y de la homepage:
"Entre más documentos sube el trabajador, más crece su expediente y mayores beneficios obtiene."

Pero debes hacerlo con sensibilidad ética.
No queremos que se sienta manipulador, gamificado de forma infantil, explotador de datos ni confuso.
Sí queremos que se sienta útil, protector, claro, constructivo y motivador.

Responde SOLO JSON válido con esta forma exacta:
{
  "verdict": "string",
  "is_good_idea": true,
  "why_it_works": ["string"],
  "main_risks": ["string"],
  "ethical_guardrails": ["string"],
  "best_positioning": "string",
  "best_user_promise": "string",
  "benefits_to_explain": ["string"],
  "copy_examples": {
    "homepage_message": "string",
    "microcopy_after_upload": "string",
    "expedient_widget_title": "string",
    "expedient_widget_description": "string"
  },
  "implementation_recommendations": {
    "homepage": ["string"],
    "upload_flow": ["string"],
    "history_or_dashboard": ["string"],
    "avoid": ["string"]
  },
  "motivation_model": "string",
  "priority_level": "high|medium|low",
  "recommended_next_step": "string"
}
No agregues markdown ni texto fuera del JSON.
'''.strip()

USER_PROMPT = f'''
Quiero deliberar si esta idea es buena para AuditaPatron:

"Reforzar al cliente que, entre más documentos suba, más crece su expediente y más beneficios obtiene".

Objetivo real:
- aumentar valor percibido para el trabajador;
- motivar más carga documental útil;
- fortalecer el expediente del usuario;
- alimentar mejor el motor inteligente con más contexto documental;
- hacerlo de manera ética, clara y muy user friendly.

Restricciones importantes:
- No debe sentirse como manipulación de datos.
- No debe parecer que premiamos subir por subir.
- No debe sonar infantil ni como juego barato.
- Debe ser entendible para trabajadores masivos, no para expertos.
- Debe reforzar confianza, privacidad y utilidad real.
- Debe venderse como algo constructivo: mientras más ordenado y completo esté tu expediente, mejor te podemos explicar, proteger y respaldar.

Contexto del producto:
{STATE_BRIEF}

Homepage actual de AuditaPatron:
{HOME_CONTENT}

Tu trabajo:
1. Decide si esta idea es realmente buena o si tiene riesgos fuertes.
2. Explica cómo presentarla sin erosionar confianza.
3. Define la mejor promesa al usuario.
4. Propón en qué partes del producto debe aparecer.
5. Da ejemplos de copy concretos.
6. Explica qué debemos evitar por completo.
7. Piensa tanto en conversión como en ética y claridad.
'''.strip()


def parse_json_text(raw_text: str):
    raw_text = raw_text.strip()
    if raw_text.startswith('```'):
        raw_text = raw_text.strip('`')
        raw_text = raw_text.replace('json\n', '', 1).strip()
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        start = raw_text.find('{')
        end = raw_text.rfind('}')
        if start != -1 and end != -1 and end > start:
            return json.loads(raw_text[start:end + 1])
        raise


def call_openai(api_key: str):
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'gpt-4o-mini',
            'temperature': 0.3,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': USER_PROMPT},
            ],
        },
        timeout=180,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload['choices'][0]['message']['content']
    return parse_json_text(content)


def call_grok(api_key: str):
    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'grok-3-mini',
            'temperature': 0.3,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': USER_PROMPT},
            ],
        },
        timeout=180,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload['choices'][0]['message']['content']
    return parse_json_text(content)


def call_gemini(api_key: str):
    response = requests.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        params={'key': api_key},
        headers={'Content-Type': 'application/json'},
        json={
            'system_instruction': {'parts': [{'text': SYSTEM_PROMPT}]},
            'contents': [{'parts': [{'text': USER_PROMPT}]}],
            'generationConfig': {
                'temperature': 0.3,
                'responseMimeType': 'application/json',
            },
        },
        timeout=180,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload['candidates'][0]['content']['parts'][0]['text']
    return parse_json_text(content)


def safe_call(name: str, fn, api_key: str | None):
    if not api_key:
        return {'error': f'{name}: missing API key'}
    try:
        return fn(api_key)
    except Exception as exc:
        return {'error': f'{name}: {type(exc).__name__}: {exc}'}


def uniq(items):
    seen = set()
    ordered = []
    for item in items:
        if item is None:
            continue
        text = ' '.join(str(item).split()).strip()
        key = text.lower()
        if not text or key in seen:
            continue
        seen.add(key)
        ordered.append(text)
    return ordered


def build_consensus(results: dict):
    verdicts = []
    positives = []
    risks = []
    guardrails = []
    positioning = []
    promises = []
    benefits = []
    homepage_messages = []
    post_upload = []
    widget_titles = []
    widget_descriptions = []
    impl_home = []
    impl_upload = []
    impl_history = []
    avoid = []
    motivation = []
    priority = []
    next_steps = []

    for model_name, payload in results.items():
        if not isinstance(payload, dict) or payload.get('error'):
            continue
        verdicts.append(f"{model_name}: {payload.get('verdict', 'Sin veredicto')}")
        if 'is_good_idea' in payload:
            positives.append(f"{model_name}: {'sí' if payload.get('is_good_idea') else 'no'}")
        risks.extend(payload.get('main_risks', []))
        guardrails.extend(payload.get('ethical_guardrails', []))
        if payload.get('best_positioning'):
            positioning.append(f"{model_name}: {payload['best_positioning']}")
        if payload.get('best_user_promise'):
            promises.append(f"{model_name}: {payload['best_user_promise']}")
        benefits.extend(payload.get('benefits_to_explain', []))
        copy_examples = payload.get('copy_examples') or {}
        if copy_examples.get('homepage_message'):
            homepage_messages.append(f"{model_name}: {copy_examples['homepage_message']}")
        if copy_examples.get('microcopy_after_upload'):
            post_upload.append(f"{model_name}: {copy_examples['microcopy_after_upload']}")
        if copy_examples.get('expedient_widget_title'):
            widget_titles.append(copy_examples['expedient_widget_title'])
        if copy_examples.get('expedient_widget_description'):
            widget_descriptions.append(copy_examples['expedient_widget_description'])
        impl = payload.get('implementation_recommendations') or {}
        impl_home.extend(impl.get('homepage', []))
        impl_upload.extend(impl.get('upload_flow', []))
        impl_history.extend(impl.get('history_or_dashboard', []))
        avoid.extend(impl.get('avoid', []))
        if payload.get('motivation_model'):
            motivation.append(f"{model_name}: {payload['motivation_model']}")
        if payload.get('priority_level'):
            priority.append(f"{model_name}: {payload['priority_level']}")
        if payload.get('recommended_next_step'):
            next_steps.append(f"{model_name}: {payload['recommended_next_step']}")
        positives.extend(payload.get('why_it_works', []))

    return {
        'verdicts': uniq(verdicts),
        'idea_assessment': uniq(positives)[:12],
        'main_risks': uniq(risks)[:12],
        'ethical_guardrails': uniq(guardrails)[:12],
        'best_positioning': uniq(positioning)[:6],
        'best_user_promise': uniq(promises)[:6],
        'benefits_to_explain': uniq(benefits)[:12],
        'homepage_message_candidates': uniq(homepage_messages)[:6],
        'post_upload_microcopy_candidates': uniq(post_upload)[:6],
        'expedient_widget_titles': uniq(widget_titles)[:6],
        'expedient_widget_descriptions': uniq(widget_descriptions)[:6],
        'homepage_implementation': uniq(impl_home)[:12],
        'upload_flow_implementation': uniq(impl_upload)[:12],
        'history_or_dashboard_implementation': uniq(impl_history)[:12],
        'must_avoid': uniq(avoid)[:12],
        'motivation_model': uniq(motivation)[:6],
        'priority_level': uniq(priority)[:6],
        'recommended_next_steps': uniq(next_steps)[:6],
    }


def write_markdown(results: dict, consensus: dict):
    timestamp = datetime.now(timezone.utc).isoformat()
    lines = [
        '# Deliberación multi-IA sobre expediente creciente y beneficios en AuditaPatron',
        '',
        f'Generado: {timestamp}',
        '',
        '## Consenso sintetizado',
        '',
    ]

    sections = [
        ('Veredictos', 'verdicts'),
        ('Evaluación general de la idea', 'idea_assessment'),
        ('Riesgos principales', 'main_risks'),
        ('Guardrails éticos', 'ethical_guardrails'),
        ('Posicionamiento recomendado', 'best_positioning'),
        ('Promesa al usuario', 'best_user_promise'),
        ('Beneficios a explicar', 'benefits_to_explain'),
        ('Mensajes candidatos para homepage', 'homepage_message_candidates'),
        ('Microcopy posterior a carga', 'post_upload_microcopy_candidates'),
        ('Títulos del widget de expediente', 'expedient_widget_titles'),
        ('Descripciones del widget de expediente', 'expedient_widget_descriptions'),
        ('Implementación en homepage', 'homepage_implementation'),
        ('Implementación en flujo de carga', 'upload_flow_implementation'),
        ('Implementación en historial o dashboard', 'history_or_dashboard_implementation'),
        ('Qué evitar', 'must_avoid'),
        ('Modelo de motivación', 'motivation_model'),
        ('Prioridad sugerida', 'priority_level'),
        ('Siguientes pasos sugeridos', 'recommended_next_steps'),
    ]

    for title, key in sections:
        lines.extend(['', f'### {title}', ''])
        values = consensus.get(key, [])
        if values:
            for value in values:
                lines.append(f'- {value}')
        else:
            lines.append('- Sin consenso suficiente.')

    lines.extend(['', '## Respuestas completas por modelo', ''])
    for model_name, payload in results.items():
        lines.extend([
            f'### {model_name}',
            '',
            '```json',
            json.dumps(payload, ensure_ascii=False, indent=2),
            '```',
            '',
        ])

    REPORT_PATH.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def main():
    results = {
        'ChatGPT': safe_call('ChatGPT', call_openai, os.environ.get('OPENAI_API_KEY')),
        'Grok': safe_call('Grok', call_grok, os.environ.get('XAI_API_KEY')),
        'Gemini': safe_call('Gemini', call_gemini, os.environ.get('GEMINI_API_KEY')),
    }
    consensus = build_consensus(results)
    write_markdown(results, consensus)
    payload = {
        'report_path': str(REPORT_PATH),
        'results': results,
        'consensus': consensus,
    }
    JSON_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({
        'report_path': str(REPORT_PATH),
        'json_path': str(JSON_PATH),
        'consensus': consensus,
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
