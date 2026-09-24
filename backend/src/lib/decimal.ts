// Utilidades pequeñas para validar strings decimales sin depender de float
// para las decisiones de negocio (SDD-05 §0: los `numeric` viajan como string).

export function isValidDecimalString(value: unknown): value is string {
  return typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim());
}

export function decimalToNumber(value: string): number {
  return Number(value);
}

export function countDecimals(value: string): number {
  const parts = value.split(".");
  return parts.length > 1 ? parts[1].length : 0;
}
