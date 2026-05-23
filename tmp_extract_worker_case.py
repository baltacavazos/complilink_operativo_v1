import json
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

base = Path('/home/ubuntu/upload')
xml_files = sorted(base.glob('*DIDIER_ANTONIO_UICAB_PALOMO.xml'))
docx_file = base / 'CONTRATOINDETERMINADO-UICABPALOMODIDIERANTONIO.docx'

ns = {
    'cfdi': 'http://www.sat.gob.mx/cfd/4',
    'nomina12': 'http://www.sat.gob.mx/nomina12',
    'tfd': 'http://www.sat.gob.mx/TimbreFiscalDigital',
}

rows = []
for path in xml_files:
    root = ET.fromstring(path.read_text(encoding='utf-8'))
    emisor = root.find('cfdi:Emisor', ns)
    receptor = root.find('cfdi:Receptor', ns)
    nomina = root.find('.//nomina12:Nomina', ns)
    nom_receptor = root.find('.//nomina12:Receptor', ns)
    timbre = root.find('.//tfd:TimbreFiscalDigital', ns)
    percepcion = root.find('.//nomina12:Percepcion', ns)
    rows.append({
        'file': path.name,
        'uuid': timbre.attrib.get('UUID'),
        'fecha_pago': nomina.attrib.get('FechaPago'),
        'periodo_inicial': nomina.attrib.get('FechaInicialPago'),
        'periodo_final': nomina.attrib.get('FechaFinalPago'),
        'total': float(root.attrib.get('Total', '0')),
        'subtotal': float(root.attrib.get('SubTotal', '0')),
        'dias_pagados': nomina.attrib.get('NumDiasPagados'),
        'emisor_rfc': emisor.attrib.get('Rfc'),
        'emisor_nombre': emisor.attrib.get('Nombre'),
        'receptor_rfc': receptor.attrib.get('Rfc'),
        'receptor_nombre': receptor.attrib.get('Nombre'),
        'curp': nom_receptor.attrib.get('Curp'),
        'nss': nom_receptor.attrib.get('NumSeguridadSocial'),
        'num_empleado': nom_receptor.attrib.get('NumEmpleado'),
        'fecha_inicio_relacion': nom_receptor.attrib.get('FechaInicioRelLaboral'),
        'tipo_contrato': nom_receptor.attrib.get('TipoContrato'),
        'tipo_regimen': nom_receptor.attrib.get('TipoRegimen'),
        'periodicidad_pago': nom_receptor.attrib.get('PeriodicidadPago'),
        'salario_base_cotizacion': float(nom_receptor.attrib.get('SalarioBaseCotApor', '0')),
        'salario_diario_integrado': float(nom_receptor.attrib.get('SalarioDiarioIntegrado', '0')),
        'registro_patronal': root.find('.//nomina12:Emisor', ns).attrib.get('RegistroPatronal'),
        'concepto': percepcion.attrib.get('Concepto') if percepcion is not None else None,
        'tipo_percepcion': percepcion.attrib.get('TipoPercepcion') if percepcion is not None else None,
        'importe_gravado': float(percepcion.attrib.get('ImporteGravado', '0')) if percepcion is not None else 0.0,
    })

contract_text = ''
if docx_file.exists():
    with zipfile.ZipFile(docx_file) as zf:
        doc_xml = zf.read('word/document.xml')
    doc_root = ET.fromstring(doc_xml)
    texts = []
    for node in doc_root.iter():
        if node.tag.endswith('}t') and node.text:
            texts.append(node.text)
    contract_text = ' '.join(texts)

summary = {
    'worker': 'DIDIER ANTONIO UICAB PALOMO',
    'xml_count': len(rows),
    'payroll_receipts': rows,
    'contract_excerpt': contract_text[:12000],
}

out = Path('/home/ubuntu/complilink_operativo_v1/tmp_extract_worker_case.json')
out.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
print(out)
