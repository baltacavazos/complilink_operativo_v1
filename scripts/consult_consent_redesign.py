import json
import os
import requests
from pathlib import Path

OUTPUT_PATH = Path('/home/ubuntu/complilink_operativo_v1/tmp/consent_redesign_multi_ai.json')
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

SYSTEM_PROMPT = (
    'Eres un principal product designer + staff frontend engineer especializado en UX legal B2C en español. '
    'Debes proponer un rediseño muy concreto para integrar consentimiento legal dentro de un flujo de subida documental. '
    'Prioriza reducir fricción sin debilitar evidencia, trazabilidad o resiliencia. Responde en JSON válido.'
)

USER_PROMPT = '''
Contexto del producto:
- Página: /auditar de AuditaPatron.
- Público: trabajadores masivos en México.
- Objetivo UX: que el consentimiento legal deje de sentirse como una pantalla intrusiva separada.
- Objetivo legal/técnico: mantener aceptación versionada, checkbox explícito, posibilidad de reintento, trazabilidad y bloqueo real antes de usar expediente/IA/guardado.
- Intención del rediseño: integrar el consentimiento justo donde la persona sube/analiza/guarda su documento, con tono protector y simple.

Snippets actuales relevantes:
1) Copy legal compartido:
TITLE: Aceptación de Documentos Legales
BODY: Para continuar en AuditaPatron, necesitas aceptar el Aviso de Privacidad Integral v2.0 y los Términos y Condiciones de Uso v2.0. Esta aceptación deja constancia versionada de tu consentimiento para operar tu expediente digital y el servicio Helios dentro del ecosistema CompliLink.
SUBTEXT: Tu aceptación se registra con fecha, versión, dirección IP y navegador. Si después deseas ejercer derechos ARCO u oponerte a finalidades secundarias, podrás hacerlo desde tu sección de privacidad o escribiendo a privacidad@auditapatron.com.
CHECKBOX: He leído y acepto el Aviso de Privacidad Integral v2.0 y los Términos y Condiciones de Uso v2.0 de AuditaPatron.
BUTTON: Continuar

2) Estado actual del gate visual:
- Hay una sección grande superior con título, body, tarjetas de progreso/métricas, lista de documentos legales, checkbox, errores y botón Continuar.
- Además, handleUpload y handleConfirmDraft bloquean si legalGateRequired = true.

3) Área donde queremos integrar el consentimiento:
- Flujo de subida muestra selector de archivo, ayuda visual, nombre del archivo, textarea opcional y CTA principal.
- Si hay pendingDraft, el CTA guarda el documento; si no, analiza el documento.

Restricciones fuertes:
- Mantener checkbox explícito y aceptación activa del usuario.
- Debe seguir existiendo acceso a revisar Aviso de Privacidad y Términos, pero más discreto (ej. drawer, links inline, resumen expandible).
- Debe sentirse protector, claro y no manipulador.
- El CTA principal idealmente puede convertirse en: "Aceptar y analizar" o "Aceptar y guardar" solo cuando haga falta.
- Debe conservar mensajes de error/reintento si falla la aceptación.
- No queremos jerga jurídica pesada ni un muro visual.

Entrega exacta en JSON con esta forma:
{
  "ux_strategy": "...",
  "layout_changes": ["..."],
  "microcopy": {
    "notice": "...",
    "checkbox": "...",
    "cta_analyze": "...",
    "cta_save": "...",
    "links_label": "...",
    "drawer_title": "...",
    "drawer_summary": "..."
  },
  "state_logic": ["..."],
  "risk_watchouts": ["..."],
  "confidence": "high|medium|low"
}
'''

JSON_SCHEMA_HINT = {
    "type": "object",
    "properties": {
        "ux_strategy": {"type": "string"},
        "layout_changes": {"type": "array", "items": {"type": "string"}},
        "microcopy": {
            "type": "object",
            "properties": {
                "notice": {"type": "string"},
                "checkbox": {"type": "string"},
                "cta_analyze": {"type": "string"},
                "cta_save": {"type": "string"},
                "links_label": {"type": "string"},
                "drawer_title": {"type": "string"},
                "drawer_summary": {"type": "string"}
            },
            "required": ["notice", "checkbox", "cta_analyze", "cta_save", "links_label", "drawer_title", "drawer_summary"],
            "additionalProperties": False
        },
        "state_logic": {"type": "array", "items": {"type": "string"}},
        "risk_watchouts": {"type": "array", "items": {"type": "string"}},
        "confidence": {"type": "string"}
    },
    "required": ["ux_strategy", "layout_changes", "microcopy", "state_logic", "risk_watchouts", "confidence"],
    "additionalProperties": False
}


def clean_json(text: str):
    text = text.strip()
    if text.startswith('```'):
        parts = text.split('```')
        for part in parts:
            part = part.strip()
            if part and not part.lower().startswith('json'):
                text = part
                break
        if text.lower().startswith('json'):
            text = text[4:].strip()
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        text = text[start:end+1]
    return json.loads(text)


def call_openai():
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {"error": "OPENAI_API_KEY missing"}
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'gpt-4.1-mini',
            'temperature': 0.2,
            'response_format': {
                'type': 'json_schema',
                'json_schema': {
                    'name': 'consent_redesign',
                    'strict': True,
                    'schema': JSON_SCHEMA_HINT,
                },
            },
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': USER_PROMPT},
            ],
        },
        timeout=90,
    )
    response.raise_for_status()
    payload = response.json()
    text = payload['choices'][0]['message']['content']
    return json.loads(text)


def call_grok():
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {"error": "XAI_API_KEY missing"}
    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'grok-4',
            'temperature': 0.2,
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT + ' Debes responder solo JSON.'},
                {'role': 'user', 'content': USER_PROMPT},
            ],
        },
        timeout=90,
    )
    response.raise_for_status()
    payload = response.json()
    text = payload['choices'][0]['message']['content']
    return clean_json(text)


def call_gemini():
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {"error": "GEMINI_API_KEY missing"}
    response = requests.post(
        f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}',
        headers={'Content-Type': 'application/json'},
        json={
            'generationConfig': {
                'temperature': 0.2,
                'responseMimeType': 'application/json',
            },
            'systemInstruction': {
                'parts': [{'text': SYSTEM_PROMPT + ' Responde exclusivamente con un objeto JSON que siga la estructura pedida.'}],
            },
            'contents': [
                {
                    'role': 'user',
                    'parts': [{'text': USER_PROMPT}],
                }
            ],
        },
        timeout=90,
    )
    response.raise_for_status()
    payload = response.json()
    text = payload['candidates'][0]['content']['parts'][0]['text']
    return clean_json(text)


def main():
    results = {}
    for name, fn in [('openai', call_openai), ('grok', call_grok), ('gemini', call_gemini)]:
        try:
            results[name] = fn()
        except Exception as exc:
            results[name] = {'error': str(exc)}
    OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(str(OUTPUT_PATH))


if __name__ == '__main__':
    main()
