import {
  VIEW_MODE_SESSION_KEY,
  VIEW_MODE_SESSION_KEY_LEGACY,
  type UserViewCandidate,
  type UserViewMode,
  canToggleUserView,
  readPersistedViewMode,
} from "@/lib/viewMode";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  platformSessionStorageGetSync,
  platformSessionStorageRemoveSync,
  platformSessionStorageSetSync,
} from "@/lib/platformStorage";

type ViewModeContextValue = {
  viewMode: UserViewMode;
  setNativeView: () => void;
  setDemoUserView: () => void;
  syncWithUser: (user: UserViewCandidate | null | undefined) => void;
};

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

function readInitialViewMode(): UserViewMode {
  return readPersistedViewMode({
    getItem: platformSessionStorageGetSync,
    setItem: platformSessionStorageSetSync,
    removeItem: platformSessionStorageRemoveSync,
  });
}

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [viewMode, setViewMode] = useState<UserViewMode>(() => readInitialViewMode());

  useEffect(() => {
    platformSessionStorageSetSync(VIEW_MODE_SESSION_KEY, viewMode);
    platformSessionStorageRemoveSync(VIEW_MODE_SESSION_KEY_LEGACY);
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
