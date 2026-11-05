// =============================================================================
// Hijo de tests/instagram-perfil-fuentes.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre LA función de Instagram REAL (`leerPerfilInstagram`, lib/instagram-perfil-server.ts, `server-only`) en un node
// aparte con `--conditions=react-server`, con las credenciales y el workspace de la plataforma de mentira (por
// `Module._load`) y un fetch de mentira que contesta como Meta y como Apify y anota cada pedido. Imprime una línea JSON.
// =============================================================================

export {};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Modulo = require('node:module') as { _load: (pedido: string, padre: unknown, esMain: boolean) => unknown };
const cargarOriginal = Modulo._load;

/** Las credenciales de cada escenario: `<ws>:<clave>` → valor. Las cambia `escenario()`. */
let creds: Record<string, string> = {};
/** Si la lectura ESTRICTA de la key de la plataforma tira (la base no contesta). */
let estrictaTira = false;
Modulo._load = function (this: unknown, pedido: string, padre: unknown, esMain: boolean) {
  if (/[/\\]credenciales$|^@\/lib\/credenciales$|^\.\/credenciales$/.test(pedido)) {
    const leer = async (clave: string, ws?: number) => creds[`${ws}:${clave}`] ?? null;
    const estricta = async (clave: string, ws: number) => { if (estrictaTira) throw new Error('la base no contesta'); return leer(clave, ws); };
    // `clavesGuardadasConBase` (5/11/2026): las claves extra de Spy (lib/instagram-perfil-server.ts → `clavesApifyDeSpy`). Sólo nombres.
    const guardadas = async (ws: number, bases: readonly string[]) =>
      Object.keys(creds).filter((k) => k.startsWith(`${ws}:`)).map((k) => k.slice(String(ws).length + 1)).filter((c) => bases.includes(c));
    return { credWs: leer, credDelCliente: leer, credWsEstricta: estricta, clavesGuardadasConBase: guardadas };
  }
  if (/[/\\]workspace$|^@\/lib\/workspace$|^\.\/workspace$/.test(pedido)) return { wsSuperAdmin: async () => 9 };
  return cargarOriginal.call(this, pedido, padre, esMain);
};

/** Qué contesta la Meta de cada página (`pagina-<ws>`): con o sin Instagram, y si encuentra al usuario. */
let metaConIg: Record<string, boolean> = {};
let apifyTrae = true;
let apifyCae = false;
const pedidos: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const auth = String((init.headers as Record<string, string> | undefined)?.Authorization ?? '');
  pedidos.push(`${u.host}${u.pathname}${auth ? ` ${auth}` : ''}`);
  const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } });
  if (u.host === 'graph.facebook.com') {
    const pag = u.pathname.split('/').pop() ?? '';
    if (pag.startsWith('pagina-')) return json(metaConIg[pag] ? { id: pag, instagram_business_account: { id: `ig-${pag}` } } : { id: pag });
    const usuario = /username\(([^)]+)\)/.exec(u.searchParams.get('fields') ?? '')?.[1] ?? '';
    // Una cuenta personal: Business Discovery no la ve (2207013).
    if (usuario.startsWith('personal_')) return json({ error: { code: 110, error_subcode: 2207013, message: 'Invalid user id' } }, 400);
    return json({ business_discovery: { username: usuario, name: 'Por Meta', biography: 'bio de Meta', media: { data: [] } } });
  }
  if (u.host === 'api.apify.com') {
    const body = JSON.parse(String(init.body ?? '{}')) as { usernames?: string[] };
    if (apifyCae) return json({ error: 'caído' }, 500);
    // Con varios usuarios (`leerPerfilesEnLote`) devuelve uno por cada uno, salvo los que empiezan con «noexiste_».
    const usuarios = (body.usernames ?? []).filter((x) => !x.startsWith('noexiste_'));
    return json(apifyTrae ? usuarios.map((usuario) => ({ username: usuario, fullName: 'Por Apify', biography: 'bio de Apify', followersCount: 1234, latestPosts: [{ caption: 'un post', timestamp: '2026-10-20T00:00:00Z', type: 'Image' }] })) : [], 201);
  }
  return json({ error: 'red de mentira' }, 500);
}) as typeof fetch;
console.warn = () => {};

async function main() {
  const { leerPerfilInstagram } = await import('../lib/instagram-perfil-server');
  const out: Record<string, unknown> = {};
  const correr = async (nombre: string, u: string, opts: Parameters<typeof leerPerfilInstagram>[1]) => {
    pedidos.length = 0;
    const r = await leerPerfilInstagram(u, opts);
    out[nombre] = { ok: r.ok, fuente: r.ok ? r.fuente : null, motivo: r.ok ? null : r.motivo, bio: r.ok ? r.perfil.bio : null, pedidos: [...pedidos] };
  };

  // A: la Meta del negocio tiene Instagram → la lee ella; Apify ni se llama.
  creds = { '5:META_ACCESS_TOKEN': 't5', '5:META_PAGE_ID': 'pagina-5', '9:APIFY_TOKEN': 'apify-plataforma' };
  metaConIg = { 'pagina-5': true };
  await correr('metaDelNegocio', 'cuenta_demo_a', { ws: 5 });

  // B: ninguna Meta con Instagram → Apify con la key de la PLATAFORMA.
  creds = { '5:META_ACCESS_TOKEN': 't5', '5:META_PAGE_ID': 'pagina-5', '9:META_ACCESS_TOKEN': 't9', '9:META_PAGE_ID': 'pagina-9', '9:APIFY_TOKEN': 'apify-plataforma', '5:APIFY_TOKEN': 'apify-negocio' };
  metaConIg = {};
  await correr('apifyDeLaPlataforma', 'cuenta_demo_b', { ws: 5 });

  // C: la plataforma sin key de Apify → la del negocio.
  creds = { '5:APIFY_TOKEN': 'apify-negocio' };
  await correr('apifyDelNegocio', 'cuenta_demo_c', { ws: 5 });

  // D: un @ corto no se le pregunta a Apify.
  creds = { '9:APIFY_TOKEN': 'apify-plataforma' };
  await correr('arrobaCorto', 'flor', { ws: 5 });

  // E: la misma pregunta dos veces → una sola corrida (caché).
  await correr('primera', 'cuenta_demo_e', { ws: 5 });
  await correr('segunda', 'cuenta_demo_e', { ws: 5 });

  // F: Apify no lo encuentra → 'no-esta' (la cuenta no existe).
  apifyTrae = false;
  await correr('noEsta', 'cuenta_demo_f', { ws: 5, fuentes: ['apify'] });

  // M1, la fuga: ws5 (su Meta tiene Instagram) lee @fuga_ok; ws6, sin ninguna fuente, NO lo recibe de la caché.
  creds = { '5:META_ACCESS_TOKEN': 't5', '5:META_PAGE_ID': 'pagina-5' };
  metaConIg = { 'pagina-5': true };
  await correr('fugaDeWs5', 'fuga_ok', { ws: 5 });
  await correr('fugaEnWs6', 'fuga_ok', { ws: 6 });
  // M1, el envenenamiento: ws6 pregunta primero y no tiene con qué; ws5, cuya Meta anda, igual lo lee.
  await correr('venenoWs6', 'veneno_ok', { ws: 6 });
  await correr('venenoWs5', 'veneno_ok', { ws: 5 });

  // B1: Meta dice «no está» (cuenta personal) y Apify se cae: el «no está» queda 10 min, no 24 h.
  creds = { '5:META_ACCESS_TOKEN': 't5', '5:META_PAGE_ID': 'pagina-5', '9:APIFY_TOKEN': 'apify-plataforma' };
  apifyCae = true;
  await correr('personalConApifyCaido', 'personal_uno', { ws: 5 });
  const entrada = [...((globalThis as unknown as { __igPerfilCache: Map<string, { hasta: number }> }).__igPerfilCache).entries()].find(([k]) => k.includes('personal_uno'));
  out.minutosEnCache = entrada ? Math.round((entrada[1].hasta - Date.now()) / 60_000) : null;
  apifyCae = false;

  // B2: la key de la plataforma no se puede leer → NO paga el negocio.
  creds = { '5:APIFY_TOKEN': 'apify-negocio' };
  estrictaTira = true;
  await correr('plataformaIlegible', 'ilegible_ok', { ws: 5, fuentes: ['apify'] });
  estrictaTira = false;

  // B3: un @ inválido no sale a la red.
  await correr('arrobaInvalido', 'mal)usuario', { ws: 5 });

  // G: el tope por día: 40 corridas con la key de la plataforma; la 41 no sale. Desde cero (el contador es de la
  // instancia: se limpia para medir exacto).
  creds = { '9:APIFY_TOKEN': 'apify-plataforma' };
  apifyTrae = false;
  (globalThis as unknown as { __igApifyHoy: Map<string, number> }).__igApifyHoy.clear();
  let corridas = 0;
  for (let i = 0; i < 45; i++) {
    pedidos.length = 0;
    await leerPerfilInstagram(`tope_usuario_${i}`, { ws: 7, fuentes: ['apify'] });
    corridas += pedidos.filter((p) => p.startsWith('api.apify.com')).length;
  }
  out.topeCorridas = corridas;
  const ultima = await leerPerfilInstagram('tope_usuario_99', { ws: 7, fuentes: ['apify'] });
  out.topeMotivo = ultima.ok ? null : ultima.motivo;

  // H (3/11/2026): lo del buscador de Spy. El negocio 8 sólo tiene la clave de Spy.
  const apifyHoy = (globalThis as unknown as { __igApifyHoy: Map<string, number> }).__igApifyHoy;
  const cuentaDel8 = `s8|${new Date().toISOString().slice(0, 10)}`;
  const LA_DEL_ALTA = ['meta-negocio', 'meta-plataforma', 'apify', 'apify-spy'] as const;
  creds = { '8:APIFY_INSTAGRAM_TOKEN': 'clave-spy' };
  apifyTrae = true;
  apifyHoy.clear();
  // El buscador lo lee con SU lista y la vista previa con OTRA: la misma persona se paga una vez.
  await correr('leeElBuscador', 'compartida_ok', { ws: 8, fuentes: ['meta-plataforma', 'apify', 'apify-spy'] });
  await correr('leeLaVista', 'compartida_ok', { ws: 8, fuentes: LA_DEL_ALTA });
  // Y otro negocio no la recibe de esa caché, aunque tenga con qué leer: lo suyo lo paga él.
  creds = { '8:APIFY_INSTAGRAM_TOKEN': 'clave-spy', '3:APIFY_INSTAGRAM_TOKEN': 'clave-otra' };
  await correr('otroNegocio', 'compartida_ok', { ws: 3, fuentes: LA_DEL_ALTA });
  // Pero una lectura sin piezas no le contesta a quien las pide.
  await correr('quienPidePiezas', 'compartida_ok', { ws: 8, fuentes: LA_DEL_ALTA, conPiezas: true });
  // La reserva: con el cupo de la clave de Spy (150) menos la reserva (15) ya gastado, no sale; y ese freno no le tapa
  // nada a quien no la tiene.
  const { TOPE_LECTURAS_SPY_POR_DIA, TOPE_BUSQUEDAS_SPY_POR_DIA } = await import('../lib/instagram-perfil');
  out.topeLecturasSpy = TOPE_LECTURAS_SPY_POR_DIA;
  out.topeBusquedasSpy = TOPE_BUSQUEDAS_SPY_POR_DIA;
  apifyHoy.set(cuentaDel8, TOPE_LECTURAS_SPY_POR_DIA - 15);
  await correr('conReservaFrena', 'reserva_ok', { ws: 8, fuentes: LA_DEL_ALTA, reservaApify: 15 });
  await correr('sinReservaLee', 'reserva_ok', { ws: 8, fuentes: LA_DEL_ALTA });
  apifyHoy.set(cuentaDel8, TOPE_LECTURAS_SPY_POR_DIA - 16);
  await correr('conReservaAunLee', 'reserva_margen', { ws: 8, fuentes: LA_DEL_ALTA, reservaApify: 15 });
  // ⚠️ 4/11/2026: las búsquedas por nombre tienen SU cupo. Gastarlo no deja al negocio sin poder leer un @.
  const { gastarBusquedaDeSpy, topeDeSpyAgotado, leerPerfilesEnLote } = await import('../lib/instagram-perfil-server');
  apifyHoy.clear();
  let busquedas = 0;
  out.topeAgotadoAntes = topeDeSpyAgotado(8);
  for (let i = 0; i < TOPE_BUSQUEDAS_SPY_POR_DIA + 5; i++) if (gastarBusquedaDeSpy(8)) busquedas++;
  out.busquedasDelDia = busquedas;
  out.topeAgotadoDespues = topeDeSpyAgotado(8);
  await correr('leerConBusquedasAgotadas', 'sin_cupo_ok', { ws: 8, fuentes: LA_DEL_ALTA });

  // I (4/11/2026): varias filas en UNA corrida, que comparte la caché con la lectura de uno.
  apifyHoy.clear();
  pedidos.length = 0;
  const lote = await leerPerfilesEnLote(['lote_a', 'lote_b', 'noexiste_c'], { ws: 8 });
  out.loteCorridas = pedidos.filter((p) => p.startsWith('api.apify.com')).length;
  out.loteOk = [...lote].filter(([, l]) => l.ok).map(([u]) => u).sort();
  out.loteContadas = apifyHoy.get(cuentaDel8) ?? 0;
  await correr('despuesDelLote', 'lote_a', { ws: 8, fuentes: LA_DEL_ALTA });
  pedidos.length = 0;
  await leerPerfilesEnLote(['lote_a', 'lote_b'], { ws: 8 });
  out.loteRepetidoCorridas = pedidos.filter((p) => p.startsWith('api.apify.com')).length;
  // Con reserva y UN lugar libre: entra uno, y los otros dos vuelven como «limite» (no se pasa del cupo).
  apifyHoy.set(cuentaDel8, TOPE_LECTURAS_SPY_POR_DIA - 15 - 1);
  const conReserva = await leerPerfilesEnLote(['res_a', 'res_b', 'res_c'], { ws: 8, reserva: 15 });
  out.loteConReservaOk = [...conReserva].filter(([, l]) => l.ok).length;
  out.loteConReservaLimite = [...conReserva].filter(([, l]) => !l.ok && l.motivo === 'limite').length;
  process.stdout.write(`${JSON.stringify(out)}\n`);
}
main().catch((e) => { console.error(e); process.exit(1); });
