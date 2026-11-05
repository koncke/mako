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
import { getSupabaseServer } from './supabase';
import { leerTodo } from './supabase-paginado';
import { listarWorkspaces, wsSuperAdmin } from './workspace';
import { zonaDelNegocio } from './timezone';
import { hoyEnTz } from './date-utils';
import { calcularIngresos, type ClienteIngreso, type Ingresos, type PagoIngreso } from './admin-ingresos-reglas';

type FilaPago = {
  id: number; lead_id: number; funnel_id: number | null; monto_usd: number | null; fecha_pago: string | null;
  es_mensualidad: boolean | null; nacio_cobrada: boolean | null; resto_de: number | null;
  metodo: string | null; proveedor: string | null; cobro_id: number | null; concepto: string | null;
};
type FilaLead = { id: number; nombre: string | null; empresa: string | null; cliente_ws: number | null; venta_tipo: string | null };
type FilaCobro = {
  id: number; tipo: string; estado: string; pagado_at: string | null; monto_usd: number | null; lead_id: number | null;
  alta_ws: number | null; cliente_ws?: number | null; agencia_ws?: number | null; proveedor: string | null; concepto: string | null;
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
  const base = 'id, tipo, estado, pagado_at, monto_usd, lead_id, alta_ws, proveedor, concepto';
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

export type VistaIngresos = Ingresos & {
  /** Lo que no se pudo leer: lo que se muestra puede quedarse corto. */
  avisos: string[];
};

export async function vistaDeIngresos(ahora: Date = new Date()): Promise<VistaIngresos> {
  const plataforma = await wsSuperAdmin();
  const avisos: string[] = [];
  const db = getSupabaseServer();
  const [pagos, cobros, wss, tz] = await Promise.all([
    // Si esto falla, la sección no tiene qué mostrar: el error sube (la pantalla dice «No pude leer tus ingresos»).
    leerTodo<FilaPago>(db, 'pagos', 'id, lead_id, funnel_id, monto_usd, fecha_pago, es_mensualidad, nacio_cobrada, resto_de, metodo, proveedor, cobro_id, concepto',
      { eq: { workspace_id: plataforma, pagado: true }, orden: 'id' }),
    cobrosPagados(plataforma).catch((e) => { avisos.push(`los cobros de la pasarela: ${e instanceof Error ? e.message : String(e)}`); return [] as FilaCobro[]; }),
    listarWorkspaces().catch((e) => { avisos.push(`los nombres de los negocios: ${e instanceof Error ? e.message : String(e)}`); return []; }),
    zonaDelNegocio(plataforma).catch(() => 'UTC'),
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
      fecha: String(c.pagado_at).slice(0, 10),
      usd: typeof c.monto_usd === 'number' ? c.monto_usd : c.monto_usd == null ? null : Number(c.monto_usd),
      medio: c.proveedor, concepto: c.concepto,
    });
  }
  return { ...calcularIngresos(normalizados, quien, hoy), avisos };
}
