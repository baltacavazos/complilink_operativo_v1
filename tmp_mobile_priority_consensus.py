import json
import os
import requests
from textwrap import dedent

PROMPT = dedent('''
Actúa como arquitecto principal de producto y móvil.

Contexto resumido del proyecto Auditapatron:
- Web app legal-laboral con React 19 + Tailwind 4 + Express 4 + tRPC + Drizzle.
- Se está endureciendo para iPhone y Android vía Capacitor.
- Ya existe base móvil: plugins instalados, deep link listener, refresh de sesión al volver a la app, email OTP corregido para iPhone, branding Auditapatron corregido, resultado post-carga simplificado para móvil.
- Google login existe en web y parcialmente en móvil, pero falta cerrar bien el retorno a la app y endurecer el flujo completo móvil.
- Apple login está bloqueado mientras el usuario termina su cuenta Apple Developer.
- Requisitos clave: no duplicar usuarios cuando la misma persona entra por email/Google/Apple; la experiencia móvil debe ser corta y muy clara; la app debe poder publicarse luego en stores.
- Se busca decidir QUÉ avanzar AHORA mientras Apple está pendiente.

Quiero que priorices exactamente los 5 frentes de trabajo más valiosos que NO dependan de credenciales de Apple.

Devuélvelo en JSON válido con este esquema exacto:
{
  "top_priority": {
    "name": "string",
    "why_now": "string",
    "expected_user_impact": "string",
    "implementation_risk": "low|medium|high"
  },
  "next_four": [
    {
      "name": "string",
      "why_now": "string",
      "expected_user_impact": "string",
      "implementation_risk": "low|medium|high"
    }
  ],
  "recommended_sequence": ["string", "string", "string", "string", "string"],
  "do_not_start_yet": ["string"],
  "notes": "string"
}

Condiciones:
- Prioriza lo que desbloquee publicación móvil, estabilidad de login y reducción de fricción real en iPhone/Android.
- Si propones account linking, explica por qué es importante antes de Apple.
- Si propones store readiness o app identity, sepáralo de login.
- No hables de Apple como prioridad activa; solo menciona lo que debe esperar.
- Responde solo con JSON válido.
''').strip()


def call_openai():
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return {"error": "OPENAI_API_KEY missing"}
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "gpt-4.1-mini",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un arquitecto senior de apps móviles y autenticación."},
            {"role": "user", "content": PROMPT},
        ],
    }
    r = requests.post(url, headers=headers, json=payload, timeout=90)
    r.raise_for_status()
    data = r.json()
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)


def call_gemini():
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return {"error": "GEMINI_API_KEY missing"}
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
    payload = {
        "contents": [{"parts": [{"text": PROMPT}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }
    r = requests.post(url, json=payload, timeout=90)
    r.raise_for_status()
    data = r.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(text)


def call_grok():
    key = os.environ.get("XAI_API_KEY")
    if not key:
        return {"error": "XAI_API_KEY missing"}
    url = "https://api.x.ai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "grok-4-latest",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un arquitecto senior de apps móviles y autenticación."},
            {"role": "user", "content": PROMPT},
        ],
    }
    r = requests.post(url, headers=headers, json=payload, timeout=90)
    r.raise_for_status()
    data = r.json()
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)


if __name__ == "__main__":
    results = {}
    for name, fn in [("openai", call_openai), ("grok", call_grok), ("gemini", call_gemini)]:
        try:
            results[name] = fn()
        except Exception as exc:
            results[name] = {"error": str(exc)}
    print(json.dumps(results, ensure_ascii=False, indent=2))
