import json
import os
import sys
from typing import Any

import requests

SYSTEM_PROMPT = """Eres un arquitecto principal de confiabilidad para una plataforma legal-operativa. Debes recomendar SOLO el siguiente endurecimiento mínimo más rentable, sin abrir frentes grandes. Responde estrictamente en JSON válido con este esquema exacto: {\"recommended_target\": string, \"priority_rank\": [{\"target\": string, \"score\": number, \"why\": string}], \"minimum_change\": string, \"tests_to_add\": [string], \"risks\": [string], \"confidence\": \"high\"|\"medium\"|\"low\"}. No añadas markdown ni texto fuera del JSON."""

USER_PROMPT = """Contexto resumido del proyecto AuditaPatron / CompliLink:
- Ya se endureció el worker del CEO Bridge para degradar de forma segura cuando faltan tablas de agenda en arranque.
- Ya se restauró la credencial de Dropbox y la validación del secreto volvió a pasar.
- El objetivo ahora es elegir el siguiente bloque mínimo de robustez que más valor aporte bajo carga realista, sin abrir frentes grandes.

Candidatos concretos:
1) assertCaseAccess y rutas relacionadas tenant-caso en server/db.ts.
   Evidencia: getAccessibleCaseIds, assertCaseAccess, getCaseDetailForUser, listVisibleDocuments y listAuditTrail dependen de validaciones de acceso repetidas. Las pruebas server/db.access.test.ts muestran múltiples consultas para resolver acceso por tenant y por caso.
2) Descarga y visibilidad documental.
   Evidencia: listVisibleDocuments y getVisibleDocumentForUser dependen de assertCaseAccess y luego aplican filtros por visibilidad; la descarga usa storageGet en routers.ts.
3) Deduplicación/transientes de carga documental en routers.ts.
   Evidencia: ya existe deduplicación temporal para uploadDocument, analyzeDocumentDraft, confirmDocumentDraft y confirmDocumentDraftCompleted.
4) Exportes CEO.
   Evidencia: existe snapshot stale guard y auditoría; ya están más protegidos que otros flujos.

Tu tarea:
- Prioriza estos candidatos para el SIGUIENTE cambio mínimo.
- Favorece el cambio que reduzca consultas repetidas, mejore robustez bajo concurrencia/carga realista y tenga radio de impacto controlado.
- Evita proponer migraciones amplias, refactors grandes o nuevas integraciones.
- Si recomiendas assertCaseAccess/acceso tenant-caso, concreta un cambio mínimo plausible, por ejemplo consolidación de consultas o memoización local por request, pero elige solo una línea principal.
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
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
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
    response = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=90)
    response.raise_for_status()
    data = response.json()
    content = data["candidates"][0]["content"]["parts"][0]["text"]
    return {"provider": "gemini", "result": _extract_json(content)}


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
