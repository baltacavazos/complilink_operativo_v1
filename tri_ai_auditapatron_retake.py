import json
import os
import time
from pathlib import Path

import requests

BASE_DIR = Path('/home/ubuntu')
PROJECT_DIR = BASE_DIR / 'complilink_operativo_v1'
UPLOAD_DIR = BASE_DIR / 'upload'
OUTPUT_JSON = PROJECT_DIR / 'tri_ai_auditapatron_retake_output.json'
OUTPUT_MD = PROJECT_DIR / 'tri_ai_auditapatron_retake.md'


def read_text(path: Path, limit: int = 20000) -> str:
    try:
        text = path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        text = path.read_text(encoding='latin-1')
    return text[:limit]


state_brief = read_text(UPLOAD_DIR / 'auditapatron_state_brief.md', 12000)
original_brief = read_text(UPLOAD_DIR / 'pasted_content.txt', 12000)
concept_doc = read_text(UPLOAD_DIR / 'ConceptoCompletodelaPlataforma+One-LinePitchAuditapatrón.md', 16000)
app_routes = read_text(UPLOAD_DIR / 'App.tsx', 6000)
home_page = read_text(UPLOAD_DIR / 'Home.tsx', 18000)
paystub_page = read_text(UPLOAD_DIR / 'PayStubAudit.tsx', 20000)

summary = f"""
CONTEXTO PRIORITARIO
- Se pausa completamente CompliLink y cualquier frente de plataforma; el foco total ahora es AuditaPatron.
- El usuario pidió retomar la página aquí, tomando como base lo ya hecho, reutilizando al máximo activos y documentos existentes.
- No se quiere reiniciar desde cero; se quiere reconstruir con fidelidad y mejorar desde esa base.

RESUMEN DE AUDITAPATRON
- Producto: el trabajador audita a su patrón, detecta incumplimientos laborales y de seguridad social, genera evidencia y prepara acciones ante autoridades.
- Promesa: privacidad máxima, modo incógnito, respaldo legal de Grupo CVZ / Despacho Cavazos Flores.
- Diferencial: cruce documental y verificación con SAT, IMSS, INFONAVIT, STPS, PROFEDET cuando aplique.

ESTADO IMPLEMENTADO INFERIDO
- Ya existe una app React con rutas: home, /auditar, /historial, /comparar, /documentos y /admin.
- Ya existe un flujo principal de auditoría de recibos de nómina.
- Ya existen historial, comparación de recibos, centro legal y panel admin.
- Ya hay backend para auditoría, validación SAT, documentos, reportes PDF y capa administrativa.

OBJETIVO DE ESTA CONSULTA
Necesito que propongas cómo retomar AuditaPatron HOY usando como base TODO lo ya hecho. No quiero una visión abstracta de arquitectura. Quiero una recomendación muy concreta para reconstruir la página y el producto visible, preservando el trabajo existente y evitando rehacer por rehacer.

CRITERIOS OBLIGATORIOS
1. Reutilizar al máximo lo existente.
2. Priorizar simplicidad, claridad y sensación premium.
3. Mantener el núcleo funcional real: auditar recibo de nómina y generar evidencia.
4. Conservar como secundarios: historial, comparación, centro legal y admin.
5. No mezclarlo con CompliLink ni con el Shared Engine en esta fase.
6. Pensar como si mañana se fuera a enseñar o probar el producto con usuarios reales.

MATERIALES BASE
=== auditapatron_state_brief.md ===
{state_brief}

=== pasted_content.txt ===
{original_brief}

=== ConceptoCompletodelaPlataforma+One-LinePitchAuditapatrón.md ===
{concept_doc}

=== App.tsx ===
{app_routes}

=== Home.tsx (extracto) ===
{home_page}

=== PayStubAudit.tsx (extracto) ===
{paystub_page}
"""

prompt = f"""
Actúa como director de producto y UX senior para un software legal-tech laboral en México.

Con base en el contexto provisto, responde SOLO en JSON válido con esta estructura exacta:
{{
  "veredicto_general": "string",
  "estado_inferido": "string",
  "nucleo_v1": ["string"],
  "que_conservar_tal_cual": ["string"],
  "que_reordenar_o_simplificar": ["string"],
  "que_posponer": ["string"],
  "estructura_recomendada_de_paginas": [
    {{
      "ruta": "string",
      "rol": "string",
      "decision": "keep|adapt|defer|merge"
    }}
  ],
  "homepage_recomendada": {{
    "mensaje_central": "string",
    "secciones": ["string"],
    "cta_principal": "string",
    "cta_secundario": "string"
  }},
  "flujo_auditar_recomendado": ["string"],
  "riesgos_si_se_rehace_desde_cero": ["string"],
  "plan_de_recuperacion": ["string"],
  "tono_y_diseno": ["string"],
  "recomendacion_final": "string"
}}

Reglas:
- No propongas arquitectura cloud ni temas de plataforma.
- Enfócate en la página, los flujos visibles y el producto usable.
- Sé muy concreto y orientado a ejecución.
- Si algo ya existe y es valioso, dilo explícitamente.
- Si algo debe simplificarse, di exactamente qué simplificar.
"""


def call_openai() -> dict:
    api_key = os.environ.get('OPENAI_API_KEY') or os.environ.get('CHATGPT_API_KEY')
    if not api_key:
        return {"available": False, "error": "OPENAI_API_KEY no disponible"}
    url = 'https://api.openai.com/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    payload = {
        'model': 'gpt-4.1-mini',
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Eres un experto en producto y UX. Responde únicamente JSON válido.'},
            {'role': 'user', 'content': summary + '\n\n' + prompt},
        ],
        'temperature': 0.2,
    }
    r = requests.post(url, headers=headers, json=payload, timeout=180)
    r.raise_for_status()
    data = r.json()
    content = data['choices'][0]['message']['content']
    return {"available": True, "raw": content, "parsed": json.loads(content)}



def call_grok() -> dict:
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {"available": False, "error": "XAI_API_KEY no disponible"}
    url = 'https://api.x.ai/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    payload = {
        'model': 'grok-4-0709',
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Eres un experto en producto y UX. Responde únicamente JSON válido.'},
            {'role': 'user', 'content': summary + '\n\n' + prompt},
        ],
        'temperature': 0.2,
    }
    r = requests.post(url, headers=headers, json=payload, timeout=180)
    r.raise_for_status()
    data = r.json()
    content = data['choices'][0]['message']['content']
    return {"available": True, "raw": content, "parsed": json.loads(content)}



def call_gemini() -> dict:
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {"available": False, "error": "GEMINI_API_KEY no disponible"}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    headers = {'Content-Type': 'application/json'}
    payload = {
        'system_instruction': {
            'parts': [{'text': 'Eres un experto en producto y UX. Responde únicamente JSON válido.'}]
        },
        'contents': [
            {
                'parts': [
                    {'text': summary + '\n\n' + prompt}
                ]
            }
        ],
        'generationConfig': {
            'temperature': 0.2,
            'responseMimeType': 'application/json',
        },
    }
    r = requests.post(url, headers=headers, json=payload, timeout=180)
    r.raise_for_status()
    data = r.json()
    text = data['candidates'][0]['content']['parts'][0]['text']
    return {"available": True, "raw": text, "parsed": json.loads(text)}


results = {
    'generated_at': time.strftime('%Y-%m-%d %H:%M:%S'),
    'models': {}
}

for name, fn in [('chatgpt', call_openai), ('grok', call_grok), ('gemini', call_gemini)]:
    try:
        results['models'][name] = fn()
    except Exception as exc:
        results['models'][name] = {'available': True, 'error': str(exc)}

OUTPUT_JSON.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')

lines = [
    '# Consulta comparada para retomar AuditaPatron\n',
    f'Generado: {results["generated_at"]}\n',
]
for model_name, payload in results['models'].items():
    lines.append(f'## {model_name}\n')
    if payload.get('parsed'):
        lines.append('```json\n')
        lines.append(json.dumps(payload['parsed'], ensure_ascii=False, indent=2))
        lines.append('\n```\n')
    else:
        lines.append(f"Resultado no disponible o con error: {payload.get('error', 'sin detalle')}\n")

OUTPUT_MD.write_text('\n'.join(lines), encoding='utf-8')
print(str(OUTPUT_JSON))
print(str(OUTPUT_MD))
