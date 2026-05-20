import { App as CapacitorApp } from "@capacitor/app";
import { type PluginListenerHandle } from "@capacitor/core";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { getAppPathFromUrl, isNativeApp } from "@/lib/nativeRuntime";

export default function AppUrlListener() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!isNativeApp()) {
      return;
    }

    let disposed = false;

    const refreshSession = () => {
      if (disposed) {
        return;
      }

      void utils.auth.me.invalidate();
    };

    const closeExternalBrowser = async () => {
      try {
        const { Browser } = await import("@capacitor/browser");
        await Browser.close();
      } catch {
        // noop: close is best-effort because the browser might not be open
      }
    };

    const routeIncomingUrl = (rawUrl?: string | null) => {
      const nextPath = getAppPathFromUrl(rawUrl);
      if (!nextPath || disposed) {
        return;
      }

      setLocation(nextPath);
      refreshSession();
      void closeExternalBrowser();
    };

    const urlListener = CapacitorApp.addListener("appUrlOpen", event => {
      routeIncomingUrl(event.url);
    });

    const appStateListener = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        refreshSession();
      }
    });

    refreshSession();

    CapacitorApp.getLaunchUrl()
      .then((launch: { url?: string } | undefined) => {
        routeIncomingUrl(launch?.url);
      })
      .catch(() => {
        // noop: a launch URL is optional
      });

    return () => {
      disposed = true;
      void urlListener.then((handle: PluginListenerHandle) => handle.remove());
      void appStateListener.then((handle: PluginListenerHandle) => handle.remove());
    };
  }, [setLocation, utils]);

  return null;
}
