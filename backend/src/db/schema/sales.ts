import { check, numeric, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { products } from "./products";
import { batches } from "./batches";
import { users } from "./users";

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    batchId: uuid("batch_id").references(() => batches.id),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
    salePricePerUnit: numeric("sale_price_per_unit", { precision: 10, scale: 2 }).notNull(),
    costPerUnitSnapshot: numeric("cost_per_unit_snapshot", { precision: 12, scale: 4 }).notNull(),
    soldAt: timestamp("sold_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
  },
  (t) => ({
    quantityPositive: check("sale_quantity_positive", sql`${t.quantity} > 0`),
  }),
);
