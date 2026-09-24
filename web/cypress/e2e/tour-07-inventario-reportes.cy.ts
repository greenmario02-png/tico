import { VIEWPORT, quickLogin, pause, goTo, scrollTour } from "../support/tour";

describe("Tour 07 - Inventario y Reportes", VIEWPORT, () => {
  it("inventario y reportes", () => {
    quickLogin();
    goTo("nav-inventario");
    cy.get('[data-testid="inventory-summary-total"]').should("be.visible");
    pause(2500);
    scrollTour();
    cy.get('[data-testid="inventory-view-movements-button"]').click();
    cy.get('[data-testid="inventory-movements-view"]').should("be.visible");
    pause(3000);
    scrollTour();
    cy.get('[data-testid="inventory-view-stock-button"]').click();
    pause(2000);

    goTo("nav-reportes");
    cy.get('[data-testid="reports-profitability-table"]', { timeout: 10000 }).should("be.visible");
    pause(3000);
    scrollTour(2500);
    cy.get('[data-testid="reports-production-table"]').scrollIntoView({ duration: 1000 });
    pause(3000);
  });
});
