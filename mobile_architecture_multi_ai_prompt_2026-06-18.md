# Contexto

Estamos preparando **AuditaPatron** para convertirse en una app real de **iOS y Android**. No queremos una opinión genérica, sino una recomendación arquitectónica estricta y pragmática basada en el estado actual del código.

## Lo que ya existe en el proyecto

1. La base actual es **React 19 + Vite + tRPC + Express + Drizzle**.
2. El repositorio ya incluye dependencias de **Capacitor**:
   - `@capacitor/core`
   - `@capacitor/app`
   - `@capacitor/browser`
   - `@capacitor/camera`
   - `@capacitor/filesystem`
   - `@capacitor/preferences`
   - `@capacitor/android`
   - `@capacitor/ios`
   - `@capacitor/cli`
3. Ya existe lógica de soporte móvil parcial:
   - `client/src/lib/nativeRuntime.ts`
   - `client/src/components/AppUrlListener.tsx`
   - construcción de URLs públicas con `https://auditapatron.com`
   - parsing de rutas entrantes con esquema nativo `auditapatron:`
   - uso de `Browser.open()` para autenticación externa en entorno nativo
4. Ya existe un flujo de captura documental muy importante en `/auditar`, con estados como:
   - `preferredCaptureMode`
   - `selectedCaptureMode`
   - `openPreferredPicker()`
   - `openCameraPicker()`
   - `openFilePicker()`
5. No existen todavía estos artefactos:
   - `capacitor.config.*`
   - carpeta `ios/`
   - carpeta `android/`
   - manifiesto PWA operativo
   - configuración nativa de deep links por plataforma
6. El código cliente todavía usa muchas APIs browser-first, incluyendo múltiples referencias a `window`, `document`, `navigator`, `localStorage`, `sessionStorage` y `FileReader`.
7. El proyecto compila bien y el producto sigue vivo, por lo que sí es posible preparar una migración sin reescribir todo antes.

## Hallazgos externos oficiales relevantes

- Capacitor recomienda **Universal Links** en iOS y **App Links** en Android usando el mismo dominio HTTPS del sitio, más archivos de asociación en `/.well-known/`, configuración de `Associated Domains` en iOS y `intent-filter` con `android:autoVerify="true"` en Android.
- El plugin `@capacitor/camera` requiere permisos y descripciones explícitas en iOS (`NSCameraUsageDescription`, `NSPhotoLibraryAddUsageDescription`, `NSPhotoLibraryUsageDescription`) y recomienda escuchar `appRestoredResult` porque la captura abre una Activity separada que puede interrumpirse.

## Restricciones de negocio y producto

- Queremos llegar a una app real de **iOS y Android**.
- La plataforma depende críticamente de **captura de documentos**, **subida de archivos**, **autenticación**, **continuidad del expediente** y eventualmente **notificaciones**.
- Queremos minimizar retrabajo y aprovechar al máximo lo ya construido.
- Priorizamos velocidad de llegada a mercado, robustez operativa y experiencia confiable para usuarios no técnicos.

# Tu tarea

Actúa como un **arquitecto senior de producto móvil** extremadamente pragmático. Evalúa si la mejor ruta es:

A. **Capacitor sobre la base actual** como estrategia principal.
B. **Reescritura a React Native / Expo** desde ahora.
C. **Estrategia híbrida por fases**, comenzando con Capacitor y reservando una posible migración futura de superficies críticas.

# Responde en JSON válido con esta forma exacta

```json
{
  "recommended_strategy": "A | B | C",
  "confidence": "alta | media | baja",
  "why_this_strategy": "explicación breve pero contundente",
  "main_reuse_opportunities": ["..."],
  "main_risks": ["..."],
  "what_must_be_built_first": ["..."],
  "what_can_wait_until_phase_2": ["..."],
  "auth_and_deeplinks_recommendation": "...",
  "camera_and_files_recommendation": "...",
  "offline_and_local_state_recommendation": "...",
  "app_store_readiness_recommendation": "...",
  "single_best_next_move": "...",
  "anti_pattern_to_avoid": "..."
}
```

## Criterio

No me des una respuesta teórica. Quiero la recomendación **más rentable, menos frágil y más realista** para convertir este proyecto específico en app de iOS y Android.
