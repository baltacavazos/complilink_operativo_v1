import json
import os
import sys
from urllib import request, error

PROMPT = """Eres un experto en UX móvil para un producto legal/documental en México.

Contexto actual resumido:
- /acceso ya fue simplificado a una sola vía principal por correo + OTP.
- /acceso ahora recuerda el último correo usado y puede mostrar un estado ligero de reconocimiento en este equipo.
- /auditar ya fue simplificado, pero aún hay margen para reducir fricción en el hero y en el selector de subida móvil.

Objetivo de esta ronda:
1. Decidir cómo mostrar el CTA 'Ir al formulario' de forma contextual y no redundante dentro del hero de /auditar.
2. Decidir la microinteracción más simple y confiable al enviar el código por correo en /acceso.
3. Decidir cómo unificar en móvil la elección entre cámara y archivo sin aumentar pasos ni confusión.

Devuelve JSON estricto con esta forma exacta:
{
  "model": "nombre-del-modelo",
  "hero_cta": {
    "recommendation": "texto corto",
    "why": "razón breve",
    "avoid": "qué evitar"
  },
  "email_progress": {
    "recommendation": "texto corto",
    "why": "razón breve",
    "avoid": "qué evitar"
  },
  "mobile_upload_entry": {
    "recommendation": "texto corto",
    "why": "razón breve",
    "avoid": "qué evitar"
  },
  "single_sentence_consensus": "una sola oración con la idea central"
}

Responde SOLO JSON válido, sin markdown.
"""


def post_json(url, payload, headers):
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=data, headers=headers, method="POST")
    with request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read().decode("utf-8"))


def parse_json_content(text):
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("{"):
                text = part
                break
    return json.loads(text)


def call_openai():
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"error": "OPENAI_API_KEY missing"}
    payload = {
        "model": "gpt-4.1-mini",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Responde solo JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    data = post_json("https://api.openai.com/v1/chat/completions", payload, headers)
    content = data["choices"][0]["message"]["content"]
    result = parse_json_content(content)
    result.setdefault("model", "gpt-4.1-mini")
    return result


def call_grok():
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return {"error": "XAI_API_KEY missing"}
    payload = {
        "model": "grok-4",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Responde solo JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    data = post_json("https://api.x.ai/v1/chat/completions", payload, headers)
    content = data["choices"][0]["message"]["content"]
    result = parse_json_content(content)
    result.setdefault("model", "grok-4")
    return result


def call_gemini():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"error": "GEMINI_API_KEY missing"}
    payload = {
        "system_instruction": {"parts": [{"text": "Responde solo JSON válido."}]},
        "contents": [{"parts": [{"text": PROMPT}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }
    headers = {"Content-Type": "application/json"}
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    data = post_json(url, payload, headers)
    content = data["candidates"][0]["content"]["parts"][0]["text"]
    result = parse_json_content(content)
    result.setdefault("model", "gemini-2.5-flash")
    return result


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/multi_ai_round3_login_auditar.json"
    results = {
        "openai": None,
        "grok": None,
        "gemini": None,
    }
    for name, fn in (("openai", call_openai), ("grok", call_grok), ("gemini", call_gemini)):
        try:
            results[name] = fn()
        except Exception as exc:
            results[name] = {"error": f"{type(exc).__name__}: {exc}"}
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(out_path)


if __name__ == "__main__":
    main()
