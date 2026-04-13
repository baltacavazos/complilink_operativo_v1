import os
from pathlib import Path

ROOT = Path('/home/ubuntu/complilink_operativo_v1')
PROMPT_PATH = ROOT / 'audit' / 'round6_post_impl_prompt.md'
OUT_DIR = ROOT / 'audit' / 'round6_post_impl_outputs'
OUT_DIR.mkdir(parents=True, exist_ok=True)

prompt = PROMPT_PATH.read_text()

SYSTEM = (
    'Eres un auditor senior de UX/UI, producto, conversión, confianza y resiliencia de flujo. '
    'Responde en español de forma estricta, concreta y accionable.'
)


def call_openai():
    try:
        from openai import OpenAI
        client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
        resp = client.chat.completions.create(
            model='gpt-4.1',
            messages=[
                {'role': 'system', 'content': SYSTEM},
                {'role': 'user', 'content': prompt},
            ],
            temperature=0.3,
        )
        content = resp.choices[0].message.content or ''
        (OUT_DIR / 'chatgpt_round6_post_impl.md').write_text(content)
        return 'chatgpt_round6_post_impl.md'
    except Exception as exc:
        (OUT_DIR / 'chatgpt_round6_post_impl.md').write_text(f'ERROR\n\n{exc}')
        return None


def call_grok():
    try:
        from xai_sdk import Client
        from xai_sdk.chat import user
        client = Client(api_key=os.environ.get('XAI_API_KEY'))
        chat = client.chat.create(model='grok-4', temperature=0.3)
        chat.append(user(f'{SYSTEM}\n\n{prompt}'))
        response = chat.sample()
        content = getattr(response, 'content', None) or str(response)
        (OUT_DIR / 'grok_round6_post_impl.md').write_text(content)
        return 'grok_round6_post_impl.md'
    except Exception as exc:
        (OUT_DIR / 'grok_round6_post_impl.md').write_text(f'ERROR\n\n{exc}')
        return None


def call_gemini():
    try:
        import time
        from google import genai
        client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))
        last_exc = None
        for model_name in ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro']:
            for wait_seconds in [0, 3, 8]:
                try:
                    if wait_seconds:
                        time.sleep(wait_seconds)
                    resp = client.models.generate_content(
                        model=model_name,
                        contents=f'{SYSTEM}\n\n{prompt}',
                    )
                    content = getattr(resp, 'text', None) or str(resp)
                    (OUT_DIR / 'gemini_round6_post_impl.md').write_text(content)
                    return 'gemini_round6_post_impl.md'
                except Exception as exc:
                    last_exc = exc
                    continue
        raise last_exc or RuntimeError('Gemini no devolvió respuesta')
    except Exception as exc:
        (OUT_DIR / 'gemini_round6_post_impl.md').write_text(f'ERROR\n\n{exc}')
        return None


if __name__ == '__main__':
    results = [call_openai(), call_grok(), call_gemini()]
    summary = '\n'.join(str(item) for item in results)
    (OUT_DIR / 'run_summary.txt').write_text(summary + '\n')
    print(summary)
