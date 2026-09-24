/// <reference types="cypress" />

// Comandos reutilizables para las specs E2E de Ingredientes y Recetas.
// login() maneja la sesión REAL vía la UI (formulario de LoginPage): no hay
// forma de "saltarse" el login seteando localStorage porque el JWT vive solo
// en memoria (ver src/lib/api.ts), así que cada test que necesite estar
// autenticado debe pasar por /login normalmente.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Inicia sesión a través del formulario real de /login. */
      login(email: string, password: string): Chainable<void>;
      /** Inicia sesión como el admin sembrado (SDD-11: CRUD de ingredientes/recetas requiere admin). */
      loginAsAdmin(): Chainable<void>;
      /**
       * Obtiene un accessToken real llamando a POST /api/auth/login
       * directamente (sin pasar por la UI), para usarlo en cy.request()
       * contra el backend y verificar independientemente el estado real
       * en la base de datos (p. ej. el borrado lógico).
       */
      apiLoginAsAdmin(): Chainable<string>;
    }
  }
}

Cypress.Commands.add("login", (email: string, password: string) => {
  cy.visit("/login");
  cy.get('[data-testid="login-email"]').clear().type(email);
  cy.get('[data-testid="login-password"]').clear().type(password);
  cy.get('[data-testid="login-submit"]').click();
  // Espera a que la navegación real ocurra (AppShell solo se monta con user != null).
  cy.get('[data-testid="nav-home"]', { timeout: 10000 }).should("be.visible");
});

Cypress.Commands.add("loginAsAdmin", () => {
  cy.login(Cypress.env("adminEmail"), Cypress.env("adminPassword"));
});

Cypress.Commands.add("apiLoginAsAdmin", () => {
  return cy
    .request("POST", `${Cypress.env("apiUrl")}/auth/login`, {
      email: Cypress.env("adminEmail"),
      password: Cypress.env("adminPassword"),
    })
    .then((resp) => {
      expect(resp.status).to.eq(200);
      return resp.body.accessToken as string;
    });
});

export {};
