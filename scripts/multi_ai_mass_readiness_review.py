import json
import os
import time
from pathlib import Path
from typing import Any

import requests
from google import genai

BASE_DIR = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_DIR = BASE_DIR / 'research' / 'mass_readiness'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SOURCES = {
    'browser_notes': BASE_DIR / 'tmp' / 'mass_readiness_browser_notes_round1.md',
    'home': Path('/home/ubuntu/page_texts/3000-it0vzwdi5evut302an0rz-97b3c6ff.us1.manus.computer.md'),
    'auditar': Path('/home/ubuntu/page_texts/3000-it0vzwdi5evut302an0rz-97b3c6ff.us1.manus.computer_auditar.md'),
    'acceso': Path('/home/ubuntu/page_texts/3000-it0vzwdi5evut302an0rz-97b3c6ff.us1.manus.computer_acceso.md'),
    'ceo': Path('/home/ubuntu/page_texts/3000-it0vzwdi5evut302an0rz-97b3c6ff.us1.manus.computer_ceo.md'),
}

SYSTEM_PROMPT = '''Eres un auditor senior de producto, QA funcional y readiness operativo para una plataforma legal-operativa que se quiere someter a pruebas masivas.

Tu trabajo es decidir si la plataforma está lista o no para pruebas masivas controladas, no para lanzamiento general.

Reglas obligatorias:
1. Evalúa cinco dimensiones: estabilidad técnica, cobertura automatizada, claridad del onboarding, robustez de flujos críticos y riesgo operativo.
2. Debes separar claramente bloqueadores, riesgos altos, riesgos medios y observaciones menores.
3. No inventes hechos fuera del material dado.
4. Cuando falte evidencia, dilo explícitamente como hueco de validación.
5. Da un veredicto final binario: READY_FOR_CONTROLLED_MASS_TEST o NOT_READY_FOR_CONTROLLED_MASS_TEST.
6. Si el producto no está listo, di qué tres acciones mínimas lo acercan más rápido a estarlo.
7. Devuelve JSON estricto con la forma exacta solicitada.

JSON requerido:
{
  "model_name": "string",
  "verdict": "READY_FOR_CONTROLLED_MASS_TEST|NOT_READY_FOR_CONTROLLED_MASS_TEST",
  "overall_score": number,
  "executive_summary": "string",
  "blockers": ["string"],
  "high_risks": ["string"],
  "medium_risks": ["string"],
  "minor_observations": ["string"],
  "dimension_scores": {
    "technical_stability": number,
    "automated_coverage": number,
    "onboarding_clarity": number,
    "critical_flows": number,
    "operational_readiness": number
  },
  "priority_actions": ["string"],
  "evidence_gaps": ["string"]
}
'''


def read_text(path: Path) -> str:
    if not path.exists():
        return f'[MISSING] {path}'
    return path.read_text(encoding='utf-8')


def build_prompt() -> str:
    technical_summary = '''
Resumen técnico verificado internamente:
- Build de producción: pasa.
- Se detectó advertencia grave de performance: bundle principal dist/public/assets/index-OqoVz7Dk.js de ~3.7 MB y múltiples chunks >500 kB.
- TypeScript: en verde en la última validación.
- Vitest unitario/integración: existen 46 archivos de prueba.
- Playwright: existen 8 archivos e2e con 16 escenarios fallidos en la última corrida, pero el fallo visible principal fue de infraestructura local porque faltaba instalar los navegadores de Playwright (no prueba concluyente sobre la lógica del producto).
- El dashboard CEO y /auditar existen y cargan; /acceso se comporta más como landing que como login dedicado.
- En /auditar hay alta densidad de contenido y competencia entre acciones.
- En CEO hay densidad alta de datos y acciones, con sesgo fuerte a escritorio.
'''
    return (
        'Evalúa el readiness para pruebas masivas controladas con base en esta evidencia.\n\n'
        f'{technical_summary}\n\n'
        f'[NOTAS_BROWSER]\n{read_text(SOURCES["browser_notes"])}\n\n'
        f'[HOME]\n{read_text(SOURCES["home"])}\n\n'
        f'[/AUDITAR]\n{read_text(SOURCES["auditar"])}\n\n'
        f'[/ACCESO]\n{read_text(SOURCES["acceso"])}\n\n'
        f'[/CEO]\n{read_text(SOURCES["ceo"])}\n'
    )


def call_openai(user_prompt: str) -> dict[str, Any]:
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f"Bearer {os.environ['OPENAI_API_KEY']}",
            'Content-Type': 'application/json',
        },
        json={
            'model': 'gpt-4.1-mini',
            'temperature': 0.1,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': user_prompt},
            ],
        },
        timeout=180,
    )
    response.raise_for_status()
    return json.loads(response.json()['choices'][0]['message']['content'])


def call_grok(user_prompt: str) -> dict[str, Any]:
    last_error = None
    for model in ['grok-3-mini', 'grok-4-fast-reasoning', 'grok-4']:
        for attempt in range(3):
            try:
                response = requests.post(
                    'https://api.x.ai/v1/chat/completions',
                    headers={
                        'Authorization': f"Bearer {os.environ['XAI_API_KEY']}",
                        'Content-Type': 'application/json',
                    },
                    json={
                        'model': model,
                        'temperature': 0.1,
                        'response_format': {'type': 'json_object'},
                        'messages': [
                            {'role': 'system', 'content': SYSTEM_PROMPT},
                            {'role': 'user', 'content': user_prompt},
                        ],
                    },
                    timeout=180,
                )
                response.raise_for_status()
                parsed = json.loads(response.json()['choices'][0]['message']['content'])
                parsed.setdefault('model_name', model)
                return parsed
            except Exception as exc:
                last_error = exc
                time.sleep(attempt + 1)
    raise RuntimeError(f'Grok failed: {last_error}')


def call_gemini(user_prompt: str) -> dict[str, Any]:
    client = genai.Client(api_key=os.environ['GEMINI_API_KEY'])
    schema = {
        'type': 'object',
        'properties': {
            'model_name': {'type': 'string'},
            'verdict': {'type': 'string'},
            'overall_score': {'type': 'number'},
            'executive_summary': {'type': 'string'},
            'blockers': {'type': 'array', 'items': {'type': 'string'}},
            'high_risks': {'type': 'array', 'items': {'type': 'string'}},
            'medium_risks': {'type': 'array', 'items': {'type': 'string'}},
            'minor_observations': {'type': 'array', 'items': {'type': 'string'}},
            'dimension_scores': {
                'type': 'object',
                'properties': {
                    'technical_stability': {'type': 'number'},
                    'automated_coverage': {'type': 'number'},
                    'onboarding_clarity': {'type': 'number'},
                    'critical_flows': {'type': 'number'},
                    'operational_readiness': {'type': 'number'}
                },
                'required': ['technical_stability', 'automated_coverage', 'onboarding_clarity', 'critical_flows', 'operational_readiness']
            },
            'priority_actions': {'type': 'array', 'items': {'type': 'string'}},
            'evidence_gaps': {'type': 'array', 'items': {'type': 'string'}}
        },
        'required': ['model_name', 'verdict', 'overall_score', 'executive_summary', 'blockers', 'high_risks', 'medium_risks', 'minor_observations', 'dimension_scores', 'priority_actions', 'evidence_gaps']
    }
    last_error = None
    for model in ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite']:
        try:
            response = client.models.generate_content(
                model=model,
                contents=user_prompt,
                config={
                    'system_instruction': SYSTEM_PROMPT,
                    'temperature': 0.1,
                    'response_mime_type': 'application/json',
                    'response_schema': schema,
                },
            )
            parsed = json.loads(response.text)
            parsed.setdefault('model_name', model)
            return parsed
        except Exception as exc:
            last_error = exc
    raise RuntimeError(f'Gemini failed: {last_error}')


def main() -> None:
    prompt = build_prompt()
    results = {
        'openai': call_openai(prompt),
        'grok': call_grok(prompt),
        'gemini': call_gemini(prompt),
    }
    out = OUTPUT_DIR / 'multi_ai_mass_readiness_review.json'
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(out)


if __name__ == '__main__':
    main()
