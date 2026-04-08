import { describe, expect, it, vi } from "vitest";

import {
  getStoredTheme,
  resolveInitialTheme,
  syncThemeWithDocument,
  type Theme,
  type ThemeRoot,
  type ThemeStorage,
} from "./ThemeContext";

function createStorage(initialValue: string | null = null): ThemeStorage {
  let value = initialValue;

  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_, nextValue: string) => {
      value = nextValue;
    }),
  };
}

function createRoot(initialDark = false): ThemeRoot & {
  containsDark: () => boolean;
} {
  const classes = new Set<string>(initialDark ? ["dark"] : []);

  return {
    classList: {
      add: vi.fn((token: string) => {
        classes.add(token);
      }),
      remove: vi.fn((token: string) => {
        classes.delete(token);
      }),
      contains: (token: string) => classes.has(token),
      toggle: vi.fn(),
      replace: vi.fn(),
      supports: vi.fn(),
      item: vi.fn(),
      forEach: vi.fn(),
      entries: vi.fn(),
      keys: vi.fn(),
      values: vi.fn(),
      length: 0,
      value: "",
      [Symbol.iterator]: function* iterator() {
        yield* classes;
      },
    } as DOMTokenList,
    containsDark: () => classes.has("dark"),
  };
}

describe("ThemeContext helpers", () => {
  it("reads only valid persisted themes", () => {
    expect(getStoredTheme(createStorage("dark"))).toBe("dark");
    expect(getStoredTheme(createStorage("light"))).toBe("light");
    expect(getStoredTheme(createStorage("system"))).toBeNull();
    expect(getStoredTheme()).toBeNull();
  });

  it("uses the stored theme only when switching is enabled", () => {
    const storage = createStorage("dark");

    expect(
      resolveInitialTheme({
        switchable: true,
        defaultTheme: "light",
        storage,
      }),
    ).toBe("dark");

    expect(
      resolveInitialTheme({
        switchable: false,
        defaultTheme: "light",
        storage,
      }),
    ).toBe("light");
  });

  it("falls back to the default theme when storage is missing or invalid", () => {
    expect(
      resolveInitialTheme({
        switchable: true,
        defaultTheme: "dark",
        storage: createStorage("invalid"),
      }),
    ).toBe("dark");

    expect(
      resolveInitialTheme({
        switchable: true,
        defaultTheme: "light",
      }),
    ).toBe("light");
  });

  it("applies the dark class and persists the preference when switchable", () => {
    const storage = createStorage();
    const root = createRoot();

    syncThemeWithDocument({
      root,
      theme: "dark",
      switchable: true,
      storage,
    });

    expect(root.containsDark()).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith("theme", "dark");
  });

  it("removes the dark class and avoids persistence when switching is disabled", () => {
    const storage = createStorage("dark");
    const root = createRoot(true);

    syncThemeWithDocument({
      root,
      theme: "light",
      switchable: false,
      storage,
    });

    expect(root.containsDark()).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("updates persistence when returning to light mode", () => {
    const storage = createStorage("dark");
    const root = createRoot(true);

    syncThemeWithDocument({
      root,
      theme: "light" satisfies Theme,
      switchable: true,
      storage,
    });

    expect(root.containsDark()).toBe(false);
    expect(storage.setItem).toHaveBeenCalledWith("theme", "light");
  });
});
