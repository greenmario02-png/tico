import { check, numeric, pgTable, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { batches } from "./batches";
import { ingredients } from "./ingredients";
import { recipes } from "./recipes";

export const batchIngredientUsage = pgTable(
  "batch_ingredient_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    ingredientId: uuid("ingredient_id").references(() => ingredients.id),
    subRecipeId: uuid("sub_recipe_id").references(() => recipes.id),
    quantityUsedBaseUnit: numeric("quantity_used_base_unit", { precision: 12, scale: 3 }).notNull(),
    unitCostSnapshot: numeric("unit_cost_snapshot", { precision: 12, scale: 4 }).notNull(),
    totalCostSnapshot: numeric("total_cost_snapshot", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => ({
    exactlyOneTarget: check(
      "batch_usage_exactly_one_target",
      sql`(${t.ingredientId} IS NOT NULL AND ${t.subRecipeId} IS NULL)
        OR (${t.ingredientId} IS NULL AND ${t.subRecipeId} IS NOT NULL)`,
    ),
  }),
);
