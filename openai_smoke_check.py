import json, os, requests
key = os.environ.get('OPENAI_API_KEY','').strip()
if not key:
    print('missing_key')
    raise SystemExit(0)
resp = requests.post(
    'https://api.openai.com/v1/chat/completions',
    headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
    json={
        'model': 'gpt-4.1-mini',
        'temperature': 0,
        'messages': [
            {'role':'system','content':'Responde solo JSON válido.'},
            {'role':'user','content':'Devuelve {"ok":true,"engine":"chatgpt"}'}
        ],
        'response_format': {'type': 'json_object'}
    },
    timeout=45,
)
print(resp.status_code)
print(resp.text[:800])
