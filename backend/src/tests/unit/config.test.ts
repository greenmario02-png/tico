import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../../lib/config";

// SDD-10 §1.1: JWT_SECRET (y DATABASE_URL) nunca tienen default; el proceso
// debe fallar al arrancar si faltan.
describe("config fail-fast (SDD-10 §1.1)", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("T-CONFIG-01: lanza error si JWT_SECRET no está definido", () => {
    process.env.JWT_SECRET = "";
    expect(() => loadConfig()).toThrow(/JWT_SECRET/);
  });

  it("T-CONFIG-02: lanza error si DATABASE_URL no está definido", () => {
    process.env.DATABASE_URL = "";
    expect(() => loadConfig()).toThrow(/DATABASE_URL/);
  });

  it("T-CONFIG-03: no incluye ningún valor por defecto inseguro para JWT_SECRET", () => {
    delete process.env.JWT_SECRET;
    expect(() => loadConfig()).toThrow();
  });

  it("T-CONFIG-04: carga correctamente cuando todas las variables obligatorias están presentes", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
    process.env.JWT_SECRET = "a-real-secret-value";
    process.env.NODE_ENV = "development";
    process.env.CORS_ORIGIN = "http://localhost:5173";
    const cfg = loadConfig();
    expect(cfg.jwtSecret).toBe("a-real-secret-value");
    expect(cfg.port).toBe(3000);
  });
});
