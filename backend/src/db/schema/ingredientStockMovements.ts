import { index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { stockMovementTypeEnum } from "./enums";
import { ingredients } from "./ingredients";
import { users } from "./users";

export const ingredientStockMovements = pgTable(
  "ingredient_stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id),
    movementType: stockMovementTypeEnum("movement_type").notNull(),
    quantityBaseUnit: numeric("quantity_base_unit", { precision: 12, scale: 3 }).notNull(),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ingredientCreatedIdx: index("idx_stock_movements_ingredient_created").on(
      t.ingredientId,
      t.createdAt.desc(),
    ),
  }),
);
