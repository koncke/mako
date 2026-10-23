// =============================================================================
// entorno — correr un chat de MaKo SIN PANTALLA, con las MISMAS funciones de servidor que usa la app
// =============================================================================
// Para los arneses de scripts/probar-chats/ (22/10/2026, Martín: «prueba los chats... todo debe funcionar»). Un arnés
// llama al handler de la RUTA de verdad (el `POST` de app/api/.../route.ts), no a una copia: lo único que se pone acá es
// lo que en producción pone Next alrededor de un pedido.
//
// LAS TRES COSAS QUE PONE ESTE ARCHIVO, y por qué cada una:
//   1. QUIÉN MIRA (la sesión). `getUsuarioActual` (lib/auth.ts) lee la cookie firmada con `cookies()` de Next, que fuera
//      de un pedido TIRA («`cookies` was called outside a request scope»). No se fabrica un token (sería saltear el
//      segundo factor): se reemplaza el módulo lib/auth.ts en la caché de `require` por uno que devuelve la sesión que
//      el arnés elige (`usarSesion`). Por defecto, la del super admin viendo el workspace de prueba, como en producción.
//      ⚠️ Tiene que correr ANTES de importar cualquier cosa de la app: quien ya importó lib/auth.ts se queda con el real.
//   2. EL WORKSPACE. `runWithWorkspace(ws)` (lib/workspace.ts) es lo que lee `getWorkspaceActual` antes que las cookies.
//      Va alrededor de cada llamada (`enWs`). ⚠️ Sólo los de PRUEBA (`esClienteDePrueba`): nunca el ws1 (Mauricio).
//   3. LA CACHÉ DE NEXT. `cachedRead` (lib/cache.ts) usa `unstable_cache`, que fuera de Next tira «incrementalCache
//      missing». Una lectura caída adentro de un `.catch(() => [])` no avisa: el contexto de MaKo salía SIN productos
//      ni etapas y MaKo decía «esa etapa no existe». Acá la caché es de paso: nunca guarda, siempre lee la base.
//      ⚠️ Por eso un arnés NO reproduce una caché vieja de producción (TTL de 60-600 s con tags).
//
// Lo que NO hace: levantar Next (bootear local escribe en producción, AGENTS.md) ni tocar .env.local (lo pasa `node
// --env-file`). Las IA son las de verdad: el uso queda anotado en `anthropic_usage` del workspace de prueba.
// =============================================================================

import { createRequire } from 'node:module';
import { join } from 'node:path';

export const RAIZ = join(import.meta.dirname, '..', '..');
const requerir = createRequire(import.meta.url);

/** Lo que devuelve `getUsuarioActual` (lib/auth-session.ts, `Sesion`). */
export type SesionPrueba = {
  sub: string; email: string; nombre: string; rol: 'admin' | 'usuario'; exp: number;
  legacy?: boolean; ws?: number | null; rolWs?: 'admin' | 'closer' | 'setter' | null; mfa?: string;
};

let sesionActual: SesionPrueba | null = null;
/** La sesión que ve la app desde ahora (null = nadie logueado). */
export function usarSesion(s: SesionPrueba | null): void { sesionActual = s; }

// ── 1. La sesión: lib/auth.ts reemplazado en la caché de `require` ─────────────────────
{
  const archivo = join(RAIZ, 'lib', 'auth.ts');
  const Modulo = requerir('node:module') as { new (id: string): { filename: string; loaded: boolean; exports: unknown } };
  const m = new Modulo(archivo);
  m.filename = archivo;
  m.loaded = true;
  m.exports = {
    getUsuarioActual: async () => sesionActual,
    getSesionAdmin: async () => (sesionActual?.rol === 'admin' ? sesionActual : null),
  };
  (requerir.cache as Record<string, unknown>)[archivo] = m;
}

// ── 3. La caché de Next, de paso ───────────────────────────────────────────────────────
{
  const g = globalThis as { __incrementalCache?: unknown };
  g.__incrementalCache ??= {
    isOnDemandRevalidate: false,
    generateCacheKey: async (k: string) => k,
    get: async () => null,
    set: async () => {},
  };
}

// ── 2. El workspace ─────────────────────────────────────────────────────────────────────
const { runWithWorkspace } = await import('../../lib/workspace.ts');
const { esClienteDePrueba } = await import('../../lib/auth-session.ts');

/** Corre `fn` como un pedido del workspace `ws`. Tira si no es un workspace de PRUEBA. */
export function enWs<T>(ws: number, fn: () => Promise<T>): Promise<T> {
  if (!esClienteDePrueba(ws)) throw new Error(`El ws ${ws} no es de prueba: los arneses sólo corren en los de prueba (nunca el ws1).`);
  return runWithWorkspace(ws, fn);
}

/** La sesión del super admin (de la tabla `usuarios`, por email), viendo el ws de prueba como en producción. */
export async function sesionSuperAdmin(email: string): Promise<SesionPrueba> {
  const { getSupabaseServer } = await import('../../lib/supabase.ts');
  const { data, error } = await getSupabaseServer().from('usuarios').select('id, email, nombre, rol, workspace_id, rol_ws, estado').eq('email', email).maybeSingle();
  if (error || !data) throw new Error(`No encontré al usuario: ${error?.message ?? 'no está'}`);
  const u = data as { id: number; email: string; nombre: string | null; rol: string; workspace_id: number | null; rol_ws: string | null; estado: string };
  if (u.rol !== 'admin' || u.estado === 'suspendido') throw new Error('Ese usuario no es super admin activo.');
  return { sub: String(u.id), email: u.email, nombre: u.nombre ?? '', rol: 'admin', exp: 0, ws: u.workspace_id, rolWs: 'admin', mfa: 'totp' };
}

// ── Las llamadas ────────────────────────────────────────────────────────────────────────

type Handler = (req: never) => Promise<Response> | Response;

/** Llama al handler de una ruta como lo haría Next, dentro del workspace `ws`. */
export async function llamar(ws: number, handler: Handler, o: { url: string; method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal }): Promise<Response> {
  const { NextRequest } = await import('next/server');
  const req = new NextRequest(new URL(o.url, 'https://app.local'), {
    method: o.method ?? 'POST',
    ...(o.body !== undefined ? { body: JSON.stringify(o.body), headers: { 'content-type': 'application/json' } } : {}),
    ...(o.signal ? { signal: o.signal } : {}),
  });
  return enWs(ws, async () => handler(req as never));
}

/** Un evento NDJSON con cuándo llegó (ms desde el POST). */
export type EventoConHora = { ms: number; ev: Record<string, unknown> };

/** Lee una respuesta: el JSON plano (errores de antes del stream) o el NDJSON línea por línea, con la hora de cada una. */
export async function leerRespuesta(res: Response, t0: number): Promise<{ status: number; json: unknown | null; eventos: EventoConHora[] }> {
  const tipo = res.headers.get('content-type') ?? '';
  if (!tipo.includes('ndjson')) {
    const json = await res.json().catch(() => null);
    return { status: res.status, json, eventos: [] };
  }
  const eventos: EventoConHora[] = [];
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const linea = (l: string) => {
    const t = l.trim();
    if (!t) return;
    try { eventos.push({ ms: Date.now() - t0, ev: JSON.parse(t) as Record<string, unknown> }); } catch { /* línea rota */ }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) { linea(buf.slice(0, i)); buf = buf.slice(i + 1); }
  }
  linea(buf);
  return { status: res.status, json: null, eventos };
}
