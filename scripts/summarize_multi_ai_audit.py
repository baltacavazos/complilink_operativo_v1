import json
from collections import Counter, defaultdict
from pathlib import Path

BASE_DIR = Path('/home/ubuntu/complilink_operativo_v1')
RAW_PATH = BASE_DIR / '.manus-notes' / 'auditoria_multi_ia_raw.json'
OUT_PATH = BASE_DIR / '.manus-notes' / 'auditoria_multi_ia_resumen.md'

raw = json.loads(RAW_PATH.read_text(encoding='utf-8'))
models = {
    'OpenAI': raw['openai']['parsed'],
    'Grok': raw['xai']['parsed'],
    'Gemini': raw['gemini']['parsed'],
}

score_keys = ['visual_clarity', 'functional_simplicity', 'navigation_clarity', 'cognitive_load', 'overall']
averages = {}
for key in score_keys:
    averages[key] = round(sum(model['scores'][key] for model in models.values()) / len(models), 2)

surface_counter = Counter()
action_counter = Counter()
route_notes = defaultdict(list)
important_changes = []

for model_name, model in models.items():
    important_changes.append((model_name, model['single_most_important_change']))
    for item in model.get('duplicated_or_overlapping_functions', []):
        surface_counter[item['surface']] += 1
        action_counter[item['recommended_action']] += 1
    for route, text in model.get('route_assessment', {}).items():
        route_notes[route].append((model_name, text))

common_surfaces = surface_counter.most_common()
common_actions = action_counter.most_common()

def render_table(rows, headers):
    header = '| ' + ' | '.join(headers) + ' |'
    sep = '| ' + ' | '.join(['---'] * len(headers)) + ' |'
    body = ['| ' + ' | '.join(map(str, row)) + ' |' for row in rows]
    return '\n'.join([header, sep, *body])

score_rows = [[
    key,
    averages[key],
    models['OpenAI']['scores'][key],
    models['Grok']['scores'][key],
    models['Gemini']['scores'][key],
] for key in score_keys]

surface_rows = [[surface, count] for surface, count in common_surfaces]
action_rows = [[action, count] for action, count in common_actions]

lines = []
lines.append('# Resumen sintético de auditoría multi-IA')
lines.append('')
lines.append('## Promedio comparado de calificaciones')
lines.append('')
lines.append(render_table(score_rows, ['Dimensión', 'Promedio', 'OpenAI', 'Grok', 'Gemini']))
lines.append('')
lines.append('## Superficies más señaladas por redundancia o sobrecarga')
lines.append('')
lines.append(render_table(surface_rows, ['Superficie', 'Veces mencionada']))
lines.append('')
lines.append('## Tipo de acción más repetida en las recomendaciones')
lines.append('')
lines.append(render_table(action_rows, ['Acción sugerida', 'Veces mencionada']))
lines.append('')
lines.append('## Cambio más importante según cada IA')
lines.append('')
for model_name, text in important_changes:
    lines.append(f'### {model_name}')
    lines.append('')
    lines.append(text)
    lines.append('')
lines.append('## Lectura por ruta')
lines.append('')
for route in ['home', 'access', 'auditar', 'ceo']:
    lines.append(f'### {route}')
    lines.append('')
    for model_name, text in route_notes[route]:
        lines.append(f'- **{model_name}:** {text}')
    lines.append('')

OUT_PATH.write_text('\n'.join(lines), encoding='utf-8')
print(str(OUT_PATH))
