import json
import os
import requests

output_path = "/home/ubuntu/complilink_operativo_v1/tmp_callback_persistence_fix_multi_model_output.json"

context = {
    "observed_facts": {
        "local_return_handler_currently_requires": {
            "supported_events": [
                "document.processed.v1",
                "document.rejected.v1",
                "document.retry_requested.v1",
            ],
            "document_lookup": "The handler currently resolves the local document only with getDocumentById(payload.documentId).",
            "auth": "Bearer shared secret or signed webhook are both accepted.",
        },
        "last_remote_ack_for_xml": {
            "local_document_id": "DOC-B5CA99C1DA264715",
            "remote_document_id": 210005,
            "dispatch_correlation_id": "6329d7e2-d469-4a26-8c56-dba0866b6161",
            "ack_correlation_id": "trace.balt-1.CASE-BALT-1-MQ16PGFO.mq16pgfoz2bi63",
            "trace_id": "trace.balt-1.CASE-BALT-1-MQ16PGFO.mq16pgfoz2bi63",
            "source_document_id_sent": "DOC-B5CA99C1DA264715",
            "current_response_event": {
                "eventName": "document.retry_requested.v1",
                "finality": "transient",
                "providerId": 30001,
                "documentId": 210005,
                "traceId": "trace.balt-1.CASE-BALT-1-MQ16PGFO.mq16pgfoz2bi63",
            },
        },
        "last_remote_ack_for_contract": {
            "local_document_id": "DOC-29C11F6834974FD5",
            "remote_document_id": 210006,
            "dispatch_correlation_id": "ad46d102-ea94-4dd6-b7e5-82dc87339113",
            "ack_correlation_id": "trace.balt-1.CASE-BALT-1-MQ16PGFO.mq16pgfoz2bi63",
            "trace_id": "trace.balt-1.CASE-BALT-1-MQ16PGFO.mq16pgfoz2bi63",
            "source_document_id_sent": "DOC-29C11F6834974FD5",
            "current_response_event": {
                "eventName": "document.retry_requested.v1",
                "finality": "transient",
                "providerId": 30001,
                "documentId": 210006,
                "traceId": "trace.balt-1.CASE-BALT-1-MQ16PGFO.mq16pgfoz2bi63",
            },
        },
        "remote_contract_claims": {
            "callback_delivery": "outbound_webhook",
            "auth": "Authorization Bearer <shared-secret>",
            "correlation_id_policy": "echo_exact_dispatch_correlation_id",
        },
        "actual_behavior_seen": {
            "dispatch_status": "HTTP 200 sent for both documents",
            "local_webhook_events_after_wait": "still empty",
            "mismatch": "The ack says correlationId should echo dispatch correlation id, but actual ack correlationId equals traceId.",
        },
        "suspected_gap": [
            "The final webhook may arrive with remote documentId instead of local document UUID.",
            "The final webhook may carry traceId or metadata/sourceDocumentId, but the handler does not use those fallbacks.",
            "The synchronous currentResponseEvent in the ack is not being ingested into local webhook events.",
        ],
        "goal": "Find the minimum safe local fix that closes webhook event persistence without fabricating remote finality and while remaining compatible with a later true outbound webhook.",
    }
}

prompt = (
    'You are a senior integration architect. Return valid JSON only with this schema: '
    '{"root_cause":{"most_likely":"string","confidence":"high|medium|low","why":["string"]},'
    '"recommended_fix":{"primary_action":"string","secondary_actions":["string"],"do_not_do":["string"],"why":["string"]},'
    '"resolution_strategy":{"document_resolution_order":["string"],"event_ingestion_policy":{"ingest_sync_ack_current_response_event":true,"conditions":["string"],"why":"string"},"idempotency_rules":["string"]},'
    '"implementation_notes":["string"],"test_plan":["string"],"one_sentence_verdict":"string"}. '
    'Use this factual context and infer the safest minimum change: ' + json.dumps(context, ensure_ascii=False)
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
            "model": "grok-4",
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
