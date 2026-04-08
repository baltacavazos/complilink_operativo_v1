import json
import os
from pathlib import Path

BASE_DIR = Path('/home/ubuntu/complilink_operativo_v1')
OUT_DIR = BASE_DIR / 'research' / 'block1_helios'
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH = OUT_DIR / 'multi_ai_block1_helios_results.json'

PROMPT = """
Actúa como principal architect + product engineer para una app laboral mobile-first en español para trabajadores en México.

Necesito que evalúes y propongas la PRIMERA formalización real del bloque 1 Helios-first.

Contexto obligatorio:
- Producto visible: AuditaPatron.
- Núcleo obligatorio: Helios.
- Regla crítica: todo el desarrollo futuro debe quedar DENTRO de Helios como sistema central; no se permiten arquitecturas paralelas.
- UX visible: AuditaPatron sigue siendo la capa de experiencia para la persona usuaria.
- Página foco: /auditar.
- Ya existe un flujo funcional de carga documental, preanálisis, confirmación y guardado.
- Ya existe opinión preliminar de Helios por documento y copiloto contextual.
- Ya existen tablas y contratos canónicos para casos, documentos, eventos y contratos.

Estado técnico resumido ya implementado:
- El expediente actual vive sobre labor_cases.
- Los documentos actuales viven sobre case_documents.
- Existe canonical_contracts para contratos tipo case, intake, document, classification, consent, audit y shared_engine.
- cases.uploadDocument ya guarda documento, crea contratos canónicos, genera opinión preliminar de Helios y despacha al motor compartido.
- cases.detail ya devuelve documentos visibles con heliosOpinion persistida por documento.
- /auditar ya muestra progreso del expediente, recomendaciones documentales, línea de tiempo simple y copiloto laboral.

Restricción principal del bloque 1:
- No rehacer desde cero.
- No crear una segunda arquitectura de expediente/documento paralela a labor_cases y case_documents.
- Sí formalizar conceptualmente que esos objetos son ya el dominio base de Helios, aunque todavía con naming heredado.
- Sí introducir únicamente la mínima estructura adicional que haga más claro que Helios opera sobre un expediente laboral personal y sus documentos.

Objetivo de esta ronda:
Definir la mejor implementación mínima y segura para que:
1. el expediente laboral personal quede formalizado como dominio central de Helios,
2. el documento laboral quede formalizado como unidad canónica de ingestión de Helios,
3. /auditar opere de forma más explícita como interfaz del expediente Helios y no como motor paralelo,
4. todo esto ocurra sin romper la UX existente ni inflar demasiado el alcance.

Quiero una respuesta ESTRICTA en JSON con esta forma exacta:
{
  "veredicto_general": "texto corto",
  "decision_arquitectonica": {
    "mantener_modelo_actual_como_base": true,
    "por_que": "texto corto",
    "cambios_minimos_recomendados": ["cambio 1", "cambio 2", "cambio 3"]
  },
  "dominio_expediente": {
    "recomendacion": "texto corto",
    "campos_o_conceptos_minimos": ["item 1", "item 2", "item 3"],
    "como_presentarlo_en_ui": "texto corto"
  },
  "dominio_documento": {
    "recomendacion": "texto corto",
    "campos_o_conceptos_minimos": ["item 1", "item 2", "item 3"],
    "como_presentarlo_en_ui": "texto corto"
  },
  "ingestion_helios_first": {
    "recomendacion": "texto corto",
    "pipeline_minimo": ["paso 1", "paso 2", "paso 3", "paso 4"],
    "senales_de_que_no_hay_arquitectura_paralela": ["senal 1", "senal 2", "senal 3"]
  },
  "impacto_en_auditar": {
    "cambios_visibles_minimos": ["cambio 1", "cambio 2", "cambio 3"],
    "evitar": ["evitar 1", "evitar 2", "evitar 3"]
  },
  "riesgos": ["riesgo 1", "riesgo 2", "riesgo 3"],
  "plan_recomendado_48h": ["paso 1", "paso 2", "paso 3", "paso 4"],
  "score_ajuste_bloque_1": 0
}

Reglas adicionales:
- Responde solo JSON válido.
- score_ajuste_bloque_1 debe ser un número de 0 a 100.
- Prioriza robustez, continuidad, claridad conceptual y mínimo cambio estructural.
- Piensa como arquitecto exigente que quiere consolidar todo dentro de Helios sin desperdiciar trabajo ya hecho.
- No propongas una reescritura total.
- No propongas un nuevo sistema paralelo de expediente o documento.
""".strip()

CONTEXT = {
    "producto": "AuditaPatron / Helios-first",
    "pagina_foco": "/auditar",
    "estado_actual": {
        "expediente_base": "labor_cases ya funciona como expediente laboral base",
        "documento_base": "case_documents ya funciona como unidad documental base",
        "persistencia_helios": "canonical_contracts guarda contratos y opinion Helios audit helios_v1 por documento",
        "flujo_actual": [
            "carga documental",
            "preanalisis y confirmacion",
            "guardado",
            "opinion preliminar de Helios",
            "despacho al motor compartido",
            "consulta contextual por copiloto"
        ],
        "restriccion": "consolidar dentro de Helios sin arquitectura paralela"
    }
}


def call_openai():
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {"available": False, "error": "OPENAI_API_KEY no disponible"}
    try:
        import requests
        response = requests.post(
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
                    {'role': 'system', 'content': 'Responde exclusivamente con JSON válido.'},
                    {'role': 'user', 'content': PROMPT + '\n\nContexto:\n' + json.dumps(CONTEXT, ensure_ascii=False, indent=2)},
                ],
            },
            timeout=120,
        )
        response.raise_for_status()
        payload = response.json()
        raw = payload['choices'][0]['message']['content']
        return {"available": True, "model": "gpt-4.1-mini", "raw": raw, "parsed": json.loads(raw)}
    except Exception as error:
        return {"available": False, "error": str(error)}


def call_gemini():
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {"available": False, "error": "GEMINI_API_KEY no disponible"}
    try:
        import requests
        response = requests.post(
            f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}',
            headers={'Content-Type': 'application/json'},
            json={
                'contents': [
                    {
                        'role': 'user',
                        'parts': [
                            {
                                'text': PROMPT + '\n\nContexto:\n' + json.dumps(CONTEXT, ensure_ascii=False, indent=2)
                            }
                        ],
                    }
                ],
                'generationConfig': {
                    'temperature': 0.2,
                    'responseMimeType': 'application/json',
                },
            },
            timeout=120,
        )
        response.raise_for_status()
        payload = response.json()
        raw = payload['candidates'][0]['content']['parts'][0]['text']
        return {"available": True, "model": "gemini-2.5-flash", "raw": raw, "parsed": json.loads(raw)}
    except Exception as error:
        return {"available": False, "error": str(error)}


def call_grok():
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {"available": False, "error": "XAI_API_KEY no disponible"}
    try:
        import requests
        response = requests.post(
            'https://api.x.ai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json={
                'model': 'grok-4',
                'temperature': 0.2,
                'response_format': {'type': 'json_object'},
                'messages': [
                    {'role': 'system', 'content': 'Responde exclusivamente con JSON válido.'},
                    {'role': 'user', 'content': PROMPT + '\n\nContexto:\n' + json.dumps(CONTEXT, ensure_ascii=False, indent=2)},
                ],
            },
            timeout=120,
        )
        response.raise_for_status()
        payload = response.json()
        raw = payload['choices'][0]['message']['content']
        return {"available": True, "model": "grok-4", "raw": raw, "parsed": json.loads(raw)}
    except Exception as error:
        return {"available": False, "error": str(error)}


results = {
    'prompt': PROMPT,
    'context': CONTEXT,
    'results': {
        'chatgpt': call_openai(),
        'gemini': call_gemini(),
        'grok': call_grok(),
    },
}

OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(str(OUTPUT_PATH))
