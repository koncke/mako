// =============================================================================
// consultas-por-pedido — cuántas idas a la base hace UN pedido a una ruta /api, y cuántas veces relee la sesión. SOLO LEE.
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/consultas-por-pedido.mts <email> <ruta> [<ruta>…]
//   rutas: auth-me · secuencias
// =============================================================================
// Por qué existe (23/10/2026, «Rendimiento y loaders»): en producción /api/auth/me tardaba 4,5 s con la función CALIENTE y
// /api/chat-agent/secuencias p90 15 s. En una ruta /api el `cache()` de React NO memoiza (no hay render de React): cada
// `getTenantDb()` → `getWorkspaceActual()` → `getUsuarioActual()` vuelve a leer `usuarios` (y la fecha del 2FA). Con las
// funciones en iad1 y la base en us-west-2, cada ida son ~97 ms.
//
// Cómo mide sin fabricar un token (sería saltear el segundo factor): `next/headers` se reemplaza por un pedido de mentira (un
// objeto de cookies por pedido, como en Next) y `getUsuarioActual` hace las MISMAS lecturas que el real
// (`buscarUsuarioPorEmail` + `obligatorioDesdeDe`) para el usuario dado, contando cada vez que se lo llama. Si lib/auth.ts
// memoiza por pedido (`enElPedido`, lib/sesion-por-pedido.ts), la imitación pasa por la MISMA función.
// No usa `runWithWorkspace`: el workspace sale de la sesión, como en producción.
// =============================================================================
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const RAIZ = join(import.meta.dirname, '..');
const requerir = createRequire(import.meta.url);
const [email, ...rutas] = process.argv.slice(2);
if (!email || !rutas.length) { console.error('uso: <email> <ruta>…'); process.exit(2); }

// ── El pedido de mentira: un objeto de cookies POR PEDIDO (Next da el mismo objeto durante todo el pedido) ──────────────
let pedido: { get: (n: string) => { value: string } | undefined; getAll: () => never[]; has: () => boolean } = nuevoPedido();
function nuevoPedido() { return { get: (n: string) => (n === 'mako_session' ? { value: 'token-de-mentira' } : undefined), getAll: () => [] as never[], has: () => false }; }
{
  const archivo = requerir.resolve('next/headers');
  const Modulo = requerir('node:module') as { new (id: string): { filename: string; loaded: boolean; exports: unknown } };
  const m = new Modulo(archivo);
  m.filename = archivo; m.loaded = true;
  m.exports = { cookies: async () => pedido, headers: async () => new Headers(), draftMode: async () => ({ isEnabled: false }) };
  (requerir.cache as Record<string, unknown>)[archivo] = m;
}
{
  const g = globalThis as { __incrementalCache?: unknown };
  g.__incrementalCache ??= { isOnDemandRevalidate: false, generateCacheKey: async (k: string) => k, get: async () => null, set: async () => {} };
}

// ── Contar las idas a la base ────────────────────────────────────────────────────────────────────────────────────────
let idas = 0;
const fetchReal = globalThis.fetch;
globalThis.fetch = (async (u: RequestInfo | URL, i?: RequestInit) => {
  if (String(u instanceof Request ? u.url : u).includes('supabase')) idas++;
  return fetchReal(u, i);
}) as typeof fetch;

// ── La sesión: las mismas lecturas que la real, contadas ────────────────────────────────────────────────────────────
const { buscarUsuarioPorEmail } = await import('../lib/usuarios.ts');
const { obligatorioDesdeDe } = await import('../lib/mfa-obligatorio.ts');
import { readFileSync, existsSync } from 'node:fs';
const authReal = await import('../lib/auth.ts').catch(() => null) as Record<string, unknown> | null;
// ¿lib/auth.ts memoiza la sesión por pedido? Entonces la imitación pasa por el MISMO `enElPedido`.
const memoiza = existsSync(join(RAIZ, 'lib/sesion-por-pedido.ts')) && /enElPedido\(store, token \?\? '', /.test(readFileSync(join(RAIZ, 'lib/auth.ts'), 'utf8'));
const enElPedido = memoiza ? (await import('../lib/sesion-por-pedido.ts')).enElPedido as <T>(p: object, t: string, f: () => Promise<T>) => Promise<T> : null;
let lecturasSesion = 0;
async function sesionImitada() {
  lecturasSesion++;
  const u = await buscarUsuarioPorEmail(email);
  if (!u) return null;
  await obligatorioDesdeDe(u.workspace_id);
  return { sub: String(u.id), email: u.email, nombre: u.nombre ?? '', rol: u.rol, exp: 0, ws: u.workspace_id ?? null, rolWs: u.rol_ws ?? null, mfa: 'totp' };
}
{
  const archivo = join(RAIZ, 'lib', 'auth.ts');
  const Modulo = requerir('node:module') as { new (id: string): { filename: string; loaded: boolean; exports: unknown } };
  const m = new Modulo(archivo);
  m.filename = archivo; m.loaded = true;
  const getUsuarioActual = async () => {
    if (!enElPedido) return sesionImitada();
    return enElPedido(pedido, 'token-de-mentira', sesionImitada);
  };
  m.exports = { ...(authReal ?? {}), getUsuarioActual, getSesionAdmin: async () => { const s = await getUsuarioActual() as { rol?: string } | null; return s?.rol === 'admin' ? s : null; } };
  (requerir.cache as Record<string, unknown>)[archivo] = m;
}

const RUTAS: Record<string, () => Promise<Response>> = {
  'auth-me': async () => (await import('../app/api/auth/me/route.ts')).GET(),
  secuencias: async () => {
    const { NextRequest } = await import('next/server');
    return (await import('../app/api/chat-agent/secuencias/route.ts')).GET(new NextRequest('https://app.local/api/chat-agent/secuencias'));
  },
};

console.log(`sesión ${memoiza ? 'MEMOIZADA por pedido' : 'sin memo (como Next en una ruta /api)'}`);
for (const r of rutas) {
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    pedido = nuevoPedido(); idas = 0; lecturasSesion = 0;
    const t0 = performance.now();
    const res = await RUTAS[r]();
    const cuerpo = await res.text();
    if (vuelta === 0) continue; // la primera calienta los módulos
    if (process.env.CUERPO_EN) (await import('node:fs')).writeFileSync(`${process.env.CUERPO_EN}-${r}.json`, cuerpo);
    console.log(`  ${r.padEnd(11)} ${res.status} ${String(Math.round(performance.now() - t0)).padStart(5)} ms · ${String(idas).padStart(3)} idas a la base · sesión leída ${lecturasSesion} veces · ${cuerpo.length} B · sha ${createHash('sha256').update(cuerpo).digest('hex').slice(0, 10)}`);
  }
}
process.exit(0);
