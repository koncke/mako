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
  const now = Date.now();
  if (buckets.size > 10000) {
    for (const [k, b] of buckets) if (now >= b.reset) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || now >= b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count++;
  return true;
}

/** IP del cliente detrás del proxy de Vercel (best-effort). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}
