import json
import os
import requests

output_path = "/home/ubuntu/complilink_operativo_v1/tmp_bridge_payload_adapter_multi_model_v4_output.json"

context = {
    "observed_facts": {
        "local_intake_now_forwards": True,
        "local_loopback_dispatch": "sendDocumentToAuditaPatronEngine still dispatches to 127.0.0.1:3000/api/auditapatron/webhook in dev, but the local intake now forwards upstream synchronously.",
        "wrong_public_path": {
            "url": "https://complilink.mx/api/auditapatron/webhook",
            "post_with_signature": {"status": 200, "content_type": "text/html", "meaning": "frontend HTML, not API"},
            "post_with_bearer": {"status": 200, "content_type": "text/html", "meaning": "frontend HTML, not API"},
        },
        "candidate_api_path": {
            "url": "https://complilink.mx/api/integrations/auditapatron/bridge",
            "post_with_signature": {"status": 403, "body": "Auditapatrón bridge authentication failed"},
            "post_with_bearer": {
                "status": 400,
                "body": {
                    "error": "Invalid Auditapatrón bridge payload",
                    "issues": [
                        {"path": "documentId", "message": "Invalid input: expected number, received NaN"},
                        {"path": "category", "message": "Invalid option: expected one of repse_certificate|imss_opinion|sat_certificate|contract|infonavit_opinion|other"},
                        {"path": "processingStatus", "message": "Invalid option: expected one of received|pending|processing|accepted|failed"},
                    ],
                },
            },
        },
        "other_candidate": {
            "url": "https://complilink.mx/api/internal/helios/bridge",
            "post_with_bearer": {"status": 400, "body": {"error": "Invalid Helios bridge payload", "issues": [{"path": "action", "message": "Invalid input"}]}}
        },
        "current_local_payload_sample": {
            "documentId": "DOC-E5AD0B07DEA847AE",
            "category": "cfdi_nomina",
            "processingStatus": "queued",
            "mimeType": "application/xml",
            "fileUrl": "https://...cloudfront.../JAIME_SANTIAGO_LOPEZ.xml",
            "sourceCaseId": "CASE-BALT-1-MPQ5YBNG",
            "sourceDocumentId": "DOC-E5AD0B07DEA847AE",
            "uploadedAt": "2026-05-29T00:08:11.000Z",
            "eventName": "document.uploaded",
            "correlationId": "9d950b8e-475c-4506-a422-59156315c061",
            "operationalContext": {
                "traceId": "trace...",
                "sha256": "da9936...",
                "documentType": "cfdi",
            },
        },
        "goal": "Infer the minimum payload/auth adapter needed so the local intake can forward to the correct remote API and eventually receive async callbacks."
    }
}

prompt = (
    'You are a senior integration architect. Return valid JSON only with this schema: '
    '{"root_cause_assessment":{"most_likely_root_cause":"string","confidence":"high|medium|low","why":["string"]},'
    '"recommended_fix":{"change_type":"config_only|code_and_config|code_only","primary_action":"string","secondary_actions":["string"],"why":["string"]},'
    '"payload_mapping":{"target_url":"string","auth":"string","field_map":[{"from":"string","to":"string","transform":"string"}],"assumptions":["string"]},'
    '"implementation_outline":["string"],"test_plan":["string"],"one_sentence_verdict":"string"}. '
    'Infer the minimum adapter from this factual context: ' + json.dumps(context, ensure_ascii=False)
)

results = {"context": context, "prompt": prompt, "responses": {}, "parsed": {}}

openai_key = os.environ.get("OPENAI_API_KEY")
if openai_key:
    r = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
        json={
            "model": "gpt-4.1-mini",
            "temperature": 0.2,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=120,
    )
    results["responses"]["chatgpt"] = {"status_code": r.status_code, "body": r.json()}
    try:
        text = r.json()["choices"][0]["message"]["content"]
        results["parsed"]["chatgpt"] = {"text": text, "json": json.loads(text)}
    except Exception as e:
        results["parsed"]["chatgpt"] = {"error": str(e)}

xai_key = os.environ.get("XAI_API_KEY")
if xai_key:
    r = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={"Authorization": f"Bearer {xai_key}", "Content-Type": "application/json"},
        json={
            "model": "grok-4.1",
            "temperature": 0.2,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=120,
    )
    results["responses"]["grok"] = {"status_code": r.status_code, "body": r.json()}
    try:
        text = r.json()["choices"][0]["message"]["content"]
        results["parsed"]["grok"] = {"text": text, "json": json.loads(text)}
    except Exception as e:
        results["parsed"]["grok"] = {"error": str(e)}

gemini_key = os.environ.get("GEMINI_API_KEY")
if gemini_key:
    r = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}",
        headers={"Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
        },
        timeout=120,
    )
    results["responses"]["gemini"] = {"status_code": r.status_code, "body": r.json()}
    try:
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        results["parsed"]["gemini"] = {"text": text, "json": json.loads(text)}
    except Exception as e:
        results["parsed"]["gemini"] = {"error": str(e)}

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print(output_path)
