import { VIEWPORT, quickLogin, pause, goTo, slowType, scrollTour } from "../support/tour";

describe("Tour 03 - Ingredientes", VIEWPORT, () => {
  const A = "Demo Tour Harina";
  const B = "Demo Tour Azucar";
  const B2 = "Demo Tour Azucar Fina";

  function createIng(name: string, price: string, stock: string) {
    cy.get('[data-testid="ingredient-new-button"]').click();
    pause(1500);
    slowType('[data-testid="ingredient-form-name"]', name);
    cy.get('[data-testid="ingredient-form-unit"]').click();
    pause(1200);
    cy.get('[data-testid="ingredient-form-unit-option-g"]').click();
    pause(1000);
    slowType('[data-testid="ingredient-form-price"]', price);
    cy.get("body").then(($b) => {
      if ($b.find('[data-testid="ingredient-form-stock"]').length) slowType('[data-testid="ingredient-form-stock"]', stock);
    });
    slowType('[data-testid="ingredient-form-minstock"]', "100");
    cy.get('[data-testid="ingredient-form-submit"]').click();
    cy.get('[data-testid="ingredient-create-dialog"]').should("not.exist");
    pause(2000);
  }

  function open(name: string) {
    cy.get('[data-testid="ingredient-search-input"]').clear();
    cy.get('[data-testid="ingredient-search-input"]').type(name, { delay: 80 });
    pause(1500);
    cy.contains('[data-testid="ingredient-row-name"]', name)
      .parents('[data-testid="ingredient-row"]')
      .find('[data-testid="ingredient-view-button"]')
      .click();
    pause(2000);
  }

  it("listar, crear, editar y desactivar", () => {
    quickLogin();
    goTo("nav-ingredientes");
    cy.get('[data-testid="ingredient-row"]').should("have.length.greaterThan", 0);
    scrollTour();
    slowType('[data-testid="ingredient-search-input"]', "Harina");
    pause(2000);
    cy.get('[data-testid="ingredient-search-input"]').clear();
    pause(1000);

    createIng(A, "0.02", "5000");
    createIng(B, "0.015", "2000");

    open(B);
    cy.get('[data-testid="ingredient-edit-button"]').click();
    pause(1500);
    slowType('[data-testid="ingredient-form-name"]', B2);
    cy.get('[data-testid="ingredient-form-submit"]').click();
    cy.get('[data-testid="ingredient-edit-dialog"]').should("not.exist");
    cy.get('[data-testid="ingredient-detail-name"]').should("contain.text", B2);
    pause(2000);
    slowType('[data-testid="ingredient-price-input"]', "0.018");
    cy.get('[data-testid="ingredient-price-submit"]').click();
    cy.get('[data-testid="ingredient-price-success"]').should("be.visible");
    pause(2500);
    scrollTour();

    cy.get('[data-testid="ingredient-delete-button"]').click();
    cy.get('[data-testid="ingredient-delete-dialog"]').should("be.visible");
    pause(2500);
    cy.get('[data-testid="ingredient-delete-confirm"]').click();
    cy.url().should("match", /\/ingredientes$/);
    pause(2000);
    slowType('[data-testid="ingredient-search-input"]', "Demo Tour");
    pause(2500);
  });
});
