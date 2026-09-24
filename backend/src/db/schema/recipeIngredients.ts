import { check, numeric, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { recipeUnitEnum } from "./enums";
import { recipes } from "./recipes";
import { ingredients } from "./ingredients";

export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    ingredientId: uuid("ingredient_id").references(() => ingredients.id),
    subRecipeId: uuid("sub_recipe_id").references(() => recipes.id),
    quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
    unit: recipeUnitEnum("unit").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    exactlyOneTarget: check(
      "recipe_ingredient_exactly_one_target",
      sql`(${t.ingredientId} IS NOT NULL AND ${t.subRecipeId} IS NULL)
        OR (${t.ingredientId} IS NULL AND ${t.subRecipeId} IS NOT NULL)`,
    ),
    noSelfReference: check("recipe_ingredient_no_self_ref", sql`${t.subRecipeId} != ${t.recipeId}`),
  }),
);
