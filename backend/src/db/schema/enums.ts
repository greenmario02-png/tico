import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "operario", "dueño"]);

export const baseUnitEnum = pgEnum("base_unit", ["g", "ml", "pieza"]);

export const recipeUnitEnum = pgEnum("recipe_unit", [
  "g",
  "kg",
  "ml",
  "l",
  "pieza",
  "docena",
  "cucharada",
  "cucharadita",
  "taza",
]);

export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  "compra",
  "uso_produccion",
  "ajuste",
  "merma",
]);

export const categoryKindEnum = pgEnum("category_kind", ["ingrediente", "receta"]);
