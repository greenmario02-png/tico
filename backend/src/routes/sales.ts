import type { FastifyInstance } from "fastify";
import { db } from "../db/client";
import { authenticate, requireRole } from "../lib/auth";
import { buildPaginationMeta, parsePagination } from "../lib/pagination";
import { listSales, registerSale } from "../services/saleService";
import {
  validateBatchIdField,
  validateProductIdField,
  validateSaleQuantity,
  validateSalePricePerUnitField,
  validateSoldAt,
} from "../services/validation/saleValidation";

export async function saleRoutes(app: FastifyInstance) {
  app.get("/api/sales", { preHandler: [authenticate] }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const { page, pageSize } = parsePagination(query);
    const { data, totalItems, summary } = await listSales(db, {
      page,
      pageSize,
      productId: typeof query.productId === "string" ? query.productId : undefined,
      batchId: typeof query.batchId === "string" ? query.batchId : undefined,
      from: typeof query.from === "string" ? new Date(query.from) : undefined,
      to: typeof query.to === "string" ? new Date(query.to) : undefined,
      sortOrder: query.sortOrder as "asc" | "desc" | undefined,
    });
    return { data, pagination: buildPaginationMeta(page, pageSize, totalItems), summary };
  });

  app.post(
    "/api/sales",
    { preHandler: [authenticate, requireRole("admin", "dueño", "operario")] },
    async (request, reply) => {
      const body = request.body as Record<string, unknown>;

      const productId = validateProductIdField(body.productId);
      const batchId = validateBatchIdField(body.batchId);
      const quantity = validateSaleQuantity(body.quantity);
      const salePricePerUnit = validateSalePricePerUnitField(body.salePricePerUnit);
      const soldAt = validateSoldAt(body.soldAt);

      const created = await registerSale(db, {
        productId,
        batchId,
        quantity,
        salePricePerUnit,
        soldAt,
        createdBy: request.user!.id,
      });
      reply.code(201);
      return created;
    },
  );
}
