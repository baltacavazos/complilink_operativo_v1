import { getGoogleLoginUrl, getLoginUrl } from "@/const";

import { buildAbsolutePublicUrl, openExternalUrl } from "./nativeRuntime";

export function getPlatformLoginUrl(returnPath?: string) {
  return buildAbsolutePublicUrl(getLoginUrl(returnPath));
}

export function getPlatformGoogleLogin(returnPath?: string) {
  return getGoogleLoginUrl(returnPath);
}

export async function openPlatformLogin(returnPath?: string) {
  await openExternalUrl(getPlatformLoginUrl(returnPath));
}

export async function openPlatformGoogleLogin(returnPath?: string) {
  await openExternalUrl(getPlatformGoogleLogin(returnPath));
}

export async function openPlatformExternalUrl(url: string) {
  await openExternalUrl(url);
}

export async function openPlatformAbsolutePath(path: string) {
  await openExternalUrl(buildAbsolutePublicUrl(path));
}
