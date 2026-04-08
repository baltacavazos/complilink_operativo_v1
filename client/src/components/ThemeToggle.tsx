import { Moon, SunMedium } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type ThemeToggleProps = {
  className?: string;
  compact?: boolean;
  minimal?: boolean;
};

export function ThemeToggle({ className, compact = false, minimal = false }: ThemeToggleProps) {
  const { theme, toggleTheme, switchable } = useTheme();

  if (!switchable || !toggleTheme) {
    return null;
  }

  const isDark = theme === "dark";
  const label = isDark ? "Modo oscuro activo" : "Modo claro activo";
  const actionLabel = isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={actionLabel}
      aria-pressed={isDark}
      title={actionLabel}
      className={joinClasses(
        "ap-theme-toggle group inline-flex items-center rounded-full border border-slate-200/80 bg-white/92 text-slate-700 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.45)] backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-teal-200 hover:text-slate-950 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-100 dark:hover:border-teal-400/50 dark:hover:bg-slate-900/90",
        minimal ? "h-10 px-2.5" : compact ? "h-10 gap-2 px-3" : "h-11 gap-2 px-3.5",
        className,
      )}
    >
      <span className="ap-theme-toggle-track relative flex h-6 w-11 shrink-0 items-center rounded-full bg-slate-200/90 p-1 transition-colors duration-300 dark:bg-slate-800/90">
        <span
          className={joinClasses(
            "ap-theme-toggle-thumb flex h-4 w-4 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition-transform duration-300 dark:bg-teal-400 dark:text-slate-950",
            isDark ? "translate-x-5" : "translate-x-0",
          )}
        >
          {isDark ? <Moon className="h-3 w-3" strokeWidth={2} /> : <SunMedium className="h-3 w-3" strokeWidth={2} />}
        </span>
      </span>
      {minimal ? <span className="sr-only">{label}</span> : (
        <span className="ap-theme-toggle-label flex flex-col items-start leading-none">
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-400 transition-colors duration-300 dark:text-slate-500">
            Tema
          </span>
          <span className="text-sm font-semibold text-current">{label}</span>
        </span>
      )}
    </button>
  );
}
