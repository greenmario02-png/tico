import { ApiError } from "../../lib/errors";

// SDD-05 §4 (CATEGORÍAS). SDD-06 no dedica una sección propia a categorías
// todavía; se sigue el mismo estilo/tono de redacción que el resto del
// catálogo (ingredientes/recetas) en vez de inventar un formato nuevo.

export const CATEGORY_KINDS = ["ingrediente", "receta"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export function validateCategoryName(name: unknown): string {
  if (typeof name !== "string" || name.trim().length < 1 || name.trim().length > 50) {
    throw ApiError.validation("Escribe un nombre para la categoría (hasta 50 letras).", [
      { field: "name", message: "Escribe un nombre para la categoría (hasta 50 letras)." },
    ]);
  }
  return name.trim();
}

export function validateCategoryKind(kind: unknown): CategoryKind {
  if (typeof kind !== "string" || !CATEGORY_KINDS.includes(kind as CategoryKind)) {
    throw ApiError.validation("Elige el tipo de categoría: ingrediente o receta.", [
      { field: "kind", message: "Elige el tipo de categoría: ingrediente o receta." },
    ]);
  }
  return kind as CategoryKind;
}
