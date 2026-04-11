import { useViewMode } from "@/contexts/ViewModeContext";
import { getEffectiveRole, isViewingAsUser as resolveIsViewingAsUser } from "@/lib/viewMode";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();
  const { viewMode, setDemoUserView, setNativeView, syncWithUser } = useViewMode();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
      setNativeView();
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      setNativeView();
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, setNativeView, utils]);

  useEffect(() => {
    syncWithUser(meQuery.data ?? null);
  }, [meQuery.data, syncWithUser]);

  const state = useMemo(() => {
    const realUser = meQuery.data ?? null;
    const effectiveRole = getEffectiveRole(realUser, viewMode);
    const user = realUser
      ? {
          ...realUser,
          role: effectiveRole ?? realUser.role,
        }
      : null;
    const canUseDemoView = realUser?.role === "admin";
    const isViewingAsUser = resolveIsViewingAsUser(realUser, viewMode);

    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(realUser)
    );

    return {
      realUser,
      user,
      effectiveRole,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(realUser),
      canToggleUserView: canUseDemoView,
      isViewingAsUser,
      viewMode,
    };
  }, [
    logoutMutation.error,
    logoutMutation.isPending,
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    viewMode,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.realUser) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath;
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.realUser,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
    enterUserView: setDemoUserView,
    exitUserView: setNativeView,
  };
}
