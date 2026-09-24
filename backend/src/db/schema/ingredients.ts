import { boolean, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseUnitEnum } from "./enums";
import { categories } from "./categories";
import { suppliers } from "./suppliers";

export const ingredients = pgTable(
  "ingredients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    categoryId: uuid("category_id").references(() => categories.id),
    baseUnit: baseUnitEnum("base_unit").notNull(),
    currentStock: numeric("current_stock", { precision: 12, scale: 3 }).notNull().default("0"),
    minStock: numeric("min_stock", { precision: 12, scale: 3 }).notNull().default("0"),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    // Campo nuevo agregado a pedido explícito del usuario (soporte de fotos en
    // la UI). No estaba contemplado en 01-PROJECT_SPEC.md ni en SDD-06:
    // se documenta aquí y en SDD-06-VALIDACIONES.md §1 la validación asociada.
    imageUrl: text("image_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // ING-002: unicidad de `name` case-insensitive entre ingredientes ACTIVOS,
    // aplicada ahora a nivel de BD (antes solo se validaba en la capa de
    // aplicación vía SELECT-antes-de-INSERT, lo cual es vulnerable a
    // condiciones de carrera bajo escrituras concurrentes). Un ingrediente
    // desactivado (isActive=false) no bloquea crear uno nuevo activo con el
    // mismo nombre. Ver `services/ingredientService.ts` para la traducción
    // de la violación (código Postgres 23505) al mensaje SDD-06 existente.
    uniqueActiveNameLower: uniqueIndex("ingredients_active_name_lower_unique")
      .on(sql`lower(${t.name})`)
      .where(sql`${t.isActive} = true`),
  }),
);
