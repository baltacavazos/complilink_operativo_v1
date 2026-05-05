#!/usr/bin/env python3
import json
import os
import re
from pathlib import Path

import requests

ROOT = Path('/home/ubuntu/complilink_operativo_v1')
PROMPT_PATH = ROOT / 'tmp_ronda9_tri_ai_prompt.md'
OUTPUT_PATH = ROOT / 'tmp_ronda9_tri_ai_compare.json'
TIMEOUT = 120


def load_prompt() -> str:
    return PROMPT_PATH.read_text(encoding='utf-8')


def extract_json_block(text: str):
    text = (text or '').strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        pass
    match = re.search(r'```json\s*(\{.*?\})\s*```', text, re.S)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass
    match = re.search(r'(\{.*\})', text, re.S)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            return None
    return None


def call_openai(prompt: str):
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'provider': 'openai', 'error': 'OPENAI_API_KEY missing'}
    url = 'https://api.openai.com/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    models = ['gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4.1']
    last_error = None
    for model in models:
        payload = {
            'model': model,
            'temperature': 0.1,
            'response_format': {'type': 'json_object'},
            'messages': [
                {
                    'role': 'system',
                    'content': 'Responde únicamente JSON válido siguiendo exactamente el esquema solicitado por el usuario.'
                },
                {'role': 'user', 'content': prompt},
            ],
        }
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=TIMEOUT)
            if response.ok:
                data = response.json()
                content = data['choices'][0]['message']['content']
                return {
                    'provider': 'openai',
                    'model': model,
                    'raw': content,
                    'parsed': extract_json_block(content),
                }
            last_error = {'status': response.status_code, 'body': response.text[:4000], 'model': model}
        except Exception as exc:
            last_error = {'model': model, 'exception': str(exc)}
    return {'provider': 'openai', 'error': last_error}


def call_xai(prompt: str):
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'provider': 'xai', 'error': 'XAI_API_KEY missing'}
    url = 'https://api.x.ai/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    models = ['grok-3-mini', 'grok-4', 'grok-3']
    last_error = None
    for model in models:
        payload = {
            'model': model,
            'temperature': 0.1,
            'response_format': {'type': 'json_object'},
            'messages': [
                {
                    'role': 'system',
                    'content': 'Responde únicamente JSON válido siguiendo exactamente el esquema solicitado por el usuario.'
                },
                {'role': 'user', 'content': prompt},
            ],
        }
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=TIMEOUT)
            if response.ok:
                data = response.json()
                content = data['choices'][0]['message']['content']
                return {
                    'provider': 'xai',
                    'model': model,
                    'raw': content,
                    'parsed': extract_json_block(content),
                }
            last_error = {'status': response.status_code, 'body': response.text[:4000], 'model': model}
        except Exception as exc:
            last_error = {'model': model, 'exception': str(exc)}
    return {'provider': 'xai', 'error': last_error}


def call_gemini(prompt: str):
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'provider': 'gemini', 'error': 'GEMINI_API_KEY missing'}
    models = ['gemini-2.5-flash', 'gemini-2.0-flash']
    last_error = None
    for model in models:
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
        payload = {
            'systemInstruction': {
                'parts': [
                    {'text': 'Responde únicamente JSON válido siguiendo exactamente el esquema solicitado por el usuario.'}
                ]
            },
            'contents': [
                {
                    'role': 'user',
                    'parts': [{'text': prompt}],
                }
            ],
            'generationConfig': {
                'temperature': 0.1,
                'responseMimeType': 'application/json',
            },
        }
        try:
            response = requests.post(url, json=payload, timeout=TIMEOUT)
            if response.ok:
                data = response.json()
                content = data['candidates'][0]['content']['parts'][0]['text']
                return {
                    'provider': 'gemini',
                    'model': model,
                    'raw': content,
                    'parsed': extract_json_block(content),
                }
            last_error = {'status': response.status_code, 'body': response.text[:4000], 'model': model}
        except Exception as exc:
            last_error = {'model': model, 'exception': str(exc)}
    return {'provider': 'gemini', 'error': last_error}


def summarize(results: dict):
    parsed = {
        provider: payload.get('parsed')
        for provider, payload in results.items()
        if isinstance(payload, dict) and payload.get('parsed')
    }

    title_votes = []
    body_votes = []
    cta_votes = []
    hint_votes = []
    safe_fixes = []
    blockers = []
    scores = []
    real_issue_votes = []

    for payload in parsed.values():
        verdict = payload.get('post_upload_verdict', {})
        copy = verdict.get('replacement_copy', {})
        if copy.get('title'):
            title_votes.append(copy['title'])
        if copy.get('body'):
            body_votes.append(copy['body'])
        if copy.get('cta'):
            cta_votes.append(copy['cta'])
        if copy.get('hint'):
            hint_votes.append(copy['hint'])
        issue = payload.get('first_upload_mobile_issue', {})
        if 'is_real_issue' in issue:
            real_issue_votes.append(bool(issue.get('is_real_issue')))
        if issue.get('safe_fix'):
            safe_fixes.append(issue['safe_fix'])
        readiness = payload.get('publish_readiness', {})
        if isinstance(readiness.get('score'), (int, float)):
            scores.append(readiness['score'])
        blocker = readiness.get('blocker')
        if blocker:
            blockers.append(blocker)

    avg_score = round(sum(scores) / len(scores), 2) if scores else None

    return {
        'parsed_providers': list(parsed.keys()),
        'consensus': {
            'first_upload_issue_real': sum(1 for vote in real_issue_votes if vote) >= max(1, len(real_issue_votes) - 0),
            'candidate_title_options': title_votes,
            'candidate_body_options': body_votes,
            'candidate_cta_options': cta_votes,
            'candidate_hint_options': hint_votes,
            'candidate_safe_fixes': safe_fixes,
            'average_publish_score': avg_score,
            'blockers': blockers,
        },
    }


def main():
    prompt = load_prompt()
    results = {
        'openai': call_openai(prompt),
        'xai': call_xai(prompt),
        'gemini': call_gemini(prompt),
    }
    output = {
        'prompt_path': str(PROMPT_PATH),
        'results': results,
        'summary': summarize(results),
    }
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
    print(str(OUTPUT_PATH))


if __name__ == '__main__':
    main()
