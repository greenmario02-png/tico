import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import {
  categories,
  ingredientPriceHistory,
  ingredients,
  ingredientStockMovements,
  recipeIngredients,
  recipes,
  suppliers,
} from "../db/schema/index";
import { ApiError, isUniqueViolation } from "../lib/errors";
import { getCurrentPrice, insertPrice } from "./priceHistoryService";
import type { BaseUnit } from "./validation/ingredientValidation";

export interface CreateIngredientInput {
  name: string;
  categoryId?: string | null;
  baseUnit: BaseUnit;
  initialPricePerBaseUnit: string;
  currentStock: string;
  minStock: string;
  supplierId?: string | null;
  imageUrl?: string | null;
  createdBy?: string | null;
}

async function assertNameNotDuplicate(db: Database, name: string, excludeId?: string) {
  const rows = await db
    .select({ id: ingredients.id, name: ingredients.name })
    .from(ingredients)
    .where(and(eq(ingredients.isActive, true), ilike(ingredients.name, name)));
  const conflict = rows.find((r) => r.id !== excludeId);
  if (conflict) {
    throw duplicateNameError(name);
  }
}

function duplicateNameError(name: string) {
  return ApiError.conflict(`Ya existe un ingrediente llamado "${name}". Usa ese o cambia el nombre.`, [
    { field: "name", message: `Ya existe un ingrediente llamado "${name}". Usa ese o cambia el nombre.` },
  ]);
}

// El SELECT-antes-de-INSERT de `assertNameNotDuplicate` es solo un fast path:
// bajo escrituras concurrentes puede pasar igual y dejar que dos INSERTs
// simultáneos con el mismo nombre lleguen a la BD. El guardián real es el
// índice único `ingredients_active_name_lower_unique` (ver
// `db/schema/ingredients.ts`); aquí se traduce esa violación (Postgres
// 23505) al mismo mensaje de negocio para que el comportamiento visible al
// usuario no cambie.
function withDuplicateNameTranslation<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return fn().catch((err) => {
    if (isUniqueViolation(err)) {
      throw duplicateNameError(name);
    }
    throw err;
  });
}

async function assertCategoryValid(db: Database, categoryId: string | null | undefined) {
  if (!categoryId) return;
  const [cat] = await db.select().from(categories).where(eq(categories.id, categoryId));
  if (!cat || cat.kind !== "ingrediente") {
    throw ApiError.validation("Esa categoría no existe. Elige una de la lista o crea una nueva categoría.", [
      { field: "categoryId", message: "Esa categoría no existe. Elige una de la lista o crea una nueva categoría." },
    ]);
  }
}

async function assertSupplierValid(db: Database, supplierId: string | null | undefined) {
  if (!supplierId) return;
  const [sup] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));
  if (!sup || !sup.isActive) {
    throw ApiError.validation(
      "El proveedor seleccionado ya no está disponible. Elige otro proveedor o deja este campo vacío.",
      [
        {
          field: "supplierId",
          message: "El proveedor seleccionado ya no está disponible. Elige otro proveedor o deja este campo vacío.",
        },
      ],
    );
  }
}

export async function createIngredient(db: Database, input: CreateIngredientInput) {
  await assertNameNotDuplicate(db, input.name);
  await assertCategoryValid(db, input.categoryId);
  await assertSupplierValid(db, input.supplierId);

  return withDuplicateNameTranslation(input.name, () =>
    db.transaction(async (tx) => {
      const [ingredient] = await tx
        .insert(ingredients)
        .values({
          name: input.name,
          categoryId: input.categoryId ?? null,
          baseUnit: input.baseUnit,
          currentStock: input.currentStock,
          minStock: input.minStock,
          supplierId: input.supplierId ?? null,
          imageUrl: input.imageUrl ?? null,
        })
        .returning();

      await insertPrice(tx as unknown as Database, {
        ingredientId: ingredient.id,
        pricePerBaseUnit: input.initialPricePerBaseUnit,
        effectiveAt: new Date(),
        createdBy: input.createdBy,
      });

      return getIngredientById(tx as unknown as Database, ingredient.id);
    }),
  );
}

async function toApiShape(db: Database, row: typeof ingredients.$inferSelect) {
  const currentPrice = await getCurrentPrice(db, row.id);
  let categoryName: string | null = null;
  if (row.categoryId) {
    const [cat] = await db.select().from(categories).where(eq(categories.id, row.categoryId));
    categoryName = cat?.name ?? null;
  }
  let supplierName: string | null = null;
  if (row.supplierId) {
    const [sup] = await db.select().from(suppliers).where(eq(suppliers.id, row.supplierId));
    supplierName = sup?.name ?? null;
  }
  return {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    categoryName,
    baseUnit: row.baseUnit,
    currentStock: row.currentStock,
    minStock: row.minStock,
    supplierId: row.supplierId,
    supplierName,
    imageUrl: row.imageUrl,
    currentPricePerBaseUnit: currentPrice?.pricePerBaseUnit ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getIngredientById(db: Database, id: string) {
  const [row] = await db.select().from(ingredients).where(eq(ingredients.id, id));
  if (!row) {
    throw ApiError.notFound("Ingrediente no encontrado");
  }
  return toApiShape(db, row);
}

export interface ListIngredientsParams {
  page: number;
  pageSize: number;
  search?: string;
  categoryId?: string;
  supplierId?: string;
  isActive?: "true" | "false" | "all";
  sortBy?: "name" | "createdAt" | "currentStock";
  sortOrder?: "asc" | "desc";
}

export async function listIngredients(db: Database, params: ListIngredientsParams) {
  const conditions = [];
  if (params.isActive === undefined || params.isActive === "true") {
    conditions.push(eq(ingredients.isActive, true));
  } else if (params.isActive === "false") {
    conditions.push(eq(ingredients.isActive, false));
  }
  if (params.search) {
    conditions.push(ilike(ingredients.name, `%${params.search}%`));
  }
  if (params.categoryId) {
    conditions.push(eq(ingredients.categoryId, params.categoryId));
  }
  if (params.supplierId) {
    conditions.push(eq(ingredients.supplierId, params.supplierId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const sortColumn =
    params.sortBy === "createdAt"
      ? ingredients.createdAt
      : params.sortBy === "currentStock"
        ? ingredients.currentStock
        : ingredients.name;
  const orderFn = params.sortOrder === "desc" ? desc : asc;

  let query = db.select().from(ingredients).$dynamic();
  if (whereClause) query = query.where(whereClause);
  const rows = await query
    .orderBy(orderFn(sortColumn))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  let countQuery = db.select({ count: sql<number>`count(*)::int` }).from(ingredients).$dynamic();
  if (whereClause) countQuery = countQuery.where(whereClause);
  const [{ count }] = await countQuery;

  const data = await Promise.all(rows.map((row) => toApiShape(db, row)));
  return { data, totalItems: count };
}

export interface UpdateIngredientInput {
  name?: string;
  categoryId?: string | null;
  baseUnit?: BaseUnit;
  minStock?: string;
  supplierId?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
}

export async function updateIngredient(db: Database, id: string, input: UpdateIngredientInput) {
  const [existing] = await db.select().from(ingredients).where(eq(ingredients.id, id));
  if (!existing) {
    throw ApiError.notFound("Ingrediente no encontrado");
  }
  if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
    await assertNameNotDuplicate(db, input.name, id);
  }
  if (input.categoryId !== undefined) await assertCategoryValid(db, input.categoryId);
  if (input.supplierId !== undefined) await assertSupplierValid(db, input.supplierId);

  const [updated] = await withDuplicateNameTranslation(input.name ?? existing.name, () =>
    db
      .update(ingredients)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.baseUnit !== undefined ? { baseUnit: input.baseUnit } : {}),
        ...(input.minStock !== undefined ? { minStock: input.minStock } : {}),
        ...(input.supplierId !== undefined ? { supplierId: input.supplierId } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(eq(ingredients.id, id))
      .returning(),
  );

  return toApiShape(db, updated);
}

export async function deactivateIngredient(db: Database, id: string) {
  const [existing] = await db.select().from(ingredients).where(eq(ingredients.id, id));
  if (!existing) {
    throw ApiError.notFound("Ingrediente no encontrado");
  }

  const usageRows = await db
    .select({ recipeName: recipes.name })
    .from(recipeIngredients)
    .innerJoin(recipes, eq(recipeIngredients.recipeId, recipes.id))
    .where(and(eq(recipeIngredients.ingredientId, id), eq(recipes.isDeleted, false)));

  if (usageRows.length > 0) {
    const names = usageRows.map((r) => r.recipeName).join(", ");
    throw ApiError.conflict(
      `No se puede desactivar: el ingrediente se usa en ${usageRows.length} recetas activas`,
      [{ field: "id", message: `Usado en: ${names}` }],
    );
  }

  await db.update(ingredients).set({ isActive: false, updatedAt: new Date() }).where(eq(ingredients.id, id));
  return { message: "Ingrediente desactivado", id };
}

export interface PurchaseInput {
  quantityBaseUnit: string;
  note?: string | null;
  alsoUpdatePrice?: { pricePerBaseUnit: string } | null;
  createdBy?: string | null;
}

export async function registerPurchase(db: Database, ingredientId: string, input: PurchaseInput) {
  const [existing] = await db.select().from(ingredients).where(eq(ingredients.id, ingredientId));
  if (!existing || !existing.isActive) {
    throw ApiError.notFound("Ingrediente no encontrado");
  }

  return db.transaction(async (tx) => {
    const [movement] = await tx
      .insert(ingredientStockMovements)
      .values({
        ingredientId,
        movementType: "compra",
        quantityBaseUnit: input.quantityBaseUnit,
        referenceType: "purchase",
        note: input.note ?? null,
        createdBy: input.createdBy ?? null,
      })
      .returning();

    await tx
      .update(ingredientStockMovements)
      .set({ referenceId: movement.id })
      .where(eq(ingredientStockMovements.id, movement.id));

    const newStock = (Number(existing.currentStock) + Number(input.quantityBaseUnit)).toFixed(3);
    await tx.update(ingredients).set({ currentStock: newStock, updatedAt: new Date() }).where(eq(ingredients.id, ingredientId));

    if (input.alsoUpdatePrice) {
      await insertPrice(tx as unknown as Database, {
        ingredientId,
        pricePerBaseUnit: input.alsoUpdatePrice.pricePerBaseUnit,
        effectiveAt: new Date(),
        createdBy: input.createdBy,
      });
    }

    const currentPrice = await getCurrentPrice(tx as unknown as Database, ingredientId);

    return {
      movement: { ...movement, referenceId: movement.id },
      ingredient: {
        id: ingredientId,
        currentStock: newStock,
        currentPricePerBaseUnit: currentPrice?.pricePerBaseUnit ?? null,
      },
    };
  });
}

export async function listLowStock(db: Database, params: { page: number; pageSize: number }) {
  const rows = await db.select().from(ingredients).where(eq(ingredients.isActive, true));
  const low = rows
    .filter((r) => Number(r.currentStock) <= Number(r.minStock))
    .sort((a, b) => Number(a.currentStock) - Number(a.minStock) - (Number(b.currentStock) - Number(b.minStock)));

  const start = (params.page - 1) * params.pageSize;
  const paged = low.slice(start, start + params.pageSize);

  const data = await Promise.all(
    paged.map(async (r) => {
      let supplierName: string | null = null;
      if (r.supplierId) {
        const [sup] = await db.select().from(suppliers).where(eq(suppliers.id, r.supplierId));
        supplierName = sup?.name ?? null;
      }
      return {
        id: r.id,
        name: r.name,
        baseUnit: r.baseUnit,
        currentStock: r.currentStock,
        minStock: r.minStock,
        deficit: (Number(r.minStock) - Number(r.currentStock)).toFixed(3),
        supplierName,
      };
    }),
  );

  return { data, totalItems: low.length };
}
