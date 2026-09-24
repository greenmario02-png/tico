// VITE_API_BASE_URL se lee del entorno (ver .env.example), nunca hardcodeada
// (SDD-05 §1.1 define la base URL por entorno: dev vs producción).
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";
