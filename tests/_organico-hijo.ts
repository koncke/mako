// =============================================================================
// Hijo de tests/organico.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Instagram orgánico por Zernio (28/10/2026): la operación `ver_rendimiento_redes` y lib/zernio-organico.ts REALES
// (`server-only`, en un node aparte con `--conditions=react-server`), sobre el PostgREST de mentira y la API de Zernio de
// mentira, en el ws 3. Imprime lo que contestó la operación y lo que se le pidió a Zernio.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

const WS = 3;
const pg = crearPostgrest({ tablas: ['credenciales', 'app_settings', 'workspaces', 'webhook_routing', 'zernio_workspace'] });
const db = pg.db;
const red: string[] = [];
const pedidos: string[] = [];
/** Lo que contesta cada endpoint de analítica: un cuerpo (200) o un status de error. */
let resp: Record<'insights' | 'seguidores' | 'posts', { status: number; body: unknown }> = {} as never;
let cuentas: unknown[] = [];

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const metodo = (init.method ?? 'GET').toUpperCase();
  if (u.host === 'supa.test') return pg.responder(u, init);
  if (u.host === 'zernio.com') {
    const ruta = u.pathname.replace(/^\/api\/v1/, '');
    pedidos.push(`${metodo} ${ruta}${u.search}`);
    if (ruta === '/profiles') return json(200, { profiles: [{ _id: 'prof_1', name: 'Default', isDefault: true }] });
    if (ruta === '/accounts') return json(200, { accounts: cuentas });
    const cual = ruta === '/analytics/instagram/account-insights' ? 'insights' : ruta === '/analytics/instagram/follower-history' ? 'seguidores' : ruta === '/analytics' ? 'posts' : null;
    if (cual) { const r = resp[cual]; return r.status === 200 ? json(200, r.body) : json(r.status, { error: r.status === 402 ? 'Analytics add-on required' : 'error' }); }
    return json(404, { error: `sin mock: ${ruta}` });
  }
  red.push(`${metodo} ${u.host}${u.pathname}`);
  return json(500, { error: 'red de mentira' });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales';

const OK = {
  insights: { status: 200, body: { success: true, metrics: { reach: { total: 1520 }, views: { total: 4300 }, accounts_engaged: { total: 210 }, total_interactions: { total: 380 }, likes: { total: 300 } } } },
  seguidores: { status: 200, body: { success: true, metrics: { follower_count: { values: [{ date: '2026-09-29', value: 980 }, { date: '2026-10-28', value: 1012 }] }, followers_gained: { total: 40 }, followers_lost: { total: 8 } } } },
  posts: { status: 200, body: { posts: [
    { postId: 'p1', content: 'Reel del caso', publishedAt: '2026-10-20T15:00:00Z', platformPostUrl: 'https://www.instagram.com/reel/a/', mediaType: 'reel', analytics: { reach: 900, views: 2100, likes: 80, comments: 6 } },
    { postId: 'p2', content: 'Historia', publishedAt: '2026-10-25T15:00:00Z', mediaType: 'story', analytics: { reach: 300 } },
  ] } },
};
const IG = { _id: 'acc_ig_1', platform: 'instagram', username: 'negocio.prueba', displayName: 'Negocio', profileId: 'prof_1', isActive: true };

async function main() {
  const { cifrar } = await import('../lib/cripto-credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const { RUNNERS } = await import('../lib/api-mako/areas/contenido.run');
  const op = RUNNERS.ver_rendimiento_redes as unknown as { leer: (i: Record<string, unknown>) => Promise<string | { content: string; isError: boolean }> };

  const reset = () => {
    pg.vaciar();
    pedidos.length = 0; red.length = 0;
    resp = JSON.parse(JSON.stringify(OK));
    cuentas = [IG];
    db.workspaces.push({ id: WS, nombre: 'Prueba' });
    db.app_settings.push({ workspace_id: WS, key: 'mako.timezone', value: 'America/Argentina/Buenos_Aires', updated_at: '2026-10-01T00:00:00Z' });
    db.credenciales.push({ workspace_id: WS, clave: 'ZERNIO_API_KEY', valor_enc: cifrar('sk_zernio_prueba', WS, 'ZERNIO_API_KEY'), servicio: 'zernio' });
  };
  const correr = async (input: Record<string, unknown>) => {
    const r = await runWithWorkspace(WS, () => op.leer(input)).catch((e) => ({ content: `TIRA ${e instanceof Error ? e.message : String(e)}`, isError: true }));
    if (typeof r === 'string') { try { return JSON.parse(r); } catch { return { crudo: r }; } }
    return { errorDeLectura: r.content };
  };
  const analitica = () => pedidos.filter((p) => p.includes('/analytics'));
  const out: Record<string, unknown> = {};

  reset();
  out.a = { r: await correr({ desde: '2026-10-01', hasta: '2026-10-28' }), pedidos: analitica() };
  reset();
  resp.insights = { status: 402, body: null }; resp.seguidores = { status: 402, body: null }; resp.posts = { status: 402, body: null };
  out.b = await correr({});
  reset();
  resp.seguidores = { status: 500, body: null };
  out.c = await correr({});
  reset();
  cuentas = [];
  out.d = await correr({});
  reset();
  resp.posts = { status: 200, body: { success: true } };
  out.e = await correr({});
  reset();
  out.f = { r: await correr({ desde: '2026-01-01', hasta: '2026-10-28' }), pedidos: analitica().length };
  reset();
  cuentas = [IG, { ...IG, _id: 'acc_ig_2', username: 'otra.cuenta' }];
  out.g = { r: await correr({ cuenta: '@otra.cuenta' }), pedidos: analitica() };

  out.red = [...red];
  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(out)}`, () => process.exit(0));
}

void main().catch((e) => { process.stdout.write(`\n@@RESULTADO@@${JSON.stringify({ tiro: e instanceof Error ? e.stack : String(e) })}`, () => process.exit(0)); });

export {};
