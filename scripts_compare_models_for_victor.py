import json
import os
import requests
from textwrap import dedent

PROMPT = dedent('''
Actúa como estratega de asuntos públicos y comunicación institucional en México.

Necesito insumos para redactar una cuartilla dirigida a un funcionario público llamado Víctor.
El tono debe ser cercano, institucional, claro y nada técnico.
No debe sonar acartonado ni demasiado formal.

Contexto del producto:
- Auditapatrón es una plataforma orientada al trabajador en México.
- Ayuda a revisar documentos laborales, detectar posibles inconsistencias, ordenar evidencia, explicar de forma simple qué significa cada documento y preparar mejor a la persona para asesorarse, conciliar o reclamar.
- No queremos venderlo como un software complejo, sino como una herramienta práctica de orientación, claridad y defensa preventiva.

Necesito que respondas en JSON válido con esta estructura exacta:
{
  "enfoque_central": "string",
  "como_definir_auditapatron": "string",
  "como_explicar_ayuda_al_trabajador": "string",
  "lectura_del_entorno_laboral_mexico": "string",
  "problema_publico_que_resuelve": "string",
  "vias_de_monetizacion": ["string", "string", "string", "string"],
  "tono_recomendado": "string",
  "frase_clave_para_abrir": "string",
  "riesgos_de_redaccion": ["string", "string", "string"],
  "recomendacion_estrategica_final": "string"
}

Sé concreto, con lenguaje mexicano y enfoque útil para una carta breve dirigida a una autoridad laboral.
''').strip()


def call_openai():
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {"error": "OPENAI_API_KEY no disponible"}
    url = 'https://api.openai.com/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    payload = {
        'model': 'gpt-4.1-mini',
        'temperature': 0.4,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Responde solo con JSON válido.'},
            {'role': 'user', 'content': PROMPT},
        ],
    }
    r = requests.post(url, headers=headers, json=payload, timeout=120)
    return {'status_code': r.status_code, 'body': r.json()}


def call_grok():
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {"error": "XAI_API_KEY no disponible"}
    url = 'https://api.x.ai/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    payload = {
        'model': 'grok-3-mini',
        'temperature': 0.4,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Responde solo con JSON válido.'},
            {'role': 'user', 'content': PROMPT},
        ],
    }
    r = requests.post(url, headers=headers, json=payload, timeout=120)
    try:
        body = r.json()
    except Exception:
        body = {'text': r.text}
    return {'status_code': r.status_code, 'body': body}


def call_gemini():
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {"error": "GEMINI_API_KEY no disponible"}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    headers = {'Content-Type': 'application/json'}
    schema = {
        'type': 'OBJECT',
        'properties': {
            'enfoque_central': {'type': 'STRING'},
            'como_definir_auditapatron': {'type': 'STRING'},
            'como_explicar_ayuda_al_trabajador': {'type': 'STRING'},
            'lectura_del_entorno_laboral_mexico': {'type': 'STRING'},
            'problema_publico_que_resuelve': {'type': 'STRING'},
            'vias_de_monetizacion': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
            'tono_recomendado': {'type': 'STRING'},
            'frase_clave_para_abrir': {'type': 'STRING'},
            'riesgos_de_redaccion': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
            'recomendacion_estrategica_final': {'type': 'STRING'},
        },
        'required': [
            'enfoque_central', 'como_definir_auditapatron', 'como_explicar_ayuda_al_trabajador',
            'lectura_del_entorno_laboral_mexico', 'problema_publico_que_resuelve',
            'vias_de_monetizacion', 'tono_recomendado', 'frase_clave_para_abrir',
            'riesgos_de_redaccion', 'recomendacion_estrategica_final'
        ],
        'propertyOrdering': [
            'enfoque_central', 'como_definir_auditapatron', 'como_explicar_ayuda_al_trabajador',
            'lectura_del_entorno_laboral_mexico', 'problema_publico_que_resuelve',
            'vias_de_monetizacion', 'tono_recomendado', 'frase_clave_para_abrir',
            'riesgos_de_redaccion', 'recomendacion_estrategica_final'
        ]
    }
    payload = {
        'contents': [{'parts': [{'text': PROMPT}]}],
        'generationConfig': {
            'temperature': 0.4,
            'responseMimeType': 'application/json',
            'responseSchema': schema,
        },
    }
    r = requests.post(url, headers=headers, json=payload, timeout=120)
    try:
        body = r.json()
    except Exception:
        body = {'text': r.text}
    return {'status_code': r.status_code, 'body': body}


def extract_openai_content(resp):
    try:
        return json.loads(resp['body']['choices'][0]['message']['content'])
    except Exception as e:
        return {'parse_error': str(e), 'raw': resp}


def extract_grok_content(resp):
    try:
        return json.loads(resp['body']['choices'][0]['message']['content'])
    except Exception as e:
        return {'parse_error': str(e), 'raw': resp}


def extract_gemini_content(resp):
    try:
        text = resp['body']['candidates'][0]['content']['parts'][0]['text']
        return json.loads(text)
    except Exception as e:
        return {'parse_error': str(e), 'raw': resp}


def main():
    openai_resp = call_openai()
    grok_resp = call_grok()
    gemini_resp = call_gemini()
    result = {
        'openai': extract_openai_content(openai_resp) if 'body' in openai_resp else openai_resp,
        'grok': extract_grok_content(grok_resp) if 'body' in grok_resp else grok_resp,
        'gemini': extract_gemini_content(gemini_resp) if 'body' in gemini_resp else gemini_resp,
        'raw_meta': {
            'openai_status': openai_resp.get('status_code'),
            'grok_status': grok_resp.get('status_code'),
            'gemini_status': gemini_resp.get('status_code'),
        }
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
