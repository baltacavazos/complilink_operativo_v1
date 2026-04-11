export type UserViewMode = "native" | "demo-user";

export type UserViewCandidate = {
  role?: string | null;
};

export const VIEW_MODE_SESSION_KEY = "complilink-view-mode";

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
