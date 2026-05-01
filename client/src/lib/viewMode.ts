export type UserViewMode = "native" | "demo-user";

export type UserViewCandidate = {
  role?: string | null;
  [key: string]: unknown;
};

export const VIEW_MODE_SESSION_KEY = "complilink-view-mode";
export const CEO_PANEL_STORAGE_KEY_PREFIX = "ceo_panel_open";

export function canToggleUserView(user: UserViewCandidate | null | undefined) {
  return user?.role === "admin";
}

export function getEffectiveRole(
  user: UserViewCandidate | null | undefined,
  viewMode: UserViewMode,
) {
  if (!user?.role) return null;
  if (user.role === "admin" && viewMode === "demo-user") return "user";
  return user.role;
}

export function isViewingAsUser(
  user: UserViewCandidate | null | undefined,
  viewMode: UserViewMode,
) {
  return canToggleUserView(user) && viewMode === "demo-user";
}

export function isCeoRoute(pathname: string) {
  return pathname === "/ceo" || pathname.startsWith("/ceo/");
}

export function shouldRedirectDemoUserFromCeo(
  pathname: string,
  user: UserViewCandidate | null | undefined,
  viewMode: UserViewMode,
) {
  return isCeoRoute(pathname) && isViewingAsUser(user, viewMode);
}

export function getStableUserIdentifier(
  user: UserViewCandidate | null | undefined,
) {
  if (!user) {
    return null;
  }

  const candidateKeys = ["openId", "id", "userId", "email"] as const;

  for (const key of candidateKeys) {
    const value = user[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

export function getCeoPanelStateStorageKey(
  user: UserViewCandidate | null | undefined,
) {
  if (!canToggleUserView(user)) {
    return null;
  }

  const stableUserIdentifier = getStableUserIdentifier(user);
  if (!stableUserIdentifier) {
    return null;
  }

  return `${CEO_PANEL_STORAGE_KEY_PREFIX}_${stableUserIdentifier}`;
}

export function readPersistedCeoPanelState(
  user: UserViewCandidate | null | undefined,
) {
  if (typeof window === "undefined") {
    return false;
  }

  const storageKey = getCeoPanelStateStorageKey(user);
  if (!storageKey) {
    return false;
  }

  try {
    return window.localStorage.getItem(storageKey) === "open";
  } catch {
    return false;
  }
}

export function writePersistedCeoPanelState(
  user: UserViewCandidate | null | undefined,
  isOpen: boolean,
) {
  if (typeof window === "undefined") {
    return;
  }

  const storageKey = getCeoPanelStateStorageKey(user);
  if (!storageKey) {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, isOpen ? "open" : "closed");
  } catch {
    return;
  }
}

export function clearPersistedCeoPanelState(
  user: UserViewCandidate | null | undefined,
) {
  if (typeof window === "undefined") {
    return;
  }

  const storageKey = getCeoPanelStateStorageKey(user);

  try {
    if (storageKey) {
      window.localStorage.removeItem(storageKey);
    }

    window.localStorage.removeItem("ceoPanelState");

    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(`${CEO_PANEL_STORAGE_KEY_PREFIX}_`)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    return;
  }
}
