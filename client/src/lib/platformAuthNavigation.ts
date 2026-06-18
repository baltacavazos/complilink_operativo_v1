import { getLoginUrl } from "@/const";

import { buildAbsolutePublicUrl, openExternalUrl } from "./nativeRuntime";

export function getPlatformLoginUrl(returnPath?: string) {
  return getLoginUrl(returnPath);
}

export async function openPlatformLogin(returnPath?: string) {
  await openExternalUrl(getPlatformLoginUrl(returnPath));
}

export async function openPlatformExternalUrl(url: string) {
  await openExternalUrl(url);
}

export async function openPlatformAbsolutePath(path: string) {
  await openExternalUrl(buildAbsolutePublicUrl(path));
}
