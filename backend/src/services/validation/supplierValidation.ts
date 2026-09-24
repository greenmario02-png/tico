import { ApiError } from "../../lib/errors";

// SDD-05 §5 (PROVEEDORES). Igual que en categoryValidation.ts, SDD-06 no
// dedica una sección propia a proveedores; formato de teléfono boliviano no
// se fuerza estrictamente (texto libre), tal como aclara SDD-05 §5.2.

export function validateSupplierName(name: unknown): string {
  if (typeof name !== "string" || name.trim().length < 1 || name.trim().length > 100) {
    throw ApiError.validation("Escribe un nombre para el proveedor (hasta 100 letras).", [
      { field: "name", message: "Escribe un nombre para el proveedor (hasta 100 letras)." },
    ]);
  }
  return name.trim();
}

export function validateContactPerson(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 150) {
    throw ApiError.validation("El nombre de contacto es demasiado largo (máximo 150 letras).", [
      { field: "contactPerson", message: "El nombre de contacto es demasiado largo (máximo 150 letras)." },
    ]);
  }
  return value;
}

export function validatePhone(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 30) {
    throw ApiError.validation("El teléfono es demasiado largo (máximo 30 caracteres).", [
      { field: "phone", message: "El teléfono es demasiado largo (máximo 30 caracteres)." },
    ]);
  }
  return value;
}
