// =============================================================================
// admin-ingresos — el lector de lo que entra a MaKo, para la sección Revenue de la tab Admin (5/11/2026)
// =============================================================================
// Las cuentas viven en lib/admin-ingresos-reglas.ts (puro, testeado). Acá se lee la base y se normaliza a `PagoIngreso`.
//
// DE DÓNDE SALE LA PLATA (medido en producción el 5/11/2026, docs/relevo/admin-encargo.md):
//   1. `pagos` del CRM de la PLATAFORMA (`wsSuperAdmin()`, nunca `OWNER_WS`: el 1 es un cliente) con `pagado = true`. Ahí
//      está todo lo que Martín cobró a mano (transferencia, Binance) y también lo que cobró la pasarela de un lead: el
//      cobro lo asienta `registrarCobroDeProveedor` como un pago con su `cobro_id` (lib/pagos.ts).
//   2. `cobros` de la plataforma PAGADOS que ningún pago nombra (`cobro_id`): un lugar de agencia o un alta sin lead.
//      Así no se cuenta dos veces lo mismo.
//   3. (10/11/2026) EL LIBRO DE LA MENSUALIDAD DE LAS AGENCIAS (lib/agencia-mes.ts, `app_settings` de la plataforma): cada orden de
//      Binance que anotó, menos las que ya cuenta un pago del CRM (`recibo_pagos.pago_id`, mig 0408). Al leer, sin escribir en
//      `pagos`: la entrada de Patricia (9/11) entró por ahí y Revenue no la veía. Las reglas, en lib/admin-ingresos-libro.ts; que la
//      mensualidad del libro y la del CRM no se cuenten dos veces, en `conElLibro` (lib/admin-ingresos-reglas.ts).
//
// QUÉ ES RECURRENTE (MRR) Y QUÉ ES CASH SOLO (el porqué, en las reglas):
//   · un pago registrado COMO la mensualidad (`es_mensualidad`, mig 0323): siempre;
//   · una cuota del PLAN de un lead de suscripción (`venta_tipo = 'suscripcion'`, ni nacida cobrada ni el resto de otra);
//   · el cobro de una suscripción de la pasarela (`cobros.tipo = 'suscripcion'`).
//   Lo demás —un pago suelto, el diferencial de un cliente nuevo, una venta de pago único o por tramos— suma al cash del mes
//   y al total del cliente, nunca al MRR (Martín: el MRR va aparte y no infla lo cerrado).
//
// ⚠️ CUANDO EL CHAT DE LA SUSCRIPCIÓN EN LA FICHA (punta/suscripciones-ficha) cambie cómo se guarda una suscripción, el
//    único lugar que cambia es `esRecurrente` (y quizás la clave de la suscripción): las cuentas no saben de dónde salió
//    cada pago. Su relevo dirá cómo leerlo (docs/relevo/nube-suscripciones.md).
//
// A QUIÉN SE LE ATRIBUYE: al lead del CRM de la plataforma y, si tiene su cuenta de MaKo (`leads.cliente_ws`, mig 0175), a
// esa cuenta: «el cliente» es el negocio. Un cobro de un lugar de agencia (`cobros.agencia_ws`) es de la AGENCIA, que es la
// que le paga a MaKo (un cliente de agencia no es un cliente de MaKo: vive adentro de su agencia).
//
// ⚠️ CRUZA NEGOCIOS: sólo el super admin (lo pregunta quien llama: app/admin/page.tsx, la API). Sólo lee lo de la
//    plataforma: sus pagos, sus leads (nombre, empresa, cuenta, tipo de venta) y sus cobros, y los nombres de los negocios.
// =============================================================================

import 'server-only';
import { cache } from 'react';
import { getSupabaseServer } from './supabase';
import { leerTodo } from './supabase-paginado';
import { listarWorkspaces, runWithWorkspace, wsSuperAdmin } from './workspace';
import { zonaDelNegocio } from './timezone';
import { hoyEnTz } from './date-utils';
import { calcularIngresos, diaEnLaZona, esLeadDeSuscripcion, proximoDeHistoria, type ClienteIngreso, type Ingresos, type PagoIngreso, type ProximoDeSuscripcion } from './admin-ingresos-reglas';
import { cobradoDelLead, type Cobrado, type CobroParaCobrado } from './cobrado-lead';
import { esDelTrato } from './pagos-crm';
import { leerCambiosDeSuscripcion } from './suscripcion-movimientos';
import type { PagoDeSuscripcion } from './suscripcion-meses';
import { ordenesAtadas, pagosDelLibro, PREFIJO_LIBRO, type CobroDeRecibo, type FilaLibro } from './admin-ingresos-libro';
import { leadDeLaCuenta } from './recibos-reglas';

type FilaPago = {
  id: number; lead_id: number; funnel_id: number | null; monto_usd: number | null; fecha_pago: string | null;
  es_mensualidad: boolean | null; nacio_cobrada: boolean | null; resto_de: number | null;
  metodo: string | null; proveedor: string | null; cobro_id: number | null; concepto: string | null; proveedor_pago_id: string | null;
};
type FilaLead = { id: number; nombre: string | null; empresa: string | null; cliente_ws: number | null; venta_tipo: string | null };
type FilaCobro = {
  id: number; tipo: string; estado: string; pagado_at: string | null; monto_usd: number | null; lead_id: number | null;
  alta_ws: number | null; cliente_ws?: number | null; agencia_ws?: number | null; proveedor: string | null; concepto: string | null;
  proveedor_pago_id: string | null;
};

/** ¿Este pago es de una suscripción (MRR)? Ver la cabecera. */
export function esRecurrente(p: Pick<FilaPago, 'es_mensualidad' | 'nacio_cobrada' | 'resto_de' | 'cobro_id'>, lead: Pick<FilaLead, 'venta_tipo'> | undefined, cobrosDeSuscripcion: ReadonlySet<number>): boolean {
  if (p.es_mensualidad === true) return true;
  if (p.cobro_id != null && cobrosDeSuscripcion.has(Number(p.cobro_id))) return true;
  return lead?.venta_tipo === 'suscripcion' && p.nacio_cobrada !== true && p.resto_de == null;
}

/** Los leads de esos ids, de a tandas (un `.in` largo no entra en la URL). */
async function leadsDe(plataforma: number, ids: readonly number[]): Promise<Map<number, FilaLead>> {
  const out = new Map<number, FilaLead>();
  const db = getSupabaseServer();
  for (let i = 0; i < ids.length; i += 200) {
    const tanda = ids.slice(i, i + 200);
    const { data, error } = await db.from('leads').select('id, nombre, empresa, cliente_ws, venta_tipo')
      .eq('workspace_id', plataforma).in('id', tanda);
    if (error) throw new Error(`No pude leer los leads de los pagos: ${error.message}`);
    for (const l of (data ?? []) as FilaLead[]) out.set(Number(l.id), l);
  }
  return out;
}

/** Los cobros pagados de la plataforma. Tolera una base sin las columnas de agencia (mig 0306). */
async function cobrosPagados(plataforma: number): Promise<FilaCobro[]> {
  const db = getSupabaseServer();
  const base = 'id, tipo, estado, pagado_at, monto_usd, lead_id, alta_ws, proveedor, concepto, proveedor_pago_id';
  for (const cols of [`${base}, cliente_ws, agencia_ws`, base]) {
    try {
      return await leerTodo<FilaCobro>(db, 'cobros', cols, { eq: { workspace_id: plataforma, estado: 'pagado' }, orden: 'id' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (cols === base || !/cliente_ws|agencia_ws|column/.test(msg)) throw e;
    }
  }
  return [];
}

/** Una tabla que todavía no existe (la mig 0397 sin aplicar): sin recibos, ninguna orden está atada a un pago del CRM. */
const faltaLaTabla = (msg: string) => /Could not find the table|relation .* does not exist|PGRST205|42P01/.test(msg);

/**
 * El libro de las agencias (todas las filas de `PREFIJO_LIBRO` de la plataforma, paginadas: el libro crece con cada aviso) y las
 * órdenes que ya cuenta un pago del CRM (los cobros de los recibos atados a un pago, `recibo_pagos.pago_id`). «No pude leer» tira:
 * sin saber cuáles están atadas, una orden se contaría dos veces.
 */
async function libroDeLasAgencias(plataforma: number): Promise<{ filas: FilaLibro[]; atadas: Set<string> }> {
  const db = getSupabaseServer();
  const [filas, cobros] = await Promise.all([
    leerTodo<{ key: string; value: unknown }>(db, 'app_settings', 'key, value', {
      eq: { workspace_id: plataforma }, filtros: (q) => q.like('key', `${PREFIJO_LIBRO}%`), orden: 'key',
    }),
    // Con `*`: sin la mig 0408 no hay `pago_id`, y entonces ninguna orden está atada (como lee Admin › Sales).
    leerTodo<CobroDeRecibo>(db, 'recibo_pagos', '*', { eq: { medio: 'binance' }, orden: 'id' }).catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      if (faltaLaTabla(msg)) return [] as CobroDeRecibo[];
      throw new Error(`no pude ver cuáles ya están en el CRM: ${msg}`);
    }),
  ]);
  return {
    filas: filas.filter((f) => typeof f.value === 'string').map((f) => ({ key: f.key, value: f.value as string })),
    atadas: ordenesAtadas(cobros.map((c) => ({ ...c, pago_id: c.pago_id ?? null, anulado: c.anulado === true }))),
  };
}

/** La ficha del CRM de la plataforma de cada agencia (`leads.cliente_ws`), para el link de su renglón. */
async function fichasDeAgencias(plataforma: number, agencias: readonly number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (!agencias.length) return out;
  const { data, error } = await getSupabaseServer().from('leads').select('id, cliente_ws, estado_lead, venta_tipo')
    .eq('workspace_id', plataforma).in('cliente_ws', [...agencias]);
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as Array<{ id: number; cliente_ws: number; estado_lead: string | null; venta_tipo: string | null }>;
  for (const ag of agencias) {
    const l = leadDeLaCuenta(filas.filter((f) => Number(f.cliente_ws) === ag));
    if (l.ok) out.set(ag, l.id);
  }
  return out;
}

export type VistaIngresos = Ingresos & {
  /** Lo que no se pudo leer: lo que se muestra puede quedarse corto. */
  avisos: string[];
};

/**
 * ⚠️ UNA LECTURA POR PEDIDO (6/11/2026): en una misma página de Admin la piden varios (Customers lee la lista de negocios,
 * que la lee adentro —lib/clientes-plataforma.ts—, y después sus propias cuentas; la ficha de un negocio, Sales y lo que paga).
 * `cache` de React la lee una vez por pedido del server; fuera de un render (una ruta, un cron, un test) no guarda nada.
 * La clave es el MINUTO de `ahora`: `ahora` sólo dice qué día es en la zona de la plataforma, y redondear al minuto no cambia el
 * día. Quien llama con su propio `new Date()` un instante después comparte la misma lectura.
 */
const MINUTO_MS = 60_000;
const vistaDelMinuto = cache((minuto: number): Promise<VistaIngresos> => calcularVistaDeIngresos(new Date(minuto * MINUTO_MS)));

export async function vistaDeIngresos(ahora: Date = new Date()): Promise<VistaIngresos> {
  return vistaDelMinuto(Math.floor(ahora.getTime() / MINUTO_MS));
}

async function calcularVistaDeIngresos(ahora: Date): Promise<VistaIngresos> {
  const plataforma = await wsSuperAdmin();
  const avisos: string[] = [];
  const db = getSupabaseServer();
  const [pagos, cobros, wss, tz, libroLeido] = await Promise.all([
    // Si esto falla, la sección no tiene qué mostrar: el error sube (la pantalla dice «No pude leer tus ingresos»).
    leerTodo<FilaPago>(db, 'pagos', 'id, lead_id, funnel_id, monto_usd, fecha_pago, es_mensualidad, nacio_cobrada, resto_de, metodo, proveedor, cobro_id, concepto, proveedor_pago_id',
      { eq: { workspace_id: plataforma, pagado: true }, orden: 'id' }),
    cobrosPagados(plataforma).catch((e) => { avisos.push(`los cobros de la pasarela: ${e instanceof Error ? e.message : String(e)}`); return [] as FilaCobro[]; }),
    listarWorkspaces().catch((e) => { avisos.push(`los nombres de los negocios: ${e instanceof Error ? e.message : String(e)}`); return []; }),
    zonaDelNegocio(plataforma).catch(() => 'UTC'),
    // Si el libro no se lee, lo de las agencias no suma y SE DICE: no es un cero.
    libroDeLasAgencias(plataforma).catch((e) => { avisos.push(`los pagos de las agencias por su mensualidad: ${e instanceof Error ? e.message : String(e)}`); return null; }),
  ]);
  const hoy = hoyEnTz(tz, ahora);
  const nombreWs = new Map(wss.map((w) => [w.id, w.nombre]));
  const leads = await leadsDe(plataforma, [...new Set(pagos.map((p) => Number(p.lead_id)))]);
  const deSuscripcion = new Set(cobros.filter((c) => c.tipo === 'suscripcion').map((c) => Number(c.id)));
  const nombrados = new Set(pagos.map((p) => p.cobro_id).filter((x): x is number => x != null).map(Number));

  const quien = new Map<string, ClienteIngreso>();
  const claveDeLead = (l: FilaLead | undefined, leadId: number): string => {
    if (l?.cliente_ws != null) {
      const ws = Number(l.cliente_ws);
      const clave = `ws:${ws}`;
      if (!quien.has(clave)) quien.set(clave, { clave, nombre: nombreWs.get(ws) ?? (l.empresa || l.nombre || `Workspace ${ws}`), ws, leadId });
      return clave;
    }
    const clave = `lead:${leadId}`;
    if (!quien.has(clave)) quien.set(clave, { clave, nombre: (l?.empresa || l?.nombre || `Lead ${leadId}`).trim(), ws: null, leadId });
    return clave;
  };

  const normalizados: PagoIngreso[] = [];
  for (const p of pagos) {
    if (!p.fecha_pago) continue;
    const leadId = Number(p.lead_id);
    const l = leads.get(leadId);
    const cliente = claveDeLead(l, leadId);
    normalizados.push({
      id: `p:${p.id}`, cliente,
      suscripcion: esRecurrente(p, l, deSuscripcion) ? `lead:${leadId}:${p.funnel_id ?? 'casa'}` : null,
      fecha: String(p.fecha_pago).slice(0, 10),
      usd: typeof p.monto_usd === 'number' ? p.monto_usd : p.monto_usd == null ? null : Number(p.monto_usd),
      medio: p.metodo ?? p.proveedor ?? null,
      concepto: p.concepto ?? null,
      cobroId: p.cobro_id != null ? Number(p.cobro_id) : null,
      proveedor: p.proveedor ?? null,
      proveedorPagoId: p.proveedor_pago_id ?? null,
      // Cuál suscripción del CRM es la mensualidad de una agencia: la que pasa a llevar su libro (`conElLibro`).
      mensualidad: p.es_mensualidad === true,
    });
  }
  for (const c of cobros) {
    if (nombrados.has(Number(c.id)) || !c.pagado_at) continue;
    // De quién: la agencia que paga el lugar, la cuenta que nació del cobro, o el lead.
    const ws = c.agencia_ws ?? c.cliente_ws ?? c.alta_ws;
    let cliente: string;
    if (ws != null) {
      cliente = `ws:${Number(ws)}`;
      if (!quien.has(cliente)) quien.set(cliente, { clave: cliente, nombre: nombreWs.get(Number(ws)) ?? `Workspace ${ws}`, ws: Number(ws), leadId: null });
    } else if (c.lead_id != null) {
      cliente = claveDeLead(leads.get(Number(c.lead_id)), Number(c.lead_id));
    } else continue;
    normalizados.push({
      id: `c:${c.id}`, cliente,
      // Un lugar de agencia: cada cuenta de su cartera es su propia suscripción (sumar dos lugares no es reemplazar uno).
      suscripcion: c.tipo === 'suscripcion' ? `cobro:${c.cliente_ws ?? c.alta_ws ?? c.id}` : null,
      // El día del pago en la zona de la plataforma, no el de su instante en UTC (punto 6: uno de la noche caía en el día
      // siguiente, y a fin de mes en el mes siguiente de Metrics).
      fecha: diaEnLaZona(String(c.pagado_at), tz),
      usd: typeof c.monto_usd === 'number' ? c.monto_usd : c.monto_usd == null ? null : Number(c.monto_usd),
      medio: c.proveedor, concepto: c.concepto, cobroId: Number(c.id),
      proveedor: c.proveedor, proveedorPagoId: c.proveedor_pago_id ?? null,
    });
  }
  // 3. El libro de las agencias: cada orden, de la agencia que paga (`ws:<ag>`), como un cobro de un lugar de agencia. Su historia
  //    (lo que entró para cada mes) va con las de las suscripciones: el MRR de un mes es lo de ese mes, no el último pago.
  const historiasDelLibro = new Map<string, ProximoDeSuscripcion>();
  if (libroLeido) {
    const libro = pagosDelLibro(libroLeido.filas, { atadas: libroLeido.atadas, nombreWs, hoy });
    for (const [k, h] of libro.proximos) historiasDelLibro.set(k, h);
    avisos.push(...libro.avisos);
    const sinRenglon = libro.agencias.filter((ag) => !quien.has(`ws:${ag}`));
    const fichas = await fichasDeAgencias(plataforma, sinRenglon)
      .catch((e) => { avisos.push(`la ficha en el CRM de las agencias: ${e instanceof Error ? e.message : String(e)}`); return new Map<number, number>(); });
    for (const ag of sinRenglon) quien.set(`ws:${ag}`, { clave: `ws:${ag}`, nombre: nombreWs.get(ag) ?? `Workspace ${ag}`, ws: ag, leadId: fichas.get(ag) ?? null });
    normalizados.push(...libro.pagos);
  }
  // El próximo cobro de cada suscripción manual sale de su historia mes a mes (la de la ficha), no del último pago más un mes.
  const subs = await suscripcionesDeLaPlataforma(plataforma, hoy);
  avisos.push(...subs.avisos);
  const proximos = proximosDeSuscripciones(subs.lista, hoy);
  for (const [k, h] of historiasDelLibro) proximos.set(k, h);
  return { ...calcularIngresos(normalizados, quien, hoy, 12, proximos), avisos };
}

// ── Las suscripciones mes a mes de la plataforma ─────────────────────────────────────────────────────────────────────
// ⚠️ LA MISMA CUENTA QUE LA FICHA (6/11/2026): cada lead de la plataforma con `venta_tipo = 'suscripcion'` (o con un pago registrado
// COMO la mensualidad, `esLeadDeSuscripcion`: ese pago ya cuenta en el MRR, punto 10) pasa por
// `cobradoDelLead` (lib/cobrado-lead.ts) con los pagos de su CASA (la regla de `esDelTrato`), sus cobros de suscripción de la
// pasarela y sus cambios guardados (mig 0401). De ahí salen la fuente (a mano o la pasarela), el estado y la historia mes a mes.
// Lo usan `vistaDeIngresos` (el próximo cobro, `porCobrar`) y Admin › Sales › Subscriptions (app/admin/_polar/datos/ventas-server.ts).
// Una lectura que falla no tumba lo cobrado: lo dice en `avisos` y `porCobrar` vuelve a la regla de los tramos.

type FilaLeadSuscripcion = {
  id: number; nombre: string | null; empresa: string | null; email: string | null; cliente_ws: number | null; venta_tipo: string | null;
  estado_lead: string | null; fecha_cierre: string | null; monto_cierre_usd: number | string | null; suscripcion_monto_usd: number | string | null;
  suscripcion_meses: number | null; suscripcion_cancelada_at: string | null; funnel_id: number | null;
};

export type SuscripcionDeLaPlataforma = {
  leadId: number;
  nombre: string;
  email: string | null;
  /** La cuenta de MaKo del cliente (`leads.cliente_ws`), si tiene. */
  clienteWs: number | null;
  estadoLead: string | null;
  fechaCierre: string | null;
  /** El CRM de su casa (`leads.funnel_id`, o el del negocio): la clave de sus pagos en lo cobrado es `lead:<id>:<crm|casa>`. */
  casa: number | null;
  /** Lo de la ficha: `cobrado.suscripcion` (fuente, estado, mensualidad, historia mes a mes). */
  cobrado: Cobrado & { suscripcion: NonNullable<Cobrado['suscripcion']> };
  /** Los pagos de su casa (los que cuenta la historia), para listar los pedidos de la suscripción. */
  pagos: PagoDeSuscripcion[];
  /** Sus cobros de suscripción de la pasarela (`cobros.id`): los que se cortan desde Admin › Sales. */
  cobroIds: number[];
};

async function porTandas<T>(ids: readonly number[], leer: (tanda: number[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 200) out.push(...(await leer(ids.slice(i, i + 200))));
  return out;
}

/** Una lectura por pedido (`cache`): la piden `vistaDeIngresos` y Admin › Sales › Subscriptions con la misma plataforma y el mismo día. */
export const suscripcionesDeLaPlataforma = cache(leerSuscripcionesDeLaPlataforma);

async function leerSuscripcionesDeLaPlataforma(plataforma: number, hoy: string): Promise<{ lista: SuscripcionDeLaPlataforma[]; avisos: string[] }> {
  const avisos: string[] = [];
  const db = getSupabaseServer();
  let leads: FilaLeadSuscripcion[];
  const COLS_LEAD = 'id, nombre, empresa, email, cliente_ws, venta_tipo, estado_lead, fecha_cierre, monto_cierre_usd, suscripcion_monto_usd, suscripcion_meses, suscripcion_cancelada_at, funnel_id';
  let conMensualidad = new Set<number>();
  try {
    const [deSuscripcion, mensualidades] = await Promise.all([
      leerTodo<FilaLeadSuscripcion>(db, 'leads', COLS_LEAD, { eq: { workspace_id: plataforma, venta_tipo: 'suscripcion' }, orden: 'id' }),
      leerTodo<{ id: number; lead_id: number }>(db, 'pagos', 'id, lead_id', { eq: { workspace_id: plataforma, es_mensualidad: true }, orden: 'id' }),
    ]);
    conMensualidad = new Set(mensualidades.map((p) => Number(p.lead_id)));
    const yaEstan = new Set(deSuscripcion.map((l) => Number(l.id)));
    const faltan = [...conMensualidad].filter((id) => !yaEstan.has(id));
    const otros = await porTandas(faltan, (t) => leerTodo<FilaLeadSuscripcion>(db, 'leads', COLS_LEAD, { eq: { workspace_id: plataforma }, filtros: (q) => q.in('id', t), orden: 'id' }));
    leads = [...deSuscripcion, ...otros].filter((l) => esLeadDeSuscripcion(l, conMensualidad));
  } catch (e) {
    avisos.push(`las suscripciones mes a mes: ${e instanceof Error ? e.message : String(e)}`);
    return { lista: [], avisos };
  }
  if (!leads.length) return { lista: [], avisos };
  const ids = leads.map((l) => Number(l.id));
  try {
    const [pagos, agregados, cobros, casaNegocio, cambios] = await Promise.all([
      porTandas(ids, (t) => leerTodo<PagoDeSuscripcion & { lead_id: number; funnel_id: number | null }>(db, 'pagos', '*', { eq: { workspace_id: plataforma }, filtros: (q) => q.in('lead_id', t), orden: 'id' })),
      porTandas(ids, (t) => leerTodo<{ id: number; lead_id: number; funnel_id: number }>(db, 'lead_funnel', 'id, lead_id, funnel_id', { eq: { workspace_id: plataforma }, filtros: (q) => q.in('lead_id', t), orden: 'id' })),
      porTandas(ids, (t) => leerTodo<CobroParaCobrado & { id: number; lead_id: number }>(db, 'cobros', 'id, lead_id, tipo, estado, suscripcion_estado, motivo', { eq: { workspace_id: plataforma, tipo: 'suscripcion' }, filtros: (q) => q.in('lead_id', t), orden: 'id' })),
      db.from('funnels').select('id').eq('workspace_id', plataforma).eq('es_default', true).limit(1).maybeSingle().then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return data ? Number((data as { id: number }).id) : null;
      }),
      runWithWorkspace(plataforma, () => leerCambiosDeSuscripcion(ids)),
    ]);
    if (!cambios.leido) avisos.push('los cambios de monto de las suscripciones (los meses usan la mensualidad del lead)');
    const pagosDe = new Map<number, Array<PagoDeSuscripcion & { lead_id: number; funnel_id: number | null }>>();
    for (const p of pagos) pagosDe.set(Number(p.lead_id), [...(pagosDe.get(Number(p.lead_id)) ?? []), p]);
    const agregadosDe = new Map<number, number[]>();
    for (const a of agregados) agregadosDe.set(Number(a.lead_id), [...(agregadosDe.get(Number(a.lead_id)) ?? []), Number(a.funnel_id)]);
    const cobrosDe = new Map<number, Array<CobroParaCobrado & { id: number }>>();
    for (const c of cobros) cobrosDe.set(Number(c.lead_id), [...(cobrosDe.get(Number(c.lead_id)) ?? []), c]);
    const lista: SuscripcionDeLaPlataforma[] = [];
    for (const l of leads) {
      const id = Number(l.id);
      const casa = l.funnel_id != null ? Number(l.funnel_id) : casaNegocio;
      const otros = (agregadosDe.get(id) ?? []).filter((f) => f !== casa);
      const suyos = (pagosDe.get(id) ?? []).filter((p) => esDelTrato(p.funnel_id, null, otros));
      const cobrado = cobradoDelLead({
        // Un lead con una mensualidad registrada es una suscripción aunque su `venta_tipo` diga otra cosa (`esLeadDeSuscripcion`).
        ventaTipo: esLeadDeSuscripcion(l, conMensualidad) ? 'suscripcion' : l.venta_tipo, montoCierreUsd: l.monto_cierre_usd, suscripcionMontoUsd: l.suscripcion_monto_usd, suscripcionMeses: l.suscripcion_meses,
        fechaCierre: l.fecha_cierre, suscripcionCanceladaAt: l.suscripcion_cancelada_at, pagos: suyos, cobros: cobrosDe.get(id) ?? [],
        movimientos: cambios.porLead.get(id) ?? [], hoy,
      });
      const suscripcion = cobrado.suscripcion;
      if (!suscripcion) continue;
      lista.push({
        leadId: id, nombre: (l.empresa || l.nombre || `Lead ${id}`).trim(), email: l.email ?? null,
        clienteWs: l.cliente_ws != null ? Number(l.cliente_ws) : null, estadoLead: l.estado_lead ?? null,
        fechaCierre: l.fecha_cierre ? String(l.fecha_cierre).slice(0, 10) : null, casa,
        cobrado: { ...cobrado, suscripcion }, pagos: suyos, cobroIds: (cobrosDe.get(id) ?? []).map((c) => Number(c.id)),
      });
    }
    return { lista, avisos };
  } catch (e) {
    avisos.push(`las suscripciones mes a mes: ${e instanceof Error ? e.message : String(e)}`);
    return { lista: [], avisos };
  }
}

/**
 * Lo que viene de cada suscripción MANUAL, por las claves con que lo cobrado nombra sus pagos (`lead:<id>:casa` y
 * `lead:<id>:<crm de la casa>`). Las de la pasarela no: ahí manda el último cobro de la pasarela (la regla de los tramos, como la
 * ficha: su ancla es el último cobro).
 */
export function proximosDeSuscripciones(lista: readonly SuscripcionDeLaPlataforma[], hoy: string): Map<string, ProximoDeSuscripcion> {
  const out = new Map<string, ProximoDeSuscripcion>();
  for (const s of lista) {
    if (s.cobrado.suscripcion.fuente !== 'manual') continue;
    const p = proximoDeHistoria(s.cobrado.suscripcion.historia, hoy);
    out.set(`lead:${s.leadId}:casa`, p);
    if (s.casa != null) out.set(`lead:${s.leadId}:${s.casa}`, p);
  }
  return out;
}
