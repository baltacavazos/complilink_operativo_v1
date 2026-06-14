# Dossier para ronda multi-IA de cierre total — AuditaPatron

## Mandato

Esta ronda no busca una auditoría más. Busca una **propuesta ejecutable de cierre total** para que AuditaPatron se sienta como un producto terminado, altamente deseable, confiable, fácil de entender y suficientemente valioso como para que la reacción del usuario sea cercana a **“shut up and take my money”**.

El moderador va a ejecutar cambios reales después de esta deliberación. Por eso la respuesta debe priorizar **cambios concretos de alto impacto** y no críticas abstractas.

## Restricciones reales

La plataforma ya existe y está operativa. No se busca una reescritura total. Se busca una ronda de cierre que aumente conversión, claridad, confianza y percepción de producto premium.

No se permite inventar testimonios, reseñas ni prueba social falsa. Si se recomiendan mecanismos de credibilidad, deben ser reales, demostrativos, funcionales o estructurales.

La audiencia principal son trabajadores mexicanos no técnicos que quieren revisar si algo en su nómina, CFDI o documentos laborales no cuadra.

## Estado actual moderado

La ronda de auditoría previa dejó un score moderado de **6.0/10**, pero un consenso de **9.2/10** sobre los problemas raíz. La conclusión fue que la plataforma **ya encontró una promesa valiosa y una voz correcta**, pero todavía arrastra señales visibles de crecimiento por acumulación: monolitos frontend, sobre-explicación editorial y consistencia visual incompleta.

## Lo que hoy sí funciona

La home pública tiene una promesa inicial fuerte y clara: `Sube tu recibo y te decimos qué revisar.` También funcionan bien frases como `Primero ves qué revisar. Si te sirve, luego decides si lo guardas o sigues con otro documento.`

La pantalla `/acceso` es limpia y entendible. El mensaje `Entra y sigue donde te quedaste` transmite continuidad y reduce ruido. El flujo de correo con código se entiende mejor que antes.

Existe un sistema global de tokens visuales en `index.css`, aunque la landing todavía usa varios colores hardcodeados que rompen coherencia.

## Lo que hoy sigue frenando la sensación de producto terminado

| Área | Problema |
| --- | --- |
| Home | Muy larga, demasiados bloques, repetición narrativa y demasiadas justificaciones de la misma promesa |
| Home | La propuesta es clara, pero no termina de sentirse inevitable ni deseable a nivel premium |
| Acceso | Funciona, pero todavía se siente más correcto que memorable o convincente |
| Auditar | Gran concentración de responsabilidades en un solo archivo y riesgo de sentirse más herramienta poderosa que experiencia perfectamente curada |
| Visual | Persisten rastros de inconsistencia de color y de sistema |
| Confianza | Falta reforzar la percepción de resultado real, seguridad real y valor progresivo sin recurrir a prueba social falsa |

## Evidencia estructural clave

| Archivo | Señal |
| --- | --- |
| `client/src/pages/Auditar.tsx` | 14,144 líneas |
| `client/src/pages/Home.tsx` | 3,027 líneas |
| `client/src/pages/CeoDashboard.tsx` | 4,637 líneas |
| `client/src/pages/Access.tsx` | 597 líneas |
| `client/src/index.css` | Tokens globales existentes con OKLCH |

## Lectura visual reciente

La home actual abre fuerte, pero todavía encadena demasiadas capas: hero, documento sugerido, microvideo, casos anonimizados, ejemplo de resultado, invitaciones a subir, privacidad, FAQ y CTA final. El problema ya no es falta de dirección. El problema es que se intenta probar demasiado una promesa que ya se entendió desde arriba.

`/acceso` está visualmente mejor resuelto. Sin embargo, todavía puede subir de nivel si se siente más como continuación natural de valor ganado y menos como trámite aislado.

También apareció una anomalía a verificar: `Salida rápida` fue extraído por el navegador como enlace a `https://news.google.com/`. Si esto es real y no un artefacto de extracción, debe corregirse porque daña confianza.

## Qué se espera de cada modelo

Cada modelo debe proponer una **versión final más irresistible** del producto actual sin reescribirlo desde cero. Debe priorizar cambios que aumenten:

1. Conversión desde la home.
2. Claridad inmediata del valor.
3. Credibilidad sin testimonios falsos.
4. Sensación de producto premium y terminado.
5. Continuidad suave hacia acceso y auditoría.
6. Disposición a pagar cuando aparezca el momento comercial.

## Preguntas obligatorias

1. Si solo pudieras cambiar **5 cosas** para que AuditaPatron se sienta terminado y altamente deseable, ¿cuáles serían?
2. ¿Qué debería **eliminarse, fusionarse o comprimirse** en Home para aumentar conversión?
3. ¿Qué prueba de realidad o de seriedad debería verse en el primer scroll sin inventar testimonios?
4. ¿Cómo debería sentirse `/acceso` para que no sea trámite sino continuación natural del valor?
5. ¿Qué debe cambiar en `/auditar` para que el núcleo del producto se sienta más premium, más obvio y más digno de pago?
6. ¿Cuál sería tu nueva propuesta de jerarquía para Home, en orden exacto de bloques?
7. ¿Qué frases exactas o ángulos de copy cambiarías para aumentar deseo, claridad y urgencia confiable?
8. ¿Qué cosas actuales deben preservarse obligatoriamente?

## Formato de salida obligatorio

Cada modelo debe responder con un objeto JSON con esta forma:

```json
{
  "model": "string",
  "global_finish_score": 0,
  "conversion_score": 0,
  "trust_score": 0,
  "premium_feel_score": 0,
  "top_5_changes": ["string", "string", "string", "string", "string"],
  "home_keep": ["string"],
  "home_cut_or_merge": ["string"],
  "home_new_hierarchy": ["string"],
  "home_copy_upgrades": ["string"],
  "trust_mechanisms": ["string"],
  "access_upgrades": ["string"],
  "auditar_upgrades": ["string"],
  "must_fix_now": ["string"],
  "must_preserve": ["string"],
  "north_star": "string",
  "confidence": "string"
}
```

## Criterio del moderador

El moderador no va a ejecutar una lista infinita. Va a sintetizar una ronda pequeña, agresiva y de máximo impacto. Por eso las recomendaciones deben ser **priorizadas, ejecutables y con criterio de producto real**.
