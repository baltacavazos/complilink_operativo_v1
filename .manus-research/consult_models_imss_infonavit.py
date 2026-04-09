import json
import os
from pathlib import Path

import requests

PROMPT = """Contexto: AuditaPatron es una landing para trabajadores mexicanos, con tono cálido, claro y no técnico. El hero actual habla de claridad laboral desde el primer documento. Estamos evaluando si mencionar explícitamente en la home o hero que con AuditaPatron puedes revisar si estás bien dado de alta en el IMSS e Infonavit.

Quiero una respuesta breve pero sustanciosa en español con este formato exacto:
1. Veredicto: SI / SI, CON MATICES / NO
2. Impacto en efecto wow: alto / medio / bajo
3. Riesgo principal de comunicación en 1 frase
4. Recomendación de ubicación: hero principal / subtítulo hero / lista de beneficios / sección secundaria
5. Mejor ángulo de copy en 1 o 2 frases, sin sonar a promesa legal absoluta ni a afirmación regulatoria excesiva
6. Una propuesta de microcopy de máximo 18 palabras

Evalúa desde marketing, claridad, confianza y riesgo reputacional. Importa mucho que no suene técnico ni engañoso."""

OUTDIR = Path("/home/ubuntu/complilink_operativo_v1/.manus-research")
OUTDIR.mkdir(parents=True, exist_ok=True)


def save(name: str, payload: dict) -> None:
    (OUTDIR / f"{name}_imss_infonavit.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def call_gemini() -> dict:
    api_key = os.environ["GEMINI_API_KEY"]
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": PROMPT,
                    }
                ]
            }
        ]
    }
    response = requests.post(url, json=payload, timeout=60)
    response.raise_for_status()
    return response.json()


def call_openai() -> dict:
    api_key = os.environ["OPENAI_API_KEY"]
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {
                "role": "system",
                "content": "Responde en español, con criterio de UX, marketing y comunicación responsable.",
            },
            {
                "role": "user",
                "content": PROMPT,
            },
        ],
    }
    response = requests.post(
        url,
        headers={"Authorization": f"Bearer {api_key}"},
        json=payload,
        timeout=60,
    )
    response.raise_for_status()
    return response.json()


def call_grok() -> dict:
    api_key = os.environ["XAI_API_KEY"]
    url = "https://api.x.ai/v1/chat/completions"
    payload = {
        "model": "grok-4",
        "messages": [
            {
                "role": "system",
                "content": "Responde en español, con criterio de UX, marketing y comunicación responsable.",
            },
            {
                "role": "user",
                "content": PROMPT,
            },
        ],
    }
    response = requests.post(
        url,
        headers={"Authorization": f"Bearer {api_key}"},
        json=payload,
        timeout=60,
    )
    response.raise_for_status()
    return response.json()


def main() -> None:
    results = {}
    for name, fn in (("gemini", call_gemini), ("openai", call_openai), ("grok", call_grok)):
        try:
            payload = fn()
            save(name, payload)
            results[name] = "ok"
        except Exception as exc:  # noqa: BLE001
            error_payload = {"error": str(exc)}
            save(name, error_payload)
            results[name] = f"error: {exc}"
    print(json.dumps(results, ensure_ascii=False))


if __name__ == "__main__":
    main()
