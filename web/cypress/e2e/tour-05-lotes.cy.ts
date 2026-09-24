import { VIEWPORT, quickLogin, pause, goTo, slowType, scrollTour } from "../support/tour";

describe("Tour 05 - Lotes / Produccion", VIEWPORT, () => {
  it("producir un lote", () => {
    quickLogin();
    goTo("nav-lotes-producir");
    cy.get('[data-testid="batch-recipe-select"]').click();
    pause(1800);
    cy.contains('[role="option"]', "Demo Tour Pan Especial").click();
    pause(2000);
    slowType('[data-testid="batch-quantity-input"]', "20");
    cy.get('[data-testid="batch-cost-preview"]', { timeout: 10000 }).should("be.visible");
    pause(2500);
    scrollTour();
    cy.get('[data-testid="batch-produce-button"]').click();
    cy.get('[data-testid="batch-confirm-dialog"]').should("be.visible");
    pause(3500);
    cy.get('[data-testid="batch-confirm-submit"]').click();
    cy.get('[data-testid="batch-success"]', { timeout: 10000 }).should("be.visible");
    pause(3500);
    scrollTour();
  });
});
