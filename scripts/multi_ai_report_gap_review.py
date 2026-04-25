#!/usr/bin/env python3
import json
import os
from pathlib import Path
from typing import Any

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_PATH = PROJECT_ROOT / 'tmp' / 'multi_ai_report_gap_review.json'
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

SYSTEM_PROMPT = """Eres un principal product strategist + UX auditor + frontend lead. Tu trabajo es comparar un reporte externo de rediseño con el estado actual resumido del producto. Debes ser crítico, preciso y conservador: no recomiendes cambios que rompan validaciones o que reviertan mejoras recientes sin una razón fuerte. Devuelve JSON válido, sin markdown, con esta forma exacta:
{
  \"overall_verdict\": \"texto corto\",
  \"already_satisfied\": [\"texto corto\"],
  \"implement_now\": [
    {
      \"priority\": 1,
      \"title\": \"texto corto\",
      \"why_now\": \"texto corto\",
      \"risk\": \"low|medium|high\"
    }
  ],
  \"defer_or_modify\": [
    {
      \"title\": \"texto corto\",
      \"reason\": \"texto corto\",
      \"suggested_adjustment\": \"texto corto\"
    }
  ],
  \"conflicts_or_cautions\": [\"texto corto\"]
}
Usa máximo 5 items en implement_now y máximo 5 items en defer_or_modify."""

USER_PROMPT = """Analiza este contraste.

REPORTE EXTERNO PROPONE:
1) Hacer totalmente público el aviso de privacidad y hacerlo visible desde footer, hero y /auditar.
2) Añadir bloque visual grande de anonimato con mensaje tipo 'Nadie de tu empresa lo sabrá nunca'.
3) Cambiar el hero a: 'Sube tu recibo, contrato o CFDI. Descubre en minutos si tu patrón cumple la ley.'
4) Usar un CTA principal único y dominante: 'Subir mi documento gratis'.
5) Quitar 'Consola CEO' completamente del nav y hero público.
6) Renombrar el dashboard ejecutivo a 'Mi Expediente Laboral' o 'Mi Defensa'.
7) Convertir /auditar en pantalla de acción más transaccional y menos landing.
8) Reducir repetición de copy en Home y /auditar.
9) Subir antes la vista previa del resultado.
10) Añadir resumen humano antes de textos legales agresivos.

ESTADO ACTUAL RESUMIDO DEL PRODUCTO:
- La ruta /legal/privacidad ya existe como pública en el router.
- Home ya tiene enlace visible de privacidad y una sección de privacidad visible.
- LegalDocuments tiene acceso público a Aviso de Privacidad.
- En el nav público actual no aparece el texto 'Consola CEO'.
- El hero actual de Home está más elaborado y dinámico; no usa todavía el H1 exacto del reporte.
- Los CTAs del hero no están totalmente unificados; existen variantes tipo 'Subir mi primer documento' o 'Ir a mi primera auditoría'.
- Home ya muestra ejemplo visual del resultado relativamente arriba y también bloques de confianza/privacidad.
- /acceso y /auditar fueron simplificados recientemente para bajar fricción y Playwright quedó estable.
- /auditar todavía conserva bastante estructura editorial además del flujo transaccional de carga.
- El dashboard ejecutivo sigue siendo /ceo internamente y Access todavía devuelve la etiqueta 'la consola ejecutiva' en ese retorno.
- Renombrar /ceo o su semántica pública podría impactar pruebas, navegación, permisos o consistencia interna.
- Se quiere consultar antes de implementar cualquier cambio.

Tu tarea:
- Dime qué propuestas del reporte ya están básicamente satisfechas.
- Dime qué 3 a 5 cambios conviene implementar primero y con menor riesgo.
- Dime qué propuestas deberían diferirse, ajustarse o no ejecutarse literalmente.
- Señala conflictos o riesgos importantes entre el reporte y el estado actual.
"""


def extract_openai_text(payload: dict[str, Any]) -> str:
    if isinstance(payload.get('choices'), list) and payload['choices']:
        content = payload['choices'][0].get('message', {}).get('content')
        if isinstance(content, str):
            return content
    if isinstance(payload.get('output'), list):
        texts: list[str] = []
        for item in payload['output']:
            for content in item.get('content', []):
                text = content.get('text')
                if text:
                    texts.append(text)
        if texts:
            return '\n'.join(texts)
    raise ValueError(f'No se pudo extraer texto: {payload}')


def call_openai() -> dict[str, Any]:
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f"Bearer {os.environ['OPENAI_API_KEY']}",
            'Content-Type': 'application/json',
        },
        json={
            'model': 'gpt-4o-mini',
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': USER_PROMPT},
            ],
            'temperature': 0.1,
        },
        timeout=120,
    )
    response.raise_for_status()
    return json.loads(extract_openai_text(response.json()))


def call_xai() -> dict[str, Any]:
    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f"Bearer {os.environ['XAI_API_KEY']}",
            'Content-Type': 'application/json',
        },
        json={
            'model': 'grok-3-mini',
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': USER_PROMPT},
            ],
            'temperature': 0.1,
        },
        timeout=120,
    )
    response.raise_for_status()
    return json.loads(extract_openai_text(response.json()))


def call_gemini() -> dict[str, Any]:
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={os.environ['GEMINI_API_KEY']}",
        headers={'Content-Type': 'application/json'},
        json={
            'systemInstruction': {'parts': [{'text': SYSTEM_PROMPT}]},
            'contents': [{'parts': [{'text': USER_PROMPT}]}],
            'generationConfig': {
                'temperature': 0.1,
                'responseMimeType': 'application/json',
            },
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    text = payload['candidates'][0]['content']['parts'][0]['text']
    return json.loads(text)


def main() -> None:
    results: dict[str, Any] = {}
    errors: dict[str, str] = {}
    for name, fn in (('chatgpt', call_openai), ('grok', call_xai), ('gemini', call_gemini)):
        try:
            results[name] = fn()
        except Exception as exc:
            errors[name] = f'{type(exc).__name__}: {exc}'
    OUTPUT_PATH.write_text(json.dumps({'results': results, 'errors': errors}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(str(OUTPUT_PATH))


if __name__ == '__main__':
    main()
