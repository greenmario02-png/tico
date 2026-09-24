// E2E: Inventario, contra el backend real (Fastify + Postgres) y la UI real
// de app/web.
//
// HALLAZGO IMPORTANTE (no es un bug de este spec, es una limitación real de
// la UI actual): el backend expone GET /api/inventory/movements (kardex de
// movimientos: compra, uso_producción, ajuste, merma — ver
// app/backend/src/routes/inventory.ts), pero app/web/src/pages/inventory/
// InventoryPage.tsx SOLO renderiza el resumen de stock actual; no existe
// ninguna vista de kardex/movimientos en la UI todavía. Por eso este spec:
//   1) prueba por UI el listado de inventario real (lo que SÍ existe), y
//   2) verifica por API DIRECTA (no por UI, porque no hay dónde hacerlo)
//      que un lote producido genera una fila de movimiento real de tipo
//      "uso_produccion" — dejando documentado que falta la pantalla de
//      kardex en la UI, sin inventar una que no existe.

describe("Inventario", () => {
  const runId = Date.now();
  const ingredientName = `Leche QA Inventario ${runId}`;
  const recipeName = `Receta QA Inventario ${runId}`;

  let token: string;
  let ingredientId: string;
  let recipeId: string;

  before(() => {
    cy.apiLoginAsAdmin().then((t) => {
      token = t;
      return cy
        .request({
          method: "POST",
          url: `${Cypress.env("apiUrl")}/ingredients`,
          headers: { Authorization: `Bearer ${token}` },
          body: {
            name: ingredientName,
            baseUnit: "ml",
            initialPricePerBaseUnit: "0.01",
            currentStock: "3000.000",
            minStock: "100",
          },
        })
        .then((resp) => {
          expect(resp.status).to.eq(201);
          ingredientId = resp.body.id;
          return cy.request({
            method: "POST",
            url: `${Cypress.env("apiUrl")}/recipes`,
            headers: { Authorization: `Bearer ${token}` },
            body: {
              name: recipeName,
              yieldQuantity: "5",
              yieldUnit: "pieza",
              wastePercent: "0",
              ingredients: [{ ingredientId, quantity: "500", unit: "ml" }],
            },
          });
        })
        .then((resp) => {
          expect(resp.status).to.eq(201);
          recipeId = resp.body.id;
          return cy.request({
            method: "POST",
            url: `${Cypress.env("apiUrl")}/batches`,
            headers: { Authorization: `Bearer ${token}` },
            body: { recipeId, requestedUnits: "5" },
          });
        })
        .then((resp) => {
          expect(resp.status).to.eq(201);
        });
    });
  });

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.screenshot("inventario-01-login");
  });

  it("Listado: muestra el resumen de valor en stock y filas reales de ingredientes", () => {
    cy.get('[data-testid="nav-inventario"]').click();
    cy.get('[data-testid="inventory-summary-total"]').should("be.visible").and("contain.text", "Bs");
    cy.get('[data-testid="inventory-row"]').should("have.length.greaterThan", 0);
    cy.contains('[data-testid="inventory-row-name"]', "Harina de trigo").should("be.visible");
    cy.screenshot("inventario-02-listado-real");

    // Nota: InventoryPage.tsx pide pageSize=200 pero el backend recorta a
    // MAX_PAGE_SIZE=100 (ver app/backend/src/lib/pagination.ts) y ordena por
    // nombre sin filtro de búsqueda (a diferencia de Ingredientes/Recetas,
    // esta pantalla no tiene un input de búsqueda) — con muchos ingredientes
    // sembrados/creados por otras specs, el ingrediente recién creado en
    // este spec podría no caer dentro de la primera página. Por eso la
    // verificación de que el LOTE descontó exactamente el stock esperado se
    // hace por API directa (independiente y determinista), no buscándolo en
    // la tabla renderizada.
    cy.request({
      method: "GET",
      url: `${Cypress.env("apiUrl")}/ingredients/${ingredientId}`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((resp) => {
      expect(resp.status).to.eq(200);
      expect(Number(resp.body.currentStock)).to.eq(2500);
    });
    cy.screenshot("inventario-03-listado-completo");

    // Verificación cruzada contra la API real: el valor total en stock
    // mostrado en la tarjeta resumen coincide con lo que reporta el backend.
    cy.request({
      method: "GET",
      url: `${Cypress.env("apiUrl")}/inventory`,
      qs: { pageSize: 200 },
      headers: { Authorization: `Bearer ${token}` },
    }).then((resp) => {
      expect(resp.status).to.eq(200);
      cy.get('[data-testid="inventory-summary-total"]').should("contain.text", resp.body.summary.totalStockValue);
    });
  });

  it("Kardex (verificación por API, la UI todavía no tiene esta pantalla): el lote producido generó un movimiento real de uso_producción", () => {
    cy.request({
      method: "GET",
      url: `${Cypress.env("apiUrl")}/inventory/movements`,
      qs: { ingredientId, movementType: "uso_produccion" },
      headers: { Authorization: `Bearer ${token}` },
    }).then((resp) => {
      expect(resp.status).to.eq(200);
      expect(resp.body.data.length).to.be.greaterThan(0);
      const movement = resp.body.data[0];
      expect(movement.ingredientId).to.eq(ingredientId);
      // El consumo por producción se registra como NEGATIVO (descuento de
      // stock), ver batchService.ts: quantityBaseUnit = -neededBeforeWaste.
      expect(Number(movement.quantityBaseUnit)).to.eq(-500);
    });
  });
});
