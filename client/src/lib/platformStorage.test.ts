import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isNativeAppMock = vi.fn(() => false);
const preferencesGetMock = vi.fn();
const preferencesSetMock = vi.fn();
const preferencesRemoveMock = vi.fn();

vi.mock("./nativeRuntime", () => ({
  isNativeApp: () => isNativeAppMock(),
}));

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: (input: unknown) => preferencesGetMock(input),
    set: (input: unknown) => preferencesSetMock(input),
    remove: (input: unknown) => preferencesRemoveMock(input),
  },
}));

import {
  getSessionMemoryStorageSize,
  platformSessionStorageGetSync,
  platformSessionStorageRemoveSync,
  platformSessionStorageSetSync,
  platformStorageGet,
  platformStorageRemove,
  platformStorageSet,
} from "./platformStorage";

type StorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

type TestWindow = {
  localStorage: StorageMock;
  sessionStorage: StorageMock;
};

function createStorageMock(): StorageMock {
  const store = new Map<string, string>();

  return {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: key => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

const globalScope = globalThis as typeof globalThis & {
  window?: TestWindow;
};

describe("platformStorage", () => {
  beforeEach(() => {
    isNativeAppMock.mockReturnValue(false);
    preferencesGetMock.mockReset();
    preferencesSetMock.mockReset();
    preferencesRemoveMock.mockReset();
    globalScope.window = {
      localStorage: createStorageMock(),
      sessionStorage: createStorageMock(),
    };
  });

  afterEach(() => {
    delete globalScope.window;
    vi.restoreAllMocks();
  });

  it("uses browser storages on web", async () => {
    await platformStorageSet("local", "alpha", "uno");
    expect(await platformStorageGet("local", "alpha")).toBe("uno");

    platformSessionStorageSetSync("beta", "dos");
    expect(platformSessionStorageGetSync("beta")).toBe("dos");

    await platformStorageRemove("local", "alpha");
    platformSessionStorageRemoveSync("beta");

    expect(await platformStorageGet("local", "alpha")).toBeNull();
    expect(platformSessionStorageGetSync("beta")).toBeNull();
  });

  it("uses Preferences for native local storage and memory for native session storage", async () => {
    isNativeAppMock.mockReturnValue(true);
    preferencesGetMock.mockResolvedValue({ value: "tres" });

    await platformStorageSet("local", "clave", "valor");
    expect(preferencesSetMock).toHaveBeenCalledWith({
      key: "auditapatron.local.clave",
      value: "valor",
    });

    expect(await platformStorageGet("local", "clave")).toBe("tres");

    platformSessionStorageSetSync("temporal", "cuatro");
    expect(platformSessionStorageGetSync("temporal")).toBe("cuatro");
    expect(getSessionMemoryStorageSize()).toBeGreaterThan(0);

    platformSessionStorageRemoveSync("temporal");
    expect(platformSessionStorageGetSync("temporal")).toBeNull();

    await platformStorageRemove("local", "clave");
    expect(preferencesRemoveMock).toHaveBeenCalledWith({
      key: "auditapatron.local.clave",
    });
  });
});
