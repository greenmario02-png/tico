import { VIEWPORT, quickLogin, pause, goTo, slowType, scrollTour } from "../support/tour";

describe("Tour 04 - Recetas", VIEWPORT, () => {
  const BASE = "Demo Tour Masa Base";
  const FINAL = "Demo Tour Pan Especial";

  function addIngredient(name: string, qty: string, idx: number) {
    cy.get('[data-testid="recipe-form-add-ingredient"]').click();
    pause(1000);
    cy.get('[data-testid="recipe-form-line"]').eq(idx).within(() => {
      cy.get('[data-testid="ingredient-picker-search"]').type(name, { delay: 80 });
    });
    pause(1200);
    cy.contains('[data-testid="ingredient-picker-option"]', name).click();
    pause(800);
    cy.get('[data-testid="recipe-form-line"]').eq(idx).find('[data-testid="recipe-form-line-quantity"]').type(qty, { delay: 90 });
    pause(1200);
  }

  function create(name: string, yieldQ: string) {
    cy.get('[data-testid="recipe-new-button"]').click();
    pause(1500);
    slowType('[data-testid="recipe-form-name"]', name);
    slowType('[data-testid="recipe-form-yield"]', yieldQ);
    slowType('[data-testid="recipe-form-waste"]', "3");
  }

  it("listar, detalle, crear con ingrediente y sub-receta", () => {
    quickLogin();
    goTo("nav-recetas");
    cy.get('[data-testid="recipe-row"]').should("have.length.greaterThan", 0);
    scrollTour();
    cy.contains('[data-testid="recipe-row-name"]', "Pan de Molde")
      .parents('[data-testid="recipe-row"]')
      .find('[data-testid="recipe-view-button"]')
      .click();
    cy.get('[data-testid="recipe-detail-page"]').should("be.visible");
    pause(2500);
    scrollTour(2500);
    cy.go("back");
    pause(1500);

    create(BASE, "20");
    addIngredient("Demo Tour Harina", "1000", 0);
    cy.get('[data-testid="recipe-form-submit"]').click();
    cy.get('[data-testid="recipe-create-dialog"]').should("not.exist");
    pause(2500);

    create(FINAL, "10");
    cy.get('[data-testid="recipe-form-add-subrecipe"]').click();
    pause(1200);
    cy.get('[data-testid="recipe-form-subrecipe-select"]').click();
    pause(1200);
    cy.contains('[role="option"]', BASE).click();
    pause(1000);
    cy.get('[data-testid="recipe-form-line"]').eq(0).find('[data-testid="recipe-form-line-quantity"]').type("5", { delay: 90 });
    pause(1200);
    addIngredient("Demo Tour Harina", "150", 1);
    cy.get('[data-testid="recipe-form-submit"]').click();
    cy.get('[data-testid="recipe-create-dialog"]').should("not.exist");
    pause(2000);

    slowType('[data-testid="recipe-search-input"]', "Demo Tour");
    pause(1500);
    cy.contains('[data-testid="recipe-row-name"]', FINAL)
      .parents('[data-testid="recipe-row"]')
      .find('[data-testid="recipe-view-button"]')
      .click();
    cy.get('[data-testid="recipe-detail-name"]').should("contain.text", FINAL);
    pause(2500);
    scrollTour(2500);
  });
});
