/**
 * Rate limiting progresivo para login (SDD-11 §rate limiting).
 * En memoria (por instancia), reloj inyectable para tests.
 *
 * - Clave = IP + email normalizado. Cada fallo n incrementa el bloqueo:
 *   min(base * 2^(n-1), max) segundos. Mientras dura, todo intento => 429.
 * - Login correcto resetea la clave. Sin fallos durante 30 min => se olvida.
 * - Tope por IP: N intentos/minuto (ventana deslizante).
 */
export interface LoginThrottleOptions {
  baseSeconds?: number;
  maxSeconds?: number;
  ipLimitPerMinute?: number;
  forgetAfterMs?: number;
  maxEntries?: number;
  now?: () => number;
}

interface Entry {
  failures: number;
  blockedUntil: number;
  lastFailure: number;
}

export function createLoginThrottle(opts: LoginThrottleOptions = {}) {
  const base = opts.baseSeconds ?? 5;
  const max = opts.maxSeconds ?? 900;
  const ipLimit = opts.ipLimitPerMinute ?? 20;
  const forgetMs = opts.forgetAfterMs ?? 30 * 60_000;
  const maxEntries = opts.maxEntries ?? 10_000;
  const now = opts.now ?? (() => Date.now());

  const entries = new Map<string, Entry>();
  const ipHits = new Map<string, number[]>();

  const keyOf = (ip: string, email: string) => `${ip}|${email.trim().toLowerCase()}`;

  function pruneIp(ip: string, t: number): number[] {
    const arr = (ipHits.get(ip) ?? []).filter((x) => t - x < 60_000);
    if (arr.length) ipHits.set(ip, arr);
    else ipHits.delete(ip);
    return arr;
  }

  /** Devuelve segundos de espera (>0) si el intento debe rechazarse; 0 si puede continuar. */
  function check(ip: string, email: string): number {
    const t = now();
    const hits = pruneIp(ip, t);
    if (hits.length >= ipLimit) {
      return Math.max(1, Math.ceil((60_000 - (t - hits[0])) / 1000));
    }
    const k = keyOf(ip, email);
    const e = entries.get(k);
    if (e) {
      if (t - e.lastFailure >= forgetMs) {
        entries.delete(k);
      } else if (e.blockedUntil > t) {
        return Math.ceil((e.blockedUntil - t) / 1000);
      }
    }
    // Intento admitido: cuenta para el tope por IP.
    const arr = ipHits.get(ip) ?? [];
    arr.push(t);
    ipHits.set(ip, arr);
    return 0;
  }

  function recordFailure(ip: string, email: string): void {
    const t = now();
    const k = keyOf(ip, email);
    const prev = entries.get(k);
    const failures = prev && t - prev.lastFailure < forgetMs ? prev.failures + 1 : 1;
    const seconds = Math.min(base * 2 ** Math.min(failures - 1, 30), max);
    entries.delete(k); // reinsertar => el orden de inserción actúa como LRU
    entries.set(k, { failures, blockedUntil: t + seconds * 1000, lastFailure: t });
    if (entries.size > maxEntries) {
      cleanup();
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    }
  }

  function recordSuccess(ip: string, email: string): void {
    entries.delete(keyOf(ip, email));
  }

  function cleanup(): void {
    const t = now();
    for (const [k, e] of entries) if (t - e.lastFailure >= forgetMs) entries.delete(k);
    for (const ip of [...ipHits.keys()]) pruneIp(ip, t);
  }

  let timer: NodeJS.Timeout | null = null;
  function startCleanup(intervalMs = 60_000) {
    if (timer) return;
    timer = setInterval(cleanup, intervalMs);
    timer.unref();
  }
  function stopCleanup() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return {
    check,
    recordFailure,
    recordSuccess,
    cleanup,
    startCleanup,
    stopCleanup,
    size: () => entries.size,
  };
}

export type LoginThrottle = ReturnType<typeof createLoginThrottle>;
