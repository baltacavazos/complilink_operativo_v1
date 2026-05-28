import json
import os
import re
import zipfile
from pathlib import Path

import requests
from xml.etree import ElementTree as ET

PROJECT = Path('/home/ubuntu/complilink_operativo_v1')
UPLOAD = Path('/home/ubuntu/upload')
OUT = PROJECT / 'tmp_hector_multi_model_review_output.json'

XML_FILES = [
    UPLOAD / '29C44A28-91A0-513B-877E-E8F527AFC12C_HECTOR_JOVANE_ORTIZ_HERNANDEZ.xml',
    UPLOAD / '30D275A3-E5BA-5D65-848F-15E4320DEF48_HECTOR_JOVANE_ORTIZ_HERNANDEZ.xml',
    UPLOAD / 'AB0DE2EA-FE78-5716-AF36-94B36011AA1F_HECTOR_JOVANE_ORTIZ_HERNANDEZ.xml',
]
DOCX_FILE = UPLOAD / 'CONTRATOINDETERMINADO-ORTIZHERNANDEZHECTORJOVANE.docx'

NS = {
    'cfdi': 'http://www.sat.gob.mx/cfd/4',
    'nomina12': 'http://www.sat.gob.mx/nomina12',
    'tfd': 'http://www.sat.gob.mx/TimbreFiscalDigital',
}


def read_docx_text(path: Path) -> str:
    with zipfile.ZipFile(path) as zf:
        xml = zf.read('word/document.xml').decode('utf-8', errors='ignore')
    text = re.sub(r'</w:p>', '\n', xml)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def parse_xml(path: Path) -> dict:
    root = ET.fromstring(path.read_text(encoding='utf-8'))
    receptor = root.find('cfdi:Receptor', NS)
    nomina = root.find('cfdi:Complemento/nomina12:Nomina', NS)
    nom_receptor = root.find('cfdi:Complemento/nomina12:Nomina/nomina12:Receptor', NS)
    emisor = root.find('cfdi:Emisor', NS)
    timbre = root.find('cfdi:Complemento/tfd:TimbreFiscalDigital', NS)
    emisor_nomina = root.find('cfdi:Complemento/nomina12:Nomina/nomina12:Emisor', NS)
    return {
        'file': path.name,
        'uuid': timbre.attrib.get('UUID') if timbre is not None else None,
        'fecha': root.attrib.get('Fecha'),
        'folio': root.attrib.get('Folio'),
        'subtotal': root.attrib.get('SubTotal'),
        'total': root.attrib.get('Total'),
        'emisor_nombre': emisor.attrib.get('Nombre') if emisor is not None else None,
        'emisor_rfc': emisor.attrib.get('Rfc') if emisor is not None else None,
        'receptor_nombre': receptor.attrib.get('Nombre') if receptor is not None else None,
        'receptor_rfc': receptor.attrib.get('Rfc') if receptor is not None else None,
        'fecha_pago': nomina.attrib.get('FechaPago') if nomina is not None else None,
        'fecha_inicial_pago': nomina.attrib.get('FechaInicialPago') if nomina is not None else None,
        'fecha_final_pago': nomina.attrib.get('FechaFinalPago') if nomina is not None else None,
        'num_dias_pagados': nomina.attrib.get('NumDiasPagados') if nomina is not None else None,
        'total_percepciones': nomina.attrib.get('TotalPercepciones') if nomina is not None else None,
        'num_empleado': nom_receptor.attrib.get('NumEmpleado') if nom_receptor is not None else None,
        'curp': nom_receptor.attrib.get('Curp') if nom_receptor is not None else None,
        'tipo_contrato': nom_receptor.attrib.get('TipoContrato') if nom_receptor is not None else None,
        'tipo_regimen': nom_receptor.attrib.get('TipoRegimen') if nom_receptor is not None else None,
        'periodicidad_pago': nom_receptor.attrib.get('PeriodicidadPago') if nom_receptor is not None else None,
        'fecha_inicio_relacion': nom_receptor.attrib.get('FechaInicioRelLaboral') if nom_receptor is not None else None,
        'nss': nom_receptor.attrib.get('NumSeguridadSocial') if nom_receptor is not None else None,
        'sbc': nom_receptor.attrib.get('SalarioBaseCotApor') if nom_receptor is not None else None,
        'sdi': nom_receptor.attrib.get('SalarioDiarioIntegrado') if nom_receptor is not None else None,
        'banco': nom_receptor.attrib.get('Banco') if nom_receptor is not None else None,
        'cuenta': nom_receptor.attrib.get('CuentaBancaria') if nom_receptor is not None else None,
        'registro_patronal': emisor_nomina.attrib.get('RegistroPatronal') if emisor_nomina is not None else None,
    }


def build_context() -> dict:
    xmls = [parse_xml(path) for path in XML_FILES]
    contract_text = read_docx_text(DOCX_FILE)
    contract_excerpt = contract_text[:6000]
    return {
        'worker_name': 'HECTOR JOVANE ORTIZ HERNANDEZ',
        'worker_rfc': 'OIHH850612NS2',
        'worker_curp': 'OIHH850612HDFRRC01',
        'employer_name': 'EVOLUCION CREATIVA CAMREFLEX',
        'employer_rfc': 'ECC190605VA1',
        'xml_documents': xmls,
        'contract_excerpt': contract_excerpt,
        'known_runtime_state': {
            'dev_server_running': True,
            'typescript_errors': False,
            'lsp_errors': False,
            'bridge_health_probe_result': 'Servidor activo y sin errores TypeScript/LSP; el bridge contractual ya fue endurecido y, en esta misma corrida restaurada, el despacho remoto volvió a responder HTTP 202 en ambos documentos.',
            'goal': 'ejecutar una nueva validacion punta a punta con este trabajador para expediente, clasificacion, Helios inicial, bridge, conectores y retorno si aparece en ventana corta.'
        },
        'known_observations_from_documents': {
            'contract_start_date': '2023-09-01',
            'contract_salary_daily': '207.44',
            'contract_payment_frequency': 'quincenal',
            'contract_bank_account': '1577189636',
            'contract_position': 'VIGILANCIA',
            'cfdi_quincenal_total': '4725.60',
            'cfdi_sbc_sdi': '331.45',
            'cfdi_payment_frequency_code': '04',
            'consistency_signals': [
                'RFC, CURP, NSS, cuenta bancaria y fecha de inicio laboral coinciden entre contrato y CFDI.',
                'Los CFDI muestran tres quincenas consecutivas con total 4725.60.',
                'Existe posible diferencia a revisar entre salario diario textual del contrato (207.44) y SBC/SDI en CFDI (331.45).'
            ]
        }
    }


def build_prompt(context: dict) -> str:
    return (
        'Analiza el siguiente caso laboral y operativo de una app juridico-documental mexicana. '
        'Quiero un JSON estricto con este esquema: '
        '{"document_consistency_verdict":"ok|warning|fail",'
        '"document_findings":["..."],'
        '"operational_risks":["..."],'
        '"recommended_test_focus":["..."],'
        '"final_readiness":"ready|ready_with_caveats|not_ready"}. '
        'Evalua consistencia documental, posibles focos laborales y que debe observarse en la prueba punta a punta con Helios/bridge. '
        'Contexto: ' + json.dumps(context, ensure_ascii=False)
    )


def call_openai(prompt: str) -> dict:
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY missing'}
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    payload = {
        'model': 'gpt-4.1-mini',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Eres un analista juridico-tecnico experto en CFDI de nomina, validacion documental y resiliencia operativa.'},
            {'role': 'user', 'content': prompt},
        ],
    }
    r = requests.post('https://api.openai.com/v1/chat/completions', headers=headers, json=payload, timeout=120)
    return {'status_code': r.status_code, 'body': r.json()}


def call_grok(prompt: str) -> dict:
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY missing'}
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    payload = {
        'model': 'grok-4',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Eres un analista juridico-tecnico experto en CFDI de nomina, validacion documental y resiliencia operativa.'},
            {'role': 'user', 'content': prompt},
        ],
    }
    r = requests.post('https://api.x.ai/v1/chat/completions', headers=headers, json=payload, timeout=120)
    return {'status_code': r.status_code, 'body': r.json()}


def call_gemini(prompt: str) -> dict:
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY missing'}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    payload = {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {
            'temperature': 0.2,
            'responseMimeType': 'application/json',
        },
    }
    r = requests.post(url, json=payload, timeout=120)
    return {'status_code': r.status_code, 'body': r.json()}


def extract_text(result: dict, vendor: str):
    try:
        if vendor == 'openai':
            return result['body']['choices'][0]['message']['content']
        if vendor == 'grok':
            return result['body']['choices'][0]['message']['content']
        if vendor == 'gemini':
            return result['body']['candidates'][0]['content']['parts'][0]['text']
    except Exception as exc:
        return f'__parse_error__: {exc}'


def try_json(text: str):
    try:
        return json.loads(text)
    except Exception:
        return {'raw': text}


def main():
    context = build_context()
    prompt = build_prompt(context)
    raw = {
        'context': context,
        'prompt': prompt,
        'responses': {
            'chatgpt': call_openai(prompt),
            'grok': call_grok(prompt),
            'gemini': call_gemini(prompt),
        }
    }
    parsed = {}
    for key, vendor in [('chatgpt', 'openai'), ('grok', 'grok'), ('gemini', 'gemini')]:
        response = raw['responses'][key]
        if 'error' in response:
            parsed[key] = response
            continue
        text = extract_text(response, vendor)
        parsed[key] = {
            'text': text,
            'json': try_json(text),
        }
    raw['parsed'] = parsed
    OUT.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding='utf-8')
    print(str(OUT))


if __name__ == '__main__':
    main()
