import { describe, expect, it } from "vitest";
import {
  validateBaseUnit,
  validateCurrentStock,
  validateEffectiveAt,
  validateImageUrl,
  validateMinStock,
  validateName,
  validatePricePerBaseUnit,
} from "../../services/validation/ingredientValidation";
import { ApiError } from "../../lib/errors";

describe("validaciones de ingredientes (SDD-06 §1)", () => {
  it("T-ING-VAL-01: ING-001 rechaza nombre demasiado corto", () => {
    try {
      validateName("A");
      throw new Error("no debió pasar");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).message).toBe(
        "Escribe un nombre para el ingrediente (entre 2 y 100 letras).",
      );
    }
  });

  it("T-ING-VAL-02: ING-001 acepta nombre válido", () => {
    expect(validateName("Harina de trigo")).toBe("Harina de trigo");
  });

  it("T-ING-VAL-03: ING-004 rechaza unidad base inválida", () => {
    expect(() => validateBaseUnit("litros")).toThrowError(
      "Elige una unidad de medida para este ingrediente: gramos, mililitros o pieza.",
    );
  });

  it("T-ING-VAL-04: ING-005 rechaza stock negativo", () => {
    expect(() => validateCurrentStock("-5")).toThrowError("La cantidad en stock no puede ser negativa.");
  });

  it("T-ING-VAL-05: ING-006 rechaza minStock negativo", () => {
    expect(() => validateMinStock("-1")).toThrowError("El nivel mínimo de stock no puede ser negativo.");
  });
});

// imageUrl: campo nuevo agregado a pedido explícito del usuario (soporte de
// fotos en la UI), no contemplado en SDD-06 original.
describe("validaciones de imageUrl (campo nuevo, no en SDD-06 original)", () => {
  it("T-ING-VAL-06: acepta ausencia de imageUrl (undefined/null/vacío) como null", () => {
    expect(validateImageUrl(undefined)).toBeNull();
    expect(validateImageUrl(null)).toBeNull();
    expect(validateImageUrl("")).toBeNull();
  });

  it("T-ING-VAL-07: acepta una URL http/https válida", () => {
    expect(validateImageUrl("https://commons.wikimedia.org/foo.jpg")).toBe(
      "https://commons.wikimedia.org/foo.jpg",
    );
  });

  it("T-ING-VAL-08: rechaza una URL con protocolo no http/https", () => {
    expect(() => validateImageUrl("ftp://example.com/foo.jpg")).toThrowError(
      "La URL de la imagen no es válida.",
    );
  });

  it("T-ING-VAL-09: rechaza texto que no es una URL", () => {
    expect(() => validateImageUrl("no-es-una-url")).toThrowError("La URL de la imagen no es válida.");
  });

  it("T-ING-VAL-10: rechaza URLs de más de 500 caracteres", () => {
    const longUrl = "https://example.com/" + "a".repeat(500) + ".jpg";
    expect(() => validateImageUrl(longUrl)).toThrowError(
      "La URL de la imagen no es válida (máximo 500 caracteres).",
    );
  });
});

describe("validaciones de precios (SDD-06 §2)", () => {
  it("T-PRE-VAL-01: PRE-001 rechaza precio <= 0", () => {
    expect(() => validatePricePerBaseUnit("0")).toThrowError("El precio debe ser mayor a cero.");
    expect(() => validatePricePerBaseUnit("-1")).toThrowError("El precio debe ser mayor a cero.");
  });

  it("T-PRE-VAL-02: PRE-001 acepta precio válido con 4 decimales", () => {
    expect(validatePricePerBaseUnit("0.0135")).toBe("0.0135");
  });

  it("T-PRE-VAL-03: PRE-003 rechaza fecha inválida", () => {
    expect(() => validateEffectiveAt("no-es-una-fecha", { allowFuture: false })).toThrowError(
      "La fecha de vigencia no es válida.",
    );
  });

  it("T-PRE-VAL-04: rechaza effectiveAt futura cuando allowFuture=false", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    expect(() => validateEffectiveAt(future, { allowFuture: false })).toThrowError(
      "La fecha de vigencia no puede ser futura",
    );
  });

  it("T-PRE-VAL-05: acepta fecha pasada válida", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
    const result = validateEffectiveAt(past, { allowFuture: false });
    expect(result).toBeInstanceOf(Date);
  });
});
