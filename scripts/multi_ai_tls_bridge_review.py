import json
import os
import subprocess
from pathlib import Path

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
TEST_PATH = PROJECT_ROOT / 'server' / 'auditaPatronBridgeSecret.test.ts'
OUTPUT_PATH = Path('/tmp/bridge_tls_multi_ai.json')

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
XAI_API_KEY = os.getenv('XAI_API_KEY', '')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')

health_url = 'https://complilink.mx/api/auditapatron/health'
webhook_url = os.getenv('AUDITAPATRON_ENGINE_WEBHOOK_URL', 'https://complilink.mx/api/auditapatron/webhook')


def run_cmd(cmd: list[str]) -> dict:
    try:
        completed = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
        return {
            'command': ' '.join(cmd),
            'returncode': completed.returncode,
            'stdout': completed.stdout[-4000:],
            'stderr': completed.stderr[-4000:],
        }
    except Exception as exc:
        return {
            'command': ' '.join(cmd),
            'error': f'{type(exc).__name__}: {exc}',
        }


def call_openai(prompt: str) -> dict:
    if not OPENAI_API_KEY:
        return {'ok': False, 'error': 'OPENAI_API_KEY missing'}
    try:
        response = requests.post(
            'https://api.openai.com/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {OPENAI_API_KEY}',
                'Content-Type': 'application/json',
            },
            json={
                'model': 'gpt-4.1-mini',
                'temperature': 0.2,
                'response_format': {'type': 'json_object'},
                'messages': [
                    {'role': 'system', 'content': 'Eres un ingeniero senior de plataforma y TLS. Responde solo JSON válido.'},
                    {'role': 'user', 'content': prompt},
                ],
            },
            timeout=70,
        )
        return {
            'ok': response.ok,
            'status_code': response.status_code,
            'body': response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text,
        }
    except Exception as exc:
        return {'ok': False, 'error': f'{type(exc).__name__}: {exc}'}


def call_xai(prompt: str) -> dict:
    if not XAI_API_KEY:
        return {'ok': False, 'error': 'XAI_API_KEY missing'}
    try:
        response = requests.post(
            'https://api.x.ai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {XAI_API_KEY}',
                'Content-Type': 'application/json',
            },
            json={
                'model': 'grok-4-0709',
                'temperature': 0.2,
                'response_format': {'type': 'json_object'},
                'messages': [
                    {'role': 'system', 'content': 'Eres un ingeniero senior de plataforma y TLS. Responde solo JSON válido.'},
                    {'role': 'user', 'content': prompt},
                ],
            },
            timeout=70,
        )
        return {
            'ok': response.ok,
            'status_code': response.status_code,
            'body': response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text,
        }
    except Exception as exc:
        return {'ok': False, 'error': f'{type(exc).__name__}: {exc}'}


def call_gemini(prompt: str) -> dict:
    if not GEMINI_API_KEY:
        return {'ok': False, 'error': 'GEMINI_API_KEY missing'}
    try:
        response = requests.post(
            f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}',
            headers={'Content-Type': 'application/json'},
            json={
                'system_instruction': {
                    'parts': [{'text': 'Eres un ingeniero senior de plataforma y TLS. Responde solo JSON válido.'}]
                },
                'generationConfig': {
                    'temperature': 0.2,
                    'responseMimeType': 'application/json',
                },
                'contents': [
                    {
                        'role': 'user',
                        'parts': [{'text': prompt}],
                    }
                ],
            },
            timeout=70,
        )
        return {
            'ok': response.ok,
            'status_code': response.status_code,
            'body': response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text,
        }
    except Exception as exc:
        return {'ok': False, 'error': f'{type(exc).__name__}: {exc}'}


test_content = TEST_PATH.read_text()
probe_curl = run_cmd(['curl', '-sS', '--tlsv1.2', '-D', '-', health_url, '-o', '/tmp/bridge_health_probe_body.json'])
probe_openssl = run_cmd(['openssl', 's_client', '-connect', 'complilink.mx:443', '-servername', 'complilink.mx', '-brief'])

prompt = f'''Analiza este fallo real de una suite Vitest de un proyecto Node/TypeScript.

Contexto:
- La prueba `server/auditaPatronBridgeSecret.test.ts` hace GET a `{health_url}` y POST firmado a `{webhook_url}`.
- Desde Node fetch y también desde curl con TLS 1.2 falla el handshake.
- Error observado: `ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE` y `sslv3 alert handshake failure`.
- Necesito decidir si el problema es del servidor remoto/TLS/CDN/WAF/certificado, si el test está mal planteado por depender de un endpoint externo, o si hay una mitigación local sensata.
- Importa preservar seguridad; no quiero hacks inseguros ni desactivar TLS verification.

Archivo de prueba actual:
```ts
{test_content}
```

Evidencia curl:
```json
{json.dumps(probe_curl, ensure_ascii=False, indent=2)}
```

Evidencia openssl:
```json
{json.dumps(probe_openssl, ensure_ascii=False, indent=2)}
```

Responde SOLO como JSON con esta forma exacta:
{{
  "likely_root_cause": "string",
  "confidence": "high|medium|low",
  "server_side_or_local": "server_side|local_test_design|mixed|unknown",
  "evidence_used": ["string"],
  "recommended_action": "string",
  "recommended_test_strategy": "string",
  "safe_mitigation_now": "string",
  "what_not_to_do": ["string"],
  "notes": ["string"]
}}
'''

results = {
    'prompt_summary': {
        'health_url': health_url,
        'webhook_url': webhook_url,
    },
    'probes': {
        'curl_tls12': probe_curl,
        'openssl_s_client': probe_openssl,
    },
    'models': {
        'openai': call_openai(prompt),
        'grok': call_xai(prompt),
        'gemini': call_gemini(prompt),
    },
}

OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(str(OUTPUT_PATH))
