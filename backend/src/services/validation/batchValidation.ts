import { ApiError } from "../../lib/errors";
import { countDecimals, isValidDecimalString } from "../../lib/decimal";

// Mensajes literales de SDD-06 §6 (LOTES DE PRODUCCIÓN).
// Nunca se reinventa la redacción aquí — se copian tal cual del documento.

// BAT-002: requestedUnits > 0 y <= 999,999.99, hasta 2 decimales.
export function validateRequestedUnits(value: unknown): string {
  if (!isValidDecimalString(value)) {
    throw ApiError.validation("La cantidad a producir debe ser mayor a cero.", [
      { field: "requestedUnits", message: "La cantidad a producir debe ser mayor a cero." },
    ]);
  }
  const num = Number(value);
  if (!(num > 0) || num > 999_999.99 || countDecimals(value) > 2) {
    throw ApiError.validation("La cantidad a producir debe ser mayor a cero.", [
      { field: "requestedUnits", message: "La cantidad a producir debe ser mayor a cero." },
    ]);
  }
  return value;
}

// BAT-001 / BAT-004: identificadores básicos de forma (existencia se valida en el servicio).
export function validateRecipeIdField(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw ApiError.validation("Selecciona una receta válida para producir el lote.", [
      { field: "recipeId", message: "Selecciona una receta válida para producir el lote." },
    ]);
  }
  return value;
}

export function validateNotes(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > 500) {
    throw ApiError.validation("Las notas son demasiado largas (máximo 500 letras).", [
      { field: "notes", message: "Las notas son demasiado largas (máximo 500 letras)." },
    ]);
  }
  return value;
}
