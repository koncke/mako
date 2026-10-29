// =============================================================================
// Hijo de tests/zernio-varias-claves.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Varias claves de Zernio por negocio (29/10/2026): `clavesZernio`, `cfgDeCuenta`, `conexionesViaZernio`, `urlConectarViaZernio`,
// `asegurarWebhook`, `enviarDm` y `crearPostZernio` REALES (`server-only`, `--conditions=react-server`) sobre el PostgREST de
// mentira y un Zernio de mentira con una cuenta por clave. Imprime con QUÉ CLAVE habló cada pedido.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

const pg = crearPostgrest({ tablas: ['credenciales', 'app_settings', 'workspaces', 'webhook_routing', 'zernio_workspace'] });
const db = pg.db;
const pedidos: Array<{ key: string; metodo: string; ruta: string; cuerpo: unknown }> = [];
const red: string[] = [];

// Lo que tiene conectado cada cuenta de Zernio (una por clave).
type Cuenta = { _id: string; platform: string; username: string; isActive: boolean };
const cuentasDe = new Map<string, Cuenta[]>();
const webhooksDe = new Map<string, Array<{ _id: string; url: string }>>();

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const metodo = (init.method ?? 'GET').toUpperCase();
  if (u.host === 'supa.test') return pg.responder(u, init);
  if (u.host === 'zernio.com') {
    const ruta = u.pathname.replace(/^\/api\/v1/, '');
    const key = (new Headers(init.headers).get('authorization') ?? '').replace(/^Bearer /, '');
    const cuerpo = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    pedidos.push({ key, metodo, ruta: `${ruta}${u.search}`, cuerpo });
    if (!cuentasDe.has(key)) return json(401, { error: 'Invalid API key' });
    if (ruta === '/profiles') return json(200, { profiles: [{ _id: `prof_${key}`, name: 'Default', isDefault: true }] });
    if (ruta === '/accounts') {
      const plataforma = u.searchParams.get('platform');
      const lista = cuentasDe.get(key)!.filter((a) => !plataforma || a.platform === plataforma);
      return json(200, { accounts: lista.map((a) => ({ ...a, profileId: `prof_${key}` })) });
    }
    if (ruta.startsWith('/connect/')) return json(200, { authUrl: `https://zernio.com/oauth/${ruta.slice(9)}?con=${key}` });
    if (ruta === '/webhooks/settings' && metodo === 'GET') return json(200, { webhooks: webhooksDe.get(key) ?? [] });
    if (ruta === '/webhooks/settings') {
      const w = cuerpo as { url?: string };
      webhooksDe.set(key, [...(webhooksDe.get(key) ?? []), { _id: `wh_${key}`, url: w.url ?? '' }]);
      return json(200, { webhook: { _id: `wh_${key}` } });
    }
    if (ruta.startsWith('/inbox/conversations/')) return json(200, { data: { messageId: `msg_${key}` } });
    if (ruta === '/posts' && metodo === 'POST') return json(200, { post: { _id: `post_${key}` } });
    return json(404, { error: `sin mock: ${metodo} ${ruta}` });
  }
  red.push(`${metodo} ${u.host}${u.pathname}`);
  return json(500, { error: 'red de mentira' });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales';
process.env.ZERNIO_API_KEY = 'sk_zernio_de_la_plataforma';
process.env.ZERNIO_WEBHOOK_SECRET = 'maestro-de-prueba';

const WS = 3;
const PLATAFORMA = 9;
const cuenta = (id: string, platform: string): Cuenta => ({ _id: id, platform, username: id, isActive: true });

async function main() {
  const { cifrar } = await import('../lib/cripto-credenciales');
  const Z = await import('../lib/zernio');
  const C = await import('../lib/zernio-conectar');
  const P = await import('../lib/zernio-publicar');

  /** `claves`: las claves del negocio en orden (la 1 es `ZERNIO_API_KEY`); `cuentas`: lo que tiene conectado cada una. */
  const reset = (claves: string[], cuentas: Record<string, Cuenta[]>) => {
    pg.vaciar();
    pedidos.length = 0;
    cuentasDe.clear(); webhooksDe.clear();
    Z.olvidarClavesZernio(WS);
    db.workspaces.push({ id: WS, nombre: 'Prueba', capa: 'cliente' }, { id: PLATAFORMA, nombre: 'MaKo', capa: 'superadmin' });
    claves.forEach((k, i) => {
      const env = i === 0 ? 'ZERNIO_API_KEY' : `ZERNIO_API_KEY_${i + 1}`;
      db.credenciales.push({ workspace_id: WS, clave: env, valor_enc: cifrar(k, WS, env), servicio: 'zernio' });
      // El email de la cuenta (no es una clave: no tiene que contar).
      if (i > 0) db.credenciales.push({ workspace_id: WS, clave: `${env}_ACCOUNT`, valor_enc: cifrar(`otro${i}@gmail.com`, WS, `${env}_ACCOUNT`), servicio: 'zernio' });
      cuentasDe.set(k, cuentas[k] ?? []);
    });
  };
  const conQue = (desde: number) => pedidos.slice(desde).map((p) => `${p.key} ${p.metodo} ${p.ruta.split('?')[0]}`);
  const out: Record<string, unknown> = {};

  // (a) UNA SOLA CLAVE: todo como antes. `cfgDeCuenta` no le pregunta nada a Zernio.
  reset(['sk_uno'], { sk_uno: [cuenta('acc_fb_1', 'facebook')] });
  const a0 = pedidos.length;
  const unica = await Z.cfgDeCuenta(WS, 'acc_fb_1');
  out.a = { slot: unica.slot, claves: (await Z.clavesZernio(WS)).map((k) => k.slot), pedidosAZernio: conQue(a0) };

  // (b) DOS CLAVES: las extra se leen (el email `_ACCOUNT` no es una clave), la lista junta las dos, cada red con su número.
  reset(['sk_uno', 'sk_dos'], {
    sk_uno: [cuenta('acc_fb_1', 'facebook'), cuenta('acc_ig_1', 'instagram')],
    sk_dos: [cuenta('acc_li_2', 'linkedin')],
  });
  const claves = await Z.clavesZernio(WS);
  const lista = await C.conexionesViaZernio(WS);
  out.b = {
    claves: claves.map((k) => `${k.slot}:${k.apiKey}`),
    conexiones: lista.map((c) => `${c.accountId}@${c.clave}`).sort(),
    ruteoPerfil: db.webhook_routing.filter((f) => f.servicio === 'zernio').map((f) => `${f.identificador}→${f.workspace_id}`).sort(),
  };

  // (c) LA RED QUEDA ATADA A SU CLAVE: un DM y un post sobre la cuenta de la clave 2 salen con la 2; los de la 1, con la 1.
  const c0 = pedidos.length;
  const dm2 = await Z.enviarDm(WS, 'conv_1', { accountId: 'acc_li_2', texto: 'hola' });
  const dm1 = await Z.enviarDm(WS, 'conv_2', { accountId: 'acc_fb_1', texto: 'hola' });
  const post2 = await P.crearPostZernio(WS, { content: 'x', platforms: [{ platform: 'linkedin', accountId: 'acc_li_2' }] } as never, 'req-1');
  out.c = {
    dm2: dm2.messageId, dm1: dm1.messageId, post2: post2.id,
    huellaPost2EsLaDeLa2: post2.clave === Z.huellaClave('sk_dos'),
    // Lo publicado con la 2 se puede leer y borrar (la huella es del negocio).
    huellasDelNegocio: [...(await P.huellasDelNegocio(WS))].map((h) => (h === Z.huellaClave('sk_uno') ? 'uno' : h === Z.huellaClave('sk_dos') ? 'dos' : h)).sort(),
    salieron: conQue(c0).filter((x) => !x.includes('/accounts')),
  };

  // (e) CONECTAR: la 1 está llena (2 activas) y la 2 tiene lugar → el login se pide con la 2, sin aviso.
  const e0 = pedidos.length;
  const rE = await C.urlConectarViaZernio(WS, 'twitter' as never, '/integraciones', {});
  out.e = { r: rE, connect: conQue(e0).filter((x) => x.includes('/connect/')) };

  // (d) Una red RECIÉN conectada con la clave 2 (después de que se cacheó su lista) igual sale con la 2: se relee una vez. Y una
  // cuenta que no es de ninguna no vuelve a leer en el acto (va a la 1).
  cuentasDe.get('sk_dos')!.push(cuenta('acc_tt_2', 'tiktok'));
  const d = await Z.cfgDeCuenta(WS, 'acc_tt_2');
  const d0 = pedidos.length;
  const nadie1 = await Z.cfgDeCuenta(WS, 'acc_de_nadie');
  const d1 = pedidos.length;
  const nadie2 = await Z.cfgDeCuenta(WS, 'acc_de_nadie');
  out.d = { recien: d.slot, nadie: [nadie1.slot, nadie2.slot], lecturasPrimera: d1 - d0, lecturasSegunda: pedidos.length - d1 };

  // (f) Las DOS llenas → el aviso ANTES del login, con «agrega otra clave»; ningún /connect.
  reset(['sk_uno', 'sk_dos'], {
    sk_uno: [cuenta('acc_fb_1', 'facebook'), cuenta('acc_ig_1', 'instagram')],
    sk_dos: [cuenta('acc_li_2', 'linkedin'), cuenta('acc_tt_2', 'tiktok')],
  });
  const f0 = pedidos.length;
  const rF = await C.urlConectarViaZernio(WS, 'youtube' as never, '/integraciones', {});
  out.f = { r: rF, connect: conQue(f0).filter((x) => x.includes('/connect/')) };
  // «Conectar igual»: con el permiso, en la 1.
  const g0 = pedidos.length;
  await C.urlConectarViaZernio(WS, 'youtube' as never, '/integraciones', { aceptaCobro: true });
  out.g = conQue(g0).filter((x) => x.includes('/connect/'));
  // Volver a entrar con una red que esa clave ya tiene no suma: va derecho a la clave que tiene lugar para ella (la 2 tiene LinkedIn).
  const h0 = pedidos.length;
  const rH = await C.urlConectarViaZernio(WS, 'linkedin' as never, '/integraciones', {});
  out.h = { ok: rH.ok, connect: conQue(h0).filter((x) => x.includes('/connect/')) };

  // (i) Las CINCO claves llenas → el aviso ya no ofrece otra clave: dice la salida que queda.
  const cinco = ['sk_uno', 'sk_dos', 'sk_tres', 'sk_cuatro', 'sk_cinco'];
  reset(cinco, Object.fromEntries(cinco.map((k) => [k, [cuenta(`fb_${k}`, 'facebook'), cuenta(`ig_${k}`, 'instagram')]])));
  out.i = await C.urlConectarViaZernio(WS, 'youtube' as never, '/integraciones', {});

  // (j) EL WEBHOOK, en CADA clave, con la misma URL del negocio (`?w=3`): la ruta verifica igual venga de la que venga.
  reset(['sk_uno', 'sk_dos'], { sk_uno: [], sk_dos: [] });
  const wh = await Z.asegurarWebhook(WS);
  out.j = { wh, urls: [...webhooksDe.entries()].map(([k, l]) => `${k}:${l.map((w) => w.url.replace(/^https?:\/\/[^/]+/, '')).join(',')}`).sort() };

  // (k) Una clave EXTRA rota (401) no tumba la lista: se ven las de la 1.
  reset(['sk_uno', 'sk_rota'], { sk_uno: [cuenta('acc_fb_1', 'facebook')] });
  cuentasDe.delete('sk_rota');
  out.k = await C.conexionesViaZernio(WS).then((l) => l.map((c) => `${c.accountId}@${c.clave}`), (e) => `tira ${(e as { motivo?: string }).motivo ?? e}`);

  // (l) La misma clave pegada como 1 y como 2 cuenta UNA vez.
  reset(['sk_uno', 'sk_uno'], { sk_uno: [] });
  out.l = (await Z.clavesZernio(WS)).map((k) => k.slot);

  out.red = [...red];
  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(out)}`, () => process.exit(0));
}

void main().catch((e) => { process.stdout.write(`\n@@RESULTADO@@${JSON.stringify({ tiro: e instanceof Error ? e.stack : String(e) })}`, () => process.exit(0)); });

export {};
