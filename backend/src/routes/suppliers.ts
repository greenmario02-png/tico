import type { FastifyInstance } from "fastify";
import { db } from "../db/client";
import { authenticate, requireRole } from "../lib/auth";
import { buildPaginationMeta, parsePagination } from "../lib/pagination";
import {
  createSupplier,
  deactivateSupplier,
  getSupplierById,
  listSuppliers,
  updateSupplier,
} from "../services/supplierService";
import { validateContactPerson, validatePhone, validateSupplierName } from "../services/validation/supplierValidation";

export async function supplierRoutes(app: FastifyInstance) {
  app.get("/api/suppliers", { preHandler: [authenticate] }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const { page, pageSize } = parsePagination(query);
    const { data, totalItems } = await listSuppliers(db, {
      page,
      pageSize,
      search: typeof query.search === "string" ? query.search : undefined,
      isActive: query.isActive as "true" | "false" | "all" | undefined,
    });
    return { data, pagination: buildPaginationMeta(page, pageSize, totalItems) };
  });

  app.get("/api/suppliers/:id", { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    return getSupplierById(db, id);
  });

  app.post(
    "/api/suppliers",
    { preHandler: [authenticate, requireRole("admin", "dueño")] },
    async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const name = validateSupplierName(body.name);
      const contactPerson = validateContactPerson(body.contactPerson);
      const phone = validatePhone(body.phone);

      const created = await createSupplier(db, { name, contactPerson, phone });
      reply.code(201);
      return created;
    },
  );

  app.put(
    "/api/suppliers/:id",
    { preHandler: [authenticate, requireRole("admin", "dueño")] },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      const updateInput: Record<string, unknown> = {};
      if (body.name !== undefined) updateInput.name = validateSupplierName(body.name);
      if (body.contactPerson !== undefined) updateInput.contactPerson = validateContactPerson(body.contactPerson);
      if (body.phone !== undefined) updateInput.phone = validatePhone(body.phone);
      if (body.isActive !== undefined) updateInput.isActive = body.isActive;

      return updateSupplier(db, id, updateInput);
    },
  );

  app.delete(
    "/api/suppliers/:id",
    { preHandler: [authenticate, requireRole("admin", "dueño")] },
    async (request) => {
      const { id } = request.params as { id: string };
      return deactivateSupplier(db, id);
    },
  );
}
