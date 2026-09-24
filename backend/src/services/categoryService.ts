import { and, asc, eq, ilike, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { categories, ingredients, recipes } from "../db/schema/index";
import { ApiError } from "../lib/errors";
import type { CategoryKind } from "./validation/categoryValidation";

export interface CreateCategoryInput {
  name: string;
  kind: CategoryKind;
}

function kindLabel(kind: CategoryKind): string {
  return kind === "ingrediente" ? "ingrediente" : "receta";
}

async function assertCategoryNameNotDuplicate(
  db: Database,
  name: string,
  kind: CategoryKind,
  excludeId?: string,
) {
  const rows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(and(eq(categories.kind, kind), ilike(categories.name, name)));
  const conflict = rows.find((r) => r.id !== excludeId);
  if (conflict) {
    throw ApiError.conflict(`Ya existe una categoría de ${kindLabel(kind)} con ese nombre`, [
      { field: "name", message: `Ya existe una categoría de ${kindLabel(kind)} con ese nombre` },
    ]);
  }
}

export async function createCategory(db: Database, input: CreateCategoryInput) {
  await assertCategoryNameNotDuplicate(db, input.name, input.kind);
  const [row] = await db.insert(categories).values({ name: input.name, kind: input.kind }).returning();
  return row;
}

export async function getCategoryById(db: Database, id: string) {
  const [row] = await db.select().from(categories).where(eq(categories.id, id));
  if (!row) {
    throw ApiError.notFound("Categoría no encontrada");
  }
  return row;
}

export interface ListCategoriesParams {
  page: number;
  pageSize: number;
  kind?: CategoryKind;
}

export async function listCategories(db: Database, params: ListCategoriesParams) {
  const whereClause = params.kind ? eq(categories.kind, params.kind) : undefined;

  let query = db.select().from(categories).$dynamic();
  if (whereClause) query = query.where(whereClause);
  const rows = await query
    .orderBy(asc(categories.name))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  let countQuery = db.select({ count: sql<number>`count(*)::int` }).from(categories).$dynamic();
  if (whereClause) countQuery = countQuery.where(whereClause);
  const [{ count }] = await countQuery;

  return { data: rows, totalItems: count };
}

export interface UpdateCategoryInput {
  name?: string;
}

export async function updateCategory(db: Database, id: string, input: UpdateCategoryInput) {
  const existing = await getCategoryById(db, id);

  if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
    await assertCategoryNameNotDuplicate(db, input.name, existing.kind, id);
  }

  const [updated] = await db
    .update(categories)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
    })
    .where(eq(categories.id, id))
    .returning();

  return updated;
}

export async function deleteCategory(db: Database, id: string) {
  const existing = await getCategoryById(db, id);

  if (existing.kind === "ingrediente") {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(ingredients)
      .where(and(eq(ingredients.categoryId, id), eq(ingredients.isActive, true)));
    if (count > 0) {
      throw ApiError.conflict(`No se puede eliminar: ${count} ingredientes usan esta categoría`);
    }
  } else {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(recipes)
      .where(and(eq(recipes.categoryId, id), eq(recipes.isDeleted, false)));
    if (count > 0) {
      throw ApiError.conflict(`No se puede eliminar: ${count} recetas usan esta categoría`);
    }
  }

  await db.delete(categories).where(eq(categories.id, id));
  return { message: "Categoría eliminada", id };
}
