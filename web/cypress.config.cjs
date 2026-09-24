const { defineConfig } = require("cypress");

// E2E config para el flujo real de la app (SDD-09 / Fase QA):
// - baseUrl apunta al dev server de Vite (npm run dev, puerto 5173).
// - CYPRESS_apiUrl apunta al backend Fastify real (puerto 3000), usado
//   tanto por la app (VITE_API_BASE_URL) como por las specs para verificar
//   directamente con cy.request() el borrado lógico (soft-delete).
// Se usa .cjs (en vez de .ts) porque package.json tiene "type": "module" y
// el loader ts-node/esm que trae Cypress 13 falla en este entorno al
// requerir un cypress.config.ts bajo ESM puro; .cjs evita ese problema por
// completo sin renunciar a nada de la config real.
module.exports = defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.ts",
    defaultCommandTimeout: 8000,
    // video:true + screenshots explícitos en cada spec (SDD-09 / Fase QA
    // evidencia visual real): se usan para armar qa-evidence/web/ luego de
    // correr `npx cypress run`.
    video: true,
    screenshotsFolder: "cypress/screenshots",
    videosFolder: "cypress/videos",
    retries: { runMode: 1, openMode: 0 },
  },
  env: {
    // 127.0.0.1 explícito (no "localhost"): en este entorno Node/Electron
    // resuelve "localhost" a ::1 primero y el backend Fastify solo escucha
    // en la interfaz IPv4 (ver app/backend/src/server.ts), lo que provoca
    // ECONNREFUSED en cy.request() si se usa "localhost" aquí.
    apiUrl: "http://127.0.0.1:3000/api",
    adminEmail: "admin@panaderia.bo",
    adminPassword: "Admin12345!",
  },
});
