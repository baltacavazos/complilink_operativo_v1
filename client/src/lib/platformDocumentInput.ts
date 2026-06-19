import { Camera, CameraResultType, CameraSource, type GalleryPhoto, type Photo } from "@capacitor/camera";

import { isNativeApp } from "./nativeRuntime";

export type PlatformDocumentSelection = {
  source: "web-file" | "native-camera" | "native-gallery";
  dataUrl: string;
  formatHint: "image";
};

export type PlatformCaptureMode = "camera" | "file";

export function canUseNativeDocumentInput() {
  return isNativeApp();
}


async function normalizePhoto(
  photo: Photo | GalleryPhoto,
  source: PlatformDocumentSelection["source"],
): Promise<PlatformDocumentSelection> {
  if (photo.webPath) {
    return {
      source,
      dataUrl: photo.webPath,
      formatHint: "image",
    };
  }

  if (photo.path) {
    return {
      source,
      dataUrl: photo.path,
      formatHint: "image",
    };
  }

  throw new Error("No fue posible normalizar la imagen seleccionada.");
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
