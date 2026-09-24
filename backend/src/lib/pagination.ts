import { ApiError } from "./errors";

// SDD-10 §2.4 / SDD-05 §1.3
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const rawPage = query.page !== undefined ? Number(query.page) : 1;
  const rawPageSize = query.pageSize !== undefined ? Number(query.pageSize) : DEFAULT_PAGE_SIZE;

  if (!Number.isFinite(rawPage) || rawPage < 1 || !Number.isInteger(rawPage)) {
    throw ApiError.validation("El número de página no es válido.", [
      { field: "page", message: "Debe ser un número entero mayor o igual a 1." },
    ]);
  }
  if (!Number.isFinite(rawPageSize) || rawPageSize < 1 || !Number.isInteger(rawPageSize)) {
    throw ApiError.validation("El tamaño de página no es válido.", [
      { field: "pageSize", message: "Debe ser un número entero mayor o igual a 1." },
    ]);
  }

  const pageSize = Math.min(rawPageSize, MAX_PAGE_SIZE);
  return { page: rawPage, pageSize };
}

export function buildPaginationMeta(page: number, pageSize: number, totalItems: number) {
  return {
    page,
    pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
  };
}
