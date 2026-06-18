import { Preferences } from "@capacitor/preferences";

import { isNativeApp } from "./nativeRuntime";

type StorageScope = "local" | "session";

type BrowserStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const memorySessionStorage = new Map<string, string>();

function getBrowserStorage(scope: StorageScope): BrowserStorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  return scope === "local" ? window.localStorage : window.sessionStorage;
}

function getNativeKey(scope: StorageScope, key: string) {
  return `auditapatron.${scope}.${key}`;
}

export function getSessionMemoryStorageSize() {
  return memorySessionStorage.size;
}

export function platformSessionStorageGetSync(key: string) {
  if (isNativeApp()) {
    return memorySessionStorage.get(key) ?? null;
  }

  return getBrowserStorage("session")?.getItem(key) ?? null;
}

export function platformSessionStorageSetSync(key: string, value: string) {
  if (isNativeApp()) {
    memorySessionStorage.set(key, value);
    return;
  }

  getBrowserStorage("session")?.setItem(key, value);
}

export function platformSessionStorageRemoveSync(key: string) {
  if (isNativeApp()) {
    memorySessionStorage.delete(key);
    return;
  }

  getBrowserStorage("session")?.removeItem(key);
}

export async function platformStorageGet(
  scope: StorageScope,
  key: string,
): Promise<string | null> {
  if (isNativeApp()) {
    if (scope === "session") {
      return memorySessionStorage.get(key) ?? null;
    }

    const result = await Preferences.get({ key: getNativeKey(scope, key) });
    return result.value ?? null;
  }

  const storage = getBrowserStorage(scope);
  return storage?.getItem(key) ?? null;
}

export async function platformStorageSet(
  scope: StorageScope,
  key: string,
  value: string,
): Promise<void> {
  if (isNativeApp()) {
    if (scope === "session") {
      memorySessionStorage.set(key, value);
      return;
    }

    await Preferences.set({ key: getNativeKey(scope, key), value });
    return;
  }

  const storage = getBrowserStorage(scope);
  storage?.setItem(key, value);
}

export async function platformStorageRemove(
  scope: StorageScope,
  key: string,
): Promise<void> {
  if (isNativeApp()) {
    if (scope === "session") {
      memorySessionStorage.delete(key);
      return;
    }

    await Preferences.remove({ key: getNativeKey(scope, key) });
    return;
  }

  const storage = getBrowserStorage(scope);
  storage?.removeItem(key);
}

export async function platformStorageGetJSON<T>(
  scope: StorageScope,
  key: string,
): Promise<T | null> {
  const rawValue = await platformStorageGet(scope, key);
  if (!rawValue) return null;

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

export async function platformStorageSetJSON(
  scope: StorageScope,
  key: string,
  value: unknown,
): Promise<void> {
  await platformStorageSet(scope, key, JSON.stringify(value));
}

export async function platformStorageClearSession(): Promise<void> {
  memorySessionStorage.clear();
}
