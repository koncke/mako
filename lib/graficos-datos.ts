// =============================================================================
// graficos-datos — el lector del Dashboard: de un conjunto de datos de MaKo a filas
// =============================================================================
// Cada conjunto de `lib/graficos-catalogo.ts` se lee acá y sale como `Fila` (fecha, etiquetas,
// números y claves distintas); `lib/graficos-agregar.ts` hace el resto. Lo que gobierna:
//
//   · TODA lectura lleva el workspace EXPLÍCITO (`eq workspace_id`), además del scope de
//     `getTenantDb()`: no todas estas tablas están en TENANT_TABLES, y para las que no, el
//     cliente de tenant es passthrough (AGENTS.md). Sin workspace, no se lee nada.
//   · TODO se lee paginado (`leerTodo`, con un orden que termina en una columna única):
//     PostgREST corta en 1000 sin avisar, y el ws1 tiene 78 mil eventos del VSL.
//   · NUNCA se lee el contenido de una conversación (WhatsApp, MaKo): sólo se cuentan filas.
//   · El gasto de Meta está en la moneda de la CUENTA: se pasa a dólares con
//     `conversorGastoMeta()`. Y la pauta llega por cron: el día en curso todavía no está.
//   · Las fechas de un instante se pasan a Tijuana, como en el resto de la app.

import 'server-only';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { leerTodo, type ConsultaPaginada, type OrdenPaginado } from './supabase-paginado';
import { conversorGastoMeta } from './moneda-meta';
import { diasAntes, hoyEnTijuana } from './date-utils';
import { productosCrm } from './api-mako/areas/crm.helpers';
import { tableroActual } from './tablero-actual';
import { VENTA_SIN_COBRO } from './venta-tipo';
import { fuenteDe, sanearGrafico, type Grafico } from './graficos-catalogo';
import { agregar, type Fila, type Resultado } from './graficos-agregar';

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const txt = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const fechaTj = (iso: unknown): string | null => {
  if (typeof iso !== 'string' || !iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? hoyEnTijuana(new Date(ms)) : null;
};
const lindo = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/[_-]+/g, ' ') : null);
/** La ruta de una URL sin el dominio ni la query: «/vsl», no «https://hola-mako.com/vsl?fbclid=…». */
const ruta = (u: unknown): string | null => {
  const s = txt(u);
  if (!s) return null;
  try { const x = new URL(s); return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/$/, '') || ''}`; } catch { return s.split('?')[0]; }
};
const host = (u: unknown): string | null => {
  const s = txt(u);
  if (!s) return '(directo)';
  try { return new URL(s).hostname.replace(/^www\./, ''); } catch { return s; }
};

type Rango = { desde: string; hasta: string; sinRango: boolean };

/**
 * La lectura común: workspace explícito, paginada, y con el período sobre la columna que se
 * pida. Un instante (`ts`) se trae con un día de margen a cada lado y se recorta en memoria con
 * la fecha de Tijuana, que es la que se dibuja.
 */
async function leer<T>(tabla: string, cols: string, rg: Rango, opts: { col?: string | null; ts?: boolean; orden?: OrdenPaginado; extra?: (q: ConsultaPaginada) => ConsultaPaginada } = {}): Promise<T[]> {
  const ws = await getWorkspaceActual();
  if (ws == null) return [];
  const db = await getTenantDb();
  const col = opts.col;
  const filtros = (q: ConsultaPaginada) => {
    let x = opts.extra ? opts.extra(q) : q;
    if (col && !rg.sinRango) {
      x = opts.ts
        ? x.gte(col, `${diasAntes(rg.desde, 1)}T00:00:00Z`).lte(col, `${diasAntes(rg.hasta, -1)}T23:59:59Z`)
        : x.gte(col, rg.desde).lte(col, rg.hasta);
    }
    return x;
  };
  return leerTodo<T>(db, tabla, cols, { orden: opts.orden ?? 'id', eq: { workspace_id: ws }, filtros });
}
/** ¿La fecha de la fila entra en el período? (Las de un instante vienen con margen.) */
const enRango = (f: string | null, rg: Rango) => rg.sinRango || (!!f && f >= rg.desde && f <= rg.hasta);

async function nombres(tabla: string, ids: Array<number | string>, col = 'nombre'): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unicos = [...new Set(ids.filter((x) => x != null).map(String))];
  if (!unicos.length) return out;
  const ws = await getWorkspaceActual();
  const db = await getTenantDb();
  // De a tandas: un `.in` con cientos de ids arma una URL que el proxy corta.
  for (let i = 0; i < unicos.length; i += 150) {
    const { data, error } = await db.from(tabla).select(`id, ${col}`).eq('workspace_id', ws ?? -1).in('id', unicos.slice(i, i + 150));
    if (error) throw new Error(`No pude leer ${tabla}: ${error.message}`);
    for (const x of (data ?? []) as unknown as Array<Record<string, unknown>>) { const n = txt(x[col]); if (n) out.set(String(x.id), n); }
  }
  return out;
}

// ── Marketing ────────────────────────────────────────────────────────────────────────────

type FMeta = { id: number; fecha: string; ad_id: string | null; campaign_name: string | null; adset_name: string | null; ad_name: string | null; spend: number | null; impressions: number | null; link_clicks: number | null; leads_count: number | null; agendas_meta: number | null };
async function filasMeta(rg: Rango): Promise<Fila[]> {
  const [rows, conv] = await Promise.all([
    leer<FMeta>('marketing_metrics_daily', 'id, fecha, ad_id, campaign_name, adset_name, ad_name, spend, impressions, link_clicks, leads_count, agendas_meta', rg, {
      col: 'fecha',
      // Una fila por ANUNCIO por día: ni fecha ni ad_id son únicos, el id cierra el orden.
      orden: [{ col: 'fecha' }, { col: 'ad_id' }, { col: 'id' }],
      extra: (q) => q.eq('plataforma', 'meta'),
    }),
    conversorGastoMeta(),
  ]);
  return rows.map((x) => ({
    f: x.fecha,
    d: { campana: txt(x.campaign_name), conjunto: txt(x.adset_name), anuncio: txt(x.ad_name) },
    v: { gasto: conv.aUsdNum(num(x.spend)), impresiones: num(x.impressions), clics: num(x.link_clicks), leads: num(x.leads_count), agendas: num(x.agendas_meta) },
    u: { anuncios: txt(x.ad_id) },
  }));
}

type FPres = { fecha: string; adset_id: string; adset_name: string | null; daily_budget_mxn: number | null; status: string | null };
const ESTADO_META: Record<string, string> = { ACTIVE: 'Activo', PAUSED: 'Pausado', CAMPAIGN_PAUSED: 'Campaña pausada', WITH_ISSUES: 'Con problemas', ADSET_PAUSED: 'Conjunto pausado' };
async function filasPresupuesto(rg: Rango): Promise<Fila[]> {
  const [rows, conv] = await Promise.all([
    leer<FPres>('adset_budget_daily', 'fecha, adset_id, adset_name, daily_budget_mxn, status', rg, { col: 'fecha', orden: [{ col: 'fecha' }, { col: 'adset_id' }] }),
    conversorGastoMeta(),
  ]);
  // `daily_budget_mxn` está en la moneda de la cuenta aunque se llame así (AGENTS.md).
  return rows.map((x) => ({
    f: x.fecha,
    d: { conjunto: txt(x.adset_name), estado: ESTADO_META[x.status ?? ''] ?? lindo(txt(x.status)) },
    v: { presupuesto: conv.aUsdNum(num(x.daily_budget_mxn)) },
    u: { conjuntos: x.adset_id },
  }));
}

type FVisita = { id: number; created_at: string; visitor_id: string | null; landing_url: string | null; referrer: string | null; prueba: string | null };
async function filasVisitas(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FVisita>('landing_visits', 'id, created_at, visitor_id, landing_url, referrer, prueba', rg, { col: 'created_at', ts: true });
  return rows.map((x) => ({ f: fechaTj(x.created_at), d: { pagina: ruta(x.landing_url), origen: host(x.referrer), prueba: txt(x.prueba) }, v: { visitas: 1 }, u: { visitantes: txt(x.visitor_id) } }))
    .filter((x) => enRango(x.f, rg));
}

const EVENTO_VSL: Record<string, string> = { play: 'Reproducción', pausa: 'Pausa', salio: 'Se fue', volvio: 'Volvió', cierre: 'Cerró la página', exit: 'Salida' };
const eventoVsl = (e: string | null): string | null => {
  if (!e) return null;
  if (EVENTO_VSL[e]) return EVENTO_VSL[e];
  const s = /^s(\d+)$/.exec(e); if (s) return `Vio ${s[1]} s`;
  const p = /^p(\d+)$/.exec(e); if (p) return `Llegó al ${p[1]}%`;
  return lindo(e);
};
type FVsl = { id: number; created_at: string; visitor_id: string | null; tipo_evento: string | null; event: string | null; vsl_titulo: string | null; landing_url: string | null };
async function filasVsl(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FVsl>('vsl_events', 'id, created_at, visitor_id, tipo_evento, event, vsl_titulo, landing_url', rg, { col: 'created_at', ts: true });
  return rows.map((x) => {
    const tipo = txt(x.tipo_evento) ?? (x.event === 'vsl_play' ? 'play' : null);
    return { f: fechaTj(x.created_at), d: { evento: eventoVsl(tipo), video: txt(x.vsl_titulo), pagina: ruta(x.landing_url) }, v: { eventos: 1, reproducciones: tipo === 'play' ? 1 : 0 }, u: { personas: txt(x.visitor_id) } };
  }).filter((x) => enRango(x.f, rg));
}

type FReplay = { id: string; inicio: string | null; visitor_id: string | null; landing_url: string | null; segundos: number | null; corte: string | null };
async function filasReplays(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FReplay>('replay_sesiones', 'id, inicio, visitor_id, landing_url, segundos, corte', rg, { col: 'inicio', ts: true });
  return rows.map((x) => ({ f: fechaTj(x.inicio), d: { pagina: ruta(x.landing_url), corte: lindo(txt(x.corte)) }, v: { grabaciones: 1, segundos: num(x.segundos) }, u: { visitantes: txt(x.visitor_id) } }))
    .filter((x) => enRango(x.f, rg));
}

type FCreativo = { ad_id: string; analyzed_at: string | null; created_at: string | null; angle: string | null; angle_override: string | null; hook_type: string | null; format: string | null; avatar: string | null; avatar_override: string | null; dur: number | null };
async function filasCreativos(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FCreativo>('script_analyses', 'ad_id, analyzed_at, created_at, angle, angle_override, hook_type, format, avatar, avatar_override, dur', rg, { col: 'created_at', ts: true, orden: 'ad_id' });
  return rows.map((x) => ({
    f: fechaTj(x.analyzed_at ?? x.created_at),
    d: { angulo: lindo(txt(x.angle_override) ?? txt(x.angle)), gancho: lindo(txt(x.hook_type)), formato: lindo(txt(x.format)), avatar: txt(x.avatar_override) ?? txt(x.avatar) },
    v: { creativos: 1, segundos: num(x.dur) },
  })).filter((x) => enRango(x.f, rg));
}

// ── CRM y ventas ─────────────────────────────────────────────────────────────────────────

type FLead = {
  id: number; created_at: string | null; fecha_junta_1: string | null; fecha_cierre: string | null;
  asistio_j1: boolean | null; calificado: boolean | null; cerro: boolean | null; estado_lead: string | null;
  monto_cierre_usd: number | null; total_cobrado_usd: number | null; pipeline_stage: string | null; funnel_id: number | null;
  origen_lead: string | null; utm_source: string | null; utm_campaign: string | null; utm_content: string | null;
  meta_campaign_name: string | null; meta_ad_name: string | null; closer: string | null; setter: string | null; motivo_perdida: string | null;
  venta_tipo: string | null;
};
const COLS_LEAD = 'id, created_at, fecha_junta_1, fecha_cierre, asistio_j1, calificado, cerro, estado_lead, monto_cierre_usd, total_cobrado_usd, pipeline_stage, funnel_id, origen_lead, utm_source, utm_campaign, utm_content, meta_campaign_name, meta_ad_name, closer, setter, motivo_perdida, venta_tipo';

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
    etapa: (id, key) => (key ? de(id)?.etapas.get(key) ?? cualquiera.get(key) ?? lindo(key) : null),
  };
}

const columnaLead = (fecha: string) => (fecha === 'agenda' ? 'fecha_junta_1' : fecha === 'cierre' ? 'fecha_cierre' : 'created_at');
async function leadsCrudos(fecha: string, rg: Rango): Promise<FLead[]> {
  const col = columnaLead(fecha);
  const rows = await leer<FLead>('leads', COLS_LEAD, rg, { col, ts: col === 'created_at' });
  return rows.filter((x) => enRango(fecha === 'agenda' ? x.fecha_junta_1 : fecha === 'cierre' ? x.fecha_cierre : fechaTj(x.created_at), rg));
}
/** Un ganado que se cuenta como venta: los «sin cobro» (becados) no lo son (tests/venta-sin-cobro.test.ts). */
const gano = (x: FLead) => (!!x.cerro || x.estado_lead === 'ganado') && x.venta_tipo !== VENTA_SIN_COBRO;

async function filasLeads(fecha: string, rg: Rango): Promise<Fila[]> {
  const [rows, rot] = await Promise.all([leadsCrudos(fecha, rg), rotulosDelCrm()]);
  return rows.map((x) => ({
    f: fecha === 'agenda' ? x.fecha_junta_1 : fecha === 'cierre' ? x.fecha_cierre : fechaTj(x.created_at),
    d: {
      etapa: rot.etapa(x.funnel_id, txt(x.pipeline_stage)),
      producto: rot.producto(x.funnel_id),
      origen: txt(x.origen_lead) ?? txt(x.utm_source),
      campana: txt(x.meta_campaign_name) ?? txt(x.utm_campaign),
      anuncio: txt(x.meta_ad_name) ?? txt(x.utm_content),
      closer: txt(x.closer), setter: txt(x.setter), motivo: txt(x.motivo_perdida),
    },
    v: {
      leads: 1, agendas: x.fecha_junta_1 ? 1 : 0, asistencias: x.asistio_j1 ? 1 : 0, calificados: x.calificado ? 1 : 0,
      cierres: gano(x) ? 1 : 0, vendido: gano(x) ? num(x.monto_cierre_usd) : 0, cobrado: num(x.total_cobrado_usd),
    },
  }));
}

type FAudit = { id: number; created_at: string; lead_id: number | null; campo: string | null; valor_nuevo: string | null; autor: string | null };
async function filasCambios(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FAudit>('lead_audit', 'id, created_at, lead_id, campo, valor_nuevo, autor', rg, { col: 'created_at', ts: true });
  return rows.map((x) => ({
    f: fechaTj(x.created_at),
    d: { campo: txt(x.campo), valor: txt(x.valor_nuevo)?.slice(0, 60) ?? null, autor: txt(x.autor) },
    v: { cambios: 1 }, u: { leads: x.lead_id != null ? String(x.lead_id) : null },
  })).filter((x) => enRango(x.f, rg));
}

type FResp = { id: number; created_at: string; lead_id: number | null; reunion: string | null };
async function filasFormularios(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FResp>('lead_respuestas', 'id, created_at, lead_id, reunion', rg, { col: 'created_at', ts: true });
  return rows.map((x) => ({ f: fechaTj(x.created_at), d: { formulario: txt(x.reunion) }, v: { respuestas: 1 }, u: { leads: x.lead_id != null ? String(x.lead_id) : null } }))
    .filter((x) => enRango(x.f, rg));
}

type FPago = { id: number; lead_id: number | null; numero: number | null; monto_usd: number | null; fecha_esperada: string | null; pagado: boolean | null; fecha_pago: string | null };
async function filasPagos(fecha: string, rg: Rango): Promise<Fila[]> {
  const col = fecha === 'pago' ? 'fecha_pago' : 'fecha_esperada';
  const rows = await leer<FPago>('pagos', 'id, lead_id, numero, monto_usd, fecha_esperada, pagado, fecha_pago', rg, {
    col, extra: (q) => (fecha === 'pago' ? q.eq('pagado', true) : q),
  });
  const nom = await nombres('leads', rows.map((x) => x.lead_id).filter((x): x is number => x != null));
  const hoy = hoyEnTijuana();
  return rows.map((x) => {
    const monto = num(x.monto_usd);
    const estado = x.pagado ? 'Cobrado' : x.fecha_esperada && x.fecha_esperada < hoy ? 'Vencido' : 'Pendiente';
    return {
      f: fecha === 'pago' ? x.fecha_pago : x.fecha_esperada,
      d: { estado, cliente: x.lead_id != null ? nom.get(String(x.lead_id)) ?? null : null, cuota: x.numero != null ? `Cuota ${x.numero}` : null },
      v: { monto, cobrado: x.pagado ? monto : 0, pendiente: x.pagado ? 0 : monto, pagos: 1 },
      u: { clientes: x.lead_id != null ? String(x.lead_id) : null },
    };
  });
}

const CATEGORIA_LLAMADA: Record<string, string> = { venta: 'Venta', interna: 'Interna', entrega_servicio: 'Entrega del servicio', test: 'Prueba', sin_clasificar: 'Sin clasificar' };
type FLlamada = { recording_id: number; call_date: string | null; duration_min: number | null; closer: string | null; category: string | null; tipo: string | null; outcome: string | null; score: number | null };
async function filasLlamadas(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FLlamada>('closing_analyses', 'recording_id, call_date, duration_min, closer, category, tipo, outcome, score', rg, { col: 'call_date', orden: 'recording_id' });
  return rows.map((x) => ({
    f: x.call_date,
    d: { closer: txt(x.closer), categoria: CATEGORIA_LLAMADA[x.category ?? ''] ?? lindo(txt(x.category)), reunion: txt(x.tipo), resultado: txt(x.outcome)?.slice(0, 40) ?? null },
    v: { llamadas: 1, minutos: num(x.duration_min), puntos: x.score != null ? num(x.score) : 0, con_puntaje: x.score != null ? 1 : 0 },
  }));
}

// ── Negocio: la pauta, el CRM y los cobros en una sola serie ────────────────────────────────

async function filasNegocio(rg: Rango): Promise<Fila[]> {
  const [meta, altas, agendas, cierres, cobros] = await Promise.all([
    filasMeta(rg), leadsCrudos('alta', rg), leadsCrudos('agenda', rg), leadsCrudos('cierre', rg),
    leer<FPago>('pagos', 'id, lead_id, numero, monto_usd, fecha_esperada, pagado, fecha_pago', rg, { col: 'fecha_pago', extra: (q) => q.eq('pagado', true) }),
  ]);
  const out: Fila[] = [];
  for (const x of meta) out.push({ f: x.f, d: {}, v: { gasto: x.v.gasto } });
  for (const x of altas) out.push({ f: fechaTj(x.created_at), d: {}, v: { leads: 1 } });
  for (const x of agendas) out.push({ f: x.fecha_junta_1, d: {}, v: { agendas: 1, asistencias: x.asistio_j1 ? 1 : 0 } });
  for (const x of cierres) if (gano(x)) out.push({ f: x.fecha_cierre, d: {}, v: { cierres: 1, vendido: num(x.monto_cierre_usd) } });
  for (const x of cobros) out.push({ f: x.fecha_pago, d: {}, v: { cobrado: num(x.monto_usd) } });
  return out;
}

// ── Comunicación ─────────────────────────────────────────────────────────────────────────

const TIPO_WA: Record<string, string> = { text: 'Texto', audio: 'Audio', image: 'Imagen', video: 'Video', document: 'Documento', sticker: 'Sticker', evento: 'Evento', otro: 'Otro' };
const ESTADO_WA: Record<string, string> = { sent: 'Enviado', delivered: 'Entregado', read: 'Leído', failed: 'Falló' };
type FWa = { id: number; created_at: string; wa_timestamp: string | null; from_me: boolean | null; tipo: string | null; instance_name: string | null; status: string | null; chat_jid: string | null };
async function filasWhatsapp(rg: Rango): Promise<Fila[]> {
  // Sólo los campos que se cuentan: el texto de los mensajes no se lee nunca.
  const rows = await leer<FWa>('wa_mensajes', 'id, created_at, wa_timestamp, from_me, tipo, instance_name, status, chat_jid', rg, { col: 'created_at', ts: true });
  return rows.map((x) => ({
    f: fechaTj(x.wa_timestamp ?? x.created_at),
    d: { direccion: x.from_me ? 'Enviado' : 'Recibido', tipo: TIPO_WA[x.tipo ?? ''] ?? lindo(txt(x.tipo)), linea: txt(x.instance_name), estado: ESTADO_WA[x.status ?? ''] ?? null },
    v: { mensajes: 1, enviados: x.from_me ? 1 : 0, recibidos: x.from_me ? 0 : 1 },
    u: { chats: txt(x.chat_jid) },
  })).filter((x) => enRango(x.f, rg));
}

type FDoer = { id: number; created_at: string; role: string | null; grupo_jid: string | null };
async function filasMakoChat(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FDoer>('mako_doer_conv', 'id, created_at, role, grupo_jid', rg, { col: 'created_at', ts: true });
  return rows.map((x) => ({ f: fechaTj(x.created_at), d: { quien: x.role === 'assistant' ? 'MaKo' : 'Persona' }, v: { mensajes: 1 }, u: { grupos: txt(x.grupo_jid) } }))
    .filter((x) => enRango(x.f, rg));
}

// ── Automations ──────────────────────────────────────────────────────────────────────────

const ESTADO_INSC: Record<string, string> = { activa: 'Activa', completada: 'Completada', cancelada: 'Cancelada', no_responde: 'No responde', respondio: 'Respondió', handoff: 'Pasó a una persona' };
type FInsc = { id: number; lead_id: number | null; secuencia_id: number | null; estado: string | null; desenlace: string | null; inscripto_at: string | null; desenlace_at: string | null };
async function filasInscripciones(fecha: string, rg: Rango): Promise<Fila[]> {
  const col = fecha === 'desenlace' ? 'desenlace_at' : 'inscripto_at';
  const rows = await leer<FInsc>('nutricion_inscripciones', 'id, lead_id, secuencia_id, estado, desenlace, inscripto_at, desenlace_at', rg, { col, ts: true });
  const sec = await nombres('nutricion_secuencias', rows.map((x) => x.secuencia_id).filter((x): x is number => x != null));
  return rows.map((x) => ({
    f: fechaTj(fecha === 'desenlace' ? x.desenlace_at : x.inscripto_at),
    d: { automatizacion: x.secuencia_id != null ? sec.get(String(x.secuencia_id)) ?? null : null, estado: ESTADO_INSC[x.estado ?? ''] ?? lindo(txt(x.estado)), desenlace: lindo(txt(x.desenlace)) },
    v: { personas: 1 }, u: { leads: x.lead_id != null ? String(x.lead_id) : null },
  })).filter((x) => enRango(x.f, rg));
}

type FEnvio = { id: number; created_at: string; secuencia_id: number | null; canal: string | null; estado: string | null; abierto_at: string | null; clic_at: string | null; respondio_at: string | null };
async function filasEnvios(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FEnvio>('nutricion_envios', 'id, created_at, secuencia_id, canal, estado, abierto_at, clic_at, respondio_at', rg, { col: 'created_at', ts: true });
  const sec = await nombres('nutricion_secuencias', rows.map((x) => x.secuencia_id).filter((x): x is number => x != null));
  return rows.map((x) => ({
    f: fechaTj(x.created_at),
    d: { automatizacion: x.secuencia_id != null ? sec.get(String(x.secuencia_id)) ?? null : null, canal: lindo(txt(x.canal)), estado: x.estado === 'fallo' ? 'Falló' : lindo(txt(x.estado)) },
    v: { envios: 1, abiertos: x.abierto_at ? 1 : 0, clics: x.clic_at ? 1 : 0, respuestas: x.respondio_at ? 1 : 0 },
  })).filter((x) => enRango(x.f, rg));
}

// ── Plan ─────────────────────────────────────────────────────────────────────────────────

/** Las bandas del tablero (app/plan/board/types.ts, `prioFromScore`): ALTA ≥ 75 · MEDIA ≥ 50 · BAJA ≥ 25. */
const banda = (s: number) => (s >= 75 ? 'Alta' : s >= 50 ? 'Media' : s >= 25 ? 'Baja' : 'A futuro');
async function filasTareas(fecha: string, rg: Rango): Promise<Fila[]> {
  const deQuien = await tableroActual();
  const col = fecha === 'deadline' ? 'deadline' : fecha === 'alta' ? 'created_at' : null;
  if (deQuien === 'dueno') {
    // El tablero del super admin: plan_tareas + plan_proyectos (id de texto).
    type T = { id: string; created_at: string | null; deadline: string | null; progress: number | null; score: number | null; labels: unknown; origen: string | null };
    const rows = await leer<T>('plan_tareas', 'id, created_at, deadline, progress, score, labels, origen', rg, { col, ts: col === 'created_at' });
    const proy = await nombres('plan_proyectos', rows.map((x) => (Array.isArray(x.labels) ? String(x.labels[0] ?? '') : '')).filter(Boolean), 'name');
    return rows.map((x) => {
      const hecha = num(x.progress) >= 100;
      return {
        f: fecha === 'deadline' ? txt(x.deadline) : fechaTj(x.created_at),
        d: { proyecto: Array.isArray(x.labels) ? proy.get(String(x.labels[0] ?? '')) ?? null : null, prioridad: banda(num(x.score)), estado: hecha ? 'Hecha' : 'Abierta', origen: lindo(txt(x.origen)), responsable: null },
        v: { tareas: 1, hechas: hecha ? 1 : 0, abiertas: hecha ? 0 : 1, progreso: Math.min(100, num(x.progress)) },
      };
    }).filter((x) => enRango(x.f, rg));
  }
  // El de cada cliente: experimento_tareas + tarea_categorias (id numérico).
  type T = { id: number; created_at: string | null; deadline: string | null; progreso: number | null; score: number | null; categorias: unknown; origen: string | null; responsable: string | null };
  const rows = await leer<T>('experimento_tareas', 'id, created_at, deadline, progreso, score, categorias, origen, responsable', rg, { col, ts: col === 'created_at' });
  const cats = await nombres('tarea_categorias', rows.map((x) => (Array.isArray(x.categorias) ? String(x.categorias[0] ?? '') : '')).filter(Boolean));
  return rows.map((x) => {
    const hecha = num(x.progreso) >= 100;
    return {
      f: fecha === 'deadline' ? txt(x.deadline) : fechaTj(x.created_at),
      d: { proyecto: Array.isArray(x.categorias) ? cats.get(String(x.categorias[0] ?? '')) ?? null : null, prioridad: banda(num(x.score)), estado: hecha ? 'Hecha' : 'Abierta', origen: lindo(txt(x.origen)), responsable: txt(x.responsable) },
      v: { tareas: 1, hechas: hecha ? 1 : 0, abiertas: hecha ? 0 : 1, progreso: Math.min(100, num(x.progreso)) },
    };
  }).filter((x) => enRango(x.f, rg));
}

// ── Customer Success ─────────────────────────────────────────────────────────────────────

type FEntrega = { id: number; producto_id: number | null; etapa: string | null; etapa_desde: string | null; created_at: string | null };
async function filasEntrega(fecha: string, rg: Rango): Promise<Fila[]> {
  const rows = await leer<FEntrega>('cliente_entrega', 'id, producto_id, etapa, etapa_desde, created_at', rg, { col: fecha === 'desde' ? 'etapa_desde' : null, ts: true });
  const prod = await nombres('productos', rows.map((x) => x.producto_id).filter((x): x is number => x != null));
  return rows.map((x) => ({
    f: fechaTj(x.etapa_desde ?? x.created_at),
    d: { producto: x.producto_id != null ? prod.get(String(x.producto_id)) ?? null : null, etapa: lindo(txt(x.etapa)) },
    v: { clientes: 1 },
  })).filter((x) => enRango(x.f, rg));
}

type FProg = { id: number; lead_id: number | null; pct: number | null; estado: string | null; area: string | null; visto_at: string | null; created_at: string | null };
async function filasAvanceCursos(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FProg>('curso_progreso', 'id, lead_id, pct, estado, area, visto_at, created_at', rg, { col: 'created_at', ts: true });
  return rows.map((x) => ({
    f: fechaTj(x.visto_at ?? x.created_at), d: { estado: lindo(txt(x.estado)), area: txt(x.area) },
    v: { clases: 1, pct: Math.min(100, num(x.pct)) }, u: { alumnos: x.lead_id != null ? String(x.lead_id) : null },
  })).filter((x) => enRango(x.f, rg));
}

// ── Second Brain ─────────────────────────────────────────────────────────────────────────

type FKnow = { id: number; created_at: string | null; categoria: string | null; area: string | null; fuente: string | null; estado: string | null; activo: boolean | null };
async function filasConocimiento(fecha: string, rg: Rango): Promise<Fila[]> {
  const r2 = { ...rg, sinRango: fecha === 'actual' };
  const rows = await leer<FKnow>('mako_knowledge', 'id, created_at, categoria, area, fuente, estado, activo', r2, { col: 'created_at', ts: true });
  return rows.filter((x) => x.activo !== false).map((x) => ({
    f: fechaTj(x.created_at), d: { categoria: txt(x.categoria), area: lindo(txt(x.area)), fuente: lindo(txt(x.fuente)), estado: lindo(txt(x.estado)) }, v: { documentos: 1 },
  })).filter((x) => enRango(x.f, r2));
}

const tipoArchivo = (mime: string | null): string => {
  const s = (mime ?? '').toLowerCase();
  if (s.includes('pdf')) return 'PDF';
  if (s.startsWith('image/')) return 'Imagen';
  if (s.startsWith('video/')) return 'Video';
  if (s.startsWith('audio/')) return 'Audio';
  if (s.includes('sheet') || s.includes('excel') || s.includes('csv')) return 'Planilla';
  if (s.includes('word') || s.includes('document') || s.startsWith('text/')) return 'Documento';
  return 'Otro';
};
type FArch = { id: string; created_at: string | null; mime: string | null; tamano: number | null };
async function filasArchivero(fecha: string, rg: Rango): Promise<Fila[]> {
  const r2 = { ...rg, sinRango: fecha === 'actual' };
  const rows = await leer<FArch>('archivero_files', 'id, created_at, mime, tamano', r2, { col: 'created_at', ts: true });
  return rows.map((x) => ({ f: fechaTj(x.created_at), d: { tipo: tipoArchivo(x.mime) }, v: { archivos: 1, mb: num(x.tamano) / 1e6 } }))
    .filter((x) => enRango(x.f, r2));
}

// ── Onboarding ───────────────────────────────────────────────────────────────────────────

async function filasOnboarding(fecha: string, rg: Rango): Promise<Fila[]> {
  const ws = await getWorkspaceActual();
  if (ws == null) return [];
  const db = await getTenantDb();
  const { data, error } = await db.from('app_settings').select('key, value').eq('workspace_id', ws).like('key', 'onboarding.tab.%').limit(500);
  if (error) throw new Error(`No pude leer el onboarding: ${error.message}`);
  const r2 = { ...rg, sinRango: fecha === 'actual' };
  const out: Fila[] = [];
  for (const fila of (data ?? []) as Array<{ key: string; value: string | null }>) {
    const tab = fila.key.slice('onboarding.tab.'.length);
    // `pasos` es el registro compartido y `.puenteado` una marca de migración: no son tabs.
    if (!tab || tab === 'pasos' || tab.includes('.')) continue;
    let estado: { steps?: Record<string, { done?: boolean; at?: string }> } | null = null;
    try { estado = JSON.parse(fila.value ?? ''); } catch { continue; }
    for (const [paso, s] of Object.entries(estado?.steps ?? {})) {
      const f = fechaTj(s?.at);
      if (!r2.sinRango && !(s?.done && f && f >= rg.desde && f <= rg.hasta)) continue;
      out.push({ f, d: { tab: lindo(tab), paso: lindo(paso), estado: s?.done ? 'Hecho' : 'Pendiente' }, v: { pasos: 1, hechos: s?.done ? 1 : 0 } });
    }
  }
  return out;
}

// ── IA y contenido ───────────────────────────────────────────────────────────────────────

type FIa = { id: number; created_at: string; feature: string | null; model: string | null; provider: string | null; cost_usd: number | null; input_tokens: number | null; output_tokens: number | null };
async function filasIa(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FIa>('anthropic_usage', 'id, created_at, feature, model, provider, cost_usd, input_tokens, output_tokens', rg, { col: 'created_at', ts: true });
  return rows.map((x) => ({
    f: fechaTj(x.created_at), d: { funcion: txt(x.feature), modelo: txt(x.model), proveedor: lindo(txt(x.provider)) },
    v: { llamadas: 1, costo: num(x.cost_usd), tokens_entrada: num(x.input_tokens), tokens_salida: num(x.output_tokens) },
  })).filter((x) => enRango(x.f, rg));
}

const TIPO_FLOW: Record<string, string> = { generar_clip: 'Video', generar_imagen: 'Imagen', estado_clips: 'Consulta de estado', creditos: 'Consulta de créditos', enlace_clip: 'Enlace de video', subir_imagen: 'Foto subida' };
type FFlow = { id: number; created_at: string; tipo: string | null; estado: string | null };
async function filasFlow(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FFlow>('flow_trabajos', 'id, created_at, tipo, estado', rg, { col: 'created_at', ts: true });
  return rows.map((x) => ({
    f: fechaTj(x.created_at), d: { tipo: TIPO_FLOW[x.tipo ?? ''] ?? lindo(txt(x.tipo)), estado: x.estado === 'listo' ? 'Listo' : x.estado === 'fallido' ? 'Falló' : lindo(txt(x.estado)) },
    v: { trabajos: 1, listos: x.estado === 'listo' ? 1 : 0, fallidos: x.estado === 'fallido' ? 1 : 0 },
  })).filter((x) => enRango(x.f, rg));
}

// ── El reparto ───────────────────────────────────────────────────────────────────────────

/** Los lectores, uno por conjunto del catálogo. El test exige que estén todos. */
export const LECTORES: Record<string, (fecha: string, rg: Rango) => Promise<Fila[]>> = {
  negocio: (_, rg) => filasNegocio(rg),
  meta: (_, rg) => filasMeta(rg),
  presupuesto: (_, rg) => filasPresupuesto(rg),
  visitas: (_, rg) => filasVisitas(rg),
  vsl: (_, rg) => filasVsl(rg),
  replays: (_, rg) => filasReplays(rg),
  creativos: (_, rg) => filasCreativos(rg),
  leads: (f, rg) => filasLeads(f, rg),
  crm_cambios: (_, rg) => filasCambios(rg),
  formularios: (_, rg) => filasFormularios(rg),
  pagos: (f, rg) => filasPagos(f, rg),
  llamadas: (_, rg) => filasLlamadas(rg),
  whatsapp: (_, rg) => filasWhatsapp(rg),
  mako_chat: (_, rg) => filasMakoChat(rg),
  inscripciones: (f, rg) => filasInscripciones(f, rg),
  envios: (_, rg) => filasEnvios(rg),
  tareas: (f, rg) => filasTareas(f, rg),
  entrega: (f, rg) => filasEntrega(f, rg),
  avance_cursos: (_, rg) => filasAvanceCursos(rg),
  conocimiento: (f, rg) => filasConocimiento(f, rg),
  archivero: (f, rg) => filasArchivero(f, rg),
  onboarding: (f, rg) => filasOnboarding(f, rg),
  ia: (_, rg) => filasIa(rg),
  flow: (_, rg) => filasFlow(rg),
};

/**
 * Hasta dónde se lee una fuente. La pauta de Meta llega por cron y el día en curso todavía no
 * está: con hoy adentro, toda línea de gasto termina en un desplome a cero que no pasó (medido
 * el 10/10 sobre el ws1). El resumen del negocio cruza la pauta con el CRM, así que va igual:
 * con el gasto de hoy en cero, el CAC de hoy saldría regalado.
 */
export function hastaDeFuente(g: Grafico, desde: string, hasta: string): string {
  if (g.fuente !== 'meta' && g.fuente !== 'negocio' && g.fuente !== 'presupuesto') return hasta;
  const ayer = diasAntes(hoyEnTijuana(), 1);
  return hasta > ayer ? (ayer < desde ? desde : ayer) : hasta;
}

export type DatosGrafico = { ok: true; resultado: Resultado } | { ok: false; error: string };
export type PedidoDatos = { grafico: unknown; desde: string; hasta: string };

/**
 * Los datos de VARIOS gráficos, leyendo cada (fuente, fecha, período) UNA vez: ocho gráficos
 * sobre la pauta del mismo mes son una lectura, no ocho. Un fallo vuelve como error de SU
 * gráfico: que no se pueda leer la pauta no apaga el gráfico de leads de al lado.
 */
export async function datosDeGraficos(pedidos: PedidoDatos[]): Promise<Record<string, DatosGrafico>> {
  const lecturas = new Map<string, Promise<Fila[]>>();
  const out: Record<string, DatosGrafico> = {};
  await Promise.all(pedidos.map(async (p) => {
    const g = sanearGrafico(p.grafico);
    if (!g) return;
    const fuente = fuenteDe(g.fuente);
    const lector = LECTORES[g.fuente];
    if (!fuente || !lector) { out[g.id] = { ok: false, error: 'Fuente desconocida' }; return; }
    const sinRango = !!fuente.fechas.find((x) => x.id === g.fecha)?.sinRango;
    const hasta = hastaDeFuente(g, p.desde, p.hasta);
    const rg: Rango = { desde: p.desde, hasta, sinRango };
    const clave = `${g.fuente}|${g.fecha}|${p.desde}|${hasta}|${sinRango}`;
    if (!lecturas.has(clave)) lecturas.set(clave, lector(g.fecha, rg));
    try {
      out[g.id] = { ok: true, resultado: agregar(g, await lecturas.get(clave)!, p.desde, hasta) };
    } catch (e) {
      console.error(`[graficos] ${clave}: ${e instanceof Error ? e.message : String(e)}`);
      out[g.id] = { ok: false, error: 'No pude leer los datos' };
    }
  }));
  return out;
}
