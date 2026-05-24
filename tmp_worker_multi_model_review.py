import json
import os
import textwrap
from pathlib import Path
from xml.etree import ElementTree as ET
import zipfile
import requests

BASE = Path('/home/ubuntu/upload')
PROJECT = Path('/home/ubuntu/complilink_operativo_v1')
OUT = PROJECT / 'tmp_worker_multi_model_review_output.json'

XML_FILES = [
    BASE / '1F870DC0-BDF0-5227-A698-907D55E15F69_JAIME_SANTIAGO_LOPEZ.xml',
    BASE / '8562B2DB-D708-5325-842D-18A5837E8497_JAIME_SANTIAGO_LOPEZ.xml',
    BASE / 'BEEB9BA6-EAAE-544E-AD6E-2C2C1A4C942B_JAIME_SANTIAGO_LOPEZ.xml',
]
DOCX_FILE = BASE / 'CONTRATOINDETERMINADO-SANTIAGOLOPEZJAIME.docx'

NS = {
    'cfdi': 'http://www.sat.gob.mx/cfd/4',
    'nomina12': 'http://www.sat.gob.mx/nomina12',
    'tfd': 'http://www.sat.gob.mx/TimbreFiscalDigital',
}


def read_docx_text(path: Path) -> str:
    with zipfile.ZipFile(path) as zf:
        xml = zf.read('word/document.xml').decode('utf-8', errors='ignore')
    xml = xml.replace('</w:p>', '\n').replace('</w:tr>', '\n')
    xml = xml.replace('</w:tc>', ' | ')
    import re
    text = re.sub(r'<[^>]+>', '', xml)
    text = re.sub(r'\n{2,}', '\n', text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    return text.strip()


def parse_xml(path: Path):
    root = ET.fromstring(path.read_text(encoding='utf-8'))
    comp = root
    emisor = root.find('cfdi:Emisor', NS)
    receptor = root.find('cfdi:Receptor', NS)
    nomina = root.find('.//nomina12:Nomina', NS)
    nom_receptor = root.find('.//nomina12:Receptor', NS)
    percepcion = root.find('.//nomina12:Percepcion', NS)
    tfd = root.find('.//tfd:TimbreFiscalDigital', NS)
    return {
        'file': path.name,
        'uuid': (tfd.attrib.get('UUID') if tfd is not None else None),
        'fecha_pago': (nomina.attrib.get('FechaPago') if nomina is not None else None),
        'periodo_inicio': (nomina.attrib.get('FechaInicialPago') if nomina is not None else None),
        'periodo_fin': (nomina.attrib.get('FechaFinalPago') if nomina is not None else None),
        'total': comp.attrib.get('Total'),
        'sub_total': comp.attrib.get('SubTotal'),
        'worker_name': (receptor.attrib.get('Nombre') if receptor is not None else None),
        'worker_rfc': (receptor.attrib.get('Rfc') if receptor is not None else None),
        'employer_name': (emisor.attrib.get('Nombre') if emisor is not None else None),
        'employer_rfc': (emisor.attrib.get('Rfc') if emisor is not None else None),
        'num_empleado': (nom_receptor.attrib.get('NumEmpleado') if nom_receptor is not None else None),
        'fecha_inicio_relacion': (nom_receptor.attrib.get('FechaInicioRelLaboral') if nom_receptor is not None else None),
        'tipo_contrato': (nom_receptor.attrib.get('TipoContrato') if nom_receptor is not None else None),
        'tipo_regimen': (nom_receptor.attrib.get('TipoRegimen') if nom_receptor is not None else None),
        'periodicidad_pago': (nom_receptor.attrib.get('PeriodicidadPago') if nom_receptor is not None else None),
        'salario_base_cotizacion': (nom_receptor.attrib.get('SalarioBaseCotApor') if nom_receptor is not None else None),
        'salario_diario_integrado': (nom_receptor.attrib.get('SalarioDiarioIntegrado') if nom_receptor is not None else None),
        'nss': (nom_receptor.attrib.get('NumSeguridadSocial') if nom_receptor is not None else None),
        'curp': (nom_receptor.attrib.get('Curp') if nom_receptor is not None else None),
        'concepto': (percepcion.attrib.get('Concepto') if percepcion is not None else None),
        'importe_gravado': (percepcion.attrib.get('ImporteGravado') if percepcion is not None else None),
    }


contract_text = read_docx_text(DOCX_FILE)
xml_summaries = [parse_xml(p) for p in XML_FILES]

contract_excerpt = '\n'.join(contract_text.splitlines()[:80])

prompt = textwrap.dedent(f"""
Eres un auditor técnico-jurídico de una app laboral mexicana. Analiza este caso real para validar si el flujo documental, Helios y el bridge/conectores deberían funcionar bien con estos archivos.

Contexto del sistema a validar:
- XML CFDI de nómina se clasifica como cfdi/cfdi_nomina.
- Contratos se clasifican como contract/contrato_laboral.
- El bridge saliente mapea payroll_receipt -> recibo_nomina, cfdi -> cfdi_nomina, contract -> contrato_laboral.
- El webhook de retorno debe refrescar el estado documental, guardar contrato canónico y generar una opinión remota de Helios cuando llega document.processed.v1.
- Para CFDI y nómina, Helios suele enfocar pagos, deducciones, periodo y contraste contra contrato.
- Para contratos, Helios suele enfocar salario pactado, jornada, puesto, fecha de ingreso, prestaciones y diferencias entre lo pactado y lo real.

Datos estructurados de los XML:
{json.dumps(xml_summaries, ensure_ascii=False, indent=2)}

Extracto del contrato:
{contract_excerpt}

Responde SOLO JSON válido con esta forma exacta:
{{
  "documentary_consistency": {{
    "status": "ok|warning|critical",
    "summary": "texto breve",
    "matches": ["..."],
    "mismatches": ["..."]
  }},
  "expected_system_behavior": {{
    "classifications": [{{"file": "...", "expected_type": "...", "confidence": "high|medium|low"}}],
    "helios_should_detect": ["..."],
    "connector_should_do": ["..."],
    "likely_failure_points": ["..."]
  }},
  "validation_priority": ["..."],
  "verdict": "texto breve"
}}
""")


def call_openai(prompt: str):
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY missing'}
    url = 'https://api.openai.com/v1/chat/completions'
    payload = {
        'model': 'gpt-4.1-mini',
        'temperature': 0.1,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Devuelve únicamente JSON válido.'},
            {'role': 'user', 'content': prompt},
        ],
    }
    r = requests.post(url, headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}, json=payload, timeout=120)
    return {'status_code': r.status_code, 'body': r.json()}


def call_xai(prompt: str):
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY missing'}
    url = 'https://api.x.ai/v1/chat/completions'
    payload = {
        'model': 'grok-4',
        'temperature': 0.1,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Devuelve únicamente JSON válido.'},
            {'role': 'user', 'content': prompt},
        ],
    }
    r = requests.post(url, headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}, json=payload, timeout=120)
    return {'status_code': r.status_code, 'body': r.json()}


def call_gemini(prompt: str):
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY missing'}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    payload = {
        'generationConfig': {
            'temperature': 0.1,
            'responseMimeType': 'application/json',
        },
        'contents': [{'parts': [{'text': prompt}]}],
    }
    r = requests.post(url, headers={'Content-Type': 'application/json'}, json=payload, timeout=120)
    return {'status_code': r.status_code, 'body': r.json()}


raw = {
    'input': {
        'xml_summaries': xml_summaries,
        'contract_excerpt': contract_excerpt,
    },
    'responses': {
        'chatgpt': call_openai(prompt),
        'grok': call_xai(prompt),
        'gemini': call_gemini(prompt),
    },
}

OUT.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding='utf-8')
print(str(OUT))
