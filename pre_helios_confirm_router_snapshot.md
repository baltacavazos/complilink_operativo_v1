# Snapshot técnico de confirmDocumentDraft

El estado actual del router muestra que `confirmDocumentDraft` quedó con un preflight que:

- vuelve a leer el draft antes del lock,
- valida frescura antes del lock,
- y adquiere la deduplicación general `confirmDocumentDraft` antes del lock.

Eso rompe dos expectativas de `server/caseWorkflows.test.ts`:

- los intentos expirados deben seguir entrando a `withDatabaseLock`,
- y el rate limit debe contarse antes del lock pero sin eliminar el lock de los intentos válidos previos.

La corrección final debe hacer tres cosas:

1. **Eliminar el preflight actual `draftForDedup`**.
2. **Introducir un chequeo previo al lock sólo para una clave de confirmación exitosa reciente**, separada de la deduplicación transitoria general.
3. **Marcar esa clave de éxito sólo al final del camino feliz**, justo antes de devolver la respuesta de confirmación.
