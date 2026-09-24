import { and, asc, eq, ilike, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { suppliers } from "../db/schema/index";
import { ApiError, isUniqueViolation } from "../lib/errors";

export interface CreateSupplierInput {
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
}

function duplicateSupplierNameError(name: string) {
  return ApiError.conflict(`Ya existe un proveedor llamado "${name}".`, [
    { field: "name", message: `Ya existe un proveedor llamado "${name}".` },
  ]);
}

// Traduce la violación del índice único `suppliers_active_name_lower_unique`
// (Postgres 23505) a un mensaje de negocio, en vez de dejar pasar el error
// crudo del driver al cliente. Ver la nota en `db/schema/suppliers.ts`.
export async function createSupplier(db: Database, input: CreateSupplierInput) {
  try {
    const [row] = await db
      .insert(suppliers)
      .values({
        name: input.name,
        contactPerson: input.contactPerson ?? null,
        phone: input.phone ?? null,
      })
      .returning();
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw duplicateSupplierNameError(input.name);
    }
    throw err;
  }
}

export async function getSupplierById(db: Database, id: string) {
  const [row] = await db.select().from(suppliers).where(eq(suppliers.id, id));
  if (!row) {
    throw ApiError.notFound("Proveedor no encontrado");
  }
  return row;
}

export interface ListSuppliersParams {
  page: number;
  pageSize: number;
  search?: string;
  isActive?: "true" | "false" | "all";
}

export async function listSuppliers(db: Database, params: ListSuppliersParams) {
  const conditions = [];
  if (params.isActive === undefined || params.isActive === "true") {
    conditions.push(eq(suppliers.isActive, true));
  } else if (params.isActive === "false") {
    conditions.push(eq(suppliers.isActive, false));
  }
  if (params.search) {
    conditions.push(ilike(suppliers.name, `%${params.search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let query = db.select().from(suppliers).$dynamic();
  if (whereClause) query = query.where(whereClause);
  const rows = await query
    .orderBy(asc(suppliers.name))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  let countQuery = db.select({ count: sql<number>`count(*)::int` }).from(suppliers).$dynamic();
  if (whereClause) countQuery = countQuery.where(whereClause);
  const [{ count }] = await countQuery;

  return { data: rows, totalItems: count };
}

export interface UpdateSupplierInput {
  name?: string;
  contactPerson?: string | null;
  phone?: string | null;
  isActive?: boolean;
}

export async function updateSupplier(db: Database, id: string, input: UpdateSupplierInput) {
  const existing = await getSupplierById(db, id);

  try {
    const [updated] = await db
      .update(suppliers)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.contactPerson !== undefined ? { contactPerson: input.contactPerson } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      })
      .where(eq(suppliers.id, id))
      .returning();

    return updated;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw duplicateSupplierNameError(input.name ?? existing.name);
    }
    throw err;
  }
}

export async function deactivateSupplier(db: Database, id: string) {
  await getSupplierById(db, id);
  await db.update(suppliers).set({ isActive: false }).where(eq(suppliers.id, id));
  return { message: "Proveedor desactivado", id };
}
