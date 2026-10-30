// =============================================================================
// Hijo de tests/zernio-leads-barrido.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El barrido de leads de Meta por Zernio (29/10/2026): `barrerLeadsDeZernio` REAL (`server-only`, `--conditions=react-server`) sobre
// el PostgREST de mentira y un Zernio de mentira que lista leads (`GET /v1/ads/leads`). La carga se inyecta (la real escribe en
// decenas de tablas y la prueban sus tests): acá importa QUÉ se carga y con qué pedido.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

const pg = crearPostgrest({ tablas: ['credenciales', 'app_settings', 'workspaces', 'webhook_routing', 'zernio_workspace', 'leads', 'leads_papelera'] });
const db = pg.db;
const pedidos: Array<{ key: string; ruta: string }> = [];
const red: string[] = [];
let leadsDe: Record<string, unknown[]> = {};
let prohibido403 = new Set<string>();
let papeleraCaida = false;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') {
    if (u.pathname.endsWith('/leads_papelera')) {
      if (papeleraCaida) return json(500, { code: 'XX000', message: 'la papelera no responde' });
      // PostgREST corta en 1000 filas SIN avisar (max-rows) y el de mentira no: acá se corta como el de verdad, con el `offset` y el
      // `limit` de `.range()`.
      const desde = Number(u.searchParams.get('offset') ?? 0);
      const limite = Math.min(Number(u.searchParams.get('limit') ?? 1000) || 1000, 1000);
      const sin = new URL(u.href);
      sin.searchParams.delete('offset');
      sin.searchParams.delete('limit');
      const filas = (await (await pg.responder(sin, init)).json()) as unknown[];
      return json(200, filas.slice(desde, desde + limite));
    }
    return pg.responder(u, init);
  }
  if (u.host === 'zernio.com') {
    const ruta = u.pathname.replace(/^\/api\/v1/, '');
    const key = (new Headers(init.headers).get('authorization') ?? '').replace(/^Bearer /, '');
    pedidos.push({ key, ruta: `${ruta}${u.search}` });
    // Con la clave de la plataforma, el negocio acuña SU perfil (`mako_ws_<ws>`).
    if (ruta === '/profiles' && (init.method ?? 'GET').toUpperCase() === 'POST') {
      const nombre = (JSON.parse(String(init.body)) as { name: string }).name;
      return json(200, { profile: { _id: `prof_${nombre}`, name: nombre } });
    }
    if (ruta === '/profiles') return json(200, { profiles: [{ _id: `prof_${key}`, name: 'Default', isDefault: true }] });
    if (ruta === '/accounts') {
      const de: Record<string, unknown[]> = {
        sk_uno: [{ _id: 'acc_fb_1', platform: 'facebook', username: 'pagina', isActive: true }, { _id: 'acc_ig_1', platform: 'instagram', username: 'ig', isActive: true }],
        sk_dos: [{ _id: 'acc_ads_2', platform: 'metaads', username: 'ads', isActive: true }],
      };
      const perfil = u.searchParams.get('profileId') ?? `prof_${key}`;
      return json(200, { accounts: (de[key] ?? []).map((a) => ({ ...(a as object), profileId: perfil })) });
    }
    if (ruta === '/ads/leads') {
      if (prohibido403.has(key)) return json(403, { error: 'Ads add-on required', code: 'ads_addon_required' });
      return json(200, { status: 'success', leads: leadsDe[key] ?? [], pagination: { hasMore: false, cursor: null } });
    }
    return json(404, { error: `sin mock: ${ruta}` });
  }
  red.push(`${u.host}${u.pathname}`);
  return json(500, { error: 'red de mentira' });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales';
process.env.ZERNIO_API_KEY = 'sk_zernio_de_la_plataforma';

const WS = 3;
const OWNER = 1;
const AHORA = new Date('2026-10-29T18:00:00Z');
const hace = (min: number) => new Date(AHORA.getTime() - min * 60_000).toISOString();
const lead = (id: string, min: number, extra: Record<string, unknown> = {}) => ({
  id: `z_${id}`, leadgenId: id, formId: 'f1', formName: 'Formulario', accountId: 'acc_fb_1', adId: '120001', adsetId: '120002', campaignId: '120003',
  isOrganic: false, createdTime: hace(min),
  fieldData: [{ name: 'full_name', values: [`Persona ${id}`] }, { name: 'phone_number', values: ['+5491100000000'] }, { name: 'email', values: [`p${id}@mail.com`] }],
  ...extra,
});

async function main() {
  const { cifrar } = await import('../lib/cripto-credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const Z = await import('../lib/zernio');
  const { barrerLeadsDeZernio } = await import('../lib/zernio-leads-barrido');

  const cargados: string[] = [];
  const anunciados: string[] = [];
  const opciones: unknown[] = [];
  let creaLaCarga = true;
  const deps = {
    cargar: async (l: { leadgenId: string; creadoEn: string | null }, _ahora: Date, opc: unknown) => {
      cargados.push(l.leadgenId);
      opciones.push(opc);
      return { leadId: cargados.length, nombre: 'x', telefono: null, email: null, creado: creaLaCarga, nuevo: creaLaCarga, conversion: true };
    },
    alNacer: async (_ws: number, _c: unknown, l: { leadgenId: string }) => { anunciados.push(l.leadgenId); },
  };
  const reset = (claves: string[]) => {
    pg.vaciar();
    pedidos.length = 0; cargados.length = 0; anunciados.length = 0; opciones.length = 0; leadsDe = {}; prohibido403 = new Set();
    papeleraCaida = false; creaLaCarga = true;
    Z.olvidarClavesZernio(WS);
    db.workspaces.push({ id: WS, nombre: 'Prueba', capa: 'cliente' }, { id: 9, nombre: 'MaKo', capa: 'superadmin' });
    claves.forEach((k, i) => {
      const env = i === 0 ? 'ZERNIO_API_KEY' : `ZERNIO_API_KEY_${i + 1}`;
      db.credenciales.push({ workspace_id: WS, clave: env, valor_enc: cifrar(k, WS, env), servicio: 'zernio' });
    });
  };
  const barrer = (dias = 1) => runWithWorkspace(WS, () => barrerLeadsDeZernio(WS, dias, AHORA, deps as never));
  const out: Record<string, unknown> = {};

  // (a) Los que faltan entran; el que ya está, el de la papelera, el de menos de 5 minutos y uno de LinkedIn, no.
  reset(['sk_uno']);
  db.leads.push({ id: 1, workspace_id: WS, meta_lead_id: '10000000000001', nombre: 'Ya estaba' });
  db.leads_papelera.push({ id: 1, workspace_id: WS, lead_id: 2, foto: { v: 1, filas: { leads: [{ id: 2, meta_lead_id: '10000000000002' }] } } });
  leadsDe.sk_uno = [
    lead('10000000000001', 60), lead('10000000000002', 60), lead('10000000000003', 60), lead('10000000000004', 2),
    lead('urn:li:leadFormResponse:9', 60), lead('10000000000003', 60),
    // Tres días: fuera de la ventana de 1 día. Si Zernio ignora `since`, no se carga igual (B1).
    lead('10000000000006', 3 * 24 * 60),
  ];
  out.a = {
    r: await barrer(), cargados: [...cargados], anunciados: [...anunciados], opciones: [...opciones],
    pedidos: pedidos.filter((p) => p.ruta.startsWith('/ads/leads')).map((p) => p.ruta),
  };

  // (b) Con DOS claves: cada una se lee con la suya (la 2 tiene la conexión de anuncios); sin el complemento (403) se dice y se sigue.
  reset(['sk_uno', 'sk_dos']);
  leadsDe.sk_uno = [lead('20000000000001', 60)];
  leadsDe.sk_dos = [lead('20000000000002', 60, { accountId: 'acc_ads_2' })];
  out.b = { r: await barrer(), cargados: [...cargados].sort(), claves: [...new Set(pedidos.filter((p) => p.ruta.startsWith('/ads/leads')).map((p) => p.key))].sort() };
  reset(['sk_uno', 'sk_dos']);
  prohibido403 = new Set(['sk_dos']);
  leadsDe.sk_uno = [lead('30000000000001', 60)];
  out.c = { r: await barrer(), cargados: [...cargados] };

  // (d) Uno que falla al cargar no tumba a los demás.
  reset(['sk_uno']);
  leadsDe.sk_uno = [lead('40000000000001', 60), lead('40000000000002', 60)];
  const cargarConFalla = async (l: { leadgenId: string }) => {
    if (l.leadgenId === '40000000000001') throw new Error('duplicate key value violates unique constraint "leads_meta_lead_id_key"');
    cargados.push(l.leadgenId);
    return { leadId: 1, nombre: 'x', telefono: null, email: null, creado: true, nuevo: true, conversion: true };
  };
  out.d = { r: await runWithWorkspace(WS, () => barrerLeadsDeZernio(WS, 1, AHORA, { ...deps, cargar: cargarConFalla } as never)), cargados: [...cargados] };

  // (e) Sin ninguna página ni conexión de anuncios: no se le pregunta nada a /ads/leads.
  reset(['sk_tres']);
  out.e = { r: await barrer(), pedidosLeads: pedidos.filter((p) => p.ruta.startsWith('/ads/leads')).length };

  // (f) Con la clave de la PLATAFORMA (`byok: false`, el negocio dueño): SÓLO las cuentas de su perfil (`accountIds`), nunca el equipo
  // entero (sin el filtro, un negocio vería los leads de otro).
  reset([]);
  db.workspaces.push({ id: OWNER, nombre: 'Dueño', capa: 'cliente' });
  db.credenciales.push({ workspace_id: OWNER, clave: 'ZERNIO_API_KEY', valor_enc: cifrar('sk_uno', OWNER, 'ZERNIO_API_KEY'), servicio: 'zernio' });
  Z.olvidarClavesZernio(OWNER);
  // ⚠️ Y SI ZERNIO IGNORA EL FILTRO (revisión de privacidad, M1): vuelven también el lead de la página de otro negocio y uno que no
  // dice de qué cuenta es. Se descartan en memoria: el ws1 se queda SÓLO con el suyo.
  leadsDe.sk_uno = [lead('50000000000001', 60), lead('50000000000002', 60, { accountId: 'acc_fb_ws7' }), lead('50000000000003', 60, { accountId: undefined })];
  const rF = await runWithWorkspace(OWNER, () => barrerLeadsDeZernio(OWNER, 1, AHORA, deps as never));
  out.f = { r: rF, cargados: [...cargados], pedidos: pedidos.filter((p) => p.ruta.startsWith('/ads/leads')).map((p) => p.ruta) };

  // (g) Con clave PROPIA, lo mismo (M2): el equipo de Zernio del cliente puede tener páginas que el negocio desconectó u otros perfiles.
  // Sólo entran los de SUS cuentas de Facebook y de anuncios (ni la de Instagram, que no tiene formularios).
  reset(['sk_uno']);
  leadsDe.sk_uno = [lead('60000000000001', 60), lead('60000000000002', 60, { accountId: 'acc_fb_que_ya_no_es_mia' }), lead('60000000000003', 60, { accountId: 'acc_ig_1' })];
  out.g = { r: await barrer(), cargados: [...cargados] };

  // (h) La persona YA era un lead (la carga no lo crea, M3): ni conversión ni aviso.
  reset(['sk_uno']);
  creaLaCarga = false;
  leadsDe.sk_uno = [lead('70000000000001', 60)];
  out.h = { r: await barrer(), cargados: [...cargados], anunciados: [...anunciados] };

  // (i) La papelera con MÁS de 1000 filas (M4): el borrado número 1200 tampoco vuelve.
  reset(['sk_uno']);
  for (let i = 1; i <= 1500; i++) {
    db.leads_papelera.push({ id: i, workspace_id: WS, lead_id: 1000 + i, foto: { v: 1, filas: { leads: [{ id: 1000 + i, meta_lead_id: String(80000000000000 + i) }] } } });
  }
  leadsDe.sk_uno = [lead('80000000001200', 60), lead('80000000009999', 60)];
  out.i = { r: await barrer(), cargados: [...cargados] };

  // (j) La papelera no se pudo leer (M4): el barrido corta, no carga nada a ciegas.
  reset(['sk_uno']);
  papeleraCaida = true;
  leadsDe.sk_uno = [lead('81000000000001', 60)];
  try {
    await barrer();
    out.j = { tiro: false, cargados: [...cargados] };
  } catch (e) {
    out.j = { tiro: true, mensaje: e instanceof Error ? e.message : String(e), cargados: [...cargados], anunciados: [...anunciados] };
  }

  out.red = [...red];
  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(out)}`, () => process.exit(0));
}

void main().catch((e) => { process.stdout.write(`\n@@RESULTADO@@${JSON.stringify({ tiro: e instanceof Error ? e.stack : String(e) })}`, () => process.exit(0)); });

export {};
