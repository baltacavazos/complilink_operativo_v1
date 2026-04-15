import json
import os
import textwrap
from urllib import request

PROMPT = textwrap.dedent("""
Eres un reviewer senior de producto móvil + UX de conversión + frontend responsive.

Contexto real de AuditaPatron:
- La app permite subir un documento laboral y debería dar una primera impresión muy clara e impactante.
- El usuario reporta que, después de subir el archivo, la experiencia móvil sigue siendo confusa, larga y poco convincente.
- También reporta que los campos y bloques se estrechan visualmente hacia la derecha para empezar.
- La captura muestra demasiadas franjas, tarjetas, subtítulos, disclosures, estados y líneas antes de llegar a algo útil.
- El usuario quiere que, apenas suba el documento, "parezca magia": que en automático diga qué documento es, qué encontró, qué significa y cuál es el siguiente paso.
- Prioridad absoluta: móvil primero, claridad extrema, impacto inmediato, simplicidad radical, cero jerga técnica, cero ruido.

Objetivo del rediseño:
- Convertir el primer estado post-upload en una lectura casi instantánea.
- Reemplazar múltiples bloques secundarios por una sola narrativa principal.
- Hacer evidente qué pasó y qué debe hacer la persona sin pensar.
- Eliminar cualquier layout que empuje el contenido o haga parecer que la pantalla se va hacia la derecha.

Devuélveme JSON estricto con esta forma:
{
  "primary_diagnosis": "una sola frase muy concreta",
  "layout_root_causes": ["máximo 4 causas probables del estrechamiento o mala composición móvil"],
  "magic_post_upload_blueprint": {
    "hero_result": "qué debe verse primero en una sola oración",
    "three_blocks_only": ["bloque 1", "bloque 2", "bloque 3"],
    "cta_priority": "una sola CTA principal",
    "secondary_action": "una sola acción secundaria opcional"
  },
  "delete_or_collapse_first": ["máximo 8 zonas a eliminar, fusionar o colapsar"],
  "copy_style_rules": ["máximo 6 reglas de copy muy concretas"],
  "conversion_risk_if_not_fixed": "una sola frase",
  "confidence": "high|medium|low"
}
""").strip()


def post_json(url, payload, headers):
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=body, headers={**headers, "Content-Type": "application/json"}, method="POST")
    with request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read().decode("utf-8"))


def call_openai():
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"error": "OPENAI_API_KEY missing"}
    payload = {
        "model": "gpt-4.1-mini",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Responde únicamente JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
    }
    data = post_json(
        "https://api.openai.com/v1/chat/completions",
        payload,
        {"Authorization": f"Bearer {api_key}"},
    )
    return json.loads(data["choices"][0]["message"]["content"])


def call_grok():
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return {"error": "XAI_API_KEY missing"}
    payload = {
        "model": "grok-3-mini",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Responde únicamente JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
    }
    data = post_json(
        "https://api.x.ai/v1/chat/completions",
        payload,
        {"Authorization": f"Bearer {api_key}"},
    )
    return json.loads(data["choices"][0]["message"]["content"])


def call_gemini():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"error": "GEMINI_API_KEY missing"}
    payload = {
        "contents": [{"role": "user", "parts": [{"text": PROMPT}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json"
        }
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    data = post_json(url, payload, {})
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(text)


results = {
    "openai": call_openai(),
    "grok": call_grok(),
    "gemini": call_gemini(),
}
print(json.dumps(results, ensure_ascii=False, indent=2))
