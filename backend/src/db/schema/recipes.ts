import { boolean, check, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { categories } from "./categories";

export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    categoryId: uuid("category_id").references(() => categories.id),
    description: text("description"),
    yieldQuantity: numeric("yield_quantity", { precision: 10, scale: 2 }).notNull(),
    yieldUnit: text("yield_unit").notNull().default("pieza"),
    wastePercent: numeric("waste_percent", { precision: 5, scale: 2 }).notNull().default("0"),
    prepTimeMinutes: integer("prep_time_minutes"),
    bakeTimeMinutes: integer("bake_time_minutes"),
    instructions: text("instructions"),
    // Campo nuevo agregado a pedido explícito del usuario (soporte de fotos en
    // la UI). No estaba contemplado en 01-PROJECT_SPEC.md ni en SDD-06:
    // se documenta aquí y en SDD-06-VALIDACIONES.md §3 la validación asociada.
    imageUrl: text("image_url"),
    isDeleted: boolean("is_deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    wastePercentRange: check(
      "waste_percent_range",
      sql`${t.wastePercent} >= 0 AND ${t.wastePercent} < 100`,
    ),
    // REC-002: unicidad de `name` case-insensitive entre recetas NO
    // eliminadas, aplicada ahora a nivel de BD (mismo motivo que
    // `ingredients_active_name_lower_unique`, ver ingredients.ts). Una receta
    // con soft-delete (isDeleted=true) no bloquea crear una nueva con el
    // mismo nombre.
    uniqueActiveNameLower: uniqueIndex("recipes_active_name_lower_unique")
      .on(sql`lower(${t.name})`)
      .where(sql`${t.isDeleted} = false`),
  }),
);
