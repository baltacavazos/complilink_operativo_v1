# Contexto de robustez V1 no visible

Proyecto: `complilink_operativo_v1`
Objetivo: dejar la V1 lo más robusta posible **sin agregar funcionalidades nuevas** y **sin tocar todavía estética/interfaz**.

## Restricción de alcance
Solo se permiten correcciones de:
- errores operativos reales
- huecos de validación
- resiliencia backend
- pruebas faltantes de flujos ya existentes
- degradación segura cuando falte infraestructura esperada

No se permite:
- agregar módulos nuevos
- ampliar features
- cambiar el producto visible salvo lo estrictamente necesario para que algo existente funcione bien

## Hallazgos actuales
1. El proyecto compila en TypeScript sin errores.
2. Existe un error operativo real en ejecución del escaneo inicial de CEO Bridge:
   - `Table '...ceo_bridge_schedules' doesn't exist`
   - El error viene de una consulta a `ceo_bridge_schedules` unida con `ceo_bridge_presets` y `users`.
3. Ya se endureció la trazabilidad de anomalías de la Consola CEO y eso quedó validado.
4. Quedan pendientes de robustez V1 ligados a pruebas/validación y a eliminar ruido operativo real.

## Decisión a contrastar
Necesito que evalúes y priorices, con criterio conservador de V1 robusta, este paquete de trabajo:

A. Corregir el problema de `ceo_bridge_schedules` con la **menor expansión funcional posible**. Comparar estas opciones:
- Opción A1: crear la tabla faltante y cualquier ajuste mínimo de esquema requerido porque la funcionalidad ya existe conceptualmente.
- Opción A2: mantener el feature sin ampliarlo, pero degradar de forma segura el escaneo automático si la tabla no existe, con logging controlado y sin romper runtime.
- Opción A3: combinación mínima: guardia defensiva + saneamiento del esquema si está claramente incompleto.

B. Cerrar huecos de pruebas/validación en flujos existentes ya aprobados para V1, especialmente consentimiento `/auditar` y flujos internos críticos ya presentes.

C. Señalar si hay otro tipo de robustez **no visible** que debería corregirse antes de llamar a esto V1, pero solo si es claramente bloqueante y no implica feature nueva.

## Lo que necesito como salida
Responde en JSON válido con esta forma exacta:
{
  "prioridad_1": "...",
  "prioridad_2": "...",
  "prioridad_3": "...",
  "decision_ceo_bridge": {
    "opcion_recomendada": "A1|A2|A3",
    "justificacion": "...",
    "riesgo": "bajo|medio|alto"
  },
  "pruebas_imprescindibles_v1": ["..."],
  "bloqueantes_reales_v1": ["..."],
  "cosas_que_NO_haria_ahora": ["..."],
  "plan_minimo_robusto": ["..."]
}
