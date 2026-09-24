import { check, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { recipes } from "./recipes";
import { products } from "./products";
import { users } from "./users";

export const batches = pgTable(
  "batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id),
    productId: uuid("product_id").references(() => products.id),
    requestedUnits: numeric("requested_units", { precision: 10, scale: 2 }).notNull(),
    scaleFactor: numeric("scale_factor", { precision: 10, scale: 4 }).notNull(),
    totalCostSnapshot: numeric("total_cost_snapshot", { precision: 12, scale: 2 }).notNull(),
    costPerUnitSnapshot: numeric("cost_per_unit_snapshot", { precision: 12, scale: 4 }).notNull(),
    producedAt: timestamp("produced_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    notes: text("notes"),
  },
  (t) => ({
    requestedUnitsPositive: check("batch_requested_units_positive", sql`${t.requestedUnits} > 0`),
  }),
);
