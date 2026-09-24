import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { ingredients, ingredientStockMovements, users } from "../db/schema/index";
import { ApiError } from "../lib/errors";
import { getCurrentPrice } from "./priceHistoryService";

/**
 * SDD-05 §10 — Inventario: vista consolidada de stock (RF-015) y kardex de
 * movimientos (RF-003/RF-015). Es una vista de lectura sobre datos ya
 * escritos por `ingredientService`/`batchService` — no crea movimientos
 * nuevos.
 */

export interface InventoryOverviewParams {
  page: number;
  pageSize: number;
  categoryId?: string;
  belowMinOnly?: boolean;
  sortBy?: "name" | "currentStock" | "stockValue";
}

async function buildInventoryRow(db: Database, row: typeof ingredients.$inferSelect) {
  const currentPrice = await getCurrentPrice(db, row.id);
  const pricePerBaseUnit = currentPrice ? Number(currentPrice.pricePerBaseUnit) : 0;
  const stockValue = Number(row.currentStock) * pricePerBaseUnit;
  return {
    id: row.id,
    name: row.name,
    baseUnit: row.baseUnit,
    currentStock: row.currentStock,
    minStock: row.minStock,
    isBelowMin: Number(row.currentStock) <= Number(row.minStock),
    currentPricePerBaseUnit: currentPrice?.pricePerBaseUnit ?? null,
    stockValue: stockValue.toFixed(2),
  };
}

export async function getInventoryOverview(db: Database, params: InventoryOverviewParams) {
  const conditions = [eq(ingredients.isActive, true)];
  if (params.categoryId) conditions.push(eq(ingredients.categoryId, params.categoryId));
  const whereClause = and(...conditions);

  const allRows = await db.select().from(ingredients).where(whereClause);
  const allShaped = await Promise.all(allRows.map((row) => buildInventoryRow(db, row)));

  let filtered = allShaped;
  if (params.belowMinOnly) {
    filtered = filtered.filter((r) => r.isBelowMin);
  }

  const sortBy = params.sortBy ?? "name";
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === "currentStock") return Number(a.currentStock) - Number(b.currentStock);
    if (sortBy === "stockValue") return Number(b.stockValue) - Number(a.stockValue);
    return a.name.localeCompare(b.name);
  });

  const start = (params.page - 1) * params.pageSize;
  const data = filtered.slice(start, start + params.pageSize);

  const totalStockValue = allShaped.reduce((sum, r) => sum + Number(r.stockValue), 0);

  return {
    data,
    totalItems: filtered.length,
    summary: { totalStockValue: totalStockValue.toFixed(2) },
  };
}

export interface ListMovementsParams {
  page: number;
  pageSize: number;
  ingredientId?: string;
  movementType?: "compra" | "uso_produccion" | "ajuste" | "merma";
  from?: Date;
  to?: Date;
  sortOrder?: "asc" | "desc";
}

export async function listMovements(db: Database, params: ListMovementsParams) {
  if (params.from && params.to && params.from.getTime() > params.to.getTime()) {
    throw ApiError.validation("El rango de fechas no es válido: 'from' no puede ser posterior a 'to'.", [
      { field: "from", message: "El rango de fechas no es válido: 'from' no puede ser posterior a 'to'." },
    ]);
  }

  const conditions = [];
  if (params.ingredientId) conditions.push(eq(ingredientStockMovements.ingredientId, params.ingredientId));
  if (params.movementType) conditions.push(eq(ingredientStockMovements.movementType, params.movementType));

  // RF-015: default = últimos 30 días si no se especifica ningún rango.
  const from = params.from ?? (params.to ? undefined : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  if (from) conditions.push(gte(ingredientStockMovements.createdAt, from));
  if (params.to) conditions.push(lte(ingredientStockMovements.createdAt, params.to));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const orderFn = params.sortOrder === "asc" ? asc : desc;

  let query = db.select().from(ingredientStockMovements).$dynamic();
  if (whereClause) query = query.where(whereClause);
  const rows = await query
    .orderBy(orderFn(ingredientStockMovements.createdAt))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  let countQuery = db.select({ count: sql<number>`count(*)::int` }).from(ingredientStockMovements).$dynamic();
  if (whereClause) countQuery = countQuery.where(whereClause);
  const [{ count }] = await countQuery;

  const data = await Promise.all(
    rows.map(async (row) => {
      const [ingredient] = await db.select().from(ingredients).where(eq(ingredients.id, row.ingredientId));
      let createdByName: string | null = null;
      if (row.createdBy) {
        const [user] = await db.select().from(users).where(eq(users.id, row.createdBy));
        createdByName = user?.name ?? null;
      }
      return {
        id: row.id,
        ingredientId: row.ingredientId,
        ingredientName: ingredient?.name ?? null,
        movementType: row.movementType,
        quantityBaseUnit: row.quantityBaseUnit,
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        note: row.note,
        createdByName,
        createdAt: row.createdAt,
      };
    }),
  );

  return { data, totalItems: count };
}
