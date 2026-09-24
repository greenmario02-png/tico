// E2E: Reportes (rentabilidad por producto y producción por receta), contra
// el backend real (Fastify + Postgres) y la UI real de app/web.
//
// Igual que lotes.cy.ts/ventas.cy.ts, este spec crea su propio ingrediente +
// receta + producto + lote + venta vía API en un `before()` para garantizar
// que, sin importar qué otras specs corrieron antes, SIEMPRE hay al menos
// una fila real y verificable en ambos reportes dentro del rango de fechas
// por defecto (mes actual, que es el que la UI precarga).

describe("Reportes", () => {
  const runId = Date.now();
  const ingredientName = `Vainilla QA Reportes ${runId}`;
  const recipeName = `Receta QA Reportes ${runId}`;
  const productName = `Producto QA Reportes ${runId}`;
  const SALE_PRICE = "8.00";
  const SALE_QTY = "3";

  let token: string;
  let expectedSale: { revenue: string; realProfit: string; realMarginPercent: string };
  let expectedBatch: { totalCostSnapshot: string };

  before(() => {
    cy.apiLoginAsAdmin()
      .then((t) => {
        token = t;
        return cy.request({
          method: "POST",
          url: `${Cypress.env("apiUrl")}/ingredients`,
          headers: { Authorization: `Bearer ${token}` },
          body: {
            name: ingredientName,
            baseUnit: "ml",
            initialPricePerBaseUnit: "0.1",
            currentStock: "2000.000",
            minStock: "50",
          },
        });
      })
      .then((resp) => {
        expect(resp.status).to.eq(201);
        return cy.request({
          method: "POST",
          url: `${Cypress.env("apiUrl")}/recipes`,
          headers: { Authorization: `Bearer ${token}` },
          body: {
            name: recipeName,
            yieldQuantity: "10",
            yieldUnit: "pieza",
            wastePercent: "0",
            ingredients: [{ ingredientId: resp.body.id, quantity: "100", unit: "ml" }],
          },
        });
      })
      .then((resp) => {
        expect(resp.status).to.eq(201);
        const recipeId = resp.body.id;
        return cy.request({
          method: "POST",
          url: `${Cypress.env("apiUrl")}/products`,
          headers: { Authorization: `Bearer ${token}` },
          body: { recipeId, name: productName, salePrice: SALE_PRICE },
        });
      })
      .then((resp) => {
        expect(resp.status).to.eq(201);
        const productId = resp.body.id;
        return cy
          .request({
            method: "POST",
            url: `${Cypress.env("apiUrl")}/batches`,
            headers: { Authorization: `Bearer ${token}` },
            body: { recipeId: resp.body.recipeId, requestedUnits: "10", productId },
          })
          .then((batchResp) => {
            expect(batchResp.status).to.eq(201);
            expectedBatch = batchResp.body;
            return cy.request({
              method: "POST",
              url: `${Cypress.env("apiUrl")}/sales`,
              headers: { Authorization: `Bearer ${token}` },
              body: { productId, quantity: SALE_QTY, salePricePerUnit: SALE_PRICE },
            });
          });
      })
      .then((saleResp) => {
        expect(saleResp.status).to.eq(201);
        expectedSale = saleResp.body;
      });
  });

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.screenshot("reportes-01-login");
  });

  it("Rentabilidad por producto: la fila del producto QA muestra los números reales devueltos por la API", () => {
    cy.get('[data-testid="nav-reportes"]').click();
    cy.get('[data-testid="reports-profitability-table"]', { timeout: 10000 }).should("be.visible");
    cy.get('[data-testid="reports-profitability-row"]').should("have.length.greaterThan", 0);
    cy.screenshot("reportes-02-rentabilidad-listado");

    // Aserción estructural: todas las filas tienen ganancia numérica válida
    // (no NaN, no vacío) — no se hardcodea un valor esperado global porque
    // el conjunto de ventas depende de qué otras specs corrieron antes.
    cy.get('[data-testid="reports-profitability-profit"]').each(($el) => {
      const text = $el.text().replace("Bs", "").trim();
      expect(Number.isNaN(Number(text)), `"${text}" debe ser numérico`).to.eq(false);
    });

    // Aserción precisa: la fila del producto creado en este spec coincide
    // EXACTAMENTE con lo que devolvió POST /sales en el before().
    cy.contains('[data-testid="reports-profitability-row"]', productName).within(() => {
      cy.get('[data-testid="reports-profitability-profit"]').should("contain.text", expectedSale.realProfit);
      cy.get('[data-testid="reports-profitability-margin"]').should("contain.text", expectedSale.realMarginPercent);
    });
    cy.screenshot("reportes-03-rentabilidad-fila-verificada");
  });

  it("Producción por receta: la fila de la receta QA muestra el costo de producción real del lote", () => {
    cy.get('[data-testid="nav-reportes"]').click();
    cy.get('[data-testid="reports-production-table"]', { timeout: 10000 }).should("be.visible");
    cy.get('[data-testid="reports-production-row"]').should("have.length.greaterThan", 0);
    cy.screenshot("reportes-04-produccion-listado");

    cy.contains('[data-testid="reports-production-row"]', recipeName).within(() => {
      cy.get('[data-testid="reports-production-profit"]')
        .invoke("text")
        .then((text) => {
          expect(Number.isNaN(Number(text.replace("Bs", "").trim()))).to.eq(false);
        });
    });

    // Verificación cruzada contra la API real del reporte de producción
    // (mismo rango de fechas que usa la UI por defecto: mes actual).
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString().slice(0, 10);
    cy.request({
      method: "GET",
      url: `${Cypress.env("apiUrl")}/reports/production`,
      qs: { from, to, pageSize: 200 },
      headers: { Authorization: `Bearer ${token}` },
    }).then((resp) => {
      expect(resp.status).to.eq(200);
      const row = resp.body.data.find((r: { recipeName: string | null }) => r.recipeName === recipeName);
      expect(row, "la receta QA debe aparecer en el reporte de producción").to.exist;
      expect(row.totalProductionCost).to.eq(expectedBatch.totalCostSnapshot);
      cy.contains('[data-testid="reports-production-row"]', recipeName).should(
        "contain.text",
        row.totalProductionCost,
      );
    });
    cy.screenshot("reportes-05-produccion-fila-verificada");
  });
});
