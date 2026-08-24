import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

describe("mobile native readiness", () => {
  it("keeps the Capacitor shell aligned with the public app identity", () => {
    const config = readProjectFile("capacitor.config.ts");
    const manifest = readProjectFile("android", "app", "src", "main", "AndroidManifest.xml");
    const styles = readProjectFile("android", "app", "src", "main", "res", "values", "styles.xml");

    expect(config).toContain('appId: "com.auditapatron.mobile"');
    expect(config).toContain('"auditapatron.com"');
    expect(config).toContain("const useRemoteServer = Boolean(configuredServerUrl) && !useBundledAssetsOnly");
    expect(manifest).toContain('<data android:scheme="auditapatron" />');
    expect(styles).toContain('<item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>');
  });

  it("declares iOS privacy messages required by the native camera flow", () => {
    const infoPlist = readProjectFile("ios", "App", "App", "Info.plist");

    expect(infoPlist).toContain("NSCameraUsageDescription");
    expect(infoPlist).toContain("NSPhotoLibraryUsageDescription");
  });

  it("uses native capture for camera while preserving the system document picker for PDF and XML", () => {
    const auditar = readProjectFile("client", "src", "pages", "Auditar.tsx");

    expect(auditar).toContain('selectNativeDocumentForCaptureMode("camera")');
    expect(auditar).not.toContain('selectNativeDocumentForCaptureMode("file")');
    expect(auditar).toContain("fileInputRef.current?.click();");
  });

  it("keeps corrected AuditaPatron branding across web and native install surfaces", () => {
    const logo = readProjectFile("client", "src", "components", "AuditaPatronLogo.tsx");
    const html = readProjectFile("client", "index.html");
    const webManifest = readProjectFile("client", "public", "site.webmanifest");
    const adaptiveBackground = readProjectFile(
      "android",
      "app",
      "src",
      "main",
      "res",
      "values",
      "ic_launcher_background.xml",
    );

    expect(logo).toContain('/manus-storage/pwa-512_c25a4918.png');
    expect(logo).not.toContain("auditapatron-icon-base_034a1256.png");
    expect(html).toContain('/manus-storage/favicon-32_5a4f6751.png');
    expect(html).toContain('/manus-storage/apple-touch-icon-180_5f31b507.png');
    expect(webManifest).toContain('/manus-storage/pwa-192_aca7de64.png');
    expect(webManifest).toContain('/manus-storage/pwa-512_c25a4918.png');
    expect(adaptiveBackground).toContain("#142C52");

    const nativeAssets = [
      "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png",
      "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png",
      "android/app/src/main/res/drawable-port-xxxhdpi/splash.png",
      "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
      "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png",
    ];
    for (const relativePath of nativeAssets) {
      const absolutePath = path.join(process.cwd(), relativePath);
      expect(fs.existsSync(absolutePath), relativePath).toBe(true);
      expect(fs.statSync(absolutePath).size, relativePath).toBeGreaterThan(1_000);
    }
  });
});
