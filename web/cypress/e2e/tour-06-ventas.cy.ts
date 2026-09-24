import { VIEWPORT, quickLogin, pause, goTo, slowType, scrollTour, api } from "../support/tour";

describe("Tour 06 - Ventas", VIEWPORT, () => {
  const PRODUCT = "Demo Tour Pan Especial (venta)";

  before(() => {
    // Preparacion silenciosa (antes de la UI): producto vendible + lote con stock para el producto.
    api("GET", "/recipes?search=Demo%20Tour%20Pan%20Especial").then((r) => {
      const rec = (r.body.data ?? r.body.items ?? r.body).find((x: { name: string }) => x.name === "Demo Tour Pan Especial");
      api("POST", "/products", { recipeId: rec.id, name: PRODUCT, salePrice: "3.50" }).then((p) => {
        expect(p.status).to.eq(201);
        api("POST", "/batches", { recipeId: rec.id, requestedUnits: "10", productId: p.body.id }).then((b) => {
          expect(b.status).to.eq(201);
        });
      });
    });
  });

  it("registrar una venta", () => {
    quickLogin();
    goTo("nav-ventas-registrar");
    cy.get('[data-testid="sale-product-select"]').click();
    pause(1800);
    cy.contains('[role="option"]', PRODUCT).click();
    pause(2000);
    slowType('[data-testid="sale-quantity-input"]', "4");
    cy.get('[data-testid="sale-total-preview"]').should("be.visible");
    pause(2500);
    cy.get('[data-testid="sale-submit-button"]').click();
    cy.get('[data-testid="sale-success"]', { timeout: 10000 }).should("be.visible");
    pause(3500);
    scrollTour();
  });
});
