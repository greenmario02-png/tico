import { ApiError } from "../../lib/errors";
import { countDecimals, isValidDecimalString } from "../../lib/decimal";

// Mensajes literales de SDD-06 §1 (INGREDIENTES) y §2 (HISTORIAL DE PRECIOS).
// Nunca se reinventa la redacción aquí — se copian tal cual del documento.

export const BASE_UNITS = ["g", "ml", "pieza"] as const;
export type BaseUnit = (typeof BASE_UNITS)[number];

export interface IngredientNameInput {
  name?: unknown;
}

export function validateName(name: unknown): string {
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
    throw ApiError.validation("Escribe un nombre para el ingrediente (entre 2 y 100 letras).", [
      { field: "name", message: "Escribe un nombre para el ingrediente (entre 2 y 100 letras)." },
    ]);
  }
  return name.trim();
}

export function validateBaseUnit(baseUnit: unknown): BaseUnit {
  if (typeof baseUnit !== "string" || !BASE_UNITS.includes(baseUnit as BaseUnit)) {
    throw ApiError.validation(
      "Elige una unidad de medida para este ingrediente: gramos, mililitros o pieza.",
      [
        {
          field: "baseUnit",
          message: "Elige una unidad de medida para este ingrediente: gramos, mililitros o pieza.",
        },
      ],
    );
  }
  return baseUnit as BaseUnit;
}

export function validateCurrentStock(value: unknown): string {
  if (value === undefined || value === null) return "0";
  if (!isValidDecimalString(value)) {
    throw ApiError.validation("La cantidad en stock no puede ser negativa.", [
      { field: "currentStock", message: "La cantidad en stock no puede ser negativa." },
    ]);
  }
  const num = Number(value);
  if (num < 0 || num > 999_999_999 || countDecimals(value) > 3) {
    throw ApiError.validation("La cantidad en stock no puede ser negativa.", [
      { field: "currentStock", message: "La cantidad en stock no puede ser negativa." },
    ]);
  }
  return value;
}

export function validateMinStock(value: unknown): string {
  if (value === undefined || value === null) return "0";
  if (!isValidDecimalString(value)) {
    throw ApiError.validation("El nivel mínimo de stock no puede ser negativo.", [
      { field: "minStock", message: "El nivel mínimo de stock no puede ser negativo." },
    ]);
  }
  const num = Number(value);
  if (num < 0 || num > 999_999_999 || countDecimals(value) > 3) {
    throw ApiError.validation("El nivel mínimo de stock no puede ser negativo.", [
      { field: "minStock", message: "El nivel mínimo de stock no puede ser negativo." },
    ]);
  }
  return value;
}

// PRE-001: precio > 0 y <= 999,999.9999, hasta 4 decimales.
export function validatePricePerBaseUnit(value: unknown): string {
  if (!isValidDecimalString(value)) {
    throw ApiError.validation("El precio debe ser mayor a cero.", [
      { field: "pricePerBaseUnit", message: "El precio debe ser mayor a cero." },
    ]);
  }
  const num = Number(value);
  if (!(num > 0) || num > 999_999.9999 || countDecimals(value) > 4) {
    throw ApiError.validation("El precio debe ser mayor a cero.", [
      { field: "pricePerBaseUnit", message: "El precio debe ser mayor a cero." },
    ]);
  }
  return value;
}

// PRE-003 / PRE-004: fecha de vigencia válida y no > 1 año en el futuro.
// Para POST /price, SDD-05 §3.7 exige explícitamente que no sea futura en absoluto.
export function validateEffectiveAt(value: unknown, { allowFuture }: { allowFuture: boolean }): Date {
  let date: Date;
  if (value === undefined || value === null) {
    date = new Date();
  } else if (typeof value === "string") {
    date = new Date(value);
  } else {
    throw ApiError.validation("La fecha de vigencia no es válida.", [
      { field: "effectiveAt", message: "La fecha de vigencia no es válida." },
    ]);
  }

  if (Number.isNaN(date.getTime())) {
    throw ApiError.validation("La fecha de vigencia no es válida.", [
      { field: "effectiveAt", message: "La fecha de vigencia no es válida." },
    ]);
  }

  const now = new Date();
  if (!allowFuture && date.getTime() > now.getTime()) {
    throw ApiError.validation("La fecha de vigencia no puede ser futura", [
      { field: "effectiveAt", message: "La fecha de vigencia no puede ser futura" },
    ]);
  }

  const oneYearFromNow = new Date(now);
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  if (date.getTime() > oneYearFromNow.getTime()) {
    throw ApiError.validation("La fecha de vigencia no puede ser tan lejana en el futuro.", [
      { field: "effectiveAt", message: "La fecha de vigencia no puede ser tan lejana en el futuro." },
    ]);
  }

  return date;
}

// NOTA: `imageUrl` es un campo nuevo agregado a pedido explícito del usuario
// (soporte de fotos en la UI), no contemplado originalmente en SDD-06. Se
// documenta aquí en vez de en el SDD porque la regla es simple: opcional,
// URL válida (http/https) y hasta 500 caracteres.
export function validateImageUrl(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 500) {
    throw ApiError.validation("La URL de la imagen no es válida (máximo 500 caracteres).", [
      { field: "imageUrl", message: "La URL de la imagen no es válida (máximo 500 caracteres)." },
    ]);
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("protocolo inválido");
    }
  } catch {
    throw ApiError.validation("La URL de la imagen no es válida.", [
      { field: "imageUrl", message: "La URL de la imagen no es válida." },
    ]);
  }
  return value;
}

export function validateQuantityBaseUnit(value: unknown): string {
  if (!isValidDecimalString(value)) {
    throw ApiError.validation("Este campo es obligatorio.", [
      { field: "quantityBaseUnit", message: "Este campo es obligatorio." },
    ]);
  }
  const num = Number(value);
  if (!(num > 0) || countDecimals(value) > 3) {
    throw ApiError.validation("Este campo es obligatorio.", [
      { field: "quantityBaseUnit", message: "Este campo es obligatorio." },
    ]);
  }
  return value;
}
