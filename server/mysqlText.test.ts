import { describe, expect, it } from "vitest";
import { fitMysqlJson, fitMysqlTextColumn, MYSQL_TEXT_SAFE_BYTES, utf8ByteLength } from "./mysqlText";

describe("fitMysqlJson", () => {
  it("deja intacto un JSON que cabe en TEXT", () => {
    const packed = fitMysqlJson({ ok: true, note: "recibo guardado" });
    expect(JSON.parse(packed)).toEqual({ ok: true, note: "recibo guardado" });
  });

  it("recorta un retorno de puente más grande que TEXT y sigue siendo JSON", () => {
    const packed = fitMysqlJson({
      verification: "GIANT_VERIFICATION_BLOB:" + "x".repeat(80_000),
    });
    expect(utf8ByteLength(packed)).toBeLessThanOrEqual(MYSQL_TEXT_SAFE_BYTES);
    expect(packed).not.toContain("x".repeat(80_000));
    expect(JSON.parse(packed)).toMatchObject({ clipped: true });
  });

  it("recorta una columna que ya venía serializada", () => {
    const packed = fitMysqlTextColumn("y".repeat(70_000));
    expect(utf8ByteLength(packed)).toBeLessThanOrEqual(MYSQL_TEXT_SAFE_BYTES);
    expect(() => JSON.parse(packed)).not.toThrow();
  });
});
