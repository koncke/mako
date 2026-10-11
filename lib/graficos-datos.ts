// =============================================================================
// graficos-datos — el lector de «Mis gráficos»: de una fuente del catálogo a filas
// =============================================================================
// Cada fuente de `lib/graficos-catalogo.ts` se lee acá y sale como `Fila` (fecha del «rango
// por», etiquetas y números); `lib/graficos-agregar.ts` hace el resto. Lo que gobierna:
//
//   · TODO pasa por `getTenantDb()`: las tres tablas están en TENANT_TABLES, así que el
//     workspace lo pone el scope (el de la pestaña, `?ws=` incluido) y no este archivo.
//   · TODO se lee paginado (`leerTodo`, orden que termina en una columna única): el ws1 tiene
//     1.162 leads y 3.020 filas de pauta, y PostgREST corta en 1000 sin avisar.
//   · El gasto de Meta está en la moneda de la CUENTA: se pasa a dólares con
//     `conversorGastoMeta()`, nunca dividiendo por un tipo de cambio fijo.
//   · Las fechas de una fila son las de Tijuana, como en el resto de Graphics: un lead que
//     entró a las 23 h no puede caer en el día siguiente de un gráfico y en el de hoy del CRM.

import 'server-only';
import { getTenantDb } from './workspace';
import { leerTodo, type ConsultaPaginada } from './supabase-paginado';
import { conversorGastoMeta } from './moneda-meta';
import { diasAntes, hoyEnTijuana } from './date-utils';
import { productosCrm } from './api-mako/areas/crm.helpers';
import { sanearGrafico, type Grafico } from './graficos-catalogo';
import { agregar, type Fila, type Resultado } from './graficos-agregar';

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const txt = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const fechaTijuana = (iso: unknown): string | null => {
  if (typeof iso !== 'string' || !iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? hoyEnTijuana(new Date(t)) : null;
};

type FilaMeta = { id: number; fecha: string; campaign_name: string | null; adset_name: string | null; ad_name: string | null; spend: number | null; impressions: number | null; link_clicks: number | null; leads_count: number | null; agendas_meta: number | null };

async function filasMeta(desde: string, hasta: string): Promise<Fila[]> {
  const db = await getTenantDb();
  const [rows, conv] = await Promise.all([
    leerTodo<FilaMeta>(
      db, 'marketing_metrics_daily',
      'id, fecha, ad_id, campaign_name, adset_name, ad_name, spend, impressions, link_clicks, leads_count, agendas_meta',
      // Una fila por ANUNCIO por día: ni fecha ni ad_id son únicos, el id cierra el orden.
      { orden: [{ col: 'fecha' }, { col: 'ad_id' }, { col: 'id' }], eq: { plataforma: 'meta' }, filtros: (q: ConsultaPaginada) => q.gte('fecha', desde).lte('fecha', hasta) },
    ),
    conversorGastoMeta(),
  ]);
  return rows.map((r) => ({
    f: r.fecha,
    d: { campana: txt(r.campaign_name), conjunto: txt(r.adset_name), anuncio: txt(r.ad_name) },
    v: { gasto: conv.aUsdNum(num(r.spend)), impresiones: num(r.impressions), clics: num(r.link_clicks), leads: num(r.leads_count), agendas: num(r.agendas_meta) },
  }));
}

type FilaLead = {
  id: number; created_at: string | null; fecha_junta_1: string | null; fecha_cierre: string | null;
  asistio_j1: boolean | null; calificado: boolean | null; cerro: boolean | null; estado_lead: string | null;
  monto_cierre_usd: number | null; total_cobrado_usd: number | null; pipeline_stage: string | null; funnel_id: number | null;
  origen_lead: string | null; utm_source: string | null; utm_campaign: string | null; utm_content: string | null;
  meta_campaign_name: string | null; meta_ad_name: string | null; closer: string | null; setter: string | null; motivo_perdida: string | null;
};

/** Los nombres que ve la persona: el del producto de cada embudo y el de cada etapa. Sólo para rotular. */
async function rotulosDelCrm(): Promise<{ producto: (id: number | null) => string | null; etapa: (id: number | null, key: string | null) => string | null }> {
  const prods = await productosCrm().catch(() => null);
  const porEmbudo = new Map<number, { nombre: string; etapas: Map<string, string> }>();
  let porDefecto: { nombre: string; etapas: Map<string, string> } | null = null;
  const cualquiera = new Map<string, string>();
  for (const p of prods ?? []) {
    const e = new Map(p.etapas.map((s) => [s.key, s.label] as const));
    const x = { nombre: p.nombre, etapas: e };
    porEmbudo.set(p.embudoId, x);
    if (p.esDefault) porDefecto = x;
    for (const [k, l] of e) if (!cualquiera.has(k)) cualquiera.set(k, l);
  }
  // `funnel_id` NULL es el embudo por defecto (así lo lee el tablero del CRM).
  const de = (id: number | null) => (id != null ? porEmbudo.get(id) : null) ?? porDefecto;
  return {
    producto: (id) => de(id)?.nombre ?? null,
    etapa: (id, key) => (key ? de(id)?.etapas.get(key) ?? cualquiera.get(key) ?? key : null),
  };
}

const COLS_LEAD = 'id, created_at, fecha_junta_1, fecha_cierre, asistio_j1, calificado, cerro, estado_lead, monto_cierre_usd, total_cobrado_usd, pipeline_stage, funnel_id, origen_lead, utm_source, utm_campaign, utm_content, meta_campaign_name, meta_ad_name, closer, setter, motivo_perdida';

async function filasLeads(fecha: string, desde: string, hasta: string): Promise<Fila[]> {
  const db = await getTenantDb();
  // `created_at` es un instante: se trae con un día de margen a cada lado y se recorta en
  // memoria con la fecha de Tijuana, que es la que se dibuja.
  const filtros = (q: ConsultaPaginada) => (
    fecha === 'agenda' ? q.gte('fecha_junta_1', desde).lte('fecha_junta_1', hasta)
      : fecha === 'cierre' ? q.gte('fecha_cierre', desde).lte('fecha_cierre', hasta)
        : q.gte('created_at', `${diasAntes(desde, 1)}T00:00:00Z`).lte('created_at', `${diasAntes(hasta, -1)}T23:59:59Z`)
  );
  const [rows, rot] = await Promise.all([
    leerTodo<FilaLead>(db, 'leads', COLS_LEAD, { orden: 'id', filtros }),
    rotulosDelCrm(),
  ]);
  const out: Fila[] = [];
  for (const r of rows) {
    const f = fecha === 'agenda' ? r.fecha_junta_1 : fecha === 'cierre' ? r.fecha_cierre : fechaTijuana(r.created_at);
    if (!f || f < desde || f > hasta) continue;
    const gano = !!r.cerro || r.estado_lead === 'ganado';
    out.push({
      f,
      d: {
        etapa: rot.etapa(r.funnel_id, txt(r.pipeline_stage)),
        producto: rot.producto(r.funnel_id),
        origen: txt(r.origen_lead) ?? txt(r.utm_source),
        campana: txt(r.meta_campaign_name) ?? txt(r.utm_campaign),
        anuncio: txt(r.meta_ad_name) ?? txt(r.utm_content),
        closer: txt(r.closer), setter: txt(r.setter), motivo: txt(r.motivo_perdida),
      },
      v: {
        leads: 1,
        agendas: r.fecha_junta_1 ? 1 : 0,
        asistencias: r.asistio_j1 ? 1 : 0,
        calificados: r.calificado ? 1 : 0,
        cierres: gano ? 1 : 0,
        vendido: gano ? num(r.monto_cierre_usd) : 0,
        cobrado: num(r.total_cobrado_usd),
      },
    });
  }
  return out;
}

type FilaPago = { id: number; lead_id: number | null; numero: number | null; monto_usd: number | null; fecha_esperada: string | null; pagado: boolean | null; fecha_pago: string | null };

async function filasPagos(fecha: string, desde: string, hasta: string): Promise<Fila[]> {
  const db = await getTenantDb();
  const col = fecha === 'pago' ? 'fecha_pago' : 'fecha_esperada';
  const rows = await leerTodo<FilaPago>(db, 'pagos', 'id, lead_id, numero, monto_usd, fecha_esperada, pagado, fecha_pago', {
    orden: 'id',
    filtros: (q: ConsultaPaginada) => {
      const r = q.gte(col, desde).lte(col, hasta);
      return fecha === 'pago' ? r.eq('pagado', true) : r;
    },
  });
  // El nombre del cliente sale del lead de cada cuota, de a tandas (un `.in` con cientos de ids
  // arma una URL que el proxy corta).
  const ids = [...new Set(rows.map((r) => r.lead_id).filter((x): x is number => x != null))];
  const nombres = new Map<number, string>();
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await db.from('leads').select('id, nombre').in('id', ids.slice(i, i + 150));
    if (error) throw new Error(`No pude leer los clientes de los pagos: ${error.message}`);
    for (const l of (data ?? []) as Array<{ id: number; nombre: string | null }>) if (l.nombre) nombres.set(l.id, l.nombre);
  }
  const hoy = hoyEnTijuana();
  return rows.map((r) => {
    const monto = num(r.monto_usd);
    const estado = r.pagado ? 'Cobrado' : r.fecha_esperada && r.fecha_esperada < hoy ? 'Vencido' : 'Pendiente';
    return {
      f: fecha === 'pago' ? r.fecha_pago : r.fecha_esperada,
      d: { estado, cliente: r.lead_id != null ? nombres.get(r.lead_id) ?? null : null, cuota: r.numero != null ? `Cuota ${r.numero}` : null },
      v: { monto, cobrado: r.pagado ? monto : 0, pendiente: r.pagado ? 0 : monto, pagos: 1 },
    };
  });
}

/**
 * Hasta dónde se lee una fuente. La pauta de Meta llega por cron y el día en curso todavía no
 * está: con hoy adentro, toda línea de gasto termina en un desplome a cero que no pasó (medido
 * el 10/10 sobre el ws1, y es el mismo motivo del techo de Tendencias en lib/queries.ts).
 */
export function hastaDeFuente(g: Grafico, desde: string, hasta: string): string {
  if (g.fuente !== 'meta') return hasta;
  const ayer = diasAntes(hoyEnTijuana(), 1);
  return hasta > ayer ? (ayer < desde ? desde : ayer) : hasta;
}

/** Las filas de una fuente en el rango. Tira si la base no contesta: «no pude leer» no es un cero. */
export async function filasDeFuente(g: Grafico, desde: string, hasta: string): Promise<Fila[]> {
  if (g.fuente === 'meta') return filasMeta(desde, hasta);
  if (g.fuente === 'leads') return filasLeads(g.fecha, desde, hasta);
  return filasPagos(g.fecha, desde, hasta);
}

export type DatosGrafico = { ok: true; resultado: Resultado } | { ok: false; error: string };

/**
 * Los datos de UN gráfico. Valida el pedido contra el catálogo antes de leer nada, y un fallo
 * vuelve como error del gráfico, no del tablero: que no se pueda leer la pauta no tiene por
 * qué apagar el gráfico de leads de al lado.
 */
export async function datosDeGrafico(raw: unknown, desde: string, hasta: string): Promise<DatosGrafico> {
  const g = sanearGrafico(raw);
  if (!g) return { ok: false, error: 'Gráfico sin fuente de datos' };
  try {
    const h = hastaDeFuente(g, desde, hasta);
    const filas = await filasDeFuente(g, desde, h);
    return { ok: true, resultado: agregar(g, filas, desde, h) };
  } catch (e) {
    console.error(`[graficos] ${g.fuente}/${g.id}: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, error: 'No pude leer los datos' };
  }
}

/**
 * Los datos de VARIOS gráficos, leyendo cada fuente UNA vez por (fuente, rango por). Ocho
 * gráficos sobre la pauta son una lectura, no ocho.
 */
export async function datosDeTablero(graficos: Grafico[], desde: string, hasta: string): Promise<Record<string, DatosGrafico>> {
  const lecturas = new Map<string, Promise<Fila[]>>();
  const out: Record<string, DatosGrafico> = {};
  await Promise.all(graficos.map(async (g) => {
    const clave = g.fuente === 'meta' ? 'meta' : `${g.fuente}:${g.fecha}`;
    const h = hastaDeFuente(g, desde, hasta);
    if (!lecturas.has(clave)) lecturas.set(clave, filasDeFuente(g, desde, h));
    try {
      out[g.id] = { ok: true, resultado: agregar(g, await lecturas.get(clave)!, desde, h) };
    } catch (e) {
      console.error(`[graficos] ${clave}: ${e instanceof Error ? e.message : String(e)}`);
      out[g.id] = { ok: false, error: 'No pude leer los datos' };
    }
  }));
  return out;
}
