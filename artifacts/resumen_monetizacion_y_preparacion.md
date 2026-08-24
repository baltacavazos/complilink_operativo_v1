# Monetización de AuditaPatron — resumen operativo

## Oferta actual

| Oferta | Precio | Qué recibe la persona | Claridad para usuario | Estado operativo |
|---|---:|---|---|---|
| Audita Gratis | $0 | Primera lectura y hasta 3 documentos por expediente. | Muy clara: “Empezar gratis” y sin tarjeta. | Lista como puerta de entrada. |
| Audita Esencial | $79 MXN/mes | Hasta 15 documentos, comparativas y continuidad multi-documento. | Clara si aparece cuando el expediente ya necesita más contexto. | Checkout disponible en entorno de prueba; falta activar cobro real. |
| Audita Pro | $199 MXN/mes | Hasta 50 documentos, memoria histórica, revalidaciones y alertas. | Clara para expedientes recurrentes o más complejos. | Misma dependencia de activación de cobro real. |
| Informe Premium | $299 MXN, pago único | Resumen ejecutivo, hallazgos y siguiente paso sugerido. | Fácil de entender como entregable concreto. | Flujo comercial implementado; confirmar generación final antes de cobrar en vivo. |
| Expediente para abogado | $499 MXN, pago único | Cronología, documentos confirmados, huecos y preguntas útiles. | Útil y comprensible para quien necesita orientación profesional. | Flujo comercial implementado; confirmar entrega final antes de cobrar en vivo. |

## Qué se entiende bien

La lógica comercial parte de un modelo freemium: la persona puede obtener una primera señal sin pagar ni ingresar tarjeta y solo se le muestra una activación cuando necesita más documentos, comparación, continuidad o un entregable específico. Esto coincide con una necesidad sensible: primero comprobar utilidad, después decidir pagar.

Los productos puntuales son particularmente claros porque no obligan a una suscripción: el informe responde a “quiero entender mi caso” y el expediente responde a “quiero llevar algo ordenado a una abogada o abogado”.

## Qué debe estar listo antes de cobrar a público

| Punto | Estado | Acción necesaria |
|---|---|---|
| Cobro real | Pendiente | Salir del entorno de prueba, reclamar/configurar la cuenta de pagos y validar un cargo real controlado. |
| Retorno tras pago | Preparado en interfaz | Validar que la persona regrese a `/auditar` y vea de inmediato qué se desbloqueó. |
| Entrega del producto puntual | Requiere comprobación final | Ejecutar una compra de prueba por cada entregable y comprobar contenido, historial y acceso posterior. |
| Política de reembolso/soporte | No evaluada en este pase | Definirla antes de anunciar cobro, en lenguaje simple y visible. |

## Recomendación de salida

> Activar primero **Audita Gratis** y validar la conversión hacia **Esencial**. Mantener Pro y los productos puntuales visibles únicamente cuando sus entregables hayan sido verificados de punta a punta. No anunciar “cobro listo” hasta completar el cobro real y su retorno visible.

## Fuente interna

- `shared/commerce.ts`
- `client/src/lib/pricingExperience.ts`
- `client/src/pages/Auditar.tsx`
