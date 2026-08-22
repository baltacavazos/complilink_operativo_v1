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

    expect(config).toContain('appId: "com.auditapatron.mobile"');
    expect(config).toContain('"auditapatron.com"');
    expect(manifest).toContain('<data android:scheme="auditapatron" />');
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
});
