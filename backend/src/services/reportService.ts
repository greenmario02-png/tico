import { and, eq, gte, lte } from "drizzle-orm";
import type { Database } from "../db/client";
import {
  batchIngredientUsage,
  batches,
  ingredients,
  ingredientStockMovements,
  products,
  recipes,
  sales,
} from "../db/schema/index";
import { ApiError } from "../lib/errors";
import { getCurrentPrice } from "./priceHistoryService";

/**
 * SDD-05 §11 (RF-013/RF-014/RF-015), SDD-03 §6. Reportes de solo lectura,
 * agregaciones sobre tablas ya existentes — ninguna lógica de negocio nueva.
 */

function requireFromTo(from: Date | undefined, to: Date | undefined): { from: Date; to: Date } {
  if (!from || !to) {
    throw ApiError.validation("Debes indicar un rango de fechas (from y to) para este reporte.", [
      { field: "from", message: "Debes indicar un rango de fechas (from y to) para este reporte." },
    ]);
  }
  if (from.getTime() > to.getTime()) {
    throw ApiError.validation("El rango de fechas no es válido: 'from' no puede ser posterior a 'to'.", [
      { field: "from", message: "El rango de fechas no es válido: 'from' no puede ser posterior a 'to'." },
    ]);
  }
  return { from, to };
}

function periodKey(date: Date, groupBy: "day" | "week" | "month"): string {
  if (groupBy === "day") {
    return date.toISOString().slice(0, 10);
  }
  if (groupBy === "week") {
    // Semana ISO simple: año-Www.
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  return date.toISOString().slice(0, 7);
}

// ---------------------------------------------------------------------------
// 11.1 GET /api/reports/costs
// ---------------------------------------------------------------------------

export interface CostsReportParams {
  from?: Date;
  to?: Date;
  groupBy?: "day" | "week" | "month";
}

export async function getCostsReport(db: Database, params: CostsReportParams) {
  const { from, to } = requireFromTo(params.from, params.to);
  const groupBy = params.groupBy ?? "month";

  const rows = await db
    .select({
      totalCostSnapshot: batchIngredientUsage.totalCostSnapshot,
      producedAt: batches.producedAt,
    })
    .from(batchIngredientUsage)
    .innerJoin(batches, eq(batchIngredientUsage.batchId, batches.id))
    .where(and(gte(batches.producedAt, from), lte(batches.producedAt, to)));

  const seriesMap = new Map<string, number>();
  let totalCost = 0;
  for (const row of rows) {
    const cost = Number(row.totalCostSnapshot);
    totalCost += cost;
    const key = periodKey(new Date(row.producedAt), groupBy);
    seriesMap.set(key, (seriesMap.get(key) ?? 0) + cost);
  }

  const series = [...seriesMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, cost]) => ({ period, totalCost: cost.toFixed(2) }));

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    groupBy,
    series,
    totalCost: totalCost.toFixed(2),
  };
}

// ---------------------------------------------------------------------------
// 11.2 GET /api/reports/top-expensive-ingredients
// ---------------------------------------------------------------------------

export interface TopExpensiveIngredientsParams {
  from?: Date;
  to?: Date;
  limit?: number;
  sortBy?: "totalSpent" | "pricePerBaseUnit";
}

export async function getTopExpensiveIngredients(db: Database, params: TopExpensiveIngredientsParams) {
  const { from, to } = requireFromTo(params.from, params.to);
  const limit = Math.min(params.limit ?? 5, 50);

  const rows = await db
    .select({
      ingredientId: batchIngredientUsage.ingredientId,
      quantityUsedBaseUnit: batchIngredientUsage.quantityUsedBaseUnit,
      totalCostSnapshot: batchIngredientUsage.totalCostSnapshot,
    })
    .from(batchIngredientUsage)
    .innerJoin(batches, eq(batchIngredientUsage.batchId, batches.id))
    .where(and(gte(batches.producedAt, from), lte(batches.producedAt, to)));

  const byIngredient = new Map<string, { totalQuantityUsed: number; totalSpent: number }>();
  for (const row of rows) {
    if (!row.ingredientId) continue;
    const acc = byIngredient.get(row.ingredientId) ?? { totalQuantityUsed: 0, totalSpent: 0 };
    acc.totalQuantityUsed += Number(row.quantityUsedBaseUnit);
    acc.totalSpent += Number(row.totalCostSnapshot);
    byIngredient.set(row.ingredientId, acc);
  }

  const sortBy = params.sortBy ?? "totalSpent";

  const data = await Promise.all(
    [...byIngredient.entries()].map(async ([ingredientId, acc]) => {
      const [ingredient] = await db.select().from(ingredients).where(eq(ingredients.id, ingredientId));
      const currentPrice = await getCurrentPrice(db, ingredientId, to);
      return {
        ingredientId,
        ingredientName: ingredient?.name ?? null,
        totalQuantityUsed: acc.totalQuantityUsed.toFixed(3),
        baseUnit: ingredient?.baseUnit ?? null,
        totalSpent: acc.totalSpent.toFixed(2),
        pricePerBaseUnit: currentPrice?.pricePerBaseUnit ?? null,
      };
    }),
  );

  data.sort((a, b) => {
    if (sortBy === "pricePerBaseUnit") {
      return Number(b.pricePerBaseUnit ?? 0) - Number(a.pricePerBaseUnit ?? 0);
    }
    return Number(b.totalSpent) - Number(a.totalSpent);
  });

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    sortBy,
    data: data.slice(0, limit).map(({ pricePerBaseUnit, ...rest }) =>
      sortBy === "pricePerBaseUnit" ? { ...rest, pricePerBaseUnit } : rest,
    ),
  };
}

// ---------------------------------------------------------------------------
// 11.3 GET /api/reports/production
// ---------------------------------------------------------------------------

export interface ProductionReportParams {
  from?: Date;
  to?: Date;
  recipeId?: string;
  page: number;
  pageSize: number;
}

export async function getProductionReport(db: Database, params: ProductionReportParams) {
  const { from, to } = requireFromTo(params.from, params.to);

  const batchConditions = [gte(batches.producedAt, from), lte(batches.producedAt, to)];
  if (params.recipeId) batchConditions.push(eq(batches.recipeId, params.recipeId));

  const batchRows = await db
    .select()
    .from(batches)
    .where(and(...batchConditions));

  const byRecipe = new Map<string, { unitsProduced: number; totalProductionCost: number }>();
  for (const row of batchRows) {
    const acc = byRecipe.get(row.recipeId) ?? { unitsProduced: 0, totalProductionCost: 0 };
    acc.unitsProduced += Number(row.requestedUnits);
    acc.totalProductionCost += Number(row.totalCostSnapshot);
    byRecipe.set(row.recipeId, acc);
  }

  // Ventas del período, resueltas a receta vía su producto (sales no tiene
  // recipeId directo — SDD-02 §3.12).
  const saleRows = await db
    .select({
      quantity: sales.quantity,
      salePricePerUnit: sales.salePricePerUnit,
      costPerUnitSnapshot: sales.costPerUnitSnapshot,
      recipeId: products.recipeId,
    })
    .from(sales)
    .innerJoin(products, eq(sales.productId, products.id))
    .where(and(gte(sales.soldAt, from), lte(sales.soldAt, to)));

  const salesByRecipe = new Map<string, { unitsSold: number; totalRevenue: number; totalCost: number }>();
  for (const row of saleRows) {
    if (params.recipeId && row.recipeId !== params.recipeId) continue;
    const quantity = Number(row.quantity);
    const acc = salesByRecipe.get(row.recipeId) ?? { unitsSold: 0, totalRevenue: 0, totalCost: 0 };
    acc.unitsSold += quantity;
    acc.totalRevenue += quantity * Number(row.salePricePerUnit);
    acc.totalCost += quantity * Number(row.costPerUnitSnapshot);
    salesByRecipe.set(row.recipeId, acc);
  }

  const recipeIds = new Set([...byRecipe.keys(), ...salesByRecipe.keys()]);
  const allRows = await Promise.all(
    [...recipeIds].map(async (recipeId) => {
      const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
      const production = byRecipe.get(recipeId) ?? { unitsProduced: 0, totalProductionCost: 0 };
      const salesAgg = salesByRecipe.get(recipeId) ?? { unitsSold: 0, totalRevenue: 0, totalCost: 0 };
      const totalRealProfit = salesAgg.totalRevenue - salesAgg.totalCost;
      const realMarginPercent = salesAgg.totalRevenue > 0 ? (totalRealProfit / salesAgg.totalRevenue) * 100 : 0;
      return {
        recipeId,
        recipeName: recipe?.name ?? null,
        unitsProduced: production.unitsProduced.toFixed(2),
        totalProductionCost: production.totalProductionCost.toFixed(2),
        unitsSold: salesAgg.unitsSold.toFixed(2),
        totalRevenue: salesAgg.totalRevenue.toFixed(2),
        totalRealProfit: totalRealProfit.toFixed(2),
        realMarginPercent: realMarginPercent.toFixed(2),
      };
    }),
  );

  allRows.sort((a, b) => (a.recipeName ?? "").localeCompare(b.recipeName ?? ""));

  const start = (params.page - 1) * params.pageSize;
  const data = allRows.slice(start, start + params.pageSize);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    data,
    totalItems: allRows.length,
  };
}

// ---------------------------------------------------------------------------
// 11.4 GET /api/reports/inventory-status
// ---------------------------------------------------------------------------

export interface InventoryStatusParams {
  categoryId?: string;
  page: number;
  pageSize: number;
}

export async function getInventoryStatusReport(db: Database, params: InventoryStatusParams) {
  const conditions = [eq(ingredients.isActive, true)];
  if (params.categoryId) conditions.push(eq(ingredients.categoryId, params.categoryId));

  const ingredientRows = await db
    .select()
    .from(ingredients)
    .where(and(...conditions));

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const movementRows = await db
    .select({
      ingredientId: ingredientStockMovements.ingredientId,
      movementType: ingredientStockMovements.movementType,
      quantityBaseUnit: ingredientStockMovements.quantityBaseUnit,
    })
    .from(ingredientStockMovements)
    .where(gte(ingredientStockMovements.createdAt, thirtyDaysAgo));

  const consumptionByIngredient = new Map<string, number>();
  for (const row of movementRows) {
    if (row.movementType !== "uso_produccion" && row.movementType !== "merma") continue;
    const amount = Math.abs(Number(row.quantityBaseUnit));
    consumptionByIngredient.set(row.ingredientId, (consumptionByIngredient.get(row.ingredientId) ?? 0) + amount);
  }

  const start = (params.page - 1) * params.pageSize;
  const paged = ingredientRows.slice(start, start + params.pageSize);

  const data = paged.map((row) => {
    const totalConsumed30d = consumptionByIngredient.get(row.id) ?? 0;
    const avgDailyConsumption30d = totalConsumed30d / 30;
    const currentStock = Number(row.currentStock);

    let estimatedDaysUntilEmpty: number | null = null;
    let estimatedEmptyDate: string | null = null;
    if (avgDailyConsumption30d > 0) {
      estimatedDaysUntilEmpty = Math.floor(currentStock / avgDailyConsumption30d);
      const emptyDate = new Date(Date.now() + estimatedDaysUntilEmpty * 24 * 60 * 60 * 1000);
      estimatedEmptyDate = emptyDate.toISOString().slice(0, 10);
    }

    return {
      ingredientId: row.id,
      ingredientName: row.name,
      currentStock: row.currentStock,
      minStock: row.minStock,
      avgDailyConsumption30d: avgDailyConsumption30d.toFixed(3),
      estimatedDaysUntilEmpty,
      estimatedEmptyDate,
    };
  });

  return { data, totalItems: ingredientRows.length };
}
