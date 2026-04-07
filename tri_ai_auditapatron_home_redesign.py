import json
import os
from datetime import datetime, timezone
from pathlib import Path

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
REPORT_PATH = PROJECT_ROOT / 'tri_ai_auditapatron_home_redesign.md'
JSON_PATH = PROJECT_ROOT / 'tri_ai_auditapatron_home_redesign_output.json'

STATE_BRIEF_PATH = Path('/home/ubuntu/upload/auditapatron_state_brief.md')
IMPORTED_HOME_PATH = Path('/home/ubuntu/upload/Home.tsx')
CURRENT_HOME_PATH = PROJECT_ROOT / 'client/src/pages/Home.tsx'


def read_text(path: Path, limit: int = 18000) -> str:
    try:
        content = path.read_text(encoding='utf-8')
    except FileNotFoundError:
        return f'[missing file: {path}]'
    if len(content) <= limit:
        return content
    return content[:limit] + '\n\n[truncated]'


STATE_BRIEF = read_text(STATE_BRIEF_PATH, 14000)
IMPORTED_HOME = read_text(IMPORTED_HOME_PATH, 18000)
CURRENT_HOME = read_text(CURRENT_HOME_PATH, 18000)

SYSTEM_PROMPT = '''
Eres un director de producto + director creativo + experto en UX writing para productos masivos de alto impacto en México.
Tu misión es definir la MEJOR homepage posible para AuditaPatron, un producto para trabajadores mexicanos que quieren auditar a su patrón de forma simple, privada y útil.

Debes pensar como si el objetivo fuera:
1. hacer que cualquier trabajador entienda el producto en segundos;
2. que se vea muy llamativo, confiable y moderno;
3. que sea exageradamente fácil e intuitivo para las masas;
4. que el tono sea constructivo, protector, accesible y no agresivo;
5. que convierta hacia el flujo principal de auditoría documental.

Responde SOLO JSON válido con esta forma exacta:
{
  "verdict": "string",
  "audience_strategy": "string",
  "positioning": "string",
  "hero": {
    "headline": "string",
    "subheadline": "string",
    "primary_cta": "string",
    "secondary_cta": "string"
  },
  "sections": [
    {
      "name": "string",
      "goal": "string",
      "content_direction": "string"
    }
  ],
  "ux_principles": ["string"],
  "visual_direction": ["string"],
  "micro_interactions": ["string"],
  "trust_elements": ["string"],
  "must_avoid": ["string"],
  "conversion_strategy": ["string"],
  "implementation_notes": ["string"],
  "recommended_next_step": "string"
}
No agregues markdown ni texto fuera del JSON.
'''.strip()

USER_PROMPT = f'''
Quiero reconstruir por completo la homepage actual y reemplazarla por una nueva home de AuditaPatron.

Reglas estratégicas obligatorias:
- La homepage actual basada en CompliLink Operativo ya no sirve como base visible.
- La nueva home debe ser para trabajadores mexicanos, no para equipos corporativos internos.
- Debe sentirse extremadamente clara, amigable, intuitiva y masiva.
- Debe venderse como una herramienta CONSTRUCTIVA: ayuda a entender, verificar, documentar y proteger derechos.
- No debe sentirse técnica, fría, jurídica en exceso ni intimidante.
- Debe llevar al usuario al flujo principal /auditar.
- Historial, comparar y documentos existen, pero deben quedar en segundo plano frente a la auditoría principal.
- Debe aprovechar lo mejor ya hecho, pero sin heredar la narrativa equivocada del home actual.

Contexto de producto:
{STATE_BRIEF}

Base importada previa de home de AuditaPatron:
{IMPORTED_HOME}

Home actual equivocada que será descartada:
{CURRENT_HOME}

Tu trabajo:
1. Decide cuál debe ser el posicionamiento correcto de la nueva home.
2. Define el mejor mensaje hero para trabajadores masivos.
3. Propón la arquitectura exacta de secciones más efectiva.
4. Define el tono, la dirección visual y las microinteracciones.
5. Indica qué elementos de confianza deben aparecer para reducir miedo y fricción.
6. Explica qué NO debe aparecer o qué debe eliminarse.
7. Piensa en conversión, facilidad extrema y comprensión instantánea.
8. No propongas rehacer el producto entero; céntrate en la homepage.
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
            'temperature': 0.4,
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
            'temperature': 0.4,
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
                'temperature': 0.4,
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
    audience = []
    positioning = []
    headlines = []
    subheadlines = []
    primary_ctas = []
    secondary_ctas = []
    section_names = []
    ux = []
    visuals = []
    micro = []
    trust = []
    avoid = []
    conversion = []
    implementation = []
    next_steps = []

    for model_name, payload in results.items():
        if not isinstance(payload, dict) or payload.get('error'):
            continue
        verdicts.append(f"{model_name}: {payload.get('verdict', 'Sin veredicto')}")
        if payload.get('audience_strategy'):
            audience.append(f"{model_name}: {payload['audience_strategy']}")
        if payload.get('positioning'):
            positioning.append(f"{model_name}: {payload['positioning']}")
        hero = payload.get('hero') or {}
        if hero.get('headline'):
            headlines.append(f"{model_name}: {hero['headline']}")
        if hero.get('subheadline'):
            subheadlines.append(f"{model_name}: {hero['subheadline']}")
        if hero.get('primary_cta'):
            primary_ctas.append(hero['primary_cta'])
        if hero.get('secondary_cta'):
            secondary_ctas.append(hero['secondary_cta'])
        for section in payload.get('sections', []):
            if isinstance(section, dict) and section.get('name'):
                section_names.append(section['name'])
        ux.extend(payload.get('ux_principles', []))
        visuals.extend(payload.get('visual_direction', []))
        micro.extend(payload.get('micro_interactions', []))
        trust.extend(payload.get('trust_elements', []))
        avoid.extend(payload.get('must_avoid', []))
        conversion.extend(payload.get('conversion_strategy', []))
        implementation.extend(payload.get('implementation_notes', []))
        if payload.get('recommended_next_step'):
            next_steps.append(f"{model_name}: {payload['recommended_next_step']}")

    return {
        'verdicts': uniq(verdicts),
        'audience_strategy': uniq(audience)[:3],
        'positioning': uniq(positioning)[:3],
        'headline_candidates': uniq(headlines)[:6],
        'subheadline_candidates': uniq(subheadlines)[:6],
        'primary_cta_candidates': uniq(primary_ctas)[:5],
        'secondary_cta_candidates': uniq(secondary_ctas)[:5],
        'shared_section_names': uniq(section_names)[:10],
        'shared_ux_principles': uniq(ux)[:10],
        'shared_visual_direction': uniq(visuals)[:10],
        'shared_micro_interactions': uniq(micro)[:10],
        'shared_trust_elements': uniq(trust)[:10],
        'shared_must_avoid': uniq(avoid)[:10],
        'shared_conversion_strategy': uniq(conversion)[:10],
        'shared_implementation_notes': uniq(implementation)[:10],
        'recommended_next_steps': uniq(next_steps)[:5],
    }



def write_markdown(results: dict, consensus: dict):
    timestamp = datetime.now(timezone.utc).isoformat()
    lines = [
        '# Deliberación multi-IA para reconstruir la home de AuditaPatron',
        '',
        f'Generado: {timestamp}',
        '',
        '## Consenso sintetizado',
        '',
        '### Veredictos',
        '',
    ]

    for value in consensus['verdicts']:
        lines.append(f'- {value}')

    sections = [
        ('Estrategia de audiencia', 'audience_strategy'),
        ('Posicionamiento recomendado', 'positioning'),
        ('Headlines candidatos', 'headline_candidates'),
        ('Subheadlines candidatos', 'subheadline_candidates'),
        ('CTA primario', 'primary_cta_candidates'),
        ('CTA secundario', 'secondary_cta_candidates'),
        ('Secciones compartidas', 'shared_section_names'),
        ('Principios UX', 'shared_ux_principles'),
        ('Dirección visual', 'shared_visual_direction'),
        ('Microinteracciones', 'shared_micro_interactions'),
        ('Elementos de confianza', 'shared_trust_elements'),
        ('Qué evitar', 'shared_must_avoid'),
        ('Estrategia de conversión', 'shared_conversion_strategy'),
        ('Notas de implementación', 'shared_implementation_notes'),
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
    print(json.dumps({'report_path': str(REPORT_PATH), 'json_path': str(JSON_PATH), 'consensus': consensus}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
