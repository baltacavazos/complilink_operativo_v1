import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const accessSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Access.tsx"),
  "utf8",
);

describe("Access mobile auth markers", () => {
  it("routes Google login through the platform auth adapter", () => {
    expect(accessSource).toContain('openPlatformGoogleLogin');
    expect(accessSource).toContain('void openPlatformGoogleLogin(returnTo);');
  });

  it("keeps Manus login routed through platform external navigation", () => {
    expect(accessSource).toContain('void openPlatformExternalUrl(manusLoginUrl);');
  });

  it("separates account creation from sign-in and shows branded waiting", () => {
    expect(accessSource).toContain('type AccessMode = "signup" | "signin"');
    expect(accessSource).toContain('setAccessMode("signup")');
    expect(accessSource).toContain('setAccessMode("signin")');
    expect(accessSource).toContain("Crear cuenta con mi correo");
    expect(accessSource).toContain("Está cargando, puede tardar unos segundos.");
    expect(accessSource).toContain("window.location.assign(url)");
    expect(accessSource).toContain("Microsoft y Apple siguen disponibles");
  });
});
