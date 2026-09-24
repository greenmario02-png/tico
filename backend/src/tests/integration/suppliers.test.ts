import { afterAll, describe, expect, it } from "vitest";
import { db, pool } from "../../db/client";
import {
  createSupplier,
  deactivateSupplier,
  getSupplierById,
  listSuppliers,
  updateSupplier,
} from "../../services/supplierService";

describe("Proveedores CRUD (SDD-05 §5)", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("T-SUP-01: crea un proveedor", async () => {
    const created = await createSupplier(db, {
      name: `Molino TEST ${Date.now()}`,
      contactPerson: "Juan Pérez",
      phone: "70012345",
    });
    expect(created.isActive).toBe(true);

    const fetched = await getSupplierById(db, created.id);
    expect(fetched.contactPerson).toBe("Juan Pérez");
  });

  it("T-SUP-02: rechaza nombre duplicado (case-insensitive) con 409", async () => {
    const name = `Distribuidora TEST ${Date.now()}`;
    await createSupplier(db, { name });

    await expect(createSupplier(db, { name: name.toUpperCase() })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("T-SUP-03: PUT actualiza campos parciales", async () => {
    const created = await createSupplier(db, { name: `Lácteos Proveedor TEST ${Date.now()}` });
    const updated = await updateSupplier(db, created.id, { phone: "70099999" });
    expect(updated.phone).toBe("70099999");
  });

  it("T-SUP-04: DELETE hace soft-delete (isActive=false), sin bloqueo por uso", async () => {
    const created = await createSupplier(db, { name: `Insumos TEST ${Date.now()}` });
    const result = await deactivateSupplier(db, created.id);
    expect(result.message).toBe("Proveedor desactivado");

    const { data } = await listSuppliers(db, { page: 1, pageSize: 100, isActive: "false" });
    expect(data.some((s) => s.id === created.id)).toBe(true);
  });

  it("T-SUP-05: GET por id inexistente lanza 404", async () => {
    await expect(getSupplierById(db, "00000000-0000-0000-0000-000000000000")).rejects.toMatchObject({
      statusCode: 404,
      message: "Proveedor no encontrado",
    });
  });

  it("T-SUP-06: un proveedor desactivado no bloquea crear uno nuevo activo con el mismo nombre", async () => {
    const name = `Reutilizable TEST ${Date.now()}`;
    const first = await createSupplier(db, { name });
    await deactivateSupplier(db, first.id);

    const second = await createSupplier(db, { name });
    expect(second.id).not.toBe(first.id);
  });
});
