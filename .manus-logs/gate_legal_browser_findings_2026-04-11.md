# Hallazgos de validación visual del gate legal en /auditar

Fecha: 2026-04-11
URL verificada: `https://3000-inul7hv61pcp0ct295ejw-0aeaec7b.us1.manus.computer/auditar?legalGateHarness=1`

## Estado observado

- El modo de prueba del gate legal se renderiza correctamente sin depender de un expediente real.
- El botón **Simular conflicto del lock** provoca el estado de conflicto esperado.
- Tras el clic, aparece el botón **Reintentar aceptación** en la UI.
- El panel **Métricas visibles del lock** actualiza valores reales en pantalla.
- Valores observados después del conflicto simulado:
  - Intentos: 1
  - Conflictos: 1
  - Reintentos ejecutados: 0
  - Estado actual: `Conflicto de lock detectado`
- El bloque del gate legal queda visible en modo harness, lo que hace viable automatizar una prueba de navegador basada en query param.

## Implicación para la siguiente fase

La prueba E2E puede apuntar a `/auditar?legalGateHarness=1`, disparar el conflicto controlado y verificar tanto el estado visible del panel operativo como la aparición del CTA de reintento.
