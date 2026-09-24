import { ApiError } from "../../lib/errors";
import { countDecimals, isValidDecimalString } from "../../lib/decimal";

// Mensajes literales de SDD-06 §7 (VENTAS). Nunca se reinventa la redacción
// aquí — se copian tal cual del documento.

// VEN-001
export function validateProductIdField(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw ApiError.validation("Selecciona un producto válido para registrar la venta.", [
      { field: "productId", message: "Selecciona un producto válido para registrar la venta." },
    ]);
  }
  return value;
}

// VEN-002 (forma básica; la correspondencia real receta/producto se valida en el servicio)
export function validateBatchIdField(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length === 0) {
    throw ApiError.validation("El lote seleccionado no corresponde a este producto.", [
      { field: "batchId", message: "El lote seleccionado no corresponde a este producto." },
    ]);
  }
  return value;
}

// VEN-003: quantity > 0 y <= 999,999.99, hasta 2 decimales.
export function validateSaleQuantity(value: unknown): string {
  if (!isValidDecimalString(value)) {
    throw ApiError.validation("La cantidad vendida debe ser mayor a cero.", [
      { field: "quantity", message: "La cantidad vendida debe ser mayor a cero." },
    ]);
  }
  const num = Number(value);
  if (!(num > 0) || num > 999_999.99 || countDecimals(value) > 2) {
    throw ApiError.validation("La cantidad vendida debe ser mayor a cero.", [
      { field: "quantity", message: "La cantidad vendida debe ser mayor a cero." },
    ]);
  }
  return value;
}

// VEN-004: salePricePerUnit > 0 y <= 9,999,999.99, hasta 2 decimales.
export function validateSalePricePerUnitField(value: unknown): string {
  if (!isValidDecimalString(value)) {
    throw ApiError.validation("El precio de venta debe ser mayor a cero.", [
      { field: "salePricePerUnit", message: "El precio de venta debe ser mayor a cero." },
    ]);
  }
  const num = Number(value);
  if (!(num > 0) || num > 9_999_999.99 || countDecimals(value) > 2) {
    throw ApiError.validation("El precio de venta debe ser mayor a cero.", [
      { field: "salePricePerUnit", message: "El precio de venta debe ser mayor a cero." },
    ]);
  }
  return value;
}

// VEN-007: fecha/hora válida, no puede ser futura. Por defecto, ahora.
export function validateSoldAt(value: unknown): Date {
  if (value === undefined || value === null) return new Date();
  if (typeof value !== "string") {
    throw ApiError.validation("La fecha de la venta no puede ser en el futuro.", [
      { field: "soldAt", message: "La fecha de la venta no puede ser en el futuro." },
    ]);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw ApiError.validation("La fecha de la venta no puede ser en el futuro.", [
      { field: "soldAt", message: "La fecha de la venta no puede ser en el futuro." },
    ]);
  }
  if (date.getTime() > Date.now()) {
    throw ApiError.validation("La fecha de la venta no puede ser en el futuro.", [
      { field: "soldAt", message: "La fecha de la venta no puede ser en el futuro." },
    ]);
  }
  return date;
}
