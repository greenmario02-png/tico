import { VIEWPORT, loginWithMascot, pause, scrollTour } from "../support/tour";

describe("Tour 01 - Login y Dashboard", VIEWPORT, () => {
  it("login con mascota y dashboard", () => {
    loginWithMascot();
    cy.get('[data-testid="dashboard-page"]').should("be.visible");
    cy.get('[data-testid="dashboard-stat-card"]').each(($c) => {
      cy.wrap($c).scrollIntoView({ duration: 600 });
      pause(1200);
    });
    scrollTour();
    pause(1500);
  });
});
