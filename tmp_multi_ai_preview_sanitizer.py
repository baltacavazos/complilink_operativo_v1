import json
import os
import textwrap
from urllib import request

PROMPT = textwrap.dedent("""
Eres un reviewer senior de producto + frontend + seguridad UX.

Contexto real de AuditaPatron:
- Plataforma web para expediente/auditoría laboral en México.
- Nuevo bug móvil reportado: en la vista previa previa al guardado, aparece un bloque enorme de texto técnico crudo dentro de la UI.
- El usuario percibe que la vista previa sigue sin servir porque se vuelve ilegible antes de confirmar y guardar.

Hallazgos de código ya verificados:
1) El backend construye un objeto preliminaryAnalysis con confirmedData y estimatedData basado en nombre de archivo, mime y textHint.
2) El backend también pide a un modelo una structuredExtraction con summary, fields, missingFields y reviewNotes.
3) Esa structuredExtraction hoy solo valida tipos y presencia de strings, pero NO limita longitud ni filtra contenido técnico sospechoso.
4) El frontend renderiza field.value en tarjetas visibles del preview y también fusiona structuredExtraction con overrides.
5) Los campos editables manuales ya están limitados a claves concretas, así que el blob visible probablemente viene de structuredExtraction u otro texto visible largo no saneado.
6) Se necesita un fix que preserve información útil pero bloquee dumps técnicos, stack traces, blobs minificados, texto excesivo o respuestas inesperadas.

Devuélveme JSON estricto con esta forma:
{
  "primary_hypothesis": "una sola frase",
  "likely_sources": ["máximo 5 fuentes o puntos de fuga"],
  "server_side_fixes": ["máximo 6 acciones concretas"],
  "client_side_fixes": ["máximo 6 acciones concretas"],
  "suspicion_rules": ["máximo 8 reglas heurísticas para detectar contenido técnico no legible"],
  "safe_fallback_copy": ["máximo 4 mensajes cortos en español para reemplazar blobs ilegibles"],
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
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)


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
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)


def call_gemini():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"error": "GEMINI_API_KEY missing"}
    payload = {
        "contents": [{
            "role": "user",
            "parts": [{"text": PROMPT}]
        }],
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
