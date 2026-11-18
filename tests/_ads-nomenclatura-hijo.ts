// =============================================================================
// Hijo de tests/ads-nomenclatura.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre de verdad (`server-only`, `--conditions=react-server`) el runner `proponer_agregar_anuncio` de la API de MaKo
// (lib/api-mako/areas/ads.run.ts), sobre el PostgREST de mentira, un Zernio de mentira y una Graph API de mentira. Dos negocios:
//   · ws13 lee Meta por el token: ahí se prueban los nombres (con código, copiando el del conjunto, con una letra libre o tomada,
//     con el código de otro conjunto, sin código, después de aprobada otra, y con la lectura de los anuncios caída);
//   · ws3 conectó Meta por Zernio (sin token): el árbol se lee por Zernio y el anuncio se CREA por Zernio, así se ve con qué
//     nombre llega a Meta (desde el 03/11/2026, con el token no se crean anuncios).
// La cuenta tiene un conjunto en la nomenclatura («001.02 Leads / Testimonio») con anuncios 001.02.a y 001.02.c, uno sin código,
// y un anuncio de OTRO conjunto que se llama «001.02.k …» (un duplicado que se movió de lugar): no es su hermano.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.META_API_VERSION = 'v21.0';

const pg = crearPostgrest({ tablas: ['credenciales', 'workspaces', 'app_settings', 'webhook_routing', 'zernio_workspace', 'creative_transcripts'] });
let red: string[] = [];
const creados: Array<Record<string, unknown>> = [];
let anunciosFallan = false;
type Ad = { id: string; name: string; adset: string };
const anuncios: Ad[] = [
  { id: '71', name: '001.02.a Hook dolor', adset: '5001' },
  { id: '72', name: '001.02.c Testimonio v2', adset: '5001' },
  { id: '74', name: 'Video 5 Proactividad', adset: '5001' },
  { id: '79', name: '001.02.k Duplicado movido', adset: '5009' },
];
const CONJUNTOS: Record<string, string> = { 5001: '001.02 Leads / Testimonio', 5002: 'Conversiones / Ganadores', 5009: '001.05 Otro conjunto' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  const metodo = (init.method ?? 'GET').toUpperCase();
  if (u.host === 'zernio.com') {
    const ruta = u.pathname.replace(/^\/api\/v1/, '');
    red.push(`zernio ${metodo} ${ruta}`);
    if (metodo === 'POST' && ruta === '/ads/create') {
      creados.push(JSON.parse(String(init.body ?? '{}')) as Record<string, unknown>);
      return json({ ad: { platformAdId: 'ad-77', _id: 'z-1' } });
    }
    const conj = /^\/ads\/ad-sets\/(\d+)$/.exec(ruta)?.[1];
    if (conj && CONJUNTOS[conj]) return json({ adSet: { id: conj, account_id: 'act_33333', name: CONJUNTOS[conj], optimization_goal: 'LINK_CLICKS' } });
    if (ruta === '/ads/accounts') return json({ accounts: [{ id: 'act_33333', name: 'Cuenta por Zernio', currency: 'MXN', accountStatus: 1, timezoneName: 'America/Mexico_City' }] });
    if (ruta === '/ads/accounts/finance') return json({});
    if (ruta === '/ads/accounts/live') {
      return json({
        currency: 'MXN',
        campaigns: [{ platformCampaignId: '4001', campaignName: '001. Leads / Testimonio', configuredStatus: 'ACTIVE', platformCampaignStatus: 'ACTIVE' }],
        adSets: Object.entries(CONJUNTOS).map(([id, name]) => ({ platformAdSetId: id, adSetName: name, platformCampaignId: '4001', configuredStatus: 'PAUSED', platformAdSetStatus: 'PAUSED' })),
        paging: {},
      });
    }
    if (ruta === '/ads') {
      if (anunciosFallan) return json({ error: 'Zernio no contestó la lista de anuncios' }, 503);
      return json({ ads: anuncios.map((a) => ({ platformAdId: a.id, platformAdSetId: a.adset, platformCampaignId: '4001', name: a.name, platformStatus: 'PAUSED', status: 'paused' })), pagination: { page: 1, pages: 1 } });
    }
    if (ruta === '/ads/images') return json({ data: [{ hash: 'hash-1', url: 'https://img.test/1.jpg' }] });
    if (ruta === '/ads/ad-77') return json({ ad: { status: 'paused', configuredStatus: 'PAUSED', platformStatus: 'PAUSED' } });
    return json({ error: `sin mock: ${ruta}` }, 404);
  }
  if (u.host === 'graph.facebook.com') {
    const ruta = u.pathname.replace(/^\/v21\.0/, '');
    red.push(`graph ${metodo} ${ruta}`);
    if (ruta === '/act_1313') return json({ id: 'act_1313', name: 'Cuenta por el token', account_status: 1, currency: 'MXN', timezone_name: 'America/Mexico_City', balance: '0', amount_spent: '0' });
    if (ruta === '/act_1313/campaigns') return json({ data: [{ id: '4001', name: '001. Leads / Testimonio', effective_status: 'ACTIVE', configured_status: 'ACTIVE', objective: 'OUTCOME_LEADS' }] });
    if (ruta === '/act_1313/adsets') return json({ data: Object.entries(CONJUNTOS).map(([id, name]) => ({ id, name, campaign_id: '4001', effective_status: 'PAUSED', configured_status: 'PAUSED' })) });
    if (ruta === '/act_1313/ads') {
      if (anunciosFallan) return json({ error: { message: 'Meta no contestó la lista de anuncios', code: 2 } });
      return json({ data: anuncios.map((a) => ({ id: a.id, name: a.name, adset_id: a.adset, campaign_id: '4001', effective_status: 'PAUSED', configured_status: 'PAUSED' })) });
    }
    if (ruta === '/act_1313/recommendations') return json({ data: [] });
    const conj = /^\/(\d+)$/.exec(ruta)?.[1];
    if (conj && CONJUNTOS[conj]) return json({ id: conj, account_id: 'act_1313', name: CONJUNTOS[conj], optimization_goal: 'LINK_CLICKS' });
    return json({ error: { message: `graph de mentira: ${ruta}`, code: 100 } });
  }
  red.push(`otro ${u.host}${u.pathname}`);
  return json({ error: 'red de mentira' }, 500);
}) as typeof fetch;

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const { RUNNERS } = await import('../lib/api-mako/areas/ads.run');
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: 3, capa: 'cliente', nombre: 'Por Zernio' }, { id: 13, capa: 'cliente', nombre: 'Sólo token' });
  const cred = (ws: number, clave: string, valor: string, servicio: string) => pg.db.credenciales.push({ workspace_id: ws, clave, valor_enc: cifrarSecreto(valor, ws, clave), servicio });
  cred(13, 'META_ACCESS_TOKEN', 'tok_ws13', 'meta');
  cred(13, 'META_AD_ACCOUNT_ID', 'act_1313', 'meta');
  cred(13, 'META_PAGE_ID', '111', 'meta');
  cred(3, 'ZERNIO_API_KEY', 'sk_zernio_ws3', 'zernio');
  cred(3, 'META_ZERNIO_CUENTA', 'zacc_3', 'zernio');
  cred(3, 'META_AD_ACCOUNT_ID', 'act_33333', 'meta');
  cred(3, 'META_PAGE_ID', '111', 'meta');

  type Run = { preparar: (i: Record<string, unknown>, c: unknown) => Promise<Record<string, unknown>>; ejecutar: (p: Record<string, unknown>, c: unknown) => Promise<Record<string, unknown>> };
  const run = RUNNERS.proponer_agregar_anuncio as unknown as Run;
  const ctx = (ws: number) => ({ ws, canal: 'app', canalKey: 'app:prueba', alcance: 'ejecutar', rol: 'admin' });
  const base = { fuente: 'upload', media_type: 'image', image_hash: 'hash-1', primary_text: 'Texto del anuncio', destination_url: 'https://ejemplo.test/landing' };
  const atrapar = (e: unknown) => ({ tira: e instanceof Error ? e.message : String(e) });
  const preparar = async (ws: number, adsetId: string, nombre: string) => {
    red = [];
    const r = await runWithWorkspace(ws, () => run.preparar({ ...base, adsetId, nombre }, ctx(ws))).catch(atrapar);
    return { ...r, red };
  };
  const ejecutar = async (ws: number, payload: unknown) => {
    red = [];
    creados.length = 0;
    if (!payload || typeof payload !== 'object') return { tira: 'sin payload' };
    const r = await runWithWorkspace(ws, () => run.ejecutar(payload as Record<string, unknown>, ctx(ws))).catch(atrapar);
    return { ...r, red, creados: creados.map((c) => ({ name: c.name, adSetId: c.adSetId })) };
  };

  const out: Record<string, unknown> = {};
  out.describe = await preparar(13, '5001', 'Testimonio Juan');
  out.copiaElDelConjunto = await preparar(13, '5001', '001.02 Testimonio');
  out.letraLibre = await preparar(13, '5001', '001.02.b Hook nuevo');
  out.letraTomada = await preparar(13, '5001', '001.02.a Hook');
  out.otroConjunto = await preparar(13, '5001', '001.05.f Copiado de otro');
  out.sinCodigo = await preparar(13, '5002', 'Testimonio Juan');

  // Por Zernio: el árbol por Zernio, y el anuncio creado por Zernio con el nombre que dijo el resumen.
  out.zernio = await preparar(3, '5001', 'Testimonio Juan');
  out.zernioEjecutar = await ejecutar(3, (out.zernio as { payload?: unknown }).payload);

  // Lo que ve quien confirma después de aprobada la primera (aplicarPropuestaGenerica vuelve a preparar): la letra siguiente.
  anuncios.push({ id: 'ad-77', name: '001.02.d Testimonio Juan', adset: '5001' });
  out.despuesDeAprobada = await preparar(13, '5001', 'Testimonio Juan');
  out.zernioDespuesDeAprobada = await preparar(3, '5001', 'Testimonio Juan');

  anunciosFallan = true;
  out.lecturaCaida = await preparar(13, '5001', 'Testimonio Juan');
  out.zernioLecturaCaida = await preparar(3, '5001', 'Testimonio Juan');
  out.sinCodigoConLecturaCaida = await preparar(13, '5002', 'Testimonio Juan');
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
