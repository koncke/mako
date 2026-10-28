// =============================================================================
// url-de-la-base — por dónde entran a Postgres los scripts: el pooler, que tiene IPv4
// =============================================================================
// `DATABASE_URL` apunta a la conexión DIRECTA (`db.<ref>.supabase.co`), y ese host resuelve
// SÓLO a IPv6. Desde una red sin IPv6 — la PC de Martín, la mayoría de las veces — `postgres`
// contesta `getaddrinfo ENOENT` o `ENETUNREACH`, y se lee como «se cortó internet» porque la
// REST de Supabase, que sí tiene IPv4, sigue contestando. Y no hace falta que falle al
// arrancar: con la red de la PC entrando y saliendo de IPv6, un script largo conecta, y la
// RECONEXIÓN de mitad de corrida es la que muere (medido el 27/10/2026: `lookup` v6 ENOENT y
// v4 ENOTFOUND sobre el directo; el pooler, 3 direcciones IPv4 y `select 1` en 2,4 s).
//
// El pooler (Supavisor) en modo SESIÓN — puerto 5432 — se comporta como la directa para lo
// que hacen los scripts: bloques `do $$`, `begin/commit`, `set`, `NOTIFY pgrst`. Cambian el
// host y el usuario (`postgres.<ref>`); la contraseña es la misma. ⚠️ El prefijo del cluster
// es `aws-1`: `aws-0-us-west-2` contesta «tenant/user not found» (06/10/2026) y no dice
// «probá aws-1».
//
// Puro y sin dependencias (lo importan scripts .mjs con node pelado, y .ts/.mts con tsx).
// Test: tests/url-de-la-base.test.ts, que además barre scripts/ para que ninguno vuelva a
// abrir la directa por su cuenta.
// =============================================================================

/** El pooler del proyecto de producción (us-west-2). Se cambia con `SUPABASE_POOLER_HOST`. */
export const POOLER_POR_DEFECTO = 'aws-1-us-west-2.pooler.supabase.com';

const RE_DIRECTA = /^db\.([a-z0-9]+)\.supabase\.co$/i;

/**
 * La URL del pooler (modo sesión) que corresponde a una URL de la conexión directa de Supabase,
 * o null si `directa` no es una (otra base, una local, o ya es la del pooler).
 * @param {string} directa
 * @param {string} [host]
 * @returns {string | null}
 */
export function urlDelPooler(directa, host = POOLER_POR_DEFECTO) {
  let u;
  try { u = new URL(directa); } catch { return null; }
  const m = RE_DIRECTA.exec(u.hostname);
  if (!m) return null;
  const ref = m[1].toLowerCase();
  u.hostname = host;
  u.port = '5432';
  // `postgres` → `postgres.<ref>`: el pooler sabe de qué proyecto es por el usuario.
  if (!u.username.includes('.')) u.username = `${u.username || 'postgres'}.${ref}`;
  return u.toString();
}

/**
 * La URL con la que un script abre Postgres: la del pooler (IPv4) derivada de `DATABASE_URL`.
 * - Sin `DATABASE_URL`: `undefined`, para que el script diga «Falta DATABASE_URL» como siempre.
 * - `MAKO_DB_DIRECTA=1`: la directa tal cual (por si alguna vez el pooler no sirve para algo).
 * - Una `DATABASE_URL` que no es la directa de Supabase (local, ya del pooler): tal cual.
 * @param {Record<string, string | undefined>} [env]
 * @returns {string | undefined}
 */
export function urlDeLaBase(env = process.env) {
  const directa = env.DATABASE_URL;
  if (!directa) return undefined;
  if (env.MAKO_DB_DIRECTA === '1') return directa;
  return urlDelPooler(directa, env.SUPABASE_POOLER_HOST || POOLER_POR_DEFECTO) ?? directa;
}
