# Consulta uniforme: capacidad de verificación IMSS y fiscal de AuditaPatrón

Responde en español, de forma prudente y concreta. No inventes APIs, permisos, convenios, accesos a datos personales ni requisitos oficiales. Esto es un análisis de producto y cumplimiento; no es asesoría jurídica individual.

## Pregunta

AuditaPatrón ayuda a una persona trabajadora en México a leer recibos de nómina PDF y CFDI XML. ¿Qué puede afirmar y verificar hoy de forma honesta? ¿Qué sí podría confirmar solo con documentos aportados por la persona? ¿Qué requeriría una consulta oficial autenticada por el titular o una integración formal? Propón un camino de producto seguro y una jerarquía de evidencias.

## Hechos verificados del producto actual

1. El análisis local extrae de PDFs con capa de texto y de CFDI XML: razón social/RFC del emisor, periodo, percepciones, neto, deducciones, NSS, registro patronal, y líneas visibles de ISR, IMSS e Infonavit cuando existan.
2. La interfaz actualmente presenta estos hallazgos como lectura de los papeles, no como consulta oficial. En el caso del IMSS aclara que NSS y registro patronal son indicios documentales y que no equivalen a constancia oficial.
3. No existe en el código una llamada a un servicio oficial del IMSS, SAT o Infonavit. Solo hay clasificación y extracción de archivos aportados por la persona usuaria.
4. Un recibo puede mostrar NSS, registro patronal y conceptos de deducción, pero ello no prueba por sí solo la vigencia actual, el salario base vigente ante IMSS, semanas cotizadas, movimientos afiliatorios, cuotas enteradas ni que un pago fiscal haya sido efectivamente enterado.
5. El producto no debe simular una consulta gubernamental, solicitar credenciales gubernamentales dentro de la aplicación ni prometer validación oficial sin una integración legal y técnicamente válida.

## Hechos oficiales disponibles para contraste

1. IMSS: la solicitud oficial de Constancia de Vigencia de Derechos pide CURP, NSS y correo electrónico personal; la constancia informa sobre vigencia para servicios médicos y la FAQ del IMSS indica que incluye clínica y datos del último patrón.
2. IMSS: la constancia/reporte de semanas cotizadas es una vía oficial distinta para revisar historia de cotización.
3. SAT: el verificador oficial de CFDI permite consulta por folio fiscal con RFC emisor/receptor y captcha, o por archivo XML y captcha, para verificar si el comprobante fue certificado por el SAT.
4. SAT: el sitio oficial de Declaración Anual para personas físicas enlaza al Visor de Nómina del Trabajador y a visores de Retenciones/Deducciones; el acceso corresponde al contribuyente.
5. Infonavit: los portales oficiales remiten a Mi Cuenta Infonavit para consultar saldo, movimientos e historial/aportaciones.

## Entregable requerido

Devuelve exactamente estas secciones:

1. `conclusion` — una frase que distinga lectura documental actual de verificación oficial.
2. `matriz` — tabla o lista con: tema (alta/vigencia IMSS, semanas/salario base/cuotas IMSS, autenticidad de CFDI, ISR/retenciones, aportaciones/crédito Infonavit); qué puede decir hoy el producto; qué no puede confirmar; evidencia oficial que sí resolvería la duda; riesgo de copy.
3. `ruta_recomendada` — máximo cinco pasos de producto, sin programar una integración inexistente.
4. `frases_permitidas` — tres ejemplos de copy honesto para trabajadores.
5. `frases_prohibidas` — cinco ejemplos de promesas que deben evitarse.
6. `riesgos` — privacidad, consentimiento, seguridad y cumplimiento, sin afirmar prohibiciones no demostradas.
7. `confianza` — alta/media/baja y las incertidumbres relevantes.
