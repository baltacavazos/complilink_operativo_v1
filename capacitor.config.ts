import type { CapacitorConfig } from "@capacitor/cli";

const DEFAULT_REMOTE_WEB_URL = "https://auditapatron.com";
const configuredServerUrl = process.env.CAPACITOR_SERVER_URL?.trim();
const serverUrl = configuredServerUrl || DEFAULT_REMOTE_WEB_URL;
const useBundledAssetsOnly = process.env.CAPACITOR_USE_LOCAL_ASSETS === "1";

const config: CapacitorConfig = {
  appId: "com.auditapatron.mobile",
  appName: "Auditapatron",
  webDir: "dist/public",
  bundledWebRuntime: false,
  ...(useBundledAssetsOnly
    ? {}
    : {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith("http://"),
          allowNavigation: [
            "auditapatron.com",
            "www.auditapatron.com",
            "*.manus.space",
            "*.manus.computer",
          ],
        },
      }),
};

export default config;
