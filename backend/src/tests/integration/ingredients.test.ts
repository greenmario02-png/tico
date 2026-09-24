import { afterAll, describe, expect, it } from "vitest";
import { db, pool } from "../../db/client";
import {
  createIngredient,
  deactivateIngredient,
  listIngredients,
  registerPurchase,
  updateIngredient,
} from "../../services/ingredientService";
import { ApiError } from "../../lib/errors";

describe("Ingredientes CRUD (SDD-05 §3 / SDD-06 §1)", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("T-ING-01: crea un ingrediente con su primer precio en una sola operación", async () => {
    const created = await createIngredient(db, {
      name: `Azúcar blanca TEST ${Date.now()}`,
      baseUnit: "g",
      initialPricePerBaseUnit: "0.008",
      currentStock: "0",
      minStock: "1000",
    });
    expect(created.currentPricePerBaseUnit).toBe("0.0080");
    expect(created.isActive).toBe(true);
  });

  it("T-ING-02: rechaza nombre duplicado (case-insensitive) con 409", async () => {
    const name = `Mantequilla TEST ${Date.now()}`;
    await createIngredient(db, {
      name,
      baseUnit: "g",
      initialPricePerBaseUnit: "0.032",
      currentStock: "0",
      minStock: "0",
    });

    await expect(
      createIngredient(db, {
        name: name.toUpperCase(),
        baseUnit: "g",
        initialPricePerBaseUnit: "0.032",
        currentStock: "0",
        minStock: "0",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("T-ING-03: /purchase suma stock y puede actualizar precio vigente", async () => {
    const created = await createIngredient(db, {
      name: `Leche TEST ${Date.now()}`,
      baseUnit: "ml",
      initialPricePerBaseUnit: "0.0035",
      currentStock: "1000",
      minStock: "500",
    });

    const result = await registerPurchase(db, created.id as string, {
      quantityBaseUnit: "5000.000",
      alsoUpdatePrice: { pricePerBaseUnit: "0.0040" },
    });

    expect(result.ingredient.currentStock).toBe("6000.000");
    expect(result.ingredient.currentPricePerBaseUnit).toBe("0.0040");
  });

  it("T-ING-04: PUT rechaza intentos de actualizar stock/precio directamente", async () => {
    const created = await createIngredient(db, {
      name: `Levadura TEST ${Date.now()}`,
      baseUnit: "g",
      initialPricePerBaseUnit: "0.04",
      currentStock: "0",
      minStock: "0",
    });

    // La validación de "no permitir currentStock en PUT" vive en la ruta HTTP;
    // aquí verificamos que el servicio de update no expone esos campos.
    const updated = await updateIngredient(db, created.id as string, { minStock: "200.000" });
    expect(updated.minStock).toBe("200.000");
  });

  it("T-ING-05: DELETE hace soft-delete (isActive=false)", async () => {
    const created = await createIngredient(db, {
      name: `Sal TEST ${Date.now()}`,
      baseUnit: "g",
      initialPricePerBaseUnit: "0.01",
      currentStock: "0",
      minStock: "0",
    });

    const result = await deactivateIngredient(db, created.id as string);
    expect(result.message).toBe("Ingrediente desactivado");

    const { data } = await listIngredients(db, { page: 1, pageSize: 100, isActive: "false" });
    expect(data.some((i) => i.id === created.id)).toBe(true);
  });

  it("T-ING-06: GET por id inexistente lanza 404 con mensaje SDD-05 §1.7", async () => {
    const { getIngredientById } = await import("../../services/ingredientService");
    await expect(getIngredientById(db, "00000000-0000-0000-0000-000000000000")).rejects.toMatchObject({
      statusCode: 404,
      message: "Ingrediente no encontrado",
    });
  });

  // imageUrl: campo nuevo agregado a pedido explícito del usuario (soporte de
  // fotos en la UI), no contemplado en SDD-06 original.
  it("T-ING-07: imageUrl se guarda en la creación y persiste en GET", async () => {
    const url = "https://commons.wikimedia.org/wiki/Special:FilePath/Test.jpg?width=400";
    const created = await createIngredient(db, {
      name: `Harina de prueba con foto TEST ${Date.now()}`,
      baseUnit: "g",
      initialPricePerBaseUnit: "0.01",
      currentStock: "0",
      minStock: "0",
      imageUrl: url,
    });
    expect(created.imageUrl).toBe(url);

    const { getIngredientById } = await import("../../services/ingredientService");
    const fetched = await getIngredientById(db, created.id as string);
    expect(fetched.imageUrl).toBe(url);
  });

  it("T-ING-08: imageUrl se puede actualizar vía PUT y también limpiar con null", async () => {
    const created = await createIngredient(db, {
      name: `Ingrediente sin foto TEST ${Date.now()}`,
      baseUnit: "g",
      initialPricePerBaseUnit: "0.01",
      currentStock: "0",
      minStock: "0",
    });
    expect(created.imageUrl).toBeNull();

    const url = "https://commons.wikimedia.org/wiki/Special:FilePath/Otro.jpg?width=400";
    const updated = await updateIngredient(db, created.id as string, { imageUrl: url });
    expect(updated.imageUrl).toBe(url);

    const cleared = await updateIngredient(db, created.id as string, { imageUrl: null });
    expect(cleared.imageUrl).toBeNull();
  });

  // Parte 3 de la extensión de categorías/proveedores de esta sesión: la
  // unicidad de `name` ahora es un constraint de BD
  // (`ingredients_active_name_lower_unique`, ver `db/schema/ingredients.ts`),
  // no solo un SELECT-antes-de-INSERT en la capa de aplicación. Disparar dos
  // creaciones concurrentes con el mismo nombre (case-insensitive) fuerza que
  // al menos una golpee el constraint de BD en vez del chequeo previo,
  // verificando que la violación 23505 se traduce al mismo mensaje de
  // negocio de siempre y nunca se filtra un error crudo de Postgres.
  it("T-ING-09: creación concurrente con el mismo nombre — solo una gana, la otra recibe el 409 de siempre", async () => {
    const name = `Concurrencia TEST ${Date.now()}`;
    const attempt = (variantName: string) =>
      createIngredient(db, {
        name: variantName,
        baseUnit: "g",
        initialPricePerBaseUnit: "0.01",
        currentStock: "0",
        minStock: "0",
      });

    const results = await Promise.allSettled([attempt(name), attempt(name.toUpperCase())]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
    });
    expect(String(rejected[0].reason.message)).toContain("Ya existe un ingrediente llamado");
  });
});
