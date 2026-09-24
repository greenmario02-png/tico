import { boolean, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    contactPerson: text("contact_person"),
    phone: text("phone"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Sin este índice, `db/seed.ts` (que usa `onConflictDoNothing()` sin
    // `target`, igual que para categorías/ingredientes/recetas) no tenía
    // ningún constraint único que Postgres pudiera usar como árbitro del
    // conflicto, y por lo tanto insertaba proveedores duplicados en cada
    // corrida repetida del seed (detectado durante la limpieza de
    // `panaderia_dev` de esta sesión: una segunda corrida de `npm run
    // db:seed` duplicó los 4 proveedores a 8). Mismo patrón que
    // `ingredients_active_name_lower_unique`: case-insensitive, solo entre
    // proveedores activos.
    uniqueActiveNameLower: uniqueIndex("suppliers_active_name_lower_unique")
      .on(sql`lower(${t.name})`)
      .where(sql`${t.isActive} = true`),
  }),
);
