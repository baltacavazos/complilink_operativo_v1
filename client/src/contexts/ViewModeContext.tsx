import {
  VIEW_MODE_SESSION_KEY,
  type UserViewCandidate,
  type UserViewMode,
  canToggleUserView,
} from "@/lib/viewMode";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ViewModeContextValue = {
  viewMode: UserViewMode;
  setNativeView: () => void;
  setDemoUserView: () => void;
  syncWithUser: (user: UserViewCandidate | null | undefined) => void;
};

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

function readInitialViewMode(): UserViewMode {
  if (typeof window === "undefined") return "native";
  const stored = window.sessionStorage.getItem(VIEW_MODE_SESSION_KEY);
  return stored === "demo-user" ? "demo-user" : "native";
}

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [viewMode, setViewMode] = useState<UserViewMode>(() => readInitialViewMode());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(VIEW_MODE_SESSION_KEY, viewMode);
  }, [viewMode]);

  const setNativeView = useCallback(() => {
    setViewMode("native");
  }, []);

  const setDemoUserView = useCallback(() => {
    setViewMode("demo-user");
  }, []);

  const syncWithUser = useCallback((user: UserViewCandidate | null | undefined) => {
    if (!canToggleUserView(user)) {
      setViewMode("native");
    }
  }, []);

  const value = useMemo<ViewModeContextValue>(
    () => ({
      viewMode,
      setNativeView,
      setDemoUserView,
      syncWithUser,
    }),
    [setDemoUserView, setNativeView, syncWithUser, viewMode],
  );

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error("useViewMode must be used within ViewModeProvider");
  }
  return context;
}
