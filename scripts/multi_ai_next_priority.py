import json
import os
import sys
from typing import Any

import requests

SYSTEM_PROMPT = """Eres un arquitecto principal de confiabilidad para una plataforma legal-operativa. Debes recomendar SOLO el siguiente endurecimiento mínimo más rentable, sin abrir frentes grandes. Responde estrictamente en JSON válido con este esquema exacto: {\"recommended_target\": string, \"priority_rank\": [{\"target\": string, \"score\": number, \"why\": string}], \"minimum_change\": string, \"tests_to_add\": [string], \"risks\": [string], \"confidence\": \"high\"|\"medium\"|\"low\"}. No añadas markdown ni texto fuera del JSON."""

USER_PROMPT = """Contexto resumido del proyecto AuditaPatron / CompliLink:
- Ya se endureció el worker del CEO Bridge para degradar de forma segura cuando faltan tablas de agenda en arranque.
- Ya se restauró la credencial de Dropbox y la validación del secreto volvió a pasar.
- Ya se consolidó el acceso tenant-caso para reducir consultas redundantes sin cambiar la semántica de permisos.
- El objetivo ahora es elegir el siguiente bloque mínimo de robustez que más valor aporte bajo carga realista, sin abrir frentes grandes.

Candidatos concretos:
1) Descarga y visibilidad documental.
   Evidencia: listVisibleDocuments y getVisibleDocumentForUser dependen de assertCaseAccess, filtros de visibilidad y acceso por caso; cualquier descarga usa storageGet desde routers.ts.
2) Exportes CEO y generación de archivos.
   Evidencia: tienen stale guard y auditoría, pero siguen siendo flujos costosos por volumen y pueden requerir límites o trazabilidad adicional por solicitud.
3) Listados documentales de alto volumen.
   Evidencia: después del endurecimiento de acceso, queda margen para recortar sobrelectura o afinación de queries en listados ligados a caso/tenant.
4) Carga documental transiente.
   Evidencia: ya existe deduplicación temporal y guardrails de concurrencia en los endpoints principales, por lo que parece menos urgente.

Tu tarea:
- Prioriza estos candidatos para el SIGUIENTE cambio mínimo.
- Favorece el cambio que mejore robustez bajo concurrencia/carga realista, mantenga radio de impacto controlado y sea fácil de cubrir con pruebas.
- Evita proponer migraciones amplias, refactors grandes o nuevas integraciones.
- Si recomiendas descargas/exportes, concreta una línea mínima plausible, por ejemplo validación centralizada, límites defensivos, short-circuit temprano o trazabilidad por solicitud, pero elige solo una línea principal.
"""


def _extract_json(text: str) -> Any:
    text = text.strip()
    if not text:
        raise ValueError("empty response")
    try:
        return json.loads(text)
    except Exception:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start:end+1])
        raise


def call_openai() -> Any:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"provider": "openai", "error": "OPENAI_API_KEY missing"}
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": "gpt-4.1-mini",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_PROMPT},
        ],
    }
    response = requests.post(url, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json=payload, timeout=90)
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return {"provider": "openai", "result": _extract_json(content)}


def call_gemini() -> Any:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"provider": "gemini", "error": "GEMINI_API_KEY missing"}
    payload = {
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": SYSTEM_PROMPT + "\n\n" + USER_PROMPT}],
            }
        ],
    }
    last_error = None
    for model in ("gemini-2.5-flash", "gemini-2.0-flash"):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        try:
            response = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=90)
            response.raise_for_status()
            data = response.json()
            content = data["candidates"][0]["content"]["parts"][0]["text"]
            return {"provider": "gemini", "model": model, "result": _extract_json(content)}
        except Exception as exc:
            last_error = exc
    raise last_error if last_error else RuntimeError("gemini call failed")


def call_grok() -> Any:
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return {"provider": "grok", "error": "XAI_API_KEY missing"}
    url = "https://api.x.ai/v1/chat/completions"
    payload = {
        "model": "grok-4",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_PROMPT},
        ],
    }
    response = requests.post(url, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json=payload, timeout=90)
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return {"provider": "grok", "result": _extract_json(content)}


def main() -> int:
    results = []
    for fn in (call_openai, call_gemini, call_grok):
        try:
            results.append(fn())
        except Exception as exc:
            results.append({"provider": fn.__name__.replace("call_", ""), "error": str(exc)})
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
