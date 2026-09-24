import { asc, desc, eq, gte, inArray, lte, and, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import {
  batchIngredientUsage,
  batches,
  ingredientStockMovements,
  ingredients,
  products,
  recipes,
  sales,
} from "../db/schema/index";
import { ApiError } from "../lib/errors";
import { calculateRecipeCost, type CostDetail } from "./costingService";

/**
 * Algoritmos de SDD-04 §4/§5 y flujo de negocio SDD-03 §4 ("Producir un
 * lote" — el flujo más importante del sistema).
 *
 * Reutiliza `costingService.calculateRecipeCost` (Fase 2) para resolver
 * recursivamente sub-recetas, precios vigentes y detección de ciclos —
 * este módulo NO reimplementa ese recorrido, solo lo "aplana" a cantidades
 * reales por ingrediente base para poder validar y descontar stock.
 */

interface IngredientNeed {
  ingredientId: string;
  ingredientName: string;
  /** cantidadNecesaria acumulada (sin merma), en unidad base del ingrediente. */
  neededBeforeWaste: number;
  /** cantidadAUsar acumulada (con merma incluida, SDD-04 §3), en unidad base. */
  neededAfterWaste: number;
  /** precio vigente resuelto por calculateRecipeCost (mismo `asOf` para todo el árbol). */
  unitPrice: number;
}

/**
 * Recorre el árbol de `CostDetail` ya calculado por `calculateRecipeCost` y
 * acumula, por ingrediente base, la cantidad total necesaria — sumando
 * cuando el mismo ingrediente aparece más de una vez (directo y/o dentro de
 * una o más sub-recetas anidadas), tal como exige SDD-03 §4.4: "el sistema
 * suma el total de cada ingrediente base antes de validar y descontar
 * stock — nunca se descuenta dos veces por separado sin sumar primero".
 *
 * `multiplier` representa cuántas "unidades de receta completa" de este
 * nivel del árbol se están usando (en la raíz, es el `scaleFactor` del
 * lote; en una sub-receta anidada, es la fracción de su propio rendimiento
 * que se está consumiendo).
 */
async function collectIngredientNeeds(
  db: Database,
  details: CostDetail[],
  multiplier: number,
  acc: Map<string, IngredientNeed>,
): Promise<void> {
  for (const detail of details) {
    if (detail.type === "ingredient") {
      const pre = detail.baseQuantity * multiplier;
      const post = detail.quantityAfterWaste * multiplier;
      const existing = acc.get(detail.id);
      if (existing) {
        existing.neededBeforeWaste += pre;
        existing.neededAfterWaste += post;
      } else {
        acc.set(detail.id, {
          ingredientId: detail.id,
          ingredientName: detail.name,
          neededBeforeWaste: pre,
          neededAfterWaste: post,
          unitPrice: detail.unitPrice,
        });
      }
    } else if (detail.subBreakdown && detail.subBreakdown.length > 0) {
      // Cantidad de la sub-receta que se usa en este lote (ya con la
      // merma de ESTE nivel aplicada, SDD-04 §1 paso 5).
      const usedQtyOfSub = detail.quantityAfterWaste * multiplier;

      const [subRecipe] = await db
        .select({ yieldQuantity: recipes.yieldQuantity })
        .from(recipes)
        .where(eq(recipes.id, detail.id));
      const subYield = Number(subRecipe?.yieldQuantity ?? 0);
      if (!(subYield > 0)) continue;

      // Fracción del rendimiento COMPLETO de la sub-receta que se usa acá;
      // el desglose (`subBreakdown`) representa la sub-receta completa, así
      // que hay que re-escalar antes de recursar (CU4 4c: expansión
      // recursiva pura hasta ingredientes base).
      const subMultiplier = usedQtyOfSub / subYield;
      await collectIngredientNeeds(db, detail.subBreakdown, subMultiplier, acc);
    }
  }
}

export interface ProduceBatchInput {
  recipeId: string;
  requestedUnits: string;
  productId?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}

export async function produceBatch(db: Database, input: ProduceBatchInput) {
  const requestedUnitsNum = Number(input.requestedUnits);
  if (!(requestedUnitsNum > 0)) {
    throw ApiError.validation("La cantidad a producir debe ser mayor a cero.", [
      { field: "requestedUnits", message: "La cantidad a producir debe ser mayor a cero." },
    ]);
  }

  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, input.recipeId));
  if (!recipe || recipe.isDeleted) {
    throw ApiError.notFound("Esta receta ya no está disponible.");
  }

  if (input.productId) {
    const [product] = await db.select().from(products).where(eq(products.id, input.productId));
    if (!product) {
      throw ApiError.notFound("Producto no encontrado");
    }
    if (product.recipeId !== input.recipeId) {
      throw ApiError.validation("El producto seleccionado no corresponde a esta receta.", [
        { field: "productId", message: "El producto seleccionado no corresponde a esta receta." },
      ]);
    }
  }

  // [PREVIEW] SDD-04 §1/§3/§4 — usa precios vigentes AHORA (se re-lee dentro
  // de la transacción más abajo solo para el stock; los precios no
  // necesitan re-lectura porque no cambian en el mismo instante y el
  // snapshot final se calcula con este mismo resultado).
  const asOf = new Date();
  const costResult = await calculateRecipeCost(db, input.recipeId, { asOf });
  const yieldQuantity = Number(costResult.recipe.yieldQuantity);
  if (!(yieldQuantity > 0)) {
    throw ApiError.validation(
      "Esta receta no tiene un rendimiento válido configurado. Corrígela antes de producir.",
      [{ field: "yieldQuantity", message: "Esta receta no tiene un rendimiento válido configurado. Corrígela antes de producir." }],
    );
  }
  const scaleFactor = requestedUnitsNum / yieldQuantity;

  const needs = new Map<string, IngredientNeed>();
  await collectIngredientNeeds(db, costResult.details, scaleFactor, needs);

  if (needs.size === 0) {
    throw ApiError.conflict("Esta receta no tiene ingredientes cargados.");
  }

  const ingredientIds = [...needs.keys()];
  const totalCostSnapshot = costResult.costPerUnit * requestedUnitsNum;
  const costPerUnitSnapshot = costResult.costPerUnit;

  return db.transaction(async (tx) => {
    // [VALIDACIÓN DE STOCK — re-validada dentro de la transacción con
    // bloqueo de fila, SDD-03 §4.4, para evitar condiciones de carrera
    // entre lotes concurrentes]
    const currentRows = await tx
      .select()
      .from(ingredients)
      .where(inArray(ingredients.id, ingredientIds))
      .for("update");
    const stockById = new Map(currentRows.map((r) => [r.id, r]));

    const shortfalls: { field: string; message: string }[] = [];
    for (const need of needs.values()) {
      const ingredientRow = stockById.get(need.ingredientId);
      if (!ingredientRow) {
        throw ApiError.notFound("El ingrediente seleccionado ya no está disponible. Elige otro.");
      }
      const available = Number(ingredientRow.currentStock);
      if (available < need.neededAfterWaste) {
        shortfalls.push({
          field: "ingredientId",
          message: `${need.ingredientName}: se necesitan ${need.neededAfterWaste.toFixed(3)} ${ingredientRow.baseUnit}, hay ${available.toFixed(3)} ${ingredientRow.baseUnit} disponibles`,
        });
      }
    }

    // Todo-o-nada (SDD-03 §4.2 paso 3a / §4.4): si falta stock de CUALQUIER
    // ingrediente, no se escribe absolutamente nada — el error se lanza
    // antes del primer INSERT/UPDATE, y al estar dentro de `db.transaction`
    // cualquier lectura previa tampoco deja rastro.
    if (shortfalls.length > 0) {
      throw ApiError.insufficientStock("No hay suficiente stock para producir este lote", shortfalls);
    }

    const [batch] = await tx
      .insert(batches)
      .values({
        recipeId: input.recipeId,
        productId: input.productId ?? null,
        requestedUnits: requestedUnitsNum.toFixed(2),
        scaleFactor: scaleFactor.toFixed(4),
        totalCostSnapshot: totalCostSnapshot.toFixed(2),
        costPerUnitSnapshot: costPerUnitSnapshot.toFixed(4),
        producedAt: asOf,
        createdBy: input.createdBy ?? null,
        notes: input.notes ?? null,
      })
      .returning();

    for (const need of needs.values()) {
      const ingredientRow = stockById.get(need.ingredientId)!;
      const newStock = (Number(ingredientRow.currentStock) - need.neededAfterWaste).toFixed(3);

      await tx
        .update(ingredients)
        .set({ currentStock: newStock, updatedAt: new Date() })
        .where(eq(ingredients.id, need.ingredientId));

      // Movimiento "uso_produccion": la porción que quedó en el producto
      // terminado (sin merma), SDD-03 §4.2 paso 5b / SDD-04 §3.
      await tx.insert(ingredientStockMovements).values({
        ingredientId: need.ingredientId,
        movementType: "uso_produccion",
        quantityBaseUnit: (-need.neededBeforeWaste).toFixed(3),
        referenceType: "batch",
        referenceId: batch.id,
        createdBy: input.createdBy ?? null,
      });

      // Movimiento "merma" separado — visible en el kardex, nunca oculto
      // dentro de "uso_produccion" (SDD-04 §3, SDD-03 §4.4: no se genera
      // si wastePercent = 0 para no ensuciar el kardex con ceros).
      const wasteAmount = need.neededAfterWaste - need.neededBeforeWaste;
      if (wasteAmount > 0) {
        await tx.insert(ingredientStockMovements).values({
          ingredientId: need.ingredientId,
          movementType: "merma",
          quantityBaseUnit: (-wasteAmount).toFixed(3),
          referenceType: "batch",
          referenceId: batch.id,
          note: "Merma de preparación aplicada en el Lote",
          createdBy: input.createdBy ?? null,
        });
      }

      const lineTotalCost = need.neededAfterWaste * need.unitPrice;
      await tx.insert(batchIngredientUsage).values({
        batchId: batch.id,
        ingredientId: need.ingredientId,
        subRecipeId: null,
        quantityUsedBaseUnit: need.neededAfterWaste.toFixed(3),
        unitCostSnapshot: need.unitPrice.toFixed(4),
        totalCostSnapshot: lineTotalCost.toFixed(2),
      });
    }

    return getBatchByIdInternal(tx as unknown as Database, batch.id);
  });
}

/**
 * `unitsRemaining` (SDD-03 §7, SDD-07 CU5, SDD-00 pendientes) — valor
 * DERIVADO, nunca almacenado físicamente: `requestedUnits - SUM(ventas con
 * ese batchId)`. Se calcula acá (no como columna en `batches`) para poder
 * alertar/rechazar sobreventa de un lote ya agotado sin tocar el schema.
 */
async function getUnitsSoldByBatch(db: Database, batchIds: string[]): Promise<Map<string, number>> {
  if (batchIds.length === 0) return new Map();
  const rows = await db
    .select({ batchId: sales.batchId, unitsSold: sql<string>`coalesce(sum(${sales.quantity}), 0)` })
    .from(sales)
    .where(inArray(sales.batchId, batchIds))
    .groupBy(sales.batchId);
  return new Map(rows.filter((r) => r.batchId !== null).map((r) => [r.batchId as string, Number(r.unitsSold)]));
}

/**
 * Unidades restantes de un solo lote (usado por `saleService` para validar
 * sobreventa ANTES de insertar la venta, ver SDD-06 nueva validación).
 */
export async function getUnitsRemaining(db: Database, batchId: string): Promise<number> {
  const [batch] = await db.select().from(batches).where(eq(batches.id, batchId));
  if (!batch) {
    throw ApiError.notFound("El lote seleccionado ya no está disponible.");
  }
  const soldByBatch = await getUnitsSoldByBatch(db, [batchId]);
  const unitsSold = soldByBatch.get(batchId) ?? 0;
  return Number(batch.requestedUnits) - unitsSold;
}

async function getBatchByIdInternal(db: Database, id: string) {
  const [row] = await db.select().from(batches).where(eq(batches.id, id));
  if (!row) {
    throw ApiError.notFound("Lote no encontrado");
  }

  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, row.recipeId));
  let productName: string | null = null;
  if (row.productId) {
    const [product] = await db.select().from(products).where(eq(products.id, row.productId));
    productName = product?.name ?? null;
  }

  const usageRows = await db.select().from(batchIngredientUsage).where(eq(batchIngredientUsage.batchId, id));
  const usage = await Promise.all(
    usageRows.map(async (u) => {
      let ingredientName: string | null = null;
      if (u.ingredientId) {
        const [ingredient] = await db.select().from(ingredients).where(eq(ingredients.id, u.ingredientId));
        ingredientName = ingredient?.name ?? null;
      }
      let subRecipeName: string | null = null;
      if (u.subRecipeId) {
        const [sub] = await db.select().from(recipes).where(eq(recipes.id, u.subRecipeId));
        subRecipeName = sub?.name ?? null;
      }
      return {
        id: u.id,
        ingredientId: u.ingredientId,
        ingredientName,
        subRecipeId: u.subRecipeId,
        subRecipeName,
        quantityUsedBaseUnit: u.quantityUsedBaseUnit,
        unitCostSnapshot: u.unitCostSnapshot,
        totalCostSnapshot: u.totalCostSnapshot,
      };
    }),
  );

  const soldByBatch = await getUnitsSoldByBatch(db, [row.id]);
  const unitsSold = soldByBatch.get(row.id) ?? 0;
  const unitsRemaining = Number(row.requestedUnits) - unitsSold;

  return {
    id: row.id,
    recipeId: row.recipeId,
    recipeName: recipe?.name ?? null,
    productId: row.productId,
    productName,
    requestedUnits: row.requestedUnits,
    scaleFactor: row.scaleFactor,
    totalCostSnapshot: row.totalCostSnapshot,
    costPerUnitSnapshot: row.costPerUnitSnapshot,
    unitsRemaining: unitsRemaining.toFixed(2),
    producedAt: row.producedAt,
    createdBy: row.createdBy,
    notes: row.notes,
    usage,
  };
}

export async function getBatchById(db: Database, id: string) {
  return getBatchByIdInternal(db, id);
}

export interface ListBatchesParams {
  page: number;
  pageSize: number;
  recipeId?: string;
  productId?: string;
  createdBy?: string;
  from?: Date;
  to?: Date;
  sortBy?: "producedAt";
  sortOrder?: "asc" | "desc";
}

export async function listBatches(db: Database, params: ListBatchesParams) {
  const conditions = [];
  if (params.recipeId) conditions.push(eq(batches.recipeId, params.recipeId));
  if (params.productId) conditions.push(eq(batches.productId, params.productId));
  if (params.createdBy) conditions.push(eq(batches.createdBy, params.createdBy));
  if (params.from) conditions.push(gte(batches.producedAt, params.from));
  if (params.to) conditions.push(lte(batches.producedAt, params.to));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const orderFn = params.sortOrder === "asc" ? asc : desc;

  let query = db.select().from(batches).$dynamic();
  if (whereClause) query = query.where(whereClause);
  const rows = await query
    .orderBy(orderFn(batches.producedAt))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  let countQuery = db.select({ count: sql<number>`count(*)::int` }).from(batches).$dynamic();
  if (whereClause) countQuery = countQuery.where(whereClause);
  const [{ count }] = await countQuery;

  const soldByBatch = await getUnitsSoldByBatch(db, rows.map((r) => r.id));

  const data = await Promise.all(
    rows.map(async (row) => {
      const [recipe] = await db.select().from(recipes).where(eq(recipes.id, row.recipeId));
      let productName: string | null = null;
      if (row.productId) {
        const [product] = await db.select().from(products).where(eq(products.id, row.productId));
        productName = product?.name ?? null;
      }
      const unitsSold = soldByBatch.get(row.id) ?? 0;
      const unitsRemaining = Number(row.requestedUnits) - unitsSold;
      return {
        id: row.id,
        recipeId: row.recipeId,
        recipeName: recipe?.name ?? null,
        productId: row.productId,
        productName,
        requestedUnits: row.requestedUnits,
        scaleFactor: row.scaleFactor,
        totalCostSnapshot: row.totalCostSnapshot,
        costPerUnitSnapshot: row.costPerUnitSnapshot,
        unitsRemaining: unitsRemaining.toFixed(2),
        producedAt: row.producedAt,
        createdBy: row.createdBy,
      };
    }),
  );

  return { data, totalItems: count };
}
