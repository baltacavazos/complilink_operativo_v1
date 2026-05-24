import json
import os
import sys
from typing import Any

import requests

PROMPT = """
Eres un revisor técnico senior de producto y pagos.

Contexto del proyecto actual:
- App: CompliLink / AuditaPatron.
- Ya existe integración con Stripe en Node/TypeScript.
- Checkout de suscripciones y pagos puntuales ya funciona desde backend con stripe.checkout.sessions.create().
- El frontend YA abre checkout en nueva pestaña y muestra toast.
- El retorno de checkout YA vuelve a /auditar con parámetros billing=success&product=....
- El webhook YA existe en /api/stripe/webhook con express.raw({ type: 'application/json' }) y valida firma.
- El webhook YA responde { verified: true } para eventos evt_test_.
- El sistema YA permite promotion codes.
- El sistema YA pasa client_reference_id, metadata.user_id, metadata.customer_email y metadata.customer_name.
- El sistema YA muestra modo sandbox y recomienda la tarjeta 4242 4242 4242 4242.
- El sistema YA tiene un panel/información de monetización dentro de /auditar.

Hallazgos probables al revisar la implementación actual:
- La lógica comercial vive sobre todo en server/stripeBilling.ts.
- Los precios y productos se crean inline con price_data dentro del checkout; no existe un archivo dedicado products.ts para centralizar definición comercial/Stripe.
- El webhook hoy prácticamente solo verifica y registra logs; no persiste identificadores esenciales de Stripe ni actualiza estado local.
- No encontré una página dedicada de historial de pagos /orders o /payments; solo estado comercial dentro de /auditar.
- La app resuelve estado comercial consultando Stripe por email/customer en tiempo real, pero no parece guardar customer_id, subscription_id, payment_intent_id o invoice_id de manera local.

Tu tarea:
1) Indica qué puntos del checklist YA están satisfechos y no deberían re-trabajarse.
2) Propón SOLO las 3 mejoras faltantes de mayor impacto real para implementar AHORA MISMO, priorizando rapidez, robustez y valor de negocio.
3) Para cada mejora, estima impacto (1-5), esfuerzo (1-5) y riesgo (1-5).
4) Elige una recomendación #1 absoluta para implementar primero.
5) Mantén foco en un producto que quiere lanzar rápido, evitando sobreingeniería.

Responde JSON estricto con este esquema:
{
  "already_satisfied": ["..."],
  "top_recommendations": [
    {
      "rank": 1,
      "title": "...",
      "why_now": "...",
      "implementation_scope": ["..."],
      "impact": 1,
      "effort": 1,
      "risk": 1
    }
  ],
  "absolute_first": {
    "title": "...",
    "reason": "..."
  },
  "anti_overengineering_note": "..."
}
""".strip()


def extract_json(text: str) -> Any:
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("{") and part.endswith("}"):
                return json.loads(part)
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return json.loads(text[start:end+1])
    raise ValueError("No JSON object found")


def call_openai() -> Any:
    api_key = os.environ["OPENAI_API_KEY"]
    r = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4.1-mini",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Responde únicamente JSON válido."},
                {"role": "user", "content": PROMPT},
            ],
        },
        timeout=120,
    )
    r.raise_for_status()
    data = r.json()
    content = data["choices"][0]["message"]["content"]
    return extract_json(content)


def call_xai() -> Any:
    api_key = os.environ["XAI_API_KEY"]
    r = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-4",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Responde únicamente JSON válido."},
                {"role": "user", "content": PROMPT},
            ],
        },
        timeout=120,
    )
    r.raise_for_status()
    data = r.json()
    content = data["choices"][0]["message"]["content"]
    return extract_json(content)


def call_gemini() -> Any:
    api_key = os.environ["GEMINI_API_KEY"]
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    schema = {
        "type": "OBJECT",
        "properties": {
            "already_satisfied": {
                "type": "ARRAY",
                "items": {"type": "STRING"},
            },
            "top_recommendations": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "rank": {"type": "INTEGER"},
                        "title": {"type": "STRING"},
                        "why_now": {"type": "STRING"},
                        "implementation_scope": {
                            "type": "ARRAY",
                            "items": {"type": "STRING"},
                        },
                        "impact": {"type": "INTEGER"},
                        "effort": {"type": "INTEGER"},
                        "risk": {"type": "INTEGER"},
                    },
                    "required": [
                        "rank",
                        "title",
                        "why_now",
                        "implementation_scope",
                        "impact",
                        "effort",
                        "risk",
                    ],
                },
            },
            "absolute_first": {
                "type": "OBJECT",
                "properties": {
                    "title": {"type": "STRING"},
                    "reason": {"type": "STRING"},
                },
                "required": ["title", "reason"],
            },
            "anti_overengineering_note": {"type": "STRING"},
        },
        "required": [
            "already_satisfied",
            "top_recommendations",
            "absolute_first",
            "anti_overengineering_note",
        ],
    }
    r = requests.post(
        url,
        headers={"Content-Type": "application/json"},
        json={
            "contents": [{"role": "user", "parts": [{"text": PROMPT}]}],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
                "responseSchema": schema,
            },
        },
        timeout=120,
    )
    r.raise_for_status()
    data = r.json()
    content = data["candidates"][0]["content"]["parts"][0]["text"]
    return extract_json(content)


def main() -> None:
    results = {}
    errors = {}
    for name, fn in (("chatgpt", call_openai), ("grok", call_xai), ("gemini", call_gemini)):
        try:
            results[name] = fn()
        except Exception as exc:  # noqa: BLE001
            errors[name] = str(exc)

    payload = {"results": results, "errors": errors}
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    if len(results) < 2:
        sys.exit(1)


if __name__ == "__main__":
    main()
