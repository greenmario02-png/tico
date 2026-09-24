/// <reference types="cypress" />
// Helpers para los videos demostrativos (tour-*.cy.ts): ritmo pausado.

export const VIEWPORT = { viewportWidth: 1280, viewportHeight: 720, retries: 0 };

export const pause = (ms = 2000) => cy.wait(ms);

export function slowType(sel: string, text: string) {
  cy.get(sel).clear();
  cy.get(sel).type(text, { delay: 90 });
  pause(1200);
}

/** Desplaza la página hacia abajo y de vuelta, para que se vea todo el contenido. */
export function scrollTour(ms = 1800) {
  cy.scrollTo("bottom", { duration: ms, ensureScrollable: false });
  pause(1200);
  cy.scrollTo("top", { duration: ms, ensureScrollable: false });
  pause(1200);
}

export function goTo(nav: string) {
  cy.get(`[data-testid="${nav}"]`).click();
  pause(2000);
}

/** Login mostrando la mascota (cubre ojos al escribir clave, espía al mostrarla). */
export function loginWithMascot() {
  cy.visit("/login");
  cy.get('[data-testid="baker-mascot"]').should("be.visible");
  pause(2500);
  slowType('[data-testid="login-email"]', Cypress.env("adminEmail"));
  cy.get('[data-testid="login-password"]').click();
  pause(1800);
  cy.get('[data-testid="login-password"]').type(Cypress.env("adminPassword"), { delay: 90, log: false });
  pause(2000);
  cy.get('[data-testid="login-toggle-password"]').click();
  pause(2500);
  cy.get('[data-testid="login-toggle-password"]').click();
  pause(1500);
  cy.get('[data-testid="login-submit"]').click();
  cy.get('[data-testid="nav-home"]', { timeout: 10000 }).should("be.visible");
  pause(2500);
}

export function quickLogin() {
  cy.loginAsAdmin();
  pause(1500);
}

export function api(method: string, path: string, body?: unknown) {
  return cy.apiLoginAsAdmin().then((token) =>
    cy.request({
      method,
      url: `${Cypress.env("apiUrl")}${path}`,
      headers: { Authorization: `Bearer ${token}` },
      body,
      failOnStatusCode: false,
    }),
  );
}


// Pantalla completa para grabar: oculta la barra del runner (URL/navegador) y
// muestra la app al 100% ocupando todo el fotograma del video.
beforeEach(() => {
  const top = window.top!.document;
  if (top.getElementById("tour-fullscreen")) return;
  const st = top.createElement("style");
  st.id = "tour-fullscreen";
  st.textContent = `
    #spec-runner-header { display: none !important; }
    #unified-runner { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; transform: none !important; z-index: 9999; background: #fff; }
    #unified-runner .screenshot-height-container, #unified-runner .aut-iframe { width: 100vw !important; height: 100vh !important; }
  `;
  top.head.appendChild(st);
});
