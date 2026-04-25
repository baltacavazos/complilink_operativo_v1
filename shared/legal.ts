export const LEGAL_VERSION = "v2.0";
export const LEGAL_ACCEPTANCE_VERSION = "auditapatron-legal-mx-v2.0-2026-04";
export const LEGAL_CONTRACT_SCHEMA_VERSION = "legal-mx-v2.0-2026-04";
export const LEGAL_EFFECTIVE_DATE = "2026-04-09";
export const LEGAL_CONTROLLER_NAME = "CVZ Liderazgo en Gestión Laboral, S.A. de C.V.";
export const LEGAL_CONTACT_EMAIL = "privacidad@auditapatron.com";
export const LEGAL_CONTROLLER_ADDRESS =
  "459 Av. Santa Fe, Col. Cruz Manca, Cuajimalpa, Ciudad de México, C.P. 05349";

export const LEGAL_CONSENT_TYPES = [
  "privacy_policy",
  "terms_of_service",
  "data_processing",
  "ai_training",
  "cross_platform_sharing",
] as const;

export type LegalConsentType = (typeof LEGAL_CONSENT_TYPES)[number];
export type LegalDocumentSlug = "privacidad" | "terminos";

export type LegalDocumentDefinition = {
  slug: LegalDocumentSlug;
  route: string;
  shortTitle: string;
  fullTitle: string;
  version: string;
  effectiveDate: string;
  consentType: Extract<LegalConsentType, "privacy_policy" | "terms_of_service">;
  markdown: string;
};

export const LEGAL_GATE_COPY = {
  title: "Aceptación de Documentos Legales",
  body:
    "Para continuar en AuditaPatron, necesitas aceptar el Aviso de Privacidad Integral v2.0 y los Términos y Condiciones de Uso v2.0. Esta aceptación deja constancia versionada de tu consentimiento para operar tu expediente digital y el servicio Helios dentro del ecosistema CompliLink.",
  subtext:
    "Tu aceptación se registra con fecha, versión, dirección IP y navegador. Si después deseas ejercer derechos ARCO u oponerte a finalidades secundarias, podrás hacerlo desde tu sección de privacidad o escribiendo a privacidad@auditapatron.com.",
  checkbox:
    "Autorizo registrar este documento con el Aviso de Privacidad y los Términos vigentes de AuditaPatron.",
  button: "Continuar",
} as const;

export const PRIVACY_CENTER_COPY = {
  title: "Privacidad y control de tu expediente",
  intro:
    "Aquí puedes conocer de forma simple cómo tratamos tus datos, qué derechos puedes ejercer y qué decisiones de privacidad dejan evidencia dentro de tu expediente digital.",
  rightsSummary: [
    "Acceso: puedes solicitar qué datos tenemos, de dónde provienen y para qué se usan.",
    "Rectificación: puedes pedir la corrección de datos inexactos, incompletos o desactualizados.",
    "Cancelación: puedes solicitar la supresión cuando no exista obligación legal, contractual o de defensa jurídica que exija conservarlos.",
    "Oposición: puedes oponerte a tratamientos específicos, en particular finalidades secundarias o usos no indispensables para la prestación principal.",
  ],
  revocationNotice:
    "La revocación de consentimientos se procesa con una ventana de gracia de 5 días hábiles para completar cierres operativos, preservar evidencia y atender obligaciones legales o contractuales que sigan vigentes.",
  contactEmail: LEGAL_CONTACT_EMAIL,
  responseWindow: "20 días hábiles para responder la solicitud ARCO.",
} as const;

export const HELIOS_CONTEXT_BULLETS = [
  "El expediente y los consentimientos se gestionan bajo LFPDPPP v2.0 con trazabilidad versionada.",
  "Las aceptaciones legales deben registrar versión, timestamp, dirección IP y user-agent para auditoría.",
  "Los datos sensibles del expediente se resguardan con controles reforzados y referencia explícita a cifrado AES-256-GCM.",
  "La experiencia debe reconocer derechos ARCO, revocación con gracia de 5 días hábiles y límites cuando exista obligación legal de conservación.",
  "Helios opera dentro del ecosistema AuditaPatron/CompliLink con enfoque de expediente digital, MFA/TOTP, rate limiting, invalidación JWT y audit trail.",
  "Las respuestas de Helios son informativas y de apoyo; no sustituyen asesoría profesional vinculante.",
  "El razonamiento contextual puede apoyarse en doctrina laboral mexicana, incluyendo referencias de Baltasar Cavazos Flores, Mario de la Cueva y Néstor de Buen Lozano, sin presentar esas doctrinas como consejo jurídico definitivo.",
] as const;

export const HELIOS_CONTEXT_NOTE = HELIOS_CONTEXT_BULLETS.map((item) => `- ${item}`).join("\n");

const PRIVACY_NOTICE_MARKDOWN = `# Aviso de Privacidad Integral ${LEGAL_VERSION}

**Responsable del tratamiento:** ${LEGAL_CONTROLLER_NAME}

**Domicilio:** ${LEGAL_CONTROLLER_ADDRESS}

**Correo de contacto para privacidad:** ${LEGAL_CONTACT_EMAIL}

> Nadie de tu empresa puede ver lo que subes aquí. Tus documentos son tuyos, puedes pedir borrado cuando quieras y reforzamos el resguardo con controles de cifrado AES-256 para piezas sensibles del servicio, conforme a la LFPDPPP.

${LEGAL_CONTROLLER_NAME}, en su carácter de responsable del tratamiento de datos personales, pone a disposición de las personas usuarias de AuditaPatron el presente Aviso de Privacidad Integral, elaborado conforme a los artículos 15, 16, 17 y 18 de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares, su Reglamento y demás normativa aplicable en México.

## 1. Plataforma y alcance

AuditaPatron es una plataforma orientada a la auditoría laboral, la organización del expediente digital de la persona trabajadora y la entrega de orientación automatizada para entender mejor su situación documental. El tratamiento de datos comprende la recolección, uso, almacenamiento, organización, análisis, resguardo, consulta, supresión, anonimización y, en su caso, transferencia permitida por la ley.

## 2. Datos personales que podemos recabar

Podemos tratar datos de identificación, contacto, empleo, seguridad social, relación contractual, percepciones, deducciones, incidencias, documentos laborales, metadatos de uso de la plataforma, registros de autenticación y datos técnicos del dispositivo o navegador. También podemos recibir contratos, CFDI, recibos de nómina, soportes IMSS, constancias, evidencias y demás documentos útiles para integrar el expediente digital.

AuditaPatron **no recaba datos biométricos** como parte ordinaria de su operación.

## 3. Finalidades primarias

Tratamos los datos personales para finalidades necesarias para la prestación del servicio, incluyendo verificar cumplimiento laboral, fiscal y de seguridad social; autenticar la identidad de la persona usuaria; administrar accesos; recibir, clasificar y ordenar documentos; generar reportes y tableros; mantener el expediente digital; analizar documentos con herramientas de inteligencia artificial; devolver hallazgos, comparaciones, alertas o recomendaciones operativas; y documentar evidencias de consentimiento y auditoría dentro del servicio AuditaPatron.

## 4. Finalidades secundarias y mecanismo de oposición

De manera adicional, podremos usar datos anonimizados y agregados para analítica interna, métricas de producto, benchmarks, informes sectoriales, mejora de servicios, entrenamiento y evaluación de modelos de inteligencia artificial, desarrollo de nuevas funcionalidades, generación de obras derivadas, estudios de mercado, alertas de producto y colaboración con empresas afiliadas del ecosistema CompliLink y Helios.

Estas finalidades secundarias operan bajo un esquema de **opt-out**. La persona titular puede oponerse a ellas en cualquier momento escribiendo a ${LEGAL_CONTACT_EMAIL} o mediante los controles disponibles en la sección de privacidad, sin que ello afecte la continuidad de las finalidades primarias indispensables para el servicio, salvo cuando la limitación haga imposible la operación contratada.

## 5. Datos anonimizados y agregados

La persona usuaria reconoce y acepta que los datos anonimizados y agregados que ya no permitan identificar razonablemente a una persona física no constituyen datos personales para efectos de la LFPDPPP. En consecuencia, ${LEGAL_CONTROLLER_NAME} podrá utilizarlos, explotarlos, compartirlos, licenciarlos, analizarlos, transformarlos y conservarlos sin restricción, de forma perpetua e irrevocable, para fines lícitos, incluyendo entrenamiento de IA, generación de benchmarks, comercialización de insights agregados, obras derivadas y mejora del ecosistema CVZ.

## 6. Transferencias de datos

Los datos podrán transferirse, sin requerir consentimiento adicional cuando la ley lo permita, a empresas afiliadas o controladas del grupo ${LEGAL_CONTROLLER_NAME}, incluyendo CompliLink MX y Helios; a autoridades competentes cuando exista requerimiento legal; y a proveedores tecnológicos o de infraestructura sujetos a obligaciones de confidencialidad, seguridad y tratamiento conforme a instrucciones del responsable.

No se prevén transferencias internacionales fuera de entornos con un nivel adecuado de protección, salvo aquellas necesarias por infraestructura tecnológica, respaldo, continuidad operativa o cumplimiento contractual, siempre bajo medidas razonables de seguridad y gobernanza.

## 7. Derechos ARCO

La persona titular puede ejercer sus derechos de **Acceso, Rectificación, Cancelación y Oposición** mediante solicitud enviada a ${LEGAL_CONTACT_EMAIL}. La solicitud debe incluir nombre del titular, medio para comunicar la respuesta, documentos que acrediten identidad o representación, descripción clara del derecho que desea ejercer y cualquier dato que facilite la localización de la información.

${LEGAL_CONTROLLER_NAME} responderá en un plazo máximo de **20 días hábiles** y, de resultar procedente, ejecutará la determinación en los plazos legalmente aplicables. La cancelación no procederá cuando exista obligación legal, contractual, de seguridad, defensa jurídica, prevención de fraude o conservación de evidencia que exija mantener la información.

## 8. Revocación del consentimiento

La persona titular puede revocar consentimientos para tratamientos revocables. La revocación se documentará y operará con un periodo de gracia de **5 días hábiles**, destinado a cerrar procesos en curso, preservar evidencia mínima necesaria, concluir obligaciones legales o contractuales vigentes y evitar afectaciones operativas desproporcionadas.

La revocación no tendrá efectos retroactivos sobre tratamientos previamente realizados de forma legítima ni sobre información que deba mantenerse por mandato legal o para la defensa de derechos del responsable o de terceros.

## 9. Medidas de seguridad

AuditaPatron implementa salvaguardas administrativas, técnicas y físicas razonables para proteger la información, incluyendo controles de acceso, auditoría, segregación de funciones, bitácoras, mecanismos de endurecimiento operativo y referencias de cifrado reforzado, incluyendo **AES-256-GCM** para flujos y artefactos sensibles cuando resulte aplicable dentro de la arquitectura del servicio.

## 10. Cambios al aviso

${LEGAL_CONTROLLER_NAME} podrá modificar o actualizar este aviso para reflejar cambios legales, regulatorios, operativos o tecnológicos. La versión vigente se publicará dentro de la plataforma y, cuando corresponda, se requerirá una nueva aceptación versionada para continuar usando servicios cuya operación dependa de dichos cambios.
`;

const TERMS_MARKDOWN = `# Términos y Condiciones de Uso ${LEGAL_VERSION}

Estos Términos y Condiciones regulan el acceso, navegación y uso de AuditaPatron, así como la interacción con Helios, CompliLink y demás componentes del ecosistema operado por ${LEGAL_CONTROLLER_NAME}.

## 1. Definiciones

Para efectos de estos términos, se entenderá por **Datos de la Plataforma** toda información, contenido, documentos, metadatos, registros de uso, configuraciones y resultados que se incorporen, generen o procesen dentro de AuditaPatron. **Datos Agregados** son conjuntos estadísticos o analíticos que combinan información y dejan de identificar a una persona concreta. **Datos Anonimizados** son aquellos transformados razonablemente para impedir la identificación del titular. **Obras Derivadas** comprende modelos, taxonomías, anotaciones, embeddings, scores, resúmenes, productos analíticos, mejoras, salidas enriquecidas, reglas y artefactos construidos a partir del funcionamiento del servicio. **Ecosistema CVZ** significa el conjunto de plataformas, servicios, productos, marcas y componentes tecnológicos vinculados con ${LEGAL_CONTROLLER_NAME}, incluyendo CompliLink y Helios.

## 2. Acceso y uso autorizado

La persona usuaria se obliga a utilizar AuditaPatron de manera lícita, diligente y conforme a estos términos. No podrá introducir información respecto de la cual carezca de autorización, violar derechos de terceros, eludir controles de seguridad, alterar integridad del servicio, realizar extracción automatizada no permitida, ni usar la plataforma para fines fraudulentos, difamatorios, ilícitos o contrarios a la normatividad laboral, fiscal, de privacidad o propiedad intelectual.

## 3. Naturaleza del servicio

AuditaPatron facilita organización documental, análisis asistido, resúmenes, comparaciones, alertas y apoyo operativo para la revisión de información laboral. Helios actúa como copiloto contextual de apoyo. Ninguna salida del sistema constituye por sí misma dictamen definitivo, representación legal, asesoría profesional vinculante ni garantía de resultado en sede administrativa o judicial.

## 4. Licencia sobre datos y contenidos

La persona usuaria conserva, en principio, la titularidad que legalmente le corresponda sobre los documentos y datos originales que cargue a la plataforma. Al usar AuditaPatron concede a ${LEGAL_CONTROLLER_NAME} una licencia **no exclusiva, mundial y libre de regalías**, limitada a lo necesario para alojar, reproducir, organizar, analizar, resguardar y transformar los Datos de la Plataforma con el fin de operar, mantener, auditar, asegurar y mejorar el servicio contratado. En el caso de documentos originales y datos identificables, esta licencia se usará únicamente mientras resulte necesaria para prestar el servicio, atender obligaciones legales, prevenir fraude, defender reclamaciones o conservar evidencia mínima de trazabilidad.

${LEGAL_CONTROLLER_NAME} podrá generar **Obras Derivadas**, métricas, scores, taxonomías y mejoras de producto a partir de Datos Agregados o Datos Anonimizados, o bien de procesos internos necesarios para la operación del servicio. Dichas Obras Derivadas serán titularidad exclusiva de ${LEGAL_CONTROLLER_NAME} o de sus licenciantes, sin obligación de pago adicional a la persona usuaria y sin afectar la titularidad que corresponda sobre los documentos originales.

## 5. Propiedad intelectual

La plataforma, su código, arquitectura, interfaces, procesos, marcas, nombres comerciales, algoritmos, modelos, scores, taxonomías, bases de datos, outputs estructurados, documentación, diseños, material gráfico y cualquier otro componente protegido son propiedad de ${LEGAL_CONTROLLER_NAME} o de sus licenciantes. Ninguna disposición de estos términos transfiere derechos de propiedad intelectual a la persona usuaria, salvo el derecho limitado de uso conforme al servicio contratado.

## 6. Datos agregados, anonimizados y ecosistema

La persona usuaria reconoce que ${LEGAL_CONTROLLER_NAME} podrá usar Datos Agregados y Datos Anonimizados de forma amplia y por tiempo indefinido, siempre que ya no identifiquen razonablemente a una persona física, para fines lícitos relacionados con analítica, benchmarking, investigación, entrenamiento y evaluación de IA, mejora continua, interoperabilidad y desarrollo del Ecosistema CVZ.

## 7. Obligaciones de la persona usuaria

La persona usuaria es responsable de la veracidad, licitud y pertinencia del contenido que cargue, así como de contar con legitimación suficiente para compartirlo. También es responsable de resguardar sus credenciales, revisar accesos, notificar incidentes, verificar la conveniencia de usar resultados del sistema antes de tomar decisiones materiales y complementar la información con revisión humana cuando la naturaleza del caso lo amerite.

## 8. Exención y limitación de responsabilidad

Las lecturas, resúmenes, clasificaciones, hallazgos y sugerencias generadas por AuditaPatron o Helios son informativas y de apoyo. No garantizan exactitud absoluta, actualidad continua, disponibilidad ininterrumpida ni integridad total de fuentes de terceros, incluidas fuentes gubernamentales, fiscales o de seguridad social.

En la máxima medida permitida por la ley, la responsabilidad acumulada de ${LEGAL_CONTROLLER_NAME} frente a la persona usuaria por cualquier reclamación relacionada con la plataforma se limitará al monto efectivamente pagado por dicha persona usuaria durante los **12 meses** previos al evento reclamado o a **$5,000.00 MXN**, lo que resulte menor.

## 9. Indemnización

La persona usuaria se obliga a sacar en paz y a salvo e indemnizar a ${LEGAL_CONTROLLER_NAME}, sus afiliadas, directivos, personal, proveedores y licenciantes respecto de reclamaciones, daños, costos, multas, gastos y honorarios que deriven del uso ilícito de la plataforma, de la carga no autorizada de información, de la violación de derechos de terceros o del incumplimiento de estos términos.

## 10. Suspensión, cesión y continuidad

${LEGAL_CONTROLLER_NAME} podrá suspender o limitar accesos cuando detecte riesgos de seguridad, fraude, incumplimiento normativo, uso abusivo o necesidad de mantenimiento. Asimismo, podrá ceder o transmitir estos términos, el contrato o cualquier derecho derivado de ellos a favor de una afiliada, sucesora, adquirente o vehículo del Ecosistema CVZ. La persona usuaria no podrá ceder su posición sin autorización previa y por escrito.

## 11. Supervivencia

Las cláusulas relativas a licencia de datos, propiedad intelectual, anonimización, agregación, indemnización, limitación de responsabilidad, confidencialidad, auditoría, jurisdicción, supervivencia y demás disposiciones que por su naturaleza deban subsistir, continuarán vigentes aun después de la terminación del uso de la plataforma.

## 12. Jurisdicción y ley aplicable

Estos términos se interpretarán conforme a las leyes aplicables de los Estados Unidos Mexicanos. Para cualquier controversia, las partes se someten expresamente a la jurisdicción de los tribunales competentes de **Monterrey, Nuevo León**, renunciando a cualquier otro fuero que pudiera corresponderles por razón de domicilio presente o futuro.

## 13. Actualizaciones

${LEGAL_CONTROLLER_NAME} podrá actualizar estos términos por cambios legales, técnicos, operativos o de producto. Cuando la modificación altere de manera relevante el marco de uso o tratamiento de datos, la plataforma podrá solicitar una nueva aceptación versionada para continuar.
`;

export const LEGAL_DOCUMENTS: LegalDocumentDefinition[] = [
  {
    slug: "privacidad",
    route: "/legal/privacidad",
    shortTitle: "Aviso de Privacidad",
    fullTitle: `Aviso de Privacidad Integral ${LEGAL_VERSION}`,
    version: LEGAL_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    consentType: "privacy_policy",
    markdown: PRIVACY_NOTICE_MARKDOWN,
  },
  {
    slug: "terminos",
    route: "/legal/terminos",
    shortTitle: "Términos y Condiciones",
    fullTitle: `Términos y Condiciones de Uso ${LEGAL_VERSION}`,
    version: LEGAL_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    consentType: "terms_of_service",
    markdown: TERMS_MARKDOWN,
  },
];

export const LEGAL_DOCUMENTS_BY_SLUG = Object.fromEntries(
  LEGAL_DOCUMENTS.map((document) => [document.slug, document]),
) as Record<LegalDocumentSlug, LegalDocumentDefinition>;

export function getLegalDocumentBySlug(slug: LegalDocumentSlug) {
  return LEGAL_DOCUMENTS_BY_SLUG[slug];
}

export function getLegalConsentLabel(type: LegalConsentType) {
  switch (type) {
    case "privacy_policy":
      return "Aviso de Privacidad Integral";
    case "terms_of_service":
      return "Términos y Condiciones de Uso";
    case "data_processing":
      return "Tratamiento de datos para operar el expediente digital";
    case "ai_training":
      return "Uso secundario de datos anonimizados para mejora y entrenamiento de IA";
    case "cross_platform_sharing":
      return "Compartición permitida dentro del ecosistema AuditaPatron/CompliLink/Helios";
    default:
      return type satisfies never;
  }
}
