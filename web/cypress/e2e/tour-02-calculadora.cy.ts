import { VIEWPORT, quickLogin, pause, goTo, slowType, scrollTour } from "../support/tour";

describe("Tour 02 - Calculadora de Costos", VIEWPORT, () => {
  it("calculadora: cantidades y margen", () => {
    quickLogin();
    goTo("nav-calculadora-costos");
    cy.get('[data-testid="calculator-recipe-select"]').click();
    pause(1500);
    cy.contains('[role="option"]', "Pan de Molde").click();
    pause(2500);
    cy.get('[data-testid="calculator-cost-preview"]', { timeout: 10000 }).should("be.visible");
    pause(2000);
    slowType('[data-testid="calculator-quantity-input"]', "40");
    pause(2500);
    slowType('[data-testid="calculator-quantity-input"]', "100");
    pause(2500);
    cy.get('[data-testid="margin-slider"]').scrollIntoView({ duration: 800 });
    pause(1500);
    for (const v of [30, 45, 60, 75, 50]) {
      cy.get('[data-testid="margin-slider"]').then(($i) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
        setter.call($i[0], String(v));
        $i[0].dispatchEvent(new Event("input", { bubbles: true }));
        $i[0].dispatchEvent(new Event("change", { bubbles: true }));
      });
      pause(2000);
    }
    scrollTour();
  });
});
