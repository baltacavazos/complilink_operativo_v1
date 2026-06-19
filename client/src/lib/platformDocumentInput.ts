import { Camera, CameraResultType, CameraSource, type GalleryPhoto, type Photo } from "@capacitor/camera";

import { isNativeApp } from "./nativeRuntime";

export type PlatformDocumentSelection = {
  source: "web-file" | "native-camera" | "native-gallery";
  dataUrl: string;
  formatHint: "image";
  file?: File;
};

export type PlatformCaptureMode = "camera" | "file";

export function canUseNativeDocumentInput() {
  return isNativeApp();
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

  const photo = await Camera.getPhoto({
    source: CameraSource.Camera,
    resultType: CameraResultType.Uri,
    quality: 92,
    correctOrientation: true,
  });

  return normalizePhoto(photo, "native-camera");
}

export async function selectDocumentFromNativeGallery() {
  if (!isNativeApp()) {
    throw new Error("La galería nativa solo está disponible dentro de la app móvil.");
  }

  const photo = await Camera.getPhoto({
    source: CameraSource.Photos,
    resultType: CameraResultType.Uri,
    quality: 92,
    correctOrientation: true,
  });

  return normalizePhoto(photo, "native-gallery");
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
