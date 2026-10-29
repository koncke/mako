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
/** El status de GET /accounts (402: la cuenta de Zernio pausada). */
let cuentasStatus = 200;
/** Con qué clave se habló con Zernio (la del negocio o la de la plataforma). */
const claves: string[] = [];

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const metodo = (init.method ?? 'GET').toUpperCase();
  if (u.host === 'supa.test') return pg.responder(u, init);
  if (u.host === 'zernio.com') {
    const ruta = u.pathname.replace(/^\/api\/v1/, '');
    pedidos.push(`${metodo} ${ruta}${u.search}`);
    claves.push((new Headers(init.headers).get('authorization') ?? '').replace(/^Bearer /, ''));
    if (ruta === '/profiles') return json(200, { profiles: [{ _id: 'prof_1', name: 'Default', isDefault: true }] });
    if (ruta === '/accounts') return cuentasStatus === 200 ? json(200, { accounts: cuentas }) : json(cuentasStatus, { error: 'Subscription paused' });
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
process.env.ZERNIO_API_KEY = 'sk_zernio_de_la_plataforma';
const PLATAFORMA = 9;

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
  const { conexionesViaZernio } = await import('../lib/zernio-conectar');
  const op = RUNNERS.ver_rendimiento_redes as unknown as { leer: (i: Record<string, unknown>) => Promise<string | { content: string; isError: boolean }> };

  const reset = () => {
    pg.vaciar();
    pedidos.length = 0; red.length = 0; claves.length = 0; cuentasStatus = 200;
    resp = JSON.parse(JSON.stringify(OK));
    cuentas = [IG];
    db.workspaces.push({ id: WS, nombre: 'Prueba', capa: 'cliente' }, { id: 1, nombre: 'Mauricio', capa: 'cliente' }, { id: PLATAFORMA, nombre: 'MaKo', capa: 'superadmin' });
    db.app_settings.push({ workspace_id: WS, key: 'mako.timezone', value: 'America/Argentina/Buenos_Aires', updated_at: '2026-10-01T00:00:00Z' });
    db.credenciales.push({ workspace_id: WS, clave: 'ZERNIO_API_KEY', valor_enc: cifrar('sk_zernio_prueba', WS, 'ZERNIO_API_KEY'), servicio: 'zernio' });
  };
  const correr = async (input: Record<string, unknown>, ws = WS) => {
    const r = await runWithWorkspace(ws, () => op.leer(input)).catch((e) => ({ content: `TIRA ${e instanceof Error ? e.message : String(e)}`, isError: true }));
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

  // (h) La fecha de cada post en la zona del negocio (Buenos Aires): Zernio la manda en UTC y lo de la noche caía al día siguiente.
  reset();
  resp.posts = { status: 200, body: { posts: [
    { postId: 'n1', content: 'De noche', publishedAt: '2026-10-28T01:30:00Z', mediaType: 'reel', analytics: { reach: 900 } },
    { postId: 'n2', content: 'Antes de las 21', publishedAt: '2026-10-27T23:59:00Z', mediaType: 'reel', analytics: { reach: 500 } },
    { postId: 'n3', content: 'De día', publishedAt: '2026-10-28T15:00:00Z', mediaType: 'reel', analytics: { reach: 100 } },
  ] } };
  out.h = await correr({});

  // (i) Un post que Zernio todavía no sincronizó (syncStatus pending, todo en 0 y lastUpdated null): null y DICHO, no «nadie lo vio».
  //     Uno sincronizado con un 0 de verdad queda en 0. Y uno que Instagram no da (unavailable), también null y dicho.
  reset();
  resp.posts = { status: 200, body: { posts: [
    { postId: 's1', content: 'Recién subido', publishedAt: '2026-10-28T14:00:00Z', mediaType: 'reel', syncStatus: 'pending', analytics: { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, views: 0, engagementRate: 0, lastUpdated: null } },
    { postId: 's2', content: 'Sin vistas de verdad', publishedAt: '2026-10-27T14:00:00Z', mediaType: 'reel', syncStatus: 'synced', analytics: { reach: 0, views: 0, likes: 0, lastUpdated: '2026-10-28T10:00:00Z' } },
    { postId: 's3', content: 'Sin métricas en Instagram', publishedAt: '2026-10-26T14:00:00Z', mediaType: 'story', syncStatus: 'partial', platformAnalytics: [{ platform: 'instagram', syncStatus: 'unavailable' }], analytics: { reach: 0 } },
    { postId: 's4', content: 'Sin el campo syncStatus', publishedAt: '2026-10-25T14:00:00Z', mediaType: 'reel', analytics: { reach: 0, lastUpdated: null } },
  ] } };
  out.i = await correr({});

  // (j) Lo que Zernio dice que no entregó (unavailableMetrics, documentado en follower-history): null y DICHO, con su motivo.
  reset();
  resp.seguidores = { status: 200, body: { success: true, metrics: {}, unavailableMetrics: [{ metric: 'follower_count', reason: 'not_enrolled' }] } };
  out.j = await correr({});

  // (k) Una cuenta nombrada que no está (un error al tipear) no contesta con los números de otra: error con las conectadas.
  reset();
  cuentas = [IG, { ...IG, _id: 'acc_ig_2', username: 'otra.cuenta' }];
  out.k = { r: await correr({ cuenta: '@otra.cuentaa' }), pedidos: analitica().length };

  // (l) La clave es de la CUENTA DE MaKo: el ws 1 (su fila tiene la clave de la plataforma) y un negocio con la cuenta PRESTADA
  //     (el interruptor prendido, sin clave propia). El 402 no le habla de «tu cuenta» ni de quién paga.
  reset();
  resp.insights = { status: 402, body: null }; resp.seguidores = { status: 402, body: null }; resp.posts = { status: 402, body: null };
  db.credenciales.push({ workspace_id: 1, clave: 'ZERNIO_API_KEY', valor_enc: cifrar('sk_zernio_de_la_plataforma', 1, 'ZERNIO_API_KEY'), servicio: 'zernio' });
  db.zernio_workspace.push({ workspace_id: 1, profile_id: 'prof_1' });
  const ws1 = await correr({}, 1);
  reset();
  resp.insights = { status: 402, body: null }; resp.seguidores = { status: 402, body: null }; resp.posts = { status: 402, body: null };
  db.credenciales.length = 0;
  db.app_settings.push({ workspace_id: PLATAFORMA, key: 'zernio.cuenta_de_la_plataforma', value: '1', updated_at: '2026-10-28T00:00:00Z' });
  db.zernio_workspace.push({ workspace_id: WS, profile_id: 'prof_1' });
  const prestada = await correr({});
  const clavesPrestada = [...new Set(claves)];
  out.l = { ws1, prestada, clavesPrestada };

  // (m) Conectar: con la cuenta prestada, un 402 de Zernio (la cuenta de MaKo pausada) es un error genérico y SIN el link de pago
  //     de MaKo; con la clave propia del negocio, sí es su cuenta pausada.
  const motivoDe = async (ws: number) => conexionesViaZernio(ws, 'instagram').then(() => null, (e: { motivo?: string; pagoUrl?: string | null }) => ({ motivo: e.motivo ?? null, pagoUrl: e.pagoUrl ?? null }));
  reset();
  cuentasStatus = 402;
  db.credenciales.length = 0;
  db.app_settings.push({ workspace_id: PLATAFORMA, key: 'zernio.cuenta_de_la_plataforma', value: '1', updated_at: '2026-10-28T00:00:00Z' });
  db.zernio_workspace.push({ workspace_id: WS, profile_id: 'prof_1' });
  const conectarPrestada = await motivoDe(WS);
  reset();
  cuentasStatus = 402;
  const conectarPropia = await motivoDe(WS);
  out.m = { conectarPrestada, conectarPropia };

  out.red = [...red];
  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(out)}`, () => process.exit(0));
}

void main().catch((e) => { process.stdout.write(`\n@@RESULTADO@@${JSON.stringify({ tiro: e instanceof Error ? e.stack : String(e) })}`, () => process.exit(0)); });

export {};
