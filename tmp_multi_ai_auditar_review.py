import json
import os
import textwrap
from urllib import request, error

PROMPT = textwrap.dedent("""
Eres un reviewer senior de producto + frontend.

Contexto real de AuditaPatron:
- Plataforma web para expediente/auditoría laboral en México.
- Problema reportado en móvil: al subir el primer archivo aparece un mensaje tipo "Algo interrumpió la carga, pero tus datos siguen a salvo".
- También hay demasiado scroll móvil y demasiado texto explicativo.
- Objetivo UX: interfaz autoexplicativa, guiada, compacta, al menos 9/10.

Hallazgos de código ya verificados:
1) Frontend valida así:
   - tamaño máximo: 15 MB
   - extensiones permitidas: .pdf .xml .jpg .jpeg .png .webp .heic .heif
   - mime permitido: image/*, application/pdf, text/xml, application/xml
2) Backend valida así:
   - solo mime: application/pdf, image/jpeg, image/png, image/webp
   - tamaño máximo: 12 MB
   - además valida que la firma binaria coincida con el mime declarado
3) Los inputs del picker móvil usan capture=environment y accept="image/*,application/pdf,.xml,text/xml,application/xml"
4) El mensaje de error visible se pinta cuando submitError recibe el error del analyzeDocumentDraft.
5) La pantalla móvil actual contiene muchos bloques de apoyo, detalles, disclosures, tarjetas de progreso y copy redundante.

Devuélveme JSON estricto con esta forma:
{
  "root_cause_hypothesis": ["máximo 4 bullets muy concretos"],
  "most_likely_primary_cause": "una sola frase",
  "ux_compaction_actions": ["máximo 6 acciones priorizadas"],
  "guardrails_to_keep": ["máximo 4 elementos"],
  "copy_to_delete_first": ["máximo 6 elementos o zonas"],
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
