# Caso de prueba: Didier Antonio Uicab Palomo

Se recibieron tres CFDI XML de nómina, tres PDFs asociados y un contrato individual de trabajo para validar el procesamiento de documentos dentro de Auditapatron y verificar que el flujo funcione de punta a punta.

## Datos consistentes extraídos de los XML

| Campo | Valor |
|---|---|
| Trabajador | Didier Antonio Uicab Palomo |
| RFC | UIPD9211257I0 |
| CURP | UIPD921125HYNCLD03 |
| NSS | 84129214965 |
| Patrón emisor | Evolucion Creativa Camreflex |
| RFC patrón | ECC190605VA1 |
| Registro patronal | R1379389106 |
| Número de empleado | 935264 |
| Inicio de relación laboral | 2024-01-16 |
| Tipo de contrato SAT | 01 |
| Tipo de régimen | 02 |
| Periodicidad de pago | 04 |
| Salario base de cotización | 331.01 MXN |
| Salario diario integrado | 331.01 MXN |
| Percepción reportada | SALARIO |
| Importe por recibo | 4,725.60 MXN |
| Días pagados por recibo | 15 |

## Recibos detectados

| UUID | Periodo | Fecha de pago | Total |
|---|---|---|---|
| 1566DF73-674B-5955-9114-071B61658F2C | 2026-04-01 a 2026-04-15 | 2026-04-15 | 4,725.60 MXN |
| 8CA01374-75D4-551C-A9CA-04D59C145BAD | 2026-04-16 a 2026-04-30 | 2026-04-30 | 4,725.60 MXN |
| 8C18C713-7AFA-5EA6-B323-FA208F8A3880 | 2026-05-01 a 2026-05-15 | 2026-05-15 | 4,725.60 MXN |

## Datos visibles del contrato

El contrato individual señala una relación por tiempo indeterminado con inicio el 16 de enero de 2024. Identifica al patrón como EVOLUCIÓN CREATIVA CAMREFLEX, S.A. DE C.V. y al trabajador como UICAB PALOMO DIDIER ANTONIO. También menciona un puesto de "INPLANT DE NOMINA", pago quincenal, cuenta BBVA 1541017741, y un salario diario de 248.93 MXN.

## Punto de validación esperado

Hay un punto importante para verificar dentro del producto y del análisis: los XML reportan salario base de cotización y salario diario integrado de 331.01 MXN, mientras que el contrato visible menciona un salario diario de 248.93 MXN. Se debe revisar si la plataforma detecta y comunica esta diferencia de forma clara, además de confirmar que procesa correctamente XML, PDF y contrato dentro del expediente del trabajador.
