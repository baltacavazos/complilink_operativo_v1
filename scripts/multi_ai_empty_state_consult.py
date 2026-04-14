import json
import os
import textwrap
from pathlib import Path

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_PATH = PROJECT_ROOT / 'tmp' / 'multi_ai_empty_state_consensus.json'
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

prompt = textwrap.dedent(
    """
    Eres un auditor senior de UX mobile-first para una app mexicana llamada AuditaPatron.

    Contexto del producto:
    - Ruta: /auditar
    - Objetivo: ayudar a una persona trabajadora a subir documentos laborales y entender qué documento conviene subir después.
    - El expediente ya sugiere documentos por contexto, pero hay un pendiente puntual: optimizar el estado vacío del expediente para sugerir con mayor precisión el siguiente documento según el contexto.
    - Tipos y atajos ya definidos:
      * nómina ↔ CFDI
      * contrato → anexo o condiciones
      * IMSS → comparar con nóminas
    - El criterio del usuario es: hacerlo más mágico, automático, claro, fácil de usar y confiable, especialmente en móvil.
    - Debe evitarse tono alarmante, técnico o que parezca un paso extra.

    Lógica actual relevante:

    function getPersonalizedNextDocumentCopy(params) {
      if (params.nextTarget) {
        return {
          headline: `Documento sugerido: ${params.nextTarget.label}`,
          intro: presentSummary
            ? `Con lo que ya subiste, como ${presentSummary}, ${params.nextTarget.label.toLowerCase()} puede ayudarte a ${lowercaseFirstLetter(params.nextTarget.benefit)}`
            : `Con tu expediente actual, ${params.nextTarget.label.toLowerCase()} puede ayudarte a ${lowercaseFirstLetter(params.nextTarget.benefit)}`,
          reasonTitle: "Por qué ahora puede ser el archivo más útil",
          reasonBody: firstUncertainty
            ? `${params.nextTarget.description} Además, hoy todavía conviene aclarar algo importante: ${firstUncertainty}`
            : `${params.nextTarget.description} ${params.nextTarget.benefit}`,
          followUp:
            params.opinion?.recommendedNextStep ??
            "Cada documento ayuda a reducir estimaciones y a dejar más partes del expediente en terreno claro.",
          coverage: presentSummary
            ? `Tu expediente ya se apoya en ${presentSummary}. Cada archivo adicional da más contexto para conectar señales con menos partes preliminares.`
            : "Tu expediente apenas está empezando. Cada documento útil que subas da más contexto para orientarte mejor.",
          cta: "Subir este documento ahora",
        };
      }

      return {
        headline: "Tu expediente ya cubre varias piezas clave",
        intro: presentSummary
          ? `Ya subiste ${presentSummary}. Tu expediente ya tiene una base amplia para seguir ordenando tu caso con más contexto.`
          : "Tu expediente ya tiene una base amplia de documentos para seguir ordenando tu caso con más contexto.",
        reasonTitle: "Qué puede sumar si tienes otro archivo",
        reasonBody: firstUncertainty
          ? `Si cuentas con otro archivo específico de tu caso, puede ayudar a aclarar mejor esto: ${firstUncertainty}`
          : "Si tienes otro archivo específico de tu caso, también puede ayudar a confirmar o contrastar mejor tu historia laboral.",
        followUp:
          params.opinion?.recommendedNextStep ??
          "La revisión sigue usando cada documento para separar lo claro de lo que todavía conviene confirmar.",
        coverage:
          "Mientras más documentos útiles incorpores, más crece tu expediente y más contexto tendrás para orientarte mejor.",
        cta: "Subir otro documento útil",
      };
    }

    Necesito que propongas la mejor mejora de BAJO RIESGO para ese estado vacío/contextual sin agregar nuevas pantallas ni flujos. Quiero una respuesta muy accionable para implementar hoy mismo.

    Devuélveme JSON válido con esta estructura exacta:
    {
      "overall_verdict": "string breve",
      "keep": ["máximo 3 puntos"],
      "problems": ["máximo 4 puntos"],
      "recommended_change": {
        "headline_strategy": "string",
        "body_strategy": "string",
        "cta_strategy": "string",
        "personalization_rule": "string",
        "risk_level": "low|medium|high"
      },
      "microcopy_example": {
        "headline": "string",
        "intro": "string",
        "reason_title": "string",
        "reason_body": "string",
        "coverage": "string",
        "cta": "string"
      }
    }
    """
).strip()


def call_openai(prompt_text: str):
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY missing'}
    url = 'https://api.openai.com/v1/chat/completions'
    models = ['gpt-4.1-mini', 'gpt-4o-mini']
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    for model in models:
        payload = {
            'model': model,
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Responde sólo con JSON válido y prioriza UX mobile-first de bajo riesgo.'},
                {'role': 'user', 'content': prompt_text},
            ],
        }
        response = requests.post(url, headers=headers, json=payload, timeout=90)
        if response.ok:
            content = response.json()['choices'][0]['message']['content']
            return {'model': model, 'raw': content, 'parsed': json.loads(content)}
    return {'error': response.text, 'status_code': response.status_code}


def call_gemini(prompt_text: str):
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY missing'}
    models = ['gemini-2.5-flash', 'gemini-2.0-flash']
    headers = {'Content-Type': 'application/json'}
    schema = {
        'type': 'OBJECT',
        'properties': {
            'overall_verdict': {'type': 'STRING'},
            'keep': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
            'problems': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
            'recommended_change': {
                'type': 'OBJECT',
                'properties': {
                    'headline_strategy': {'type': 'STRING'},
                    'body_strategy': {'type': 'STRING'},
                    'cta_strategy': {'type': 'STRING'},
                    'personalization_rule': {'type': 'STRING'},
                    'risk_level': {'type': 'STRING'},
                },
                'required': ['headline_strategy', 'body_strategy', 'cta_strategy', 'personalization_rule', 'risk_level'],
            },
            'microcopy_example': {
                'type': 'OBJECT',
                'properties': {
                    'headline': {'type': 'STRING'},
                    'intro': {'type': 'STRING'},
                    'reason_title': {'type': 'STRING'},
                    'reason_body': {'type': 'STRING'},
                    'coverage': {'type': 'STRING'},
                    'cta': {'type': 'STRING'},
                },
                'required': ['headline', 'intro', 'reason_title', 'reason_body', 'coverage', 'cta'],
            },
        },
        'required': ['overall_verdict', 'keep', 'problems', 'recommended_change', 'microcopy_example'],
    }
    for model in models:
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
        payload = {
            'contents': [{'parts': [{'text': prompt_text}]}],
            'generationConfig': {
                'temperature': 0.2,
                'responseMimeType': 'application/json',
                'responseSchema': schema,
            },
        }
        response = requests.post(url, headers=headers, json=payload, timeout=90)
        if response.ok:
            text = response.json()['candidates'][0]['content']['parts'][0]['text']
            return {'model': model, 'raw': text, 'parsed': json.loads(text)}
    return {'error': response.text, 'status_code': response.status_code}


def call_grok(prompt_text: str):
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY missing'}
    url = 'https://api.x.ai/v1/chat/completions'
    models = ['grok-4', 'grok-3-mini']
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    for model in models:
        payload = {
            'model': model,
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Responde sólo con JSON válido y prioriza UX mobile-first de bajo riesgo.'},
                {'role': 'user', 'content': prompt_text},
            ],
        }
        response = requests.post(url, headers=headers, json=payload, timeout=90)
        if response.ok:
            content = response.json()['choices'][0]['message']['content']
            return {'model': model, 'raw': content, 'parsed': json.loads(content)}
    return {'error': response.text, 'status_code': response.status_code}


results = {
    'openai': call_openai(prompt),
    'grok': call_grok(prompt),
    'gemini': call_gemini(prompt),
}

OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(OUTPUT_PATH))
