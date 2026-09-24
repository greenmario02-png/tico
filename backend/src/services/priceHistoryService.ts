import { and, desc, eq, lte } from "drizzle-orm";
import type { Database } from "../db/client";
import { ingredientPriceHistory } from "../db/schema/index";

/**
 * Reglas centrales de negocio (SDD-01 §2, SDD-02 §3.5, SDD-09 §7):
 * - `ingredient_price_history` es append-only: SOLO se inserta, nunca se
 *   actualiza ni se borra una fila existente.
 * - El "precio vigente" a una fecha de referencia es siempre el registro más
 *   reciente cuyo `effectiveAt <= fecha_de_referencia`
 *   (`ORDER BY effective_at DESC WHERE effective_at <= :fecha LIMIT 1`).
 */

export interface InsertPriceInput {
  ingredientId: string;
  pricePerBaseUnit: string;
  effectiveAt: Date;
  createdBy?: string | null;
}

export async function insertPrice(db: Database, input: InsertPriceInput) {
  const [row] = await db
    .insert(ingredientPriceHistory)
    .values({
      ingredientId: input.ingredientId,
      pricePerBaseUnit: input.pricePerBaseUnit,
      effectiveAt: input.effectiveAt,
      createdBy: input.createdBy ?? null,
    })
    .returning();
  return row;
}

/**
 * Devuelve el registro de precio vigente para un ingrediente en una fecha de
 * referencia dada (por defecto, ahora). Nunca es "el último insertado":
 * siempre es el de mayor `effectiveAt` que no sea posterior a `asOf`.
 */
export async function getCurrentPrice(db: Database, ingredientId: string, asOf: Date = new Date()) {
  const [row] = await db
    .select()
    .from(ingredientPriceHistory)
    .where(
      and(
        eq(ingredientPriceHistory.ingredientId, ingredientId),
        lte(ingredientPriceHistory.effectiveAt, asOf),
      ),
    )
    .orderBy(desc(ingredientPriceHistory.effectiveAt))
    .limit(1);
  return row ?? null;
}

export interface ListPriceHistoryParams {
  ingredientId: string;
  page: number;
  pageSize: number;
  from?: Date;
  to?: Date;
}

export async function listPriceHistory(db: Database, params: ListPriceHistoryParams) {
  const conditions = [eq(ingredientPriceHistory.ingredientId, params.ingredientId)];
  // from/to filtering done in-memory-friendly via drizzle helpers when present
  const { gte, lte: lteOp, and: andOp } = await import("drizzle-orm");
  if (params.from) conditions.push(gte(ingredientPriceHistory.effectiveAt, params.from));
  if (params.to) conditions.push(lteOp(ingredientPriceHistory.effectiveAt, params.to));

  const whereClause = andOp(...conditions);

  const rows = await db
    .select()
    .from(ingredientPriceHistory)
    .where(whereClause)
    .orderBy(desc(ingredientPriceHistory.effectiveAt))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  const countRows = await db.select().from(ingredientPriceHistory).where(whereClause);

  return { rows, totalItems: countRows.length };
}
