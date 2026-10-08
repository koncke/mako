// =============================================================================
// rate-limit — limitador en memoria, best-effort (por instancia serverless)
// =============================================================================
// NO es una defensa dura contra ataques distribuidos (el estado no se comparte
// entre instancias de Vercel y se pierde en cold start), pero corta floods
// triviales desde una misma IP/clave — suficiente para endpoints públicos de
// tracking/telemetría donde el costo del abuso es envenenar métricas o engordar
// la tabla. Para límites duros hace falta un store compartido (Upstash/Redis).
// =============================================================================

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

/**
 * Ventana fija por `key`. Devuelve true si el request se permite, false si superó
 * `max` dentro de `windowMs`. Hace una limpieza perezosa para no crecer sin techo.
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  return rateLimitEstado(key, max, windowMs).permitido;
}

/** El estado de la ventana después de contar este pedido: para los headers
 *  `x-ratelimit-*` de /api/v1 (como los de GitHub). `reset` es epoch en ms. */
export type EstadoLimite = { permitido: boolean; limite: number; restantes: number; usados: number; reset: number };

/** `rateLimit` con el estado de la ventana. Cuenta igual: un pedido rechazado NO suma. */
export function rateLimitEstado(key: string, max: number, windowMs: number): EstadoLimite {
  const now = Date.now();
  if (buckets.size > 10000) {
    for (const [k, b] of buckets) if (now >= b.reset) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || now >= b.reset) {
    const nuevo = { count: 1, reset: now + windowMs };
    buckets.set(key, nuevo);
    return { permitido: true, limite: max, restantes: max - 1, usados: 1, reset: nuevo.reset };
  }
  if (b.count >= max) return { permitido: false, limite: max, restantes: 0, usados: b.count, reset: b.reset };
  b.count++;
  return { permitido: true, limite: max, restantes: max - b.count, usados: b.count, reset: b.reset };
}

/** El estado de una ventana SIN contar un pedido (para `GET /api/v1/rate_limit`, que como
 *  en GitHub no consume el límite). */
export function rateLimitVer(key: string, max: number, windowMs: number): EstadoLimite {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.reset) return { permitido: true, limite: max, restantes: max, usados: 0, reset: now + windowMs };
  return { permitido: b.count < max, limite: max, restantes: Math.max(0, max - b.count), usados: b.count, reset: b.reset };
}

/** IP del cliente detrás del proxy de Vercel (best-effort). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}
