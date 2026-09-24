import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { categoryKindEnum } from "./enums";

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    kind: categoryKindEnum("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueNamePerKind: unique().on(t.name, t.kind),
  }),
);
