export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INSUFFICIENT_STOCK"
  | "BATCH_OVERSELLING"
  | "INTERNAL_ERROR"
  | "TOKEN_EXPIRED";

export interface ErrorDetail {
  field: string;
  message: string;
}

export class ApiError extends Error {
  code: ErrorCode;
  statusCode: number;
  details?: ErrorDetail[];

  constructor(statusCode: number, code: ErrorCode, message: string, details?: ErrorDetail[]) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  toBody() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }

  static validation(message: string, details?: ErrorDetail[]) {
    return new ApiError(400, "VALIDATION_ERROR", message, details);
  }
  static unauthorized(message = "Tu sesión expiró. Vuelve a iniciar sesión para continuar.") {
    return new ApiError(401, "UNAUTHORIZED", message);
  }
  static forbidden(message = "No tenés permiso para realizar esta acción") {
    return new ApiError(403, "FORBIDDEN", message);
  }
  static notFound(message: string) {
    return new ApiError(404, "NOT_FOUND", message);
  }
  static conflict(message: string, details?: ErrorDetail[]) {
    return new ApiError(409, "CONFLICT", message, details);
  }
  static insufficientStock(message: string, details?: ErrorDetail[]) {
    return new ApiError(409, "INSUFFICIENT_STOCK", message, details);
  }
  static batchOverselling(message: string, details?: ErrorDetail[]) {
    return new ApiError(409, "BATCH_OVERSELLING", message, details);
  }
}

/**
 * Detecta una violación de constraint único de Postgres (código `23505`),
 * lanzada por el driver `pg` como un objeto plano (no una subclase de
 * `Error` tipada). Se usa para traducir una condición de carrera de
 * unicidad de nombre (ver `ingredients_active_name_lower_unique` /
 * `recipes_active_name_lower_unique`, SDD-06 ING-002/REC-002) al mismo
 * mensaje de negocio que ya devuelve el chequeo de la capa de aplicación —
 * el constraint de BD es ahora la fuente de verdad, ese chequeo previo
 * queda como optimización de "fast path", no como única guarda.
 */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "23505";
}
