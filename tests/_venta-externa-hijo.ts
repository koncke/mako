// =============================================================================
// Hijo de tests/venta-externa.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La venta de un Payment Link PROPIO del negocio (MAU-10, 28/10/2026), de punta a punta: `procesarEventoStripe` REAL (lib/cobros-
// webhook.ts, `server-only`) en un node aparte con `--conditions=react-server`, sobre el PostgREST de mentira
// (tests/_postgrest-de-mentira.ts), con la API de Stripe y la de Meta de mentira. En el ws 3 (el de prueba), nunca el 1.
// Imprime lo que quedó en la base y lo que salió a Meta. Lo que no es la base, Stripe ni Meta se anota en `red`.
// =============================================================================

import { crearPostgrest, type Fila } from './_postgrest-de-mentira';

const WS = 3;
const PLATAFORMA = 9;
const KEY = 'rk_live_NEGOCIOaaaaaaaaaaaaaa';
const KEY_PRUEBA = 'rk_test_NEGOCIOaaaaaaaaaaaaaa';

let ids = 500;
const AHORA = '2026-10-28T12:00:00.000Z';
const pg = crearPostgrest({
  tablas: ['credenciales', 'webhook_routing', 'cobros', 'leads', 'lead_audit', 'pagos', 'app_settings', 'workspaces', 'cobro_etapa_vinculos', 'productos'],
  defaults: (tabla, f) => {
    if (tabla === 'cobros') return { id: ids++, created_at: new Date().toISOString(), lead_id: null, cuenta: null, motivo: null, ...f };
    if (tabla === 'leads') return { id: ids++, created_at: AHORA, estado_lead: 'abierto', pipeline_stage: 'lead', total_cobrado_usd: null, ...f };
    if (tabla === 'pagos') return { id: ids++, pagado: false, nacio_cobrada: false, resto_de: null, es_mensualidad: false, ...f };
    if (tabla === 'lead_audit') return { id: ids++, created_at: new Date().toISOString(), ...f };
    return { ...f };
  },
  // `cobros_ref_uk (proveedor, proveedor_ref)` (mig 0255): el reclamo de la venta. Sin él, «uno a la vez» no se probaría.
  unicos: [{ tabla: 'cobros', columnas: ['proveedor', 'proveedor_ref'], donde: (f) => f.proveedor_ref != null, nombre: 'cobros_ref_uk' }],
});
const db = pg.db;
const red: string[] = [];
const meta: Array<{ pixel: string; eventos: Array<Record<string, unknown>> }> = [];
let sesiones: Record<string, Record<string, unknown>> = {};
/** Escrituras a Stripe (POST/DELETE): una venta externa nunca escribe en el Stripe del negocio. */
const escriturasStripe: string[] = [];
/** Cuántas altas de lead más contestan 500 (el aviso que se corta después de reclamar la venta). */
let fallarAltaDeLead = 0;

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const metodo = (init.method ?? 'GET').toUpperCase();
  if (u.host === 'supa.test') {
    if (fallarAltaDeLead > 0 && metodo === 'POST' && u.pathname.endsWith('/leads')) {
      fallarAltaDeLead -= 1;
      return json(500, { code: 'XX000', message: 'la base no contesta', details: null, hint: null });
    }
    return pg.responder(u, init);
  }
  if (u.host === 'api.stripe.com') {
    if (metodo !== 'GET') { escriturasStripe.push(`${metodo} ${u.pathname}`); return json(400, { error: { message: 'no se escribe' } }); }
    const m = u.pathname.match(/^\/v1\/checkout\/sessions\/([^/]+)$/);
    const s = m ? sesiones[decodeURIComponent(m[1])] : undefined;
    return s ? json(200, s) : json(404, { error: { message: `sin mock: ${u.pathname}` } });
  }
  if (u.host === 'graph.facebook.com' && metodo === 'POST') {
    const b = JSON.parse(String(init.body ?? '{}')) as { data?: Array<Record<string, unknown>> };
    meta.push({ pixel: u.pathname.split('/')[2] ?? '', eventos: b.data ?? [] });
    return json(200, { events_received: (b.data ?? []).length, fbtrace_id: 'x' });
  }
  red.push(`${metodo} ${u.host}${u.pathname}`);
  return json(500, { error: 'red de mentira' });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales';
process.env.APP_BASE_URL = 'https://mako.test';

/** Una sesión de un Payment Link como la devuelve Stripe con `expand[]=line_items` (el Sprint de Mauricio: US$270). */
const sesion = (id: string, x: Record<string, unknown> = {}): Record<string, unknown> => ({
  id, object: 'checkout.session', status: 'complete', payment_status: 'paid', livemode: !id.startsWith('cs_test_'),
  payment_link: 'plink_SPRINT', payment_intent: `pi_${id.slice(3)}`, subscription: null, invoice: null,
  amount_total: 27000, currency: 'usd', customer_email: null,
  customer_details: { email: 'Comprador@Mail.test', phone: '+5491155550000', name: 'Ana Compradora' },
  metadata: {}, success_url: 'https://negocio.test/gracias.html',
  line_items: { object: 'list', data: [{ description: 'Sprint 3 días', price: { currency: 'usd', unit_amount: 27000, recurring: null } }] },
  ...x,
});
const evento = (sesionId: string, n: number, x: Record<string, unknown> = {}) => ({
  id: `evt_${n}`, tipo: 'checkout.session.completed', livemode: !sesionId.startsWith('cs_test_'), creado: '2026-10-28T11:59:00.000Z',
  objeto: { id: sesionId, payment_status: 'paid', metadata: {} }, ...x,
});

async function main() {
  const { cifrar } = await import('../lib/cripto-credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const { procesarEventoStripe } = await import('../lib/cobros-webhook');
  const { reembolsarCobro, cancelarSuscripcionCobro } = await import('../lib/cobros');

  const cred = (ws: number, clave: string, valor: string) => db.credenciales.push({ workspace_id: ws, clave, valor_enc: cifrar(valor, ws, clave), servicio: 'x' });
  function reset(o: { prendido?: boolean; pixel?: boolean; key?: string } = {}) {
    pg.vaciar();
    meta.length = 0;
    red.length = 0;
    escriturasStripe.length = 0;
    sesiones = {};
    db.workspaces.push({ id: WS, nombre: 'Prueba', capa: 'cliente' }, { id: PLATAFORMA, nombre: 'MaKo', capa: 'superadmin' });
    db.app_settings.push({ workspace_id: WS, key: 'mako.timezone', value: 'America/Argentina/Buenos_Aires', updated_at: AHORA });
    if (o.prendido !== false) db.app_settings.push({ workspace_id: WS, key: 'cobros.ventas_externas', value: '1', updated_at: AHORA });
    for (const ws of [WS, PLATAFORMA]) {
      cred(ws, 'STRIPE_SECRET_KEY', o.key ?? KEY);
      cred(ws, 'STRIPE_ACCOUNT_ID', 'acct_NEGOCIO');
      if (o.pixel !== false) { cred(ws, 'META_PIXEL_ID', '111222333'); cred(ws, 'META_CAPI_TOKEN', 'EAAtokenDelPixel'); }
    }
  }
  const aviso = async (ev: Record<string, unknown>, ws = WS) => {
    try {
      const r = await runWithWorkspace(ws, () => procesarEventoStripe(ws, ev as never, 'principal', 'acct_NEGOCIO'));
      return `${r.estado}: ${r.motivo ?? ''}`;
    } catch (e) {
      return `tira: ${e instanceof Error ? e.message : String(e)}`;
    }
  };
  const foto = () => ({
    cobros: db.cobros.map((c) => ({
      estado: c.estado, modo: c.modo, tipo: c.tipo, monto: c.monto, moneda: c.moneda, monto_usd: c.monto_usd, proveedor_ref: c.proveedor_ref,
      proveedor_pago_id: c.proveedor_pago_id, creado_por: c.creado_por, cuenta: c.cuenta ?? null, cuenta_ref: c.cuenta_ref, lead_id: c.lead_id,
      workspace_id: c.workspace_id, email: c.email, concepto: c.concepto,
    })),
    leads: db.leads.map((l) => ({
      id: l.id, nombre: l.nombre, email: l.email, telefono: l.telefono, origen_lead: l.origen_lead ?? null, estado_lead: l.estado_lead,
      total_cobrado_usd: l.total_cobrado_usd ?? null, workspace_id: l.workspace_id,
    })),
    cuotas: db.pagos.map((p) => ({ lead_id: p.lead_id, pagado: p.pagado, monto_usd: p.monto_usd, cobro_id: p.cobro_id ?? null })),
    historial: db.lead_audit.map((a) => `${a.lead_id}|${a.campo}|${a.valor_nuevo}`),
    meta: meta.flatMap((m) => m.eventos.map((e) => ({ pixel: m.pixel, event_name: e.event_name, event_id: e.event_id, action_source: e.action_source, custom_data: e.custom_data }))),
    escriturasStripe: [...escriturasStripe],
    red: [...red],
  });
  const out: Record<string, unknown> = {};

  // (a) La venta de un Payment Link, prendido: el cobro externo ya pagado, el lead nuevo, la cuota y UNA compra a Meta.
  reset();
  sesiones.cs_live_A = sesion('cs_live_A');
  out.a = { r: await aviso(evento('cs_live_A', 1)), ...foto() };

  // (b) La MISMA venta otra vez (un reintento de Stripe con otro evt_, el cron, el script): nada nuevo, ni a Meta.
  out.b = { r: await aviso(evento('cs_live_A', 2)), ...foto() };

  // (c) El comprador YA estaba en el CRM (por el email, con otra mayúscula): no se crea otro lead, se ata al que estaba.
  reset();
  db.leads.push({ id: 40, workspace_id: WS, nombre: 'Ana de antes', email: 'comprador@mail.test', telefono: null, estado_lead: 'abierto', pipeline_stage: 'lead', created_at: '2026-09-01T00:00:00Z' });
  sesiones.cs_live_C = sesion('cs_live_C');
  out.c = { r: await aviso(evento('cs_live_C', 3)), ...foto() };

  // (d) Dos avisos de la misma venta A LA VEZ: un solo cobro y un solo lead (el reclamo por el `cs_`).
  reset();
  sesiones.cs_live_D = sesion('cs_live_D');
  const dos = await Promise.all([aviso(evento('cs_live_D', 4)), aviso(evento('cs_live_D', 5))]);
  out.d = { r: dos, ...foto() };

  // (e) Una sesión con la metadata de un checkout de MaKo, sin su cobro: no es una venta externa, nada se escribe.
  reset();
  sesiones.cs_live_E = sesion('cs_live_E', { metadata: { mako_cobro: 'tokTokTokTokTokTokTokTokTokTok12' } });
  out.e = { r: await aviso(evento('cs_live_E', 6)), ...foto() };

  // (f) En la plataforma (ahí nace la suscripción de MaKo): nunca, aunque esté prendido.
  reset();
  db.app_settings.push({ workspace_id: PLATAFORMA, key: 'cobros.ventas_externas', value: '1', updated_at: AHORA });
  sesiones.cs_live_F = sesion('cs_live_F');
  out.f = { r: await aviso(evento('cs_live_F', 7), PLATAFORMA), ...foto() };

  // (g) Una venta de PRUEBA (clave y aviso de prueba): se registra en prueba y no va a Meta.
  reset({ key: KEY_PRUEBA });
  sesiones.cs_test_G = sesion('cs_test_G');
  out.g = { r: await aviso(evento('cs_test_G', 8)), ...foto() };

  // (h) Sin píxel: la venta entra igual, a Meta no sale nada y el historial lo dice.
  reset({ pixel: false });
  sesiones.cs_live_H = sesion('cs_live_H');
  out.h = { r: await aviso(evento('cs_live_H', 9)), ...foto() };

  // (i) Apagado (el estado de todos los negocios hasta que MaKo lo prenda): no se registra nada; la compra a Meta, sí.
  reset({ prendido: false });
  sesiones.cs_live_I = sesion('cs_live_I');
  out.i = { r: await aviso(evento('cs_live_I', 10)), ...foto() };

  // (j) Un cobro externo no se reembolsa ni se cancela desde MaKo (sería un POST al Stripe del negocio).
  reset();
  sesiones.cs_live_J = sesion('cs_live_J');
  await aviso(evento('cs_live_J', 11));
  const idJ = Number((db.cobros[0] as Fila | undefined)?.id ?? 0);
  out.j = {
    reembolsar: await runWithWorkspace(WS, () => reembolsarCobro(WS, idJ, 'test', 'prueba')).catch((e) => ({ tira: String(e) })),
    cancelar: await runWithWorkspace(WS, () => cancelarSuscripcionCobro(WS, idJ, 'test')).catch((e) => ({ tira: String(e) })),
    ...foto(),
  };

  // (k) El aviso dice que la sesión no está pagada (un Payment Link con pago diferido que llegó como `completed` pagado y la
  //     sesión releída dice otra cosa): nada se escribe.
  reset();
  sesiones.cs_live_K = sesion('cs_live_K', { payment_status: 'unpaid' });
  out.k = { r: await aviso(evento('cs_live_K', 12)), ...foto() };

  // (l) El aviso se corta DESPUÉS de reclamar la venta y antes del lead (la base falla al crearlo; en Vercel, el tope de 8 s):
  //     el reintento de Stripe encuentra el cobro externo y tiene que COMPLETARLO (lead, cuota y compra a Meta), no tratarlo
  //     como un cobro de MaKo «ya pagado» y dejarlo sin lead para siempre.
  reset();
  sesiones.cs_live_L = sesion('cs_live_L');
  fallarAltaDeLead = 1;
  const corte = await aviso(evento('cs_live_L', 13));
  const trasElCorte = foto();
  // Pasó el rato del reclamo (`RECLAMO_DE_VENTA_MS`): el reintento ya no lo toma como «otro aviso lo está registrando».
  for (const c of db.cobros) c.created_at = new Date(Date.now() - 10 * 60_000).toISOString();
  out.l = { corte, trasElCorte: { cobros: trasElCorte.cobros.length, leads: trasElCorte.leads.length, meta: trasElCorte.meta.length }, r: await aviso(evento('cs_live_L', 14)), ...foto() };

  // (m) Una SUSCRIPCIÓN por un Payment Link: va con su factura (`in_`) y su `sub_`, sin escribir en Stripe, y no se cancela
  //     desde MaKo.
  reset();
  sesiones.cs_live_M = sesion('cs_live_M', {
    payment_intent: null, subscription: 'sub_M', invoice: 'in_M', amount_total: 9700,
    line_items: { object: 'list', data: [{ description: 'Membresía', price: { currency: 'usd', unit_amount: 9700, recurring: { interval: 'month' } } }] },
  });
  await aviso(evento('cs_live_M', 15));
  const idM = Number((db.cobros[0] as Fila | undefined)?.id ?? 0);
  out.m = { cancelar: await runWithWorkspace(WS, () => cancelarSuscripcionCobro(WS, idM, 'test')).catch((e) => ({ tira: String(e) })), ...foto() };

  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(out)}`);
}

void main().catch((e) => { process.stdout.write(`\n@@RESULTADO@@${JSON.stringify({ tiro: e instanceof Error ? e.stack : String(e) })}`); });

// Módulo, no script: sin esto tsc los junta en un solo ámbito global con los otros hijos y choca cada `db`/`json`.
export {};
