import json
import os
import sys
import urllib.request

PROMPT = r'''
Contexto del proyecto:
- Plataforma web AuditaPatron, con flujo principal /auditar ya operativo y Dropbox cerrado/estable.
- El proyecto quedó listo para retomar desarrollo principal.
- Restricciones: mantener TypeScript/LSP estables, priorizar valor operativo real, no romper flujos existentes, y favorecer entregables recuperables/operables hoy.
- El usuario quiere enfoque multimodelo y optimización de créditos.

Pendientes candidatos extraídos de la bitácora y del contexto heredado:
1. Bitácora operativa centralizada mínima y superficie inicial de monitoreo para diagnóstico.
2. Export recuperable de base de datos para completar la estrategia de recuperación/backup.
3. Automatizar ejecución de backups en milestones concretos.
4. Gestión operativa de alertas con estados accionables.
5. Confirmar contrato técnico remoto de Helios/adaptador endurecido.

Tu tarea:
- Evalúa cuál debe ser el siguiente frente inmediato MÁS importante a implementar ahora.
- Considera: impacto operativo, reducción de riesgo, dependencia para futuras funciones, velocidad de entrega, facilidad de prueba y recuperación ante fallos.
- Devuelve JSON estricto con este esquema:
{
  "recommended_front": "uno de los cinco candidatos o una reformulación muy cercana",
  "ranking": [
    {"front": "...", "score": 0-100, "why": "..."}
  ],
  "scope_for_next_iteration": ["3 a 6 entregables concretos"],
  "main_risks": ["..."],
  "why_now": "...",
  "defer_for_later": ["..."],
  "confidence": "low|medium|high"
}
- El ranking debe incluir los 5 frentes.
- Sé práctico: prioriza lo que más fortalezca operación y recuperación en el corto plazo.
- Responde solo JSON válido.
'''.strip()


def post_json(url, headers, payload):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def call_openai(prompt):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY missing")
    payload = {
        "model": "gpt-4.1-mini",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un arquitecto técnico pragmático. Devuelves JSON estricto."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }
    data = post_json(
        "https://api.openai.com/v1/chat/completions",
        {"Authorization": f"Bearer {api_key}"},
        payload,
    )
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)


def call_gemini(prompt):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY missing")
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }
    data = post_json(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        {},
        payload,
    )
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(text)


def call_xai(prompt):
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        raise RuntimeError("XAI_API_KEY missing")
    payload = {
        "model": "grok-3-mini",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un arquitecto técnico pragmático. Devuelves JSON estricto."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }
    data = post_json(
        "https://api.x.ai/v1/chat/completions",
        {"Authorization": f"Bearer {api_key}"},
        payload,
    )
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)


def main():
    results = {}
    errors = {}
    for name, fn in (("openai", call_openai), ("gemini", call_gemini), ("grok", call_xai)):
        try:
            results[name] = fn(PROMPT)
        except Exception as exc:
            errors[name] = str(exc)
    output = {"prompt": PROMPT, "results": results, "errors": errors}
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
