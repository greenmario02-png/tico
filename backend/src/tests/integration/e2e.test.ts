import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app";
import { db, pool } from "../../db/client";
import { users } from "../../db/schema/index";
import { hashPassword, signAccessToken } from "../../lib/auth";

/**
 * SDD-09 §9 — T-E2E-01 y T-E2E-02: flujo completo end-to-end vía HTTP real
 * (`app.inject()`), sin mocks, contra la base de datos de prueba:
 * ingrediente → receta → lote → venta → reporte de rentabilidad.
 */
describe("E2E — flujo completo panadería (SDD-09 §9)", () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    const [admin] = await db
      .insert(users)
      .values({
        name: "Admin E2E TEST",
        email: `admin_e2e_${Date.now()}_${Math.random()}@test.local`,
        passwordHash: await hashPassword("clave_segura_1234"),
        role: "admin",
      })
      .returning();
    token = signAccessToken(admin.id, "admin").token;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  function authHeaders() {
    return { authorization: `Bearer ${token}` };
  }

  async function createIngredient(name: string, baseUnit: string, currentStock: string, pricePerBaseUnit: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/ingredients",
      headers: authHeaders(),
      payload: {
        name: `${name} E2E ${Date.now()}_${Math.random()}`,
        baseUnit,
        currentStock,
        minStock: "0",
        initialPricePerBaseUnit: pricePerBaseUnit,
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json();
  }

  it("T-E2E-01: flujo simple sin receta anidada (Pan de Molde)", async () => {
    const harina = await createIngredient("Harina de trigo", "g", "50000", "0.0135");
    const azucar = await createIngredient("Azúcar blanca", "g", "20000", "0.008");
    const mantequilla = await createIngredient("Mantequilla", "g", "10000", "0.032");
    const huevos = await createIngredient("Huevos", "pieza", "200", "0.60");
    const leche = await createIngredient("Leche", "ml", "30000", "0.0035");
    const levadura = await createIngredient("Levadura", "g", "500", "0.04");

    const recipeRes = await app.inject({
      method: "POST",
      url: "/api/recipes",
      headers: authHeaders(),
      payload: {
        name: `Pan de Molde E2E ${Date.now()}`,
        yieldQuantity: "24.00",
        yieldUnit: "pieza",
        wastePercent: "5",
        ingredients: [
          { ingredientId: harina.id, quantity: "1.000", unit: "kg" },
          { ingredientId: azucar.id, quantity: "0.500", unit: "kg" },
          { ingredientId: mantequilla.id, quantity: "0.300", unit: "kg" },
          { ingredientId: huevos.id, quantity: "10.000", unit: "pieza" },
          { ingredientId: leche.id, quantity: "0.500", unit: "l" },
          { ingredientId: levadura.id, quantity: "5.000", unit: "g" },
        ],
      },
    });
    expect(recipeRes.statusCode).toBe(201);
    const recipe = recipeRes.json();

    const costRes = await app.inject({ method: "GET", url: `/api/recipes/${recipe.id}/cost`, headers: authHeaders() });
    expect(costRes.statusCode).toBe(200);
    const costBody = costRes.json();
    expect(Number(costBody.costPerUnit)).toBeCloseTo(1.54, 1);

    const productRes = await app.inject({
      method: "POST",
      url: "/api/products",
      headers: authHeaders(),
      payload: { recipeId: recipe.id, name: `Pan de Molde E2E ${Date.now()}`, salePrice: "2.50" },
    });
    expect(productRes.statusCode).toBe(201);
    const product = productRes.json();

    const batchRes = await app.inject({
      method: "POST",
      url: "/api/batches",
      headers: authHeaders(),
      payload: { recipeId: recipe.id, requestedUnits: "50.00", productId: product.id },
    });
    expect(batchRes.statusCode).toBe(201);
    const batch = batchRes.json();
    expect(Number(batch.scaleFactor)).toBeCloseTo(2.0833, 3);
    expect(Number(batch.totalCostSnapshot)).toBeCloseTo(76.86, 1);
    expect(Number(batch.costPerUnitSnapshot)).toBeCloseTo(1.54, 1);

    const harinaAfter = await app.inject({ method: "GET", url: `/api/ingredients/${harina.id}`, headers: authHeaders() });
    expect(Number(harinaAfter.json().currentStock)).toBeCloseTo(47807.02, 0);

    const saleRes = await app.inject({
      method: "POST",
      url: "/api/sales",
      headers: authHeaders(),
      payload: { productId: product.id, batchId: batch.id, quantity: "20", salePricePerUnit: "2.50" },
    });
    expect(saleRes.statusCode).toBe(201);
    const sale = saleRes.json();
    expect(sale.costPerUnitSnapshot).toBe(batch.costPerUnitSnapshot);
    expect(Number(sale.revenue)).toBeCloseTo(50.0, 2);

    const reportRes = await app.inject({
      method: "GET",
      url: `/api/reports/profitability?productId=${product.id}`,
      headers: authHeaders(),
    });
    expect(reportRes.statusCode).toBe(200);
    const report = reportRes.json();
    expect(report.data).toHaveLength(1);
    expect(Number(report.data[0].totalRevenue)).toBeCloseTo(50.0, 1);
    expect(Number(report.data[0].totalCost)).toBeCloseTo(30.8, 0);
    expect(Number(report.data[0].totalRealProfit)).toBeCloseTo(19.2, 0);
    expect(Number(report.data[0].realMarginPercent)).toBeCloseTo(38.4, 0);
  });

  it("T-E2E-02: flujo con receta anidada, sin merma (Masa Base -> Pan Relleno)", async () => {
    const harina = await createIngredient("Harina Anidada", "g", "10000", "0.0135");
    const levadura = await createIngredient("Levadura Anidada", "g", "500", "0.04");
    const azucar = await createIngredient("Azúcar Anidada", "g", "5000", "0.008");
    const mantequilla = await createIngredient("Mantequilla Anidada", "g", "5000", "0.032");

    const masaBaseRes = await app.inject({
      method: "POST",
      url: "/api/recipes",
      headers: authHeaders(),
      payload: {
        name: `Masa Base E2E ${Date.now()}`,
        yieldQuantity: "10.00",
        yieldUnit: "pieza",
        wastePercent: "0",
        ingredients: [
          { ingredientId: harina.id, quantity: "500.000", unit: "g" },
          { ingredientId: levadura.id, quantity: "5.000", unit: "g" },
        ],
      },
    });
    expect(masaBaseRes.statusCode).toBe(201);
    const masaBase = masaBaseRes.json();

    const panRellenoRes = await app.inject({
      method: "POST",
      url: "/api/recipes",
      headers: authHeaders(),
      payload: {
        name: `Pan Relleno E2E ${Date.now()}`,
        yieldQuantity: "5.00",
        yieldUnit: "pieza",
        wastePercent: "0",
        ingredients: [
          { subRecipeId: masaBase.id, quantity: "2.000", unit: "pieza" },
          { ingredientId: azucar.id, quantity: "200.000", unit: "g" },
          { ingredientId: mantequilla.id, quantity: "100.000", unit: "g" },
        ],
      },
    });
    expect(panRellenoRes.statusCode).toBe(201);
    const panRelleno = panRellenoRes.json();

    const costRes = await app.inject({ method: "GET", url: `/api/recipes/${panRelleno.id}/cost`, headers: authHeaders() });
    expect(Number(costRes.json().costPerUnit)).toBeCloseTo(1.24, 1);

    const productRes = await app.inject({
      method: "POST",
      url: "/api/products",
      headers: authHeaders(),
      payload: { recipeId: panRelleno.id, name: `Pan Relleno E2E ${Date.now()}`, salePrice: "2.00" },
    });
    const product = productRes.json();

    const batchRes = await app.inject({
      method: "POST",
      url: "/api/batches",
      headers: authHeaders(),
      payload: { recipeId: panRelleno.id, requestedUnits: "5.00", productId: product.id },
    });
    expect(batchRes.statusCode).toBe(201);
    const batch = batchRes.json();
    expect(Number(batch.scaleFactor)).toBeCloseTo(1.0, 2);
    expect(Number(batch.costPerUnitSnapshot)).toBeCloseTo(1.24, 1);
    expect(Number(batch.totalCostSnapshot)).toBeCloseTo(6.19, 1);

    const saleRes = await app.inject({
      method: "POST",
      url: "/api/sales",
      headers: authHeaders(),
      payload: { productId: product.id, batchId: batch.id, quantity: "5", salePricePerUnit: "2.00" },
    });
    expect(saleRes.statusCode).toBe(201);

    const reportRes = await app.inject({
      method: "GET",
      url: `/api/reports/profitability?productId=${product.id}`,
      headers: authHeaders(),
    });
    const report = reportRes.json();
    expect(Number(report.data[0].totalRevenue)).toBeCloseTo(10.0, 1);
    expect(Number(report.data[0].totalCost)).toBeCloseTo(6.2, 0);
    expect(Number(report.data[0].totalRealProfit)).toBeCloseTo(3.8, 0);
    expect(Number(report.data[0].realMarginPercent)).toBeCloseTo(38, 0);
  });

  it("Verificación manual del flujo: producto con receta pero sin lote se rechaza al vender (VEN-006)", async () => {
    const harina = await createIngredient("Harina Sin Lote E2E", "g", "1000", "0.0135");
    const recipeRes = await app.inject({
      method: "POST",
      url: "/api/recipes",
      headers: authHeaders(),
      payload: {
        name: `Receta Sin Lote E2E ${Date.now()}`,
        yieldQuantity: "1.00",
        yieldUnit: "pieza",
        wastePercent: "0",
        ingredients: [{ ingredientId: harina.id, quantity: "10.000", unit: "g" }],
      },
    });
    const recipe = recipeRes.json();
    const productRes = await app.inject({
      method: "POST",
      url: "/api/products",
      headers: authHeaders(),
      payload: { recipeId: recipe.id, name: `Producto Sin Lote E2E ${Date.now()}` },
    });
    const product = productRes.json();

    const saleRes = await app.inject({
      method: "POST",
      url: "/api/sales",
      headers: authHeaders(),
      payload: { productId: product.id, quantity: "1", salePricePerUnit: "5.00" },
    });
    expect(saleRes.statusCode).toBe(409);
    expect(saleRes.json().error.code).toBe("CONFLICT");
  });

  it("Verificación manual: GET /api/inventory y /api/inventory/movements devuelven datos reales", async () => {
    const harina = await createIngredient("Harina Kardex E2E", "g", "5000", "0.0135");

    const invRes = await app.inject({ method: "GET", url: "/api/inventory?pageSize=200", headers: authHeaders() });
    expect(invRes.statusCode).toBe(200);
    const invBody = invRes.json();
    const row = invBody.data.find((r: { id: string }) => r.id === harina.id);
    expect(row).toBeDefined();
    expect(Number(row.stockValue)).toBeCloseTo(5000 * 0.0135, 2);

    const movRes = await app.inject({
      method: "GET",
      url: `/api/inventory/movements?ingredientId=${harina.id}&from=2020-01-01`,
      headers: authHeaders(),
    });
    expect(movRes.statusCode).toBe(200);
  });
});
