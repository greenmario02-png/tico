// E2E: Registrar Venta, contra el backend real (Fastify + Postgres) y la UI
// real de app/web. Como registrar una venta requiere que el producto tenga
// AL MENOS un lote producido (ver saleService.resolveCostPerUnit — VEN-006),
// este spec crea su propio ingrediente + receta + producto + lote vía API
// en un `before()`, igual que lotes.cy.ts, para ser determinista sin
// depender del orden de ejecución de las demás specs.
//
// La verificación central del enunciado ("los números de ganancia/margen
// mostrados coinciden con lo que devolvió la API real, nunca un valor
// hardcodeado") se hace interceptando la respuesta REAL de POST /api/sales
// y comparando cada campo mostrado en la UI contra esa respuesta.

describe("Ventas", () => {
  const runId = Date.now();
  const ingredientName = `Azúcar QA Ventas ${runId}`;
  const recipeName = `Receta QA Ventas ${runId}`;
  const productName = `Producto QA Ventas ${runId}`;
  const SALE_PRICE = "5.00";

  let token: string;
  let ingredientId: string;
  let recipeId: string;
  let productId: string;
  let batch: { id: string; costPerUnitSnapshot: string };

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
            baseUnit: "g",
            initialPricePerBaseUnit: "0.01",
            currentStock: "10000.000",
            minStock: "100",
          },
        });
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
            yieldQuantity: "10",
            yieldUnit: "pieza",
            wastePercent: "0",
            ingredients: [{ ingredientId, quantity: "100", unit: "g" }],
          },
        });
      })
      .then((resp) => {
        expect(resp.status).to.eq(201);
        recipeId = resp.body.id;
        return cy.request({
          method: "POST",
          url: `${Cypress.env("apiUrl")}/products`,
          headers: { Authorization: `Bearer ${token}` },
          body: { recipeId, name: productName, salePrice: SALE_PRICE },
        });
      })
      .then((resp) => {
        expect(resp.status).to.eq(201);
        productId = resp.body.id;
        return cy.request({
          method: "POST",
          url: `${Cypress.env("apiUrl")}/batches`,
          headers: { Authorization: `Bearer ${token}` },
          body: { recipeId, requestedUnits: "10", productId },
        });
      })
      .then((resp) => {
        expect(resp.status).to.eq(201);
        batch = resp.body;
      });
  });

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.screenshot("ventas-01-login");
  });

  it("Registrar venta: los números de ganancia/margen mostrados coinciden con la respuesta real de la API", () => {
    cy.get('[data-testid="nav-ventas-registrar"]').click();
    cy.get('[data-testid="sale-product-select"]').should("be.visible");
    cy.screenshot("ventas-02-formulario-vacio");

    cy.get('[data-testid="sale-product-select"]').click();
    cy.contains('[role="option"]', productName).click();

    // El precio de venta se autocompleta con product.salePrice; lo dejamos,
    // solo cambiamos la cantidad a vender.
    cy.get('[data-testid="sale-quantity-input"]').clear().type("4");
    cy.get('[data-testid="sale-price-input"]').should("have.value", SALE_PRICE);
    cy.get('[data-testid="sale-total-preview"]').should("contain.text", (4 * Number(SALE_PRICE)).toFixed(2));
    cy.screenshot("ventas-03-formulario-completo");

    cy.intercept("POST", "**/api/sales").as("registerSale");
    cy.get('[data-testid="sale-submit-button"]').click();

    cy.wait("@registerSale").then((interception) => {
      expect(interception.response?.statusCode).to.eq(201);
      const sale = interception.response?.body;

      // La ganancia real y el margen real vienen calculados por el backend
      // (nunca recalculados en el cliente) — se compara la UI 1:1 contra
      // esos valores reales, no contra un cálculo propio del test.
      cy.get('[data-testid="sale-success"]', { timeout: 10000 }).should("be.visible");
      cy.get('[data-testid="sale-success-quantity"]').should("contain.text", sale.quantity);
      cy.get('[data-testid="sale-success-price"]').should("contain.text", sale.salePricePerUnit);
      cy.get('[data-testid="sale-success-cost"]').should("contain.text", sale.costPerUnitSnapshot);
      cy.get('[data-testid="sale-success-revenue"]').should("contain.text", sale.revenue);
      cy.get('[data-testid="sale-success-profit"]').should("contain.text", sale.realProfit);
      cy.get('[data-testid="sale-success-profit"]').should("contain.text", `${sale.realMarginPercent}%`);
      cy.screenshot("ventas-04-exito-ganancia-real");

      // El costo congelado usado por la venta debe ser el snapshot del
      // lote producido en el before() (nunca recalculado con el costo
      // actual del ingrediente).
      expect(sale.costPerUnitSnapshot).to.eq(batch.costPerUnitSnapshot);

      // Verificación independiente vía API: GET /sales/:id (a través del
      // listado, ya que no hay GET /sales/:id individual) refleja el mismo
      // registro real en la base de datos.
      cy.request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}/sales`,
        qs: { productId },
        headers: { Authorization: `Bearer ${token}` },
      }).then((listResp) => {
        expect(listResp.status).to.eq(200);
        const found = listResp.body.data.find((s: { id: string }) => s.id === sale.id);
        expect(found, "la venta debe existir en GET /sales").to.exist;
        expect(found.realProfit).to.eq(sale.realProfit);
        expect(found.batchId).to.eq(batch.id);
      });
    });
  });
});
