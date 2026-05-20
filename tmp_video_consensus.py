import json
import os
import requests
from datetime import datetime

PROMPT = """Actúa como estratega senior de conversión y producto para una plataforma legal-laboral en México.

Contexto del producto:
- Nombre: Auditapatron.
- Público principal: trabajadores en México.
- Promesa visible actual: subir una foto o PDF del recibo para revisar si les pagan de menos y detectar diferencias en pago, deducciones o CFDI.
- La plataforma busca transmitir claridad, confianza, facilidad de uso y utilidad inmediata.
- La pregunta estratégica es: ¿conviene hacer un video corto que explique la plataforma?

Quiero una respuesta ESTRICTAMENTE en JSON válido con esta estructura exacta:
{
  "verdict": "si" | "no" | "depende",
  "confidence": 0-100,
  "top_line": "una frase de máximo 20 palabras",
  "why_it_helps": ["razón 1", "razón 2", "razón 3"],
  "main_risks": ["riesgo 1", "riesgo 2", "riesgo 3"],
  "best_use_case": "explica el mejor uso del video",
  "recommended_length_seconds": number,
  "recommended_style": "estilo recomendado en una frase",
  "placement": "dónde usarlo primero",
  "script_focus": ["punto 1", "punto 2", "punto 3"],
  "final_recommendation": "recomendación final en máximo 60 palabras"
}

Criterios para decidir:
- Prioriza conversión, claridad, reducción de fricción y construcción de confianza.
- Penaliza el video si añade ruido, tiempo de carga o distrae del CTA principal.
- Si respondes que sí o depende, asume un formato muy corto y de alta claridad.
- No expliques fuera del JSON.
"""


def post_json(url, headers=None, payload=None, timeout=60):
    response = requests.post(url, headers=headers or {}, json=payload or {}, timeout=timeout)
    response.raise_for_status()
    return response.json()


def extract_json_from_text(text):
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) >= 3:
            text = "\n".join(lines[1:-1]).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start:end+1]
    return json.loads(text)


def ask_openai():
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return {"error": "OPENAI_API_KEY missing"}
    payload = {
        "model": "gpt-4.1-mini",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un estratega de producto y conversión. Responde solo JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
    }
    data = post_json(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        payload=payload,
    )
    content = data["choices"][0]["message"]["content"]
    return extract_json_from_text(content)


def ask_grok():
    key = os.environ.get("XAI_API_KEY")
    if not key:
        return {"error": "XAI_API_KEY missing"}
    payload = {
        "model": "grok-3-mini",
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": "Eres un estratega de producto y conversión. Responde solo JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
        "response_format": {"type": "json_object"},
    }
    data = post_json(
        "https://api.x.ai/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        payload=payload,
    )
    content = data["choices"][0]["message"]["content"]
    return extract_json_from_text(content)


def ask_gemini():
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
    data = post_json(url, headers={"Content-Type": "application/json"}, payload=payload)
    content = data["candidates"][0]["content"]["parts"][0]["text"]
    return extract_json_from_text(content)


def main():
    results = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "prompt": PROMPT,
        "results": {
            "chatgpt": ask_openai(),
            "grok": ask_grok(),
            "gemini": ask_gemini(),
        },
    }
    out = "/home/ubuntu/complilink_operativo_v1/tmp_video_consensus_results.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(out)


if __name__ == "__main__":
    main()
