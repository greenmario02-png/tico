/**
 * Validación de email compartida por toda la app (login, y cualquier futuro
 * alta/edición de usuario).
 *
 * El `.email()` por defecto de Zod usa una regex estricta y ASCII-only que
 * rechaza local-parts con caracteres no ASCII (p. ej. "dueño@panaderia.bo",
 * un correo real y válido para un usuario boliviano). En vez de eso se usa
 * una forma más permisiva tipo RFC-5322 simplificada: exige `algo@algo.algo`
 * sin espacios ni "@" repetidos, pero permite letras Unicode (incluida "ñ",
 * tildes, etc.) en el local-part y en el dominio.
 *
 * Sigue rechazando strings obviamente inválidos como "not-an-email" (sin
 * "@") o "foo@" (sin dominio con punto).
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && EMAIL_REGEX.test(value);
}
