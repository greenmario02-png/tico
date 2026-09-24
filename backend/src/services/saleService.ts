import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { batches, products, sales, users } from "../db/schema/index";
import { config } from "../lib/config";
import { ApiError } from "../lib/errors";
import { getUnitsRemaining } from "./batchService";
import { realMargin } from "./costingService";

/**
 * SDD-01 §7, SDD-03 §5, SDD-05 §9, SDD-06 §7, SDD-07 Caso de Uso 5.
 *
 * "Venta" es una entidad ligera (no un POS completo): solo registra qué se
 * vendió, a qué precio, y copia (nunca recalcula después) el costo por
 * unidad congelado del lote de producción del que salió. La ganancia real y
 * el margen real son SIEMPRE derivados al leer, nunca columnas almacenadas
 * (SDD-05 §9.1 punto 3) — se reutiliza `costingService.realMargin` (SDD-04
 * §6 Dirección B), no se reimplementa la fórmula aquí.
 */

export interface RegisterSaleInput {
  productId: string;
  batchId?: string | null;
  quantity: string;
  salePricePerUnit: string;
  soldAt?: Date;
  createdBy?: string | null;
}

interface ResolvedCost {
  batchId: string | null;
  costPerUnitSnapshot: string;
}

/**
 * SDD-05 §9.1 punto 1 / SDD-03 §5.4: si se envía `batchId`, se copia su
 * costo congelado (validando que pertenezca a la misma receta que el
 * producto); si no, se usa el costo del lote MÁS RECIENTE de la receta
 * detrás del producto. Si el producto nunca tuvo un lote producido, se
 * rechaza la venta (VEN-006) — no se puede vender algo sin costo conocido.
 */
async function resolveCostPerUnit(
  db: Database,
  productRecipeId: string,
  batchId: string | null | undefined,
): Promise<ResolvedCost> {
  if (batchId) {
    const [batch] = await db.select().from(batches).where(eq(batches.id, batchId));
    if (!batch) {
      throw ApiError.notFound("El lote seleccionado ya no está disponible.");
    }
    if (batch.recipeId !== productRecipeId) {
      throw ApiError.conflict("El lote seleccionado no corresponde a este producto.", [
        { field: "batchId", message: "El lote seleccionado no corresponde a este producto." },
      ]);
    }
    return { batchId: batch.id, costPerUnitSnapshot: batch.costPerUnitSnapshot };
  }

  const [mostRecent] = await db
    .select()
    .from(batches)
    .where(eq(batches.recipeId, productRecipeId))
    .orderBy(desc(batches.producedAt))
    .limit(1);

  if (!mostRecent) {
    throw ApiError.conflict(
      "Este producto todavía no tiene ningún lote producido, por lo que no se puede calcular la ganancia real de la venta. Registra primero un lote de producción.",
    );
  }

  return { batchId: mostRecent.id, costPerUnitSnapshot: mostRecent.costPerUnitSnapshot };
}

function computeDerived(quantity: number, salePricePerUnit: number, costPerUnitSnapshot: number) {
  const revenue = quantity * salePricePerUnit;
  const costTotal = quantity * costPerUnitSnapshot;
  const { marginReal, profitPerUnit } = realMargin(salePricePerUnit, costPerUnitSnapshot);
  const realProfit = profitPerUnit * quantity;
  return {
    revenue,
    costTotal,
    realProfit,
    realMarginPercent: marginReal * 100,
  };
}

async function toApiShape(db: Database, row: typeof sales.$inferSelect) {
  const [product] = await db.select().from(products).where(eq(products.id, row.productId));
  let createdByName: string | null = null;
  if (row.createdBy) {
    const [user] = await db.select().from(users).where(eq(users.id, row.createdBy));
    createdByName = user?.name ?? null;
  }

  const quantity = Number(row.quantity);
  const salePricePerUnit = Number(row.salePricePerUnit);
  const costPerUnitSnapshot = Number(row.costPerUnitSnapshot);
  const derived = computeDerived(quantity, salePricePerUnit, costPerUnitSnapshot);

  return {
    id: row.id,
    productId: row.productId,
    productName: product?.name ?? null,
    batchId: row.batchId,
    quantity: row.quantity,
    salePricePerUnit: row.salePricePerUnit,
    costPerUnitSnapshot: row.costPerUnitSnapshot,
    revenue: derived.revenue.toFixed(2),
    costTotal: derived.costTotal.toFixed(2),
    realProfit: derived.realProfit.toFixed(2),
    realMarginPercent: derived.realMarginPercent.toFixed(2),
    soldAt: row.soldAt,
    createdBy: row.createdBy,
    createdByName,
  };
}

export async function registerSale(db: Database, input: RegisterSaleInput) {
  const [product] = await db.select().from(products).where(eq(products.id, input.productId));
  if (!product || !product.isActive) {
    throw ApiError.notFound("Selecciona un producto válido para registrar la venta.");
  }

  const { batchId, costPerUnitSnapshot } = await resolveCostPerUnit(db, product.recipeId, input.batchId);

  // VEN-008 (SDD-06, SDD-03 §7, SDD-07 CU5 flujo alternativo): `unitsRemaining`
  // es SIEMPRE derivado (`requestedUnits - SUM(ventas de ese batchId)`), nunca
  // una columna física. Se valida acá tanto si el `batchId` vino explícito en
  // la venta como si fue resuelto implícitamente al lote más reciente — en
  // ambos casos debe respetar cuántas unidades realmente produjo ese lote.
  const quantityNum = Number(input.quantity);
  const unitsRemaining = batchId !== null ? await getUnitsRemaining(db, batchId) : Infinity;
  if (quantityNum > unitsRemaining) {
    throw ApiError.batchOverselling(
      `No se pueden vender ${quantityNum} unidades: el lote seleccionado solo tiene ${unitsRemaining.toFixed(2)} unidades restantes disponibles.`,
      [
        {
          field: "quantity",
          message: `El lote seleccionado solo tiene ${unitsRemaining.toFixed(2)} unidades restantes disponibles, se intentaron vender ${quantityNum}.`,
        },
      ],
    );
  }

  const [row] = await db
    .insert(sales)
    .values({
      productId: input.productId,
      batchId,
      quantity: input.quantity,
      salePricePerUnit: input.salePricePerUnit,
      costPerUnitSnapshot,
      soldAt: input.soldAt ?? new Date(),
      createdBy: input.createdBy ?? null,
    })
    .returning();

  return toApiShape(db, row);
}

export interface ListSalesParams {
  page: number;
  pageSize: number;
  productId?: string;
  batchId?: string;
  from?: Date;
  to?: Date;
  sortOrder?: "asc" | "desc";
}

export async function listSales(db: Database, params: ListSalesParams) {
  const conditions = [];
  if (params.productId) conditions.push(eq(sales.productId, params.productId));
  if (params.batchId) conditions.push(eq(sales.batchId, params.batchId));
  if (params.from) conditions.push(gte(sales.soldAt, params.from));
  if (params.to) conditions.push(lte(sales.soldAt, params.to));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let query = db.select().from(sales).$dynamic();
  if (whereClause) query = query.where(whereClause);
  const rows = await query
    .orderBy(params.sortOrder === "asc" ? sales.soldAt : desc(sales.soldAt))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  let countQuery = db.select({ count: sql<number>`count(*)::int` }).from(sales).$dynamic();
  if (whereClause) countQuery = countQuery.where(whereClause);
  const [{ count }] = await countQuery;

  const data = await Promise.all(rows.map((row) => toApiShape(db, row)));

  // Resumen sobre el conjunto filtrado COMPLETO, no solo la página actual
  // (SDD-05 §9.2).
  let summaryQuery = db.select().from(sales).$dynamic();
  if (whereClause) summaryQuery = summaryQuery.where(whereClause);
  const allFiltered = await summaryQuery;
  let totalRevenue = 0;
  let totalCost = 0;
  for (const row of allFiltered) {
    const quantity = Number(row.quantity);
    totalRevenue += quantity * Number(row.salePricePerUnit);
    totalCost += quantity * Number(row.costPerUnitSnapshot);
  }
  const totalProfit = totalRevenue - totalCost;

  return {
    data,
    totalItems: count,
    summary: {
      totalRevenue: totalRevenue.toFixed(2),
      totalCost: totalCost.toFixed(2),
      totalProfit: totalProfit.toFixed(2),
    },
  };
}

// ---------------------------------------------------------------------------
// Reporte de rentabilidad por producto (RF-012, SDD-03 §6.2, SDD-07 CU6) —
// agrupa ventas por producto en un período. No definido como tabla propia:
// se deriva enteramente de `sales` + `products`.
// ---------------------------------------------------------------------------

export interface ProfitabilityReportParams {
  from?: Date;
  to?: Date;
  productId?: string;
}

export async function getProfitabilityReport(db: Database, params: ProfitabilityReportParams) {
  const conditions = [];
  if (params.productId) conditions.push(eq(sales.productId, params.productId));
  if (params.from) conditions.push(gte(sales.soldAt, params.from));
  if (params.to) conditions.push(lte(sales.soldAt, params.to));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let query = db.select().from(sales).$dynamic();
  if (whereClause) query = query.where(whereClause);
  const rows = await query;

  const byProduct = new Map<
    string,
    { unitsSold: number; totalRevenue: number; totalCost: number }
  >();

  for (const row of rows) {
    const quantity = Number(row.quantity);
    const revenue = quantity * Number(row.salePricePerUnit);
    const cost = quantity * Number(row.costPerUnitSnapshot);
    const acc = byProduct.get(row.productId) ?? { unitsSold: 0, totalRevenue: 0, totalCost: 0 };
    acc.unitsSold += quantity;
    acc.totalRevenue += revenue;
    acc.totalCost += cost;
    byProduct.set(row.productId, acc);
  }

  // Umbral configurable de "producto poco rentable" (RF-012, SDD-07 CU6,
  // SDD-10 §1) — nunca un número mágico en código, viene de
  // `LOW_MARGIN_THRESHOLD_PERCENT` (default 20, ver lib/config.ts).
  const lowProfitabilityThresholdPercent = config.lowMarginThresholdPercent;

  const data = await Promise.all(
    [...byProduct.entries()].map(async ([productId, acc]) => {
      const [product] = await db.select().from(products).where(eq(products.id, productId));
      const totalRealProfit = acc.totalRevenue - acc.totalCost;
      const realMarginPercent = acc.totalRevenue > 0 ? (totalRealProfit / acc.totalRevenue) * 100 : 0;
      return {
        productId,
        productName: product?.name ?? null,
        unitsSold: acc.unitsSold.toFixed(2),
        totalRevenue: acc.totalRevenue.toFixed(2),
        totalCost: acc.totalCost.toFixed(2),
        totalRealProfit: totalRealProfit.toFixed(2),
        realMarginPercent: realMarginPercent.toFixed(2),
        isLowProfitability: realMarginPercent < lowProfitabilityThresholdPercent,
      };
    }),
  );

  data.sort((a, b) => Number(b.totalRealProfit) - Number(a.totalRealProfit));

  const totalRevenue = data.reduce((sum, r) => sum + Number(r.totalRevenue), 0);
  const totalCost = data.reduce((sum, r) => sum + Number(r.totalCost), 0);
  const totalProfit = totalRevenue - totalCost;

  return {
    data,
    totals: {
      totalRevenue: totalRevenue.toFixed(2),
      totalCost: totalCost.toFixed(2),
      totalRealProfit: totalProfit.toFixed(2),
      realMarginPercent: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : "0.00",
    },
    lowProfitabilityThresholdPercent,
  };
}
