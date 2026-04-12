from __future__ import annotations

import json
import os
from pathlib import Path

import requests

PROJECT_DIR = Path('/home/ubuntu/complilink_operativo_v1')
OUT_DIR = PROJECT_DIR / 'tmp'
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_PATH = OUT_DIR / 'multi_ai_v1_robustness_consensus.json'

SYSTEM_PROMPT = """Eres un arquitecto senior de plataformas operativas B2C/B2B con foco en robustez, seguridad, multi-tenantidad, colas y backend TypeScript. Debes priorizar solo cambios mínimos y reales para dejar una V1 lista para pruebas. No propongas features nuevas ni expansión de alcance. Responde estrictamente en JSON válido."""

USER_PROMPT = """Contexto del proyecto:
- Plataforma: AuditaPatron / CompliLink Operativo V1.
- Restricción del usuario: freeze de V1; NO agregar extras; solo robustez real para iniciar pruebas.
- Estado: ya existe scheduler bridge con bitácora visible, filtros, búsqueda textual, persistencia en URL y exportación CSV. TypeScript sin errores y Vitest relevantes en verde.
- Incidente operativo real detectado: el worker del scheduler bridge falló porque faltaban tablas `ceo_bridge_schedules` y relacionadas en la base; la migración ya se aplicó.
- Supuesto de diseño del usuario: la plataforma está pensada para muchísimos clientes descargando la app y subiendo miles de documentos; cualquier recomendación debe respetar el freeze y centrarse en robustez real, no features.

Fragmento crítico de backend actual:
```ts
export async function assertTenantAccess(userId: number, tenantId: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const membership = await db
    .select()
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.userId, userId),
        eq(tenantMemberships.tenantId, tenantId),
        eq(tenantMemberships.status, 'active'),
      ),
    )
    .limit(1);

  if (!membership[0]) {
    throw new Error('Access denied for tenant');
  }

  return membership[0];
}

export async function assertCaseAccess(userId: number, tenantId: string, caseId: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await assertTenantAccess(userId, tenantId);

  const caseGrant = await db
    .select()
    .from(caseAccess)
    .where(
      and(
        eq(caseAccess.userId, userId),
        eq(caseAccess.tenantId, tenantId),
        eq(caseAccess.caseId, caseId),
        eq(caseAccess.status, 'active'),
      ),
    )
    .limit(1);

  if (caseGrant[0]) {
    return caseGrant[0];
  }

  const tenantWide = await db
    .select()
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.userId, userId),
        eq(tenantMemberships.tenantId, tenantId),
        eq(tenantMemberships.status, 'active'),
        eq(tenantMemberships.accessScope, 'tenant'),
      ),
    )
    .limit(1);

  if (!tenantWide[0]) {
    throw new Error('Access denied for case');
  }

  return tenantWide[0];
}

function hasAdminCapability(membership: { role?: string | null }) {
  return membership.role === 'tenant_admin' || membership.role === 'manager';
}

export async function assertTenantAdminAccess(userId: number, tenantId: string) {
  const membership = await assertTenantAccess(userId, tenantId);
  if (!hasAdminCapability(membership)) {
    throw new Error('Admin access denied for tenant');
  }
  return membership;
}
```

Tu tarea:
1. Evalúa si existe un hueco real de robustez/seguridad en esos helpers de acceso y qué cambio mínimo harías.
2. Prioriza máximo 3 acciones mínimas para dejar la V1 lista para pruebas con alto volumen potencial de documentos/descargas, sin introducir features nuevas.
3. Distingue entre "bloqueante antes de pruebas", "recomendado ahora" y "dejar para V1.1".
4. Incluye los tests mínimos indispensables para no romper V1.

Devuelve JSON con esta forma exacta:
{
  "verdict": "string",
  "blocking_before_tests": ["string"],
  "recommended_now": ["string"],
  "leave_for_v1_1": ["string"],
  "rbac_fix": {
    "is_real_issue": true,
    "why": "string",
    "minimal_change": "string",
    "tests": ["string"]
  },
  "high_volume_notes": ["string"],
  "avoid_doing": ["string"]
}
"""


def call_openai() -> dict:
    api_key = os.environ['OPENAI_API_KEY']
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'gpt-4.1-mini',
            'temperature': 0.1,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': USER_PROMPT},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload['choices'][0]['message']['content']
    return json.loads(content)


def call_grok() -> dict:
    api_key = os.environ['XAI_API_KEY']
    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'grok-4',
            'temperature': 0.1,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': USER_PROMPT},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload['choices'][0]['message']['content']
    return json.loads(content)


def call_gemini() -> dict:
    api_key = os.environ['GEMINI_API_KEY']
    response = requests.post(
        f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}',
        headers={'Content-Type': 'application/json'},
        json={
            'generationConfig': {
                'temperature': 0.1,
                'responseMimeType': 'application/json',
            },
            'systemInstruction': {
                'parts': [{'text': SYSTEM_PROMPT}],
            },
            'contents': [
                {
                    'role': 'user',
                    'parts': [{'text': USER_PROMPT}],
                }
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    text = payload['candidates'][0]['content']['parts'][0]['text']
    return json.loads(text)


def main() -> None:
    results = {}
    errors = {}

    for name, func in [('openai', call_openai), ('grok', call_grok), ('gemini', call_gemini)]:
        try:
            results[name] = func()
        except Exception as exc:  # noqa: BLE001
            errors[name] = f'{type(exc).__name__}: {exc}'

    output = {
        'results': results,
        'errors': errors,
    }
    OUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(str(OUT_PATH))
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
