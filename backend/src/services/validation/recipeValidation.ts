import { ApiError } from "../../lib/errors";
import { countDecimals, isValidDecimalString } from "../../lib/decimal";
import { MAX_RECIPE_INGREDIENTS } from "../costingService";

// Mensajes literales de SDD-06 §3 (RECETAS) y §4 (INGREDIENTES DE RECETA).
// Nunca se reinventa la redacción aquí — se copian tal cual del documento.

export const RECIPE_YIELD_UNITS = ["pieza", "docena"] as const;
export type RecipeYieldUnit = (typeof RECIPE_YIELD_UNITS)[number];

export const RECIPE_INGREDIENT_UNITS = [
  "g",
  "kg",
  "ml",
  "l",
  "pieza",
  "docena",
  "cucharada",
  "cucharadita",
  "taza",
] as const;
export type RecipeIngredientUnit = (typeof RECIPE_INGREDIENT_UNITS)[number];

// REC-001
export function validateRecipeName(name: unknown): string {
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 150) {
    throw ApiError.validation("Escribe un nombre para la receta (entre 2 y 150 letras).", [
      { field: "name", message: "Escribe un nombre para la receta (entre 2 y 150 letras)." },
    ]);
  }
  return name.trim();
}

// REC-004
export function validateDescription(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > 2000) {
    throw ApiError.validation("La descripción es demasiado larga (máximo 2000 letras).", [
      { field: "description", message: "La descripción es demasiado larga (máximo 2000 letras)." },
    ]);
  }
  return value;
}

// REC-005
export function validateYieldQuantity(value: unknown): string {
  if (!isValidDecimalString(value)) {
    throw ApiError.validation("El rendimiento de la receta debe ser mayor a cero.", [
      { field: "yieldQuantity", message: "El rendimiento de la receta debe ser mayor a cero." },
    ]);
  }
  const num = Number(value);
  if (!(num > 0) || num > 999_999.99 || countDecimals(value) > 2) {
    throw ApiError.validation("El rendimiento de la receta debe ser mayor a cero.", [
      { field: "yieldQuantity", message: "El rendimiento de la receta debe ser mayor a cero." },
    ]);
  }
  return value;
}

// REC-006
export function validateYieldUnit(value: unknown): RecipeYieldUnit {
  if (value === undefined || value === null) return "pieza";
  if (typeof value !== "string" || !RECIPE_YIELD_UNITS.includes(value as RecipeYieldUnit)) {
    throw ApiError.validation("Elige si el rendimiento se cuenta en piezas o en docenas.", [
      { field: "yieldUnit", message: "Elige si el rendimiento se cuenta en piezas o en docenas." },
    ]);
  }
  return value as RecipeYieldUnit;
}

// REC-007
export function validateWastePercent(value: unknown): string {
  if (value === undefined || value === null) return "0";
  if (!isValidDecimalString(value)) {
    throw ApiError.validation("El porcentaje de merma debe estar entre 0 y 100, sin llegar a 100.", [
      { field: "wastePercent", message: "El porcentaje de merma debe estar entre 0 y 100, sin llegar a 100." },
    ]);
  }
  const num = Number(value);
  if (num < 0 || num >= 100 || countDecimals(value) > 2) {
    throw ApiError.validation("El porcentaje de merma debe estar entre 0 y 100, sin llegar a 100.", [
      { field: "wastePercent", message: "El porcentaje de merma debe estar entre 0 y 100, sin llegar a 100." },
    ]);
  }
  return value;
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

// REC-009 / REC-010
export function validateMinutes(value: unknown, field: "prepTimeMinutes" | "bakeTimeMinutes"): number | null {
  if (value === undefined || value === null) return null;
  const message =
    field === "prepTimeMinutes"
      ? "El tiempo de preparación debe ser un número de minutos válido (0 o más)."
      : "El tiempo de horneado debe ser un número de minutos válido (0 o más).";
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 10_000) {
    throw ApiError.validation(message, [{ field, message }]);
  }
  return value;
}

// REC-011
export function validateInstructions(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > 5000) {
    throw ApiError.validation("Las instrucciones son demasiado largas (máximo 5000 letras).", [
      { field: "instructions", message: "Las instrucciones son demasiado largas (máximo 5000 letras)." },
    ]);
  }
  return value;
}

// REC-012 / REC-013
export function validateIngredientsArrayShape(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw ApiError.validation("Agrega al menos un ingrediente a la receta antes de guardar.", [
      { field: "ingredients", message: "Agrega al menos un ingrediente a la receta antes de guardar." },
    ]);
  }
  if (value.length > MAX_RECIPE_INGREDIENTS) {
    throw ApiError.validation(
      "Una receta puede tener como máximo 50 ingredientes. Considera dividirla en sub-recetas.",
      [
        {
          field: "ingredients",
          message: "Una receta puede tener como máximo 50 ingredientes. Considera dividirla en sub-recetas.",
        },
      ],
    );
  }
  return value as Record<string, unknown>[];
}

export interface RawRecipeIngredientLine {
  ingredientId?: string | null;
  subRecipeId?: string | null;
  quantity: string;
  unit: RecipeIngredientUnit;
}

// RI-001, RI-006, RI-007
export function validateRecipeIngredientLine(raw: unknown, index: number): RawRecipeIngredientLine {
  const item = (raw ?? {}) as Record<string, unknown>;
  const prefix = `ingredients[${index}]`;

  const hasIngredient = typeof item.ingredientId === "string" && item.ingredientId.length > 0;
  const hasSubRecipe = typeof item.subRecipeId === "string" && item.subRecipeId.length > 0;

  if (hasIngredient === hasSubRecipe) {
    throw ApiError.validation("Selecciona un ingrediente o una receta para esta línea (no ambos).", [
      { field: `${prefix}.ingredientId`, message: "Selecciona un ingrediente o una receta para esta línea (no ambos)." },
    ]);
  }

  if (!isValidDecimalString(item.quantity)) {
    throw ApiError.validation("La cantidad debe ser mayor a cero.", [
      { field: `${prefix}.quantity`, message: "La cantidad debe ser mayor a cero." },
    ]);
  }
  const quantity = item.quantity as string;
  const num = Number(quantity);
  if (!(num > 0) || num > 999_999 || countDecimals(quantity) > 3) {
    throw ApiError.validation("La cantidad debe ser mayor a cero.", [
      { field: `${prefix}.quantity`, message: "La cantidad debe ser mayor a cero." },
    ]);
  }

  if (typeof item.unit !== "string" || !RECIPE_INGREDIENT_UNITS.includes(item.unit as RecipeIngredientUnit)) {
    throw ApiError.validation("Elige una unidad de medida válida para esta cantidad.", [
      { field: `${prefix}.unit`, message: "Elige una unidad de medida válida para esta cantidad." },
    ]);
  }

  return {
    ingredientId: hasIngredient ? (item.ingredientId as string) : null,
    subRecipeId: hasSubRecipe ? (item.subRecipeId as string) : null,
    quantity,
    unit: item.unit as RecipeIngredientUnit,
  };
}

// PRD-002
export function validateProductName(name: unknown): string {
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 150) {
    throw ApiError.validation("Escribe un nombre para el producto (entre 2 y 150 letras).", [
      { field: "name", message: "Escribe un nombre para el producto (entre 2 y 150 letras)." },
    ]);
  }
  return name.trim();
}

// PRD-003
export function validateSalePrice(value: unknown, { required }: { required: boolean }): string | null {
  if (value === undefined || value === null) {
    if (required) {
      throw ApiError.validation("El precio de venta debe ser mayor a cero.", [
        { field: "salePrice", message: "El precio de venta debe ser mayor a cero." },
      ]);
    }
    return null;
  }
  if (!isValidDecimalString(value)) {
    throw ApiError.validation("El precio de venta debe ser mayor a cero.", [
      { field: "salePrice", message: "El precio de venta debe ser mayor a cero." },
    ]);
  }
  const num = Number(value);
  if (!(num > 0) || num > 9_999_999.99 || countDecimals(value) > 2) {
    throw ApiError.validation("El precio de venta debe ser mayor a cero.", [
      { field: "salePrice", message: "El precio de venta debe ser mayor a cero." },
    ]);
  }
  return value;
}

// MAR-001 / MAR-002
export function validateMarginParam(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    throw ApiError.validation("El margen debe ser un porcentaje mayor a 0% y menor a 100%.", [
      { field: "margin", message: "El margen debe ser un porcentaje mayor a 0% y menor a 100%." },
    ]);
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw ApiError.validation("El margen debe ser un porcentaje mayor a 0% y menor a 100%.", [
      { field: "margin", message: "El margen debe ser un porcentaje mayor a 0% y menor a 100%." },
    ]);
  }
  if (num >= 100) {
    throw ApiError.validation(
      "Un margen de 100% o más no es posible: el precio de venta nunca sería suficiente para cubrirlo. Elige un margen menor a 100%.",
      [
        {
          field: "margin",
          message:
            "Un margen de 100% o más no es posible: el precio de venta nunca sería suficiente para cubrirlo. Elige un margen menor a 100%.",
        },
      ],
    );
  }
  if (!(num > 0)) {
    throw ApiError.validation("El margen debe ser un porcentaje mayor a 0% y menor a 100%.", [
      { field: "margin", message: "El margen debe ser un porcentaje mayor a 0% y menor a 100%." },
    ]);
  }
  return num;
}
