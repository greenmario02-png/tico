import { index, numeric, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { ingredients } from "./ingredients";
import { users } from "./users";

// Append-only: la capa de servicio nunca ejecuta UPDATE ni DELETE sobre esta
// tabla (SDD-02 §3.5). Toda corrección de precio es un INSERT nuevo.
export const ingredientPriceHistory = pgTable(
  "ingredient_price_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id),
    pricePerBaseUnit: numeric("price_per_base_unit", { precision: 12, scale: 4 }).notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ingredientEffectiveIdx: index("idx_price_history_ingredient_effective").on(
      t.ingredientId,
      t.effectiveAt.desc(),
    ),
  }),
);
