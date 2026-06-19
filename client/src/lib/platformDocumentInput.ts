import {
  Camera,
  CameraResultType,
  CameraSource,
  type GalleryPhoto,
  type Photo,
} from "@capacitor/camera";

import { isNativeApp } from "./nativeRuntime";

export type PlatformDocumentSelection = {
  source: "web-file" | "native-camera" | "native-gallery";
  dataUrl: string;
  formatHint: "image";
  file?: File;
};

export type PlatformCaptureMode = "camera" | "file";

const DOCUMENT_SELECTION_CANCELLED_CODE = "AUDITAPATRON_DOCUMENT_SELECTION_CANCELLED";

export function canUseNativeDocumentInput() {
  return isNativeApp();
}

function normalizePermissionState(state: string | undefined) {
  return state === "granted" || state === "limited";
}

function createDocumentSelectionError(message: string, code?: string) {
  const error = new Error(message);
  if (code) {
    Object.assign(error, { code });
  }
  return error;
}

function isSelectionCancellationMessage(message: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes("cancel") ||
    normalizedMessage.includes("cancell") ||
    normalizedMessage.includes("no image picked") ||
    normalizedMessage.includes("user did not capture")
  );
}

export function isNativeDocumentSelectionCancelled(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    (error as Error & { code?: string }).code === DOCUMENT_SELECTION_CANCELLED_CODE ||
    isSelectionCancellationMessage(error.message)
  );
}

export function getNativeDocumentSelectionErrorMessage(mode: PlatformCaptureMode) {
  return mode === "camera"
    ? "No pudimos abrir la cámara en este momento. Revisa permisos e inténtalo de nuevo."
    : "No pudimos abrir tu galería en este momento. Revisa permisos e inténtalo de nuevo.";
}

async function ensureNativeDocumentPermissions(mode: PlatformCaptureMode) {
  const permissions = await Camera.checkPermissions();

  if (mode === "camera") {
    if (!normalizePermissionState(permissions.camera)) {
      const requested = await Camera.requestPermissions({ permissions: ["camera"] });
      if (!normalizePermissionState(requested.camera)) {
        throw createDocumentSelectionError(
          "Necesitamos permiso para usar tu cámara dentro de la app.",
        );
      }
    }

    return;
  }

  if (!normalizePermissionState(permissions.photos)) {
    const requested = await Camera.requestPermissions({ permissions: ["photos"] });
    if (!normalizePermissionState(requested.photos)) {
      throw createDocumentSelectionError(
        "Necesitamos permiso para abrir tu galería dentro de la app.",
      );
    }
  }
}

function normalizeNativeSelectionError(error: unknown, mode: PlatformCaptureMode): Error {
  if (error instanceof Error && isSelectionCancellationMessage(error.message)) {
    return createDocumentSelectionError(
      mode === "camera"
        ? "Selección de cámara cancelada por la persona usuaria."
        : "Selección de galería cancelada por la persona usuaria.",
      DOCUMENT_SELECTION_CANCELLED_CODE,
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return createDocumentSelectionError(getNativeDocumentSelectionErrorMessage(mode));
}

async function normalizePhoto(
  photo: Photo | GalleryPhoto,
  source: PlatformDocumentSelection["source"],
): Promise<PlatformDocumentSelection> {
  const resolvedPath = photo.webPath ?? photo.path;

  if (!resolvedPath) {
    throw new Error("No fue posible normalizar la imagen seleccionada.");
  }

  const response = await fetch(resolvedPath);
  const blob = await response.blob();
  const normalizedFormat = (photo.format ?? blob.type.split("/")[1] ?? "jpeg")
    .toLowerCase()
    .replace(/^jpg$/, "jpeg");
  const mimeType = blob.type || `image/${normalizedFormat}`;
  const file = new File([blob], `auditapatron-${source}.${normalizedFormat}`, {
    type: mimeType,
  });

  return {
    source,
    dataUrl: resolvedPath,
    formatHint: "image",
    file,
  };
}

export async function selectDocumentFromNativeCamera() {
  if (!isNativeApp()) {
    throw new Error("La cámara nativa solo está disponible dentro de la app móvil.");
  }

  await ensureNativeDocumentPermissions("camera");

  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Camera,
      resultType: CameraResultType.Uri,
      quality: 92,
      correctOrientation: true,
    });

    return normalizePhoto(photo, "native-camera");
  } catch (error) {
    throw normalizeNativeSelectionError(error, "camera");
  }
}

export async function selectDocumentFromNativeGallery() {
  if (!isNativeApp()) {
    throw new Error("La galería nativa solo está disponible dentro de la app móvil.");
  }

  await ensureNativeDocumentPermissions("file");

  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Photos,
      resultType: CameraResultType.Uri,
      quality: 92,
      correctOrientation: true,
    });

    return normalizePhoto(photo, "native-gallery");
  } catch (error) {
    throw normalizeNativeSelectionError(error, "file");
  }
}

export async function readWebFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("No fue posible leer el archivo seleccionado."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("No fue posible leer el archivo seleccionado."));
    reader.readAsDataURL(file);
  });
}

export async function selectDocumentFromWebFile(file: File): Promise<PlatformDocumentSelection> {
  const dataUrl = await readWebFileAsDataUrl(file);
  return {
    source: "web-file",
    dataUrl,
    formatHint: "image",
    file,
  };
}

export async function selectNativeDocumentForCaptureMode(
  mode: PlatformCaptureMode,
): Promise<PlatformDocumentSelection> {
  if (mode === "camera") {
    return selectDocumentFromNativeCamera();
  }

  return selectDocumentFromNativeGallery();
}
