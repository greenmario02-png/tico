import { afterAll, describe, expect, it } from "vitest";
import { db, pool } from "../../db/client";
import { ingredients } from "../../db/schema/index";
import {
  createCategory,
  deleteCategory,
  getCategoryById,
  listCategories,
  updateCategory,
} from "../../services/categoryService";

describe("Categorías CRUD (SDD-05 §4)", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("T-CAT-01: crea una categoría de ingrediente", async () => {
    const created = await createCategory(db, { name: `Harinas TEST ${Date.now()}`, kind: "ingrediente" });
    expect(created.kind).toBe("ingrediente");

    const fetched = await getCategoryById(db, created.id);
    expect(fetched.name).toBe(created.name);
  });

  it("T-CAT-02: rechaza nombre duplicado dentro del mismo kind con 409", async () => {
    const name = `Lácteos TEST ${Date.now()}`;
    await createCategory(db, { name, kind: "ingrediente" });

    await expect(createCategory(db, { name: name.toUpperCase(), kind: "ingrediente" })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("T-CAT-03: permite el mismo nombre en kinds distintos (constraint es (name, kind))", async () => {
    const name = `Postres TEST ${Date.now()}`;
    const ingredienteCat = await createCategory(db, { name, kind: "ingrediente" });
    const recetaCat = await createCategory(db, { name, kind: "receta" });
    expect(ingredienteCat.id).not.toBe(recetaCat.id);
  });

  it("T-CAT-04: PUT solo permite editar name, kind es inmutable", async () => {
    const created = await createCategory(db, { name: `Especias TEST ${Date.now()}`, kind: "ingrediente" });
    const updated = await updateCategory(db, created.id, { name: `Especias Editado TEST ${Date.now()}` });
    expect(updated.kind).toBe("ingrediente");
  });

  it("T-CAT-05: DELETE bloqueado si hay ingredientes activos usando la categoría (409)", async () => {
    const created = await createCategory(db, { name: `Chocolates TEST ${Date.now()}`, kind: "ingrediente" });
    await db.insert(ingredients).values({
      name: `Chocolate Amargo TEST ${Date.now()}`,
      categoryId: created.id,
      baseUnit: "g",
      currentStock: "0",
      minStock: "0",
    });

    await expect(deleteCategory(db, created.id)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("T-CAT-06: DELETE físico permitido si nada la referencia", async () => {
    const created = await createCategory(db, { name: `Sin Uso TEST ${Date.now()}`, kind: "receta" });
    const result = await deleteCategory(db, created.id);
    expect(result.message).toBe("Categoría eliminada");
    await expect(getCategoryById(db, created.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("T-CAT-07: filtra listado por kind", async () => {
    const marker = `Filtro TEST ${Date.now()}`;
    await createCategory(db, { name: marker, kind: "receta" });
    const { data } = await listCategories(db, { page: 1, pageSize: 100, kind: "receta" });
    expect(data.every((c) => c.kind === "receta")).toBe(true);
    expect(data.some((c) => c.name === marker)).toBe(true);
  });
});
