import { and, asc, eq, ilike, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { products, recipes } from "../db/schema/index";
import { ApiError } from "../lib/errors";
import { calculateRecipeCost, suggestedPrice } from "./costingService";

export interface CreateProductInput {
  recipeId: string;
  name: string;
  salePrice?: string | null;
}

async function assertRecipeValid(db: Database, recipeId: string) {
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
  if (!recipe || recipe.isDeleted) {
    throw ApiError.notFound("Selecciona una receta válida para este producto.");
  }
  return recipe;
}

async function toApiShape(db: Database, row: typeof products.$inferSelect) {
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, row.recipeId));
  return {
    id: row.id,
    recipeId: row.recipeId,
    recipeName: recipe?.name ?? null,
    name: row.name,
    salePrice: row.salePrice,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createProduct(db: Database, input: CreateProductInput) {
  await assertRecipeValid(db, input.recipeId);

  const [row] = await db
    .insert(products)
    .values({
      recipeId: input.recipeId,
      name: input.name,
      salePrice: input.salePrice ?? null,
    })
    .returning();

  return toApiShape(db, row);
}

export async function getProductById(db: Database, id: string) {
  const [row] = await db.select().from(products).where(eq(products.id, id));
  if (!row) {
    throw ApiError.notFound("Producto no encontrado");
  }
  return toApiShape(db, row);
}

export interface ListProductsParams {
  page: number;
  pageSize: number;
  search?: string;
  recipeId?: string;
  isActive?: "true" | "false" | "all";
}

export async function listProducts(db: Database, params: ListProductsParams) {
  const conditions = [];
  if (params.isActive === undefined || params.isActive === "true") {
    conditions.push(eq(products.isActive, true));
  } else if (params.isActive === "false") {
    conditions.push(eq(products.isActive, false));
  }
  if (params.search) {
    conditions.push(ilike(products.name, `%${params.search}%`));
  }
  if (params.recipeId) {
    conditions.push(eq(products.recipeId, params.recipeId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let query = db.select().from(products).$dynamic();
  if (whereClause) query = query.where(whereClause);
  const rows = await query
    .orderBy(asc(products.name))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  let countQuery = db.select({ count: sql<number>`count(*)::int` }).from(products).$dynamic();
  if (whereClause) countQuery = countQuery.where(whereClause);
  const [{ count }] = await countQuery;

  const data = await Promise.all(rows.map((row) => toApiShape(db, row)));
  return { data, totalItems: count };
}

export interface UpdateProductInput {
  name?: string;
  recipeId?: string;
  isActive?: boolean;
}

export async function updateProduct(db: Database, id: string, input: UpdateProductInput) {
  const [existing] = await db.select().from(products).where(eq(products.id, id));
  if (!existing) {
    throw ApiError.notFound("Producto no encontrado");
  }
  if (input.recipeId !== undefined) await assertRecipeValid(db, input.recipeId);

  const [updated] = await db
    .update(products)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.recipeId !== undefined ? { recipeId: input.recipeId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: new Date(),
    })
    .where(eq(products.id, id))
    .returning();

  return toApiShape(db, updated);
}

export async function setProductPrice(db: Database, id: string, salePrice: string) {
  const [existing] = await db.select().from(products).where(eq(products.id, id));
  if (!existing) {
    throw ApiError.notFound("Producto no encontrado");
  }

  const [updated] = await db
    .update(products)
    .set({ salePrice, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();

  return { id: updated.id, salePrice: updated.salePrice, updatedAt: updated.updatedAt };
}

export async function deactivateProduct(db: Database, id: string) {
  const [existing] = await db.select().from(products).where(eq(products.id, id));
  if (!existing) {
    throw ApiError.notFound("Producto no encontrado");
  }
  await db.update(products).set({ isActive: false, updatedAt: new Date() }).where(eq(products.id, id));
  return { message: "Producto desactivado", id };
}

export interface SuggestedPriceParams {
  margin: number;
  date?: Date;
}

export async function getSuggestedPrice(db: Database, productId: string, params: SuggestedPriceParams) {
  const [product] = await db.select().from(products).where(eq(products.id, productId));
  if (!product) {
    throw ApiError.notFound("Producto no encontrado");
  }

  const asOf = params.date ?? new Date();
  const costResult = await calculateRecipeCost(db, product.recipeId, { asOf });
  const price = suggestedPrice(costResult.costPerUnit, params.margin);

  return {
    productId: product.id,
    productName: product.name,
    costPerUnit: costResult.costPerUnit.toFixed(4),
    marginPercent: params.margin.toFixed(2),
    suggestedPrice: price.toFixed(2),
    currentSalePrice: product.salePrice,
    priceDate: asOf.toISOString().slice(0, 10),
  };
}
