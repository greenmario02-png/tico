import { API_BASE_URL } from "./config";
import type { ApiErrorBody } from "./types";

// El JWT se guarda SOLO en memoria (variable de módulo), nunca en
// localStorage/sessionStorage: así un XSS no puede robarlo leyendo storage,
// y al recargar la página se vuelve a pedir con /api/auth/me (ver
// AuthProvider). Es la opción más segura razonable para una SPA sin
// refresh-token endpoint dedicado en el backend real.
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

// Error de aplicación: SIEMPRE usa el mensaje exacto que devolvió el backend
// (SDD-06), nunca texto inventado en el frontend.
export class AppApiError extends Error {
  code: string;
  statusCode: number;
  details?: { field: string; message: string }[];

  constructor(statusCode: number, code: string, message: string, details?: { field: string; message: string }[]) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = new URL(API_BASE_URL.replace(/\/$/, "") + path, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  // Si API_BASE_URL es absoluta (http://...), URL ya la respeta; si es
  // relativa, se resuelve contra window.location.origin.
  return API_BASE_URL.startsWith("http") ? url.toString() : url.pathname + url.search;
}

/** Notificado cuando el backend responde 401 (sesión expirada/ inválida). */
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new AppApiError(0, "NETWORK_ERROR", "No se pudo conectar con el servidor. Revisa tu conexión.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    // sin cuerpo o cuerpo no-JSON
  }

  if (!response.ok) {
    const body = json as ApiErrorBody | null;
    const message = body?.error?.message ?? "Ocurrió un error inesperado. Intenta de nuevo.";
    const code = body?.error?.code ?? "INTERNAL_ERROR";
    if (response.status === 401 && onUnauthorized) onUnauthorized();
    throw new AppApiError(response.status, code, message, body?.error?.details);
  }

  return json as T;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

// El backend limita pageSize a 100 por página (MAX_PAGE_SIZE, ver
// app/backend/src/lib/pagination.ts) sin importar qué pageSize se pida —
// pedir 500 se recorta silenciosamente a 100. Para los selectores del
// frontend (recetas, ingredientes, productos) que necesitan "todos los
// registros", hay que paginar hasta agotar `totalPages` en vez de asumir
// que un pageSize grande trae todo de una sola vez.
export async function fetchAllPages<T>(path: string, query: RequestOptions["query"] = {}): Promise<T[]> {
  const pageSize = 100;
  const first = await apiRequest<PaginatedResponse<T>>(path, { method: "GET", query: { ...query, page: 1, pageSize } });
  const items = [...first.data];
  const totalPages = first.pagination.totalPages;
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await apiRequest<PaginatedResponse<T>>(path, { method: "GET", query: { ...query, page, pageSize } });
    items.push(...next.data);
  }
  return items;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) => apiRequest<T>(path, { method: "GET", query }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: "DELETE" }),
};
