import { App as CapacitorApp } from "@capacitor/app";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { getAppPathFromUrl, isNativeApp } from "@/lib/nativeRuntime";

export default function AppUrlListener() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isNativeApp()) {
      return;
    }

    let disposed = false;

    const routeIncomingUrl = (rawUrl?: string | null) => {
      const nextPath = getAppPathFromUrl(rawUrl);
      if (!nextPath || disposed) {
        return;
      }

      setLocation(nextPath);
    };

    const listener = CapacitorApp.addListener("appUrlOpen", (event) => {
      routeIncomingUrl(event.url);
    });

    CapacitorApp.getLaunchUrl()
      .then((launch) => {
        routeIncomingUrl(launch?.url);
      })
      .catch(() => {
        // noop: a launch URL is optional
      });

    return () => {
      disposed = true;
      void listener.then((handle) => handle.remove());
    };
  }, [setLocation]);

  return null;
}
