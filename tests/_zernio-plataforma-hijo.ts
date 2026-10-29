// =============================================================================
// Hijo de tests/zernio-plataforma.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La cuenta de Zernio de la PLATAFORMA para un negocio sin key (28/10/2026): `cfg`, `ensureProfile` y `conexionesViaZernio`
// REALES (`server-only`, `--conditions=react-server`) sobre el PostgREST de mentira y Zernio de mentira. Imprime con qué key
// y qué perfil habló cada negocio.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

const pg = crearPostgrest({ tablas: ['credenciales', 'app_settings', 'workspaces', 'webhook_routing', 'zernio_workspace'] });
const db = pg.db;
const pedidos: Array<{ key: string; metodo: string; ruta: string; cuerpo: unknown }> = [];
let fallarAjuste = false;
const red: string[] = [];

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const metodo = (init.method ?? 'GET').toUpperCase();
  if (u.host === 'supa.test') {
    if (fallarAjuste && u.pathname.endsWith('/app_settings') && (u.searchParams.get('key') ?? '').includes('zernio.cuenta_de_la_plataforma')) {
      return json(500, { code: 'XX000', message: 'la base no contesta', details: null, hint: null });
    }
    return pg.responder(u, init);
  }
  if (u.host === 'zernio.com') {
    const ruta = u.pathname.replace(/^\/api\/v1/, '');
    const key = (new Headers(init.headers).get('authorization') ?? '').replace(/^Bearer /, '');
    const cuerpo = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    pedidos.push({ key, metodo, ruta: `${ruta}${u.search}`, cuerpo });
    if (ruta === '/profiles' && metodo === 'POST') return json(200, { profile: { _id: `prof_${(cuerpo as { name: string }).name}`, name: (cuerpo as { name: string }).name } });
    if (ruta === '/profiles') return json(200, { profiles: [{ _id: 'prof_default_propio', name: 'Default', isDefault: true }] });
    if (ruta === '/accounts') return json(200, { accounts: [{ _id: 'acc_ig_9', platform: 'instagram', username: 'cuenta', profileId: u.searchParams.get('profileId'), isActive: true }] });
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

async function main() {
  const { cifrar } = await import('../lib/cripto-credenciales');
  const Z = await import('../lib/zernio');
  const { conexionesViaZernio } = await import('../lib/zernio-conectar');

  const reset = (o: { prestada?: boolean; propia?: number[] } = {}) => {
    pg.vaciar();
    pedidos.length = 0; fallarAjuste = false;
    db.workspaces.push({ id: 3, nombre: 'Prueba', capa: 'cliente' }, { id: 13, nombre: 'Otro', capa: 'cliente' }, { id: PLATAFORMA, nombre: 'MaKo', capa: 'superadmin' });
    if (o.prestada) db.app_settings.push({ workspace_id: PLATAFORMA, key: 'zernio.cuenta_de_la_plataforma', value: '1', updated_at: '2026-10-28T00:00:00Z' });
    for (const ws of o.propia ?? []) db.credenciales.push({ workspace_id: ws, clave: 'ZERNIO_API_KEY', valor_enc: cifrar(`sk_propia_${ws}`, ws, 'ZERNIO_API_KEY'), servicio: 'zernio' });
  };
  const cfgDe = (ws: number) => Z.cfg(ws).then((c) => ({ key: c.apiKey, byok: c.byok }), (e) => ({ tira: e instanceof Error ? e.message : String(e) }));
  const out: Record<string, unknown> = {};

  // (a) Apagado (el de todos hasta que MaKo lo prenda): un negocio sin key no tiene Zernio.
  reset();
  out.a = { cfg: await cfgDe(3), configurado: await Z.zernioConfigurado(3), conexiones: await conexionesViaZernio(3).then(() => 'anda', (e) => (e as { motivo?: string }).motivo ?? String(e)) };

  // (b) Prendido: la key de la plataforma, su perfil `mako_ws_3` (acuñado con esa key) y su ruteo; las cuentas, de ESE perfil.
  reset({ prestada: true });
  const cfgB = await cfgDe(3);
  const conB = await conexionesViaZernio(3).then((c) => c.map((x) => x.accountId), (e) => `tira ${(e as { motivo?: string }).motivo ?? e}`);
  const conC = await conexionesViaZernio(13).then((c) => c.map((x) => x.accountId), (e) => `tira ${(e as { motivo?: string }).motivo ?? e}`);
  out.b = {
    cfg: cfgB, conexiones3: conB, conexiones13: conC,
    perfiles: db.zernio_workspace.map((f) => `${f.workspace_id}:${f.profile_id}`).sort(),
    ruteo: db.webhook_routing.map((f) => `${f.servicio}/${f.identificador}→${f.workspace_id}`).sort(),
    pedidos: pedidos.map((p) => `${p.key === 'sk_zernio_de_la_plataforma' ? 'PLATAFORMA' : p.key} ${p.metodo} ${p.ruta.split('&excludeHidden')[0]}`),
  };

  // (c) Con key propia, la propia, aunque la plataforma preste la suya.
  reset({ prestada: true, propia: [3] });
  out.c = await cfgDe(3);

  // (d) El negocio de la PLATAFORMA sin fila no toma la key «prestada» (su key es su fila).
  reset({ prestada: true });
  out.d = await cfgDe(PLATAFORMA);

  // (e) «No pude leer» el interruptor no es «apagado»: tira (no es «no tiene Zernio»).
  reset({ prestada: true });
  fallarAjuste = true;
  out.e = { cfg: await cfgDe(3), configurado: await Z.zernioConfigurado(3).then((x) => x, (e) => `tira ${e instanceof Error ? e.message : e}`) };

  out.red = [...red];
  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(out)}`, () => process.exit(0));
}

void main().catch((e) => { process.stdout.write(`\n@@RESULTADO@@${JSON.stringify({ tiro: e instanceof Error ? e.stack : String(e) })}`, () => process.exit(0)); });

export {};
