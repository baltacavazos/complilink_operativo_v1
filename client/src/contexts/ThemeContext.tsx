import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

type ThemeRoot = Pick<Element, "classList">;

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

export function getStoredTheme(storage?: ThemeStorage): Theme | null {
  if (!storage) {
    return null;
  }

  const stored = storage.getItem("theme");
  return isTheme(stored) ? stored : null;
}

export function resolveInitialTheme(options: {
  switchable: boolean;
  defaultTheme: Theme;
  storage?: ThemeStorage;
}): Theme {
  if (!options.switchable) {
    return options.defaultTheme;
  }

  return getStoredTheme(options.storage) ?? options.defaultTheme;
}

export function syncThemeWithDocument(options: {
  root?: ThemeRoot | null;
  theme: Theme;
  switchable: boolean;
  storage?: ThemeStorage;
}): void {
  const { root, theme, switchable, storage } = options;

  if (root) {
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }

  if (switchable && storage) {
    storage.setItem("theme", theme);
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() =>
    resolveInitialTheme({
      switchable,
      defaultTheme,
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    }),
  );

  useEffect(() => {
    syncThemeWithDocument({
      root: document.documentElement,
      theme,
      switchable,
      storage: window.localStorage,
    });
  }, [theme, switchable]);

  const toggleTheme = switchable
    ? () => {
        setTheme(prev => (prev === "light" ? "dark" : "light"));
      }
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

export type { Theme, ThemeRoot, ThemeStorage };
