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
//   · EL CORTE EN HOY VIVE ACÁ (`hastaDeFuente`, desde el v5): las puertas (la ruta, la página, el link,
//     la API de MaKo, el AI Analyst) mandan el período TAL CUAL. Una fecha `futuro` (el vencimiento de una
//     cuota) no se corta: «Próximos 30 días» mira hacia adelante.
//   · Una lectura que tarda más de `PLAZO_LECTOR_MS` le devuelve «Tardó demasiado: <conjunto>» a SUS
//     gráficos y deja llegar al resto: el tope de la ruta es del pedido entero (60 s).
//   · Lo que el Pixel manda en una PRUEBA (`prueba`, ?mko_test=) o desde la vista previa del constructor no
//     es del negocio: ningún conjunto lo cuenta (desde el v5, tampoco visitas, vsl ni grabaciones).

import 'server-only';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { enRango, queTableroLeer, fechaTj, host, leer, leerPorIds, lindo, nombres, num, rotulosDelCrm, ruta, txt, type Rango } from './graficos-lectura';
import { LECTORES_EXTRA, noEsDelNegocio } from './graficos-datos-extra';
export type { Rango };
import { conversorGastoMeta } from './moneda-meta';
import { hoyEnTijuana, lunesDeFecha } from './date-utils';
import { hoyEnWorkspace } from './timezone';
import { campoDe, fuenteDe, sanearGrafico, type Grafico } from './graficos-catalogo';
import { filasAudiencia } from './graficos-audiencia';
import {
  agregar, claveCategoria, conPlazo, cortarEnHoy, filtrarFilas, hastaDeLectura, periodoAnterior, PlazoVencidoError, SinConexionError,
  type Filtro, type Fila, type Resultado,
} from './graficos-agregar';
import { ESTADO_COBRADO } from './graficos-acciones';
import { diasEntre, ESTADOS_RESPONDIO, enviosRespondidos, gano, rotuloMadurez, tramosDelCiclo } from './graficos-datos-puro';
import { carteraEnEntrega } from '@/app/customer-success/entrega';
import { repartirEnEtapas } from './servicio-etapas';

// ── Marketing ────────────────────────────────────────────────────────────────────────────

type FMeta = { id: number; fecha: string; ad_id: string | null; campaign_id: string | null; adset_id: string | null; campaign_name: string | null; adset_name: string | null; ad_name: string | null; spend: number | null; impressions: number | null; link_clicks: number | null; landing_page_views: number | null; leads_count: number | null; agendas_meta: number | null };
async function filasMeta(rg: Rango): Promise<Fila[]> {
  const [rows, conv] = await Promise.all([
    leer<FMeta>('marketing_metrics_daily', 'id, fecha, ad_id, campaign_id, adset_id, campaign_name, adset_name, ad_name, spend, impressions, link_clicks, landing_page_views, leads_count, agendas_meta', rg, {
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
    v: { gasto: conv.aUsdNum(num(x.spend)), impresiones: num(x.impressions), clics: num(x.link_clicks), vistas_landing: num(x.landing_page_views), leads: num(x.leads_count), agendas: num(x.agendas_meta) },
    u: { anuncios: txt(x.ad_id) },
    // El id de Meta de cada nombre: lo que abre «Ver anuncio» (lib/graficos-acciones.ts).
    r: { campana: txt(x.campaign_id), conjunto: txt(x.adset_id), anuncio: txt(x.ad_id) },
  }));
}

/**
 * Las vistas del VSL por día: las vistas de YouTube del video marcado VSL más los plays de Panda, que es
 * la fuente del presente. Un día de YouTube sin delta (`youtube_views` null) no suma.
 *
 * ⛔ Hasta el v5 sumaba también un video de PRUEBA cableado (`VSL_PRUEBA_VIDEO_ID`, lib/config.ts): era el
 * VSL viejo de UN cliente (Mauricio) y lo veía cualquier negocio. Decisión del contrato v5: el vocabulario
 * de un cliente sale del Dashboard. Un video de YouTube cuenta si ESE negocio lo marcó como VSL.
 */
type FVistaVsl = { id: number; fecha: string; plataforma: string; youtube_video_type: string | null; youtube_views: number | null; video_plays: number | null };
async function vistasVslPorDia(rg: Rango): Promise<Array<{ f: string; n: number }>> {
  const rows = await leer<FVistaVsl>('marketing_metrics_daily', 'id, fecha, plataforma, youtube_video_type, youtube_views, video_plays', rg, {
    col: 'fecha',
    orden: [{ col: 'fecha' }, { col: 'ad_id' }, { col: 'id' }],
    extra: (q) => q.in('plataforma', ['youtube', 'panda']),
  });
  const out: Array<{ f: string; n: number }> = [];
  for (const x of rows) {
    const n = x.plataforma === 'panda'
      ? num(x.video_plays)
      : x.youtube_video_type === 'vsl' && x.youtube_views != null ? num(x.youtube_views) : 0;
    if (n) out.push({ f: x.fecha, n });
  }
  return out;
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
    r: { conjunto: txt(x.adset_id) },
  }));
}

/**
 * Cada visita del Pixel. ⚠️ SIN LAS PRUEBAS NI LA VISTA PREVIA DEL CONSTRUCTOR (v5, `noEsDelNegocio`): hasta
 * el 12/10/2026 esto las contaba y `retencion_vsl` no, así que dos tarjetas de la misma hoja contaban
 * universos distintos — y abrir el mapa en vivo con `?mko_test=` habría sumado una visita por apertura.
 * La dimensión `prueba` («Variante») queda SIEMPRE vacía por lo mismo: nunca fue una variante A/B.
 */
type FVisita = { id: number; created_at: string; visitor_id: string | null; landing_url: string | null; referrer: string | null; prueba: string | null };
async function filasVisitas(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FVisita>('landing_visits', 'id, created_at, visitor_id, landing_url, referrer, prueba', rg, { col: 'created_at', ts: true });
  return rows.filter((x) => !noEsDelNegocio(x))
    .map((x) => ({ f: fechaTj(x.created_at), d: { pagina: ruta(x.landing_url), origen: host(x.referrer), prueba: txt(x.prueba) }, v: { visitas: 1 }, u: { visitantes: txt(x.visitor_id) } }))
    .filter((x) => enRango(x.f, rg));
}

const EVENTO_VSL: Record<string, string> = { play: 'Reproducción', pausa: 'Pausa', salio: 'Se fue', volvio: 'Volvió', cierre: 'Cerró la página', exit: 'Salida', agendo: 'Agendó' };
const eventoVsl = (e: string | null): string | null => {
  if (!e) return null;
  if (EVENTO_VSL[e]) return EVENTO_VSL[e];
  const s = /^s(\d+)$/.exec(e); if (s) return `Vio ${s[1]} s`;
  const p = /^p(\d+)$/.exec(e); if (p) return `Llegó al ${p[1]}%`;
  return lindo(e);
};
/**
 * Los eventos del VSL. ⚠️ «Personas» es cualquiera que dejó UN evento en la página (un `salio`, un clic):
 * medido el 11/10/2026, en el ws1 había 7.197 «se fue» contra 3.885 plays. Quien de verdad le dio play es
 * `espectadores` (distintos, sólo en las filas de `play`), y `play_rate` = espectadores ÷ personas.
 * `agendaron` = los eventos `agendo` del Pixel. Sin las pruebas ni la vista previa (v5).
 */
type FVsl = { id: number; created_at: string; visitor_id: string | null; tipo_evento: string | null; event: string | null; vsl_titulo: string | null; landing_url: string | null; prueba: string | null };
async function filasVsl(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FVsl>('vsl_events', 'id, created_at, visitor_id, tipo_evento, event, vsl_titulo, landing_url, prueba', rg, { col: 'created_at', ts: true });
  return rows.filter((x) => !noEsDelNegocio(x)).map((x) => {
    const tipo = txt(x.tipo_evento) ?? (x.event === 'vsl_play' ? 'play' : null);
    const quien = txt(x.visitor_id);
    return {
      f: fechaTj(x.created_at), d: { evento: eventoVsl(tipo), video: txt(x.vsl_titulo), pagina: ruta(x.landing_url) },
      v: { eventos: 1, reproducciones: tipo === 'play' ? 1 : 0, agendaron: tipo === 'agendo' ? 1 : 0 },
      u: { personas: quien, espectadores: tipo === 'play' ? quien : null },
    };
  }).filter((x) => enRango(x.f, rg));
}

/** Las grabaciones de sesión. Sin las pruebas ni la vista previa del constructor (v5). */
type FReplay = { id: string; inicio: string | null; visitor_id: string | null; landing_url: string | null; segundos: number | null; corte: string | null; prueba: string | null };
async function filasReplays(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FReplay>('replay_sesiones', 'id, inicio, visitor_id, landing_url, segundos, corte, prueba', rg, { col: 'inicio', ts: true });
  return rows.filter((x) => !noEsDelNegocio(x))
    .map((x) => ({ f: fechaTj(x.inicio), d: { pagina: ruta(x.landing_url), corte: lindo(txt(x.corte)) }, v: { grabaciones: 1, segundos: num(x.segundos) }, u: { visitantes: txt(x.visitor_id) } }))
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
  venta_tipo: string | null; fecha_agenda: string | null; fecha_primer_pago: string | null; nombre: string | null;
  fecha_junta_2: string | null; fecha_confirmacion: string | null; meta_lead_id: string | null;
};
const COLS_LEAD = 'id, created_at, fecha_junta_1, fecha_cierre, asistio_j1, calificado, cerro, estado_lead, monto_cierre_usd, total_cobrado_usd, pipeline_stage, funnel_id, origen_lead, utm_source, utm_campaign, utm_content, meta_campaign_name, meta_ad_name, closer, setter, motivo_perdida, venta_tipo, fecha_agenda, fecha_primer_pago, nombre, fecha_junta_2, fecha_confirmacion, meta_lead_id';

const columnaLead = (fecha: string) => (fecha === 'agenda' ? 'fecha_junta_1' : fecha === 'cierre' ? 'fecha_cierre' : 'created_at');
async function leadsCrudos(fecha: string, rg: Rango): Promise<FLead[]> {
  const col = columnaLead(fecha);
  const rows = await leer<FLead>('leads', COLS_LEAD, rg, { col, ts: col === 'created_at' });
  return rows.filter((x) => enRango(fecha === 'agenda' ? x.fecha_junta_1 : fecha === 'cierre' ? x.fecha_cierre : fechaTj(x.created_at), rg));
}

/**
 * La MADUREZ de la cohorte de cada lead, de las vistas de cohortes (mig 0084): la semana (lunes) y el mes
 * de su reunión 1, con el estado que la vista calcula («madura» = la última J1 de la cohorte hace ≥ 14 días,
 * contra la fecha de la base). Es una propiedad de la SEMANA, no del lead: por eso se lee aparte y se
 * cruza. Es lo que leía el bloque «Salud del funnel comercial» (getFunnelMadurasLeads, lib/queries.ts).
 */
async function madurezDeCohortes(): Promise<{ semana: Map<string, string>; mes: Map<string, string> }> {
  const todo: Rango = { desde: '', hasta: '', sinRango: true };
  const [sem, mes] = await Promise.all([
    leer<{ semana_inicio: string; estado_madurez: string | null }>('v_cohortes_semanales', 'semana_inicio, estado_madurez', todo, { orden: 'semana_inicio' }),
    leer<{ mes_inicio: string; estado_madurez: string | null }>('v_cohortes_mensuales', 'mes_inicio, estado_madurez', todo, { orden: 'mes_inicio' }),
  ]);
  return {
    semana: new Map(sem.map((x) => [String(x.semana_inicio).slice(0, 10), rotuloMadurez(x.estado_madurez) ?? ''] as const)),
    mes: new Map(mes.map((x) => [String(x.mes_inicio).slice(0, 10), rotuloMadurez(x.estado_madurez) ?? ''] as const)),
  };
}

/**
 * Los leads del CRM. Lo que sumó el v5 (contrato, tabla «Los DATOS»), para que los bloques de Comercial
 * pasen a ser gráficos:
 *   · `madurez_semana` / `madurez_mes`: la de la cohorte de su reunión 1 (`madurezDeCohortes`).
 *   · `limpias` (asistió Y calificado: las «Calificadas» de las cohortes) y su tasa de cierre.
 *   · `dias_ciclo_cierre` / `con_ciclo_cierre`: de la reunión 1 al cierre, de los que cerraron (el «Ciclo
 *     J1→cierre» de las cohortes mensuales).
 *   · `dias_tN` / `con_tN`: los cinco tramos del ciclo (`tramosDelCiclo`, la regla de `_getTramosSCL`).
 * El ciclo de venta (SCL) sigue siendo de la agenda al PRIMER PAGO (`_getSCL`), y su P90 es una métrica
 * percentil sobre él: lo calcula el agregador con la lista de los `ciclo` de cada lead.
 */
async function filasLeads(fecha: string, rg: Rango): Promise<Fila[]> {
  const [rows, rot, madurez] = await Promise.all([leadsCrudos(fecha, rg), rotulosDelCrm(), madurezDeCohortes()]);
  return rows.map((x) => {
    const ciclo = diasEntre(x.fecha_agenda, x.fecha_primer_pago);
    const vendio = gano(x);
    const cicloCierre = vendio ? diasEntre(x.fecha_junta_1, x.fecha_cierre) : null;
    const j1 = x.fecha_junta_1 ? x.fecha_junta_1.slice(0, 10) : null;
    const t = tramosDelCiclo(x);
    const dt = (i: number) => t[i] ?? 0;
    const ct = (i: number) => (t[i] != null ? 1 : 0);
    return {
      f: fecha === 'agenda' ? x.fecha_junta_1 : fecha === 'cierre' ? x.fecha_cierre : fechaTj(x.created_at),
      d: {
        etapa: rot.etapa(x.funnel_id, txt(x.pipeline_stage)),
        producto: rot.producto(x.funnel_id),
        origen: txt(x.origen_lead) ?? txt(x.utm_source),
        campana: txt(x.meta_campaign_name) ?? txt(x.utm_campaign),
        anuncio: txt(x.meta_ad_name) ?? txt(x.utm_content),
        closer: txt(x.closer), setter: txt(x.setter), motivo: txt(x.motivo_perdida),
        // El lead mismo: es un nombre de persona (lib/graficos-acciones.ts, DIMENSIONES_PERSONA).
        lead: txt(x.nombre),
        madurez_semana: j1 ? madurez.semana.get(lunesDeFecha(j1)) || null : null,
        madurez_mes: j1 ? madurez.mes.get(`${j1.slice(0, 7)}-01`) || null : null,
      },
      r: { lead: String(x.id) },
      v: {
        leads: 1, agendas: x.fecha_junta_1 ? 1 : 0, asistencias: x.asistio_j1 ? 1 : 0, calificados: x.calificado ? 1 : 0,
        limpias: x.asistio_j1 && x.calificado ? 1 : 0,
        cierres: vendio ? 1 : 0, vendido: vendio ? num(x.monto_cierre_usd) : 0, cobrado: num(x.total_cobrado_usd),
        // No-show como en la tab vieja: agendó y no asistió.
        no_show: x.fecha_junta_1 && !x.asistio_j1 ? 1 : 0,
        dias_ciclo: ciclo ?? 0, con_ciclo: ciclo != null ? 1 : 0,
        dias_ciclo_cierre: cicloCierre ?? 0, con_ciclo_cierre: cicloCierre != null ? 1 : 0,
        dias_t1: dt(0), con_t1: ct(0), dias_t2: dt(1), con_t2: ct(1), dias_t3: dt(2), con_t3: ct(2),
        dias_t4: dt(3), con_t4: ct(3), dias_t5: dt(4), con_t5: ct(4),
      },
    };
  });
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
/**
 * Las cuotas. La fecha `vencimiento` mira hacia ADELANTE (`futuro`, contrato v5): «Próximos 30 días» trae lo
 * que vence. ⚠️ «Vencido» se decide con el HOY DEL NEGOCIO (su zona, `hoyEnWorkspace`), no con el de
 * Tijuana: el bloque y el detalle ya lo hacían así, y un negocio de Buenos Aires veía una cuota «vencida»
 * tres horas antes de que lo estuviera. Si la zona no se puede leer, cae a la de la app.
 */
async function filasPagos(fecha: string, rg: Rango): Promise<Fila[]> {
  const col = fecha === 'pago' ? 'fecha_pago' : 'fecha_esperada';
  const rows = await leer<FPago>('pagos', 'id, lead_id, numero, monto_usd, fecha_esperada, pagado, fecha_pago', rg, {
    col, extra: (q) => (fecha === 'pago' ? q.eq('pagado', true) : q),
  });
  const [nom, hoy] = await Promise.all([
    nombres('leads', rows.map((x) => x.lead_id).filter((x): x is number => x != null)),
    hoyEnWorkspace().catch(() => hoyEnTijuana()),
  ]);
  return rows.map((x) => {
    const monto = num(x.monto_usd);
    // `ESTADO_COBRADO` es el mismo rótulo que mira la acción «Marcar cobrada» para no ofrecerla dos veces.
    const estado = x.pagado ? ESTADO_COBRADO : x.fecha_esperada && x.fecha_esperada < hoy ? 'Vencido' : 'Pendiente';
    const lead = x.lead_id != null ? String(x.lead_id) : null;
    return {
      f: fecha === 'pago' ? x.fecha_pago : x.fecha_esperada,
      d: { estado, cliente: lead != null ? nom.get(lead) ?? null : null, cuota: x.numero != null ? `Cuota ${x.numero}` : null },
      v: { monto, cobrado: x.pagado ? monto : 0, pendiente: x.pagado ? 0 : monto, pagos: 1 },
      u: { clientes: lead },
      // Los DOS ids de la MISMA fila: marcarPagoAction no comprueba que la cuota sea de ese lead
      // (relevo de los botones de acción), así que el par nunca se arma en el navegador.
      r: { cliente: lead, cuota: String(x.id) },
    };
  });
}

const CATEGORIA_LLAMADA: Record<string, string> = { venta: 'Venta', interna: 'Interna', entrega_servicio: 'Entrega del servicio', test: 'Prueba', sin_clasificar: 'Sin clasificar' };
/**
 * El estado del análisis, en palabras. `pendiente` es una venta que llegó SIN transcript (el próximo sync la
 * reintenta): «Sin transcript» dice qué le falta, «Pendiente» se leería como «en cola».
 */
const ESTADO_LLAMADA: Record<string, string> = { analizada: 'Analizada', pendiente: 'Sin transcript', error: 'Con error', descartada: 'Descartada' };
type FLlamada = { recording_id: number; call_date: string | null; duration_min: number | null; closer: string | null; category: string | null; status: string | null; tipo: string | null; outcome: string | null; score: number | null; title: string | null; lead_id: number | null; lead_nombre: string | null };
async function filasLlamadas(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FLlamada>('closing_analyses', 'recording_id, call_date, duration_min, closer, category, status, tipo, outcome, score, title, lead_id, lead_nombre', rg, { col: 'call_date', orden: 'recording_id' });
  return rows.map((x) => ({
    f: x.call_date,
    d: {
      closer: txt(x.closer), categoria: CATEGORIA_LLAMADA[x.category ?? ''] ?? lindo(txt(x.category)), reunion: txt(x.tipo), resultado: txt(x.outcome)?.slice(0, 40) ?? null,
      estado: ESTADO_LLAMADA[x.status ?? ''] ?? lindo(txt(x.status)),
      // La llamada: su título, o con quién fue. Suele traer el nombre del lead (DIMENSIONES_PERSONA).
      llamada: txt(x.title)?.slice(0, 80) ?? txt(x.lead_nombre),
    },
    v: { llamadas: 1, minutos: num(x.duration_min), puntos: x.score != null ? num(x.score) : 0, con_puntaje: x.score != null ? 1 : 0 },
    // «Ver llamada» abre la ficha de la llamada (app/dashboard/bloques/extra/FichaLlamada.tsx) en la caja del
    // detalle; el lead, si la llamada está atada a uno, su ficha del CRM.
    r: { llamada: String(x.recording_id), lead: x.lead_id != null ? String(x.lead_id) : null },
  }));
}

// ── Negocio: la pauta, el CRM y los cobros en una sola serie ────────────────────────────────

async function filasNegocio(rg: Rango): Promise<Fila[]> {
  const [meta, altas, agendas, cierres, cobros, vsl] = await Promise.all([
    filasMeta(rg), leadsCrudos('alta', rg), leadsCrudos('agenda', rg), leadsCrudos('cierre', rg),
    leer<FPago>('pagos', 'id, lead_id, numero, monto_usd, fecha_esperada, pagado, fecha_pago', rg, { col: 'fecha_pago', extra: (q) => q.eq('pagado', true) }),
    vistasVslPorDia(rg),
  ]);
  const out: Fila[] = [];
  for (const x of meta) out.push({ f: x.f, d: {}, v: { gasto: x.v.gasto, impresiones: x.v.impresiones, clics: x.v.clics, vistas_landing: x.v.vistas_landing } });
  for (const x of vsl) out.push({ f: x.f, d: {}, v: { vistas_vsl: x.n } });
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
/**
 * Quién entró a cada automatización. `respondieron` = las que terminaron en «respondió» o «pasó a una
 * persona» (`ESTADOS_RESPONDIO`), la tasa sobre las personas. Con la fecha «Hoy» (si el catálogo la
 * declara: `sinRango`) son TODAS las inscripciones, para contar quién está hoy en una secuencia.
 */
async function filasInscripciones(fecha: string, rg: Rango): Promise<Fila[]> {
  const col = fecha === 'desenlace' ? 'desenlace_at' : 'inscripto_at';
  const rows = await leer<FInsc>('nutricion_inscripciones', 'id, lead_id, secuencia_id, estado, desenlace, inscripto_at, desenlace_at', rg, { col, ts: true });
  const sec = await nombres('nutricion_secuencias', rows.map((x) => x.secuencia_id).filter((x): x is number => x != null));
  return rows.map((x) => ({
    f: fechaTj(fecha === 'desenlace' ? x.desenlace_at : x.inscripto_at),
    d: { automatizacion: x.secuencia_id != null ? sec.get(String(x.secuencia_id)) ?? null : null, estado: ESTADO_INSC[x.estado ?? ''] ?? lindo(txt(x.estado)), desenlace: lindo(txt(x.desenlace)) },
    v: { personas: 1, respondieron: ESTADOS_RESPONDIO.has(String(x.estado ?? '')) ? 1 : 0 }, u: { leads: x.lead_id != null ? String(x.lead_id) : null },
  })).filter((x) => enRango(x.f, rg));
}

type FEnvio = { id: number; created_at: string; secuencia_id: number | null; inscripcion_id: number | null; canal: string | null; estado: string | null; abierto_at: string | null; clic_at: string | null; respondio_at: string | null };
/**
 * Lo que mandó cada automatización. ⚠️ «Respuestas» daba SIEMPRE 0: `respondio_at` no lo escribe nadie
 * (medido el 11/10/2026, 0 de 23). Desde el v5 se DEDUCE de la inscripción (`enviosRespondidos`): si terminó
 * contestando, cuenta el ÚLTIMO envío de esa inscripción (la secuencia se pausa al responder). Por eso se leen
 * los envíos de esas inscripciones fuera del período: el último puede caer después.
 */
async function filasEnvios(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FEnvio>('nutricion_envios', 'id, created_at, secuencia_id, inscripcion_id, canal, estado, abierto_at, clic_at, respondio_at', rg, { col: 'created_at', ts: true });
  const inscIds = [...new Set(rows.map((x) => x.inscripcion_id).filter((x): x is number => x != null))];
  const [sec, inscripciones, hermanos] = await Promise.all([
    nombres('nutricion_secuencias', rows.map((x) => x.secuencia_id).filter((x): x is number => x != null)),
    leerPorIds<{ id: number; estado: string | null }>('nutricion_inscripciones', 'id, estado', 'id', inscIds),
    leerPorIds<{ id: number; inscripcion_id: number | null; created_at: string; respondio_at: string | null }>('nutricion_envios', 'id, inscripcion_id, created_at, respondio_at', 'inscripcion_id', inscIds),
  ]);
  const estado = new Map(inscripciones.map((x) => [Number(x.id), x.estado] as const));
  const respondidos = enviosRespondidos(
    [...rows, ...hermanos].map((x) => ({ id: Number(x.id), inscripcionId: x.inscripcion_id, t: x.created_at, respondioAt: x.respondio_at })),
    (id) => estado.get(id),
  );
  return rows.map((x) => ({
    f: fechaTj(x.created_at),
    d: { automatizacion: x.secuencia_id != null ? sec.get(String(x.secuencia_id)) ?? null : null, canal: lindo(txt(x.canal)), estado: x.estado === 'fallo' ? 'Falló' : lindo(txt(x.estado)) },
    v: { envios: 1, abiertos: x.abierto_at ? 1 : 0, clics: x.clic_at ? 1 : 0, respuestas: respondidos.has(Number(x.id)) ? 1 : 0 },
  })).filter((x) => enRango(x.f, rg));
}

// ── Plan ─────────────────────────────────────────────────────────────────────────────────

/** Las bandas del tablero (app/plan/board/types.ts, `prioFromScore`): ALTA ≥ 75 · MEDIA ≥ 50 · BAJA ≥ 25. */
const banda = (s: number) => (s >= 75 ? 'Alta' : s >= 50 ? 'Media' : s >= 25 ? 'Baja' : 'A futuro');
async function filasTareas(fecha: string, rg: Rango): Promise<Fila[]> {
  const deQuien = await queTableroLeer();
  const col = fecha === 'deadline' ? 'deadline' : fecha === 'alta' ? 'created_at' : null;
  if (deQuien === 'dueno') {
    // El tablero del super admin: plan_tareas + plan_proyectos (id de texto).
    type T = { id: string; created_at: string | null; deadline: string | null; progress: number | null; score: number | null; labels: unknown; origen: string | null; title: string | null };
    const rows = await leer<T>('plan_tareas', 'id, created_at, deadline, progress, score, labels, origen, title', rg, { col, ts: col === 'created_at' });
    const proy = await nombres('plan_proyectos', rows.map((x) => (Array.isArray(x.labels) ? String(x.labels[0] ?? '') : '')).filter(Boolean), 'name');
    return rows.map((x) => {
      const hecha = num(x.progress) >= 100;
      return {
        f: fecha === 'deadline' ? txt(x.deadline) : fechaTj(x.created_at),
        d: { proyecto: Array.isArray(x.labels) ? proy.get(String(x.labels[0] ?? '')) ?? null : null, prioridad: banda(num(x.score)), estado: hecha ? 'Hecha' : 'Abierta', origen: lindo(txt(x.origen)), responsable: null, tarea: txt(x.title)?.slice(0, 120) ?? null },
        v: { tareas: 1, hechas: hecha ? 1 : 0, abiertas: hecha ? 0 : 1, progreso: Math.min(100, num(x.progress)) },
        // Las dos mitades del tablero no comparten el tipo del id (AGENTS): viaja como texto, que contiene al número.
        r: { tarea: String(x.id) },
      };
    }).filter((x) => enRango(x.f, rg));
  }
  // El de cada cliente: experimento_tareas + tarea_categorias (id numérico).
  type T = { id: number; created_at: string | null; deadline: string | null; progreso: number | null; score: number | null; categorias: unknown; origen: string | null; responsable: string | null; titulo: string | null };
  const rows = await leer<T>('experimento_tareas', 'id, created_at, deadline, progreso, score, categorias, origen, responsable, titulo', rg, { col, ts: col === 'created_at' });
  const cats = await nombres('tarea_categorias', rows.map((x) => (Array.isArray(x.categorias) ? String(x.categorias[0] ?? '') : '')).filter(Boolean));
  return rows.map((x) => {
    const hecha = num(x.progreso) >= 100;
    return {
      f: fecha === 'deadline' ? txt(x.deadline) : fechaTj(x.created_at),
      d: { proyecto: Array.isArray(x.categorias) ? cats.get(String(x.categorias[0] ?? '')) ?? null : null, prioridad: banda(num(x.score)), estado: hecha ? 'Hecha' : 'Abierta', origen: lindo(txt(x.origen)), responsable: txt(x.responsable), tarea: txt(x.titulo)?.slice(0, 120) ?? null },
      v: { tareas: 1, hechas: hecha ? 1 : 0, abiertas: hecha ? 0 : 1, progreso: Math.min(100, num(x.progreso)) },
      r: { tarea: String(x.id) },
    };
  }).filter((x) => enRango(x.f, rg));
}

// ── Customer Success ─────────────────────────────────────────────────────────────────────

/**
 * Cada cliente en la entrega de cada servicio, con el MISMO universo que el kanban de Customer Success
 * (`carteraEnEntrega`, app/customer-success/entrega.ts): los clientes ganados que son de ese producto (su
 * casa, o una fila ahí) y, con la regla de `repartirEnEtapas`, «un cliente sin fila está en la PRIMERA
 * etapa». ⚠️ Hasta el v5 esto contaba las FILAS de `cliente_entrega`: el ws11 decía «1 cliente en entrega»
 * teniendo 19 (relevo v5). El que cuenta filas cuenta de menos (AGENTS.md, «Una regla DERIVADA necesita el
 * UNIVERSO»). La etapa sale con su NOMBRE del catálogo del producto, no con la clave.
 *
 * Una fila guardada con una etapa que el catálogo ya no tiene (un huérfano) va con su clave: el kanban la
 * lista aparte, y acá no se le inventa una columna. Con la fecha «Llegó a la etapa», sólo los que TIENEN fila
 * (los demás nunca llegaron a ninguna: están ahí por la regla).
 */
async function filasEntrega(fecha: string, rg: Rango): Promise<Fila[]> {
  const c = await carteraEnEntrega();
  if (!c.ok) throw new Error(`No pude leer la entrega: ${c.error}`);
  const universo = new Set<number>([
    ...Object.keys(c.casaPorLead).map(Number),
    ...Object.values(c.porServicio).flatMap((m) => Object.keys(m).map(Number)),
  ].filter((x) => Number.isFinite(x)));
  const cli = await nombres('leads', [...universo]);
  const out: Fila[] = [];
  for (const s of c.servicios) {
    const filas = c.porServicio[s.productoId] ?? {};
    const delProducto = [...universo].filter((id) => c.casaPorLead[id] === s.productoId || Object.prototype.hasOwnProperty.call(filas, id));
    const { porEtapa, huerfanos } = repartirEnEtapas(s.etapas, delProducto, (id) => filas[id]?.etapa);
    const etiqueta = new Map(s.etapas.map((e) => [e.key, e.label] as const));
    const fila = (lead: number, etapa: string | null): Fila => ({
      f: fechaTj(filas[lead]?.etapa_desde ?? null),
      // El cliente es un nombre de persona (DIMENSIONES_PERSONA); su lead_id abre la ficha.
      d: { producto: s.nombre, etapa, cliente: cli.get(String(lead)) ?? null },
      v: { clientes: 1 },
      r: { cliente: String(lead) },
    });
    for (const [key, ids] of Object.entries(porEtapa)) for (const id of ids) out.push(fila(id, etiqueta.get(key) ?? lindo(key)));
    for (const id of huerfanos) out.push(fila(id, lindo(txt(filas[id]?.etapa ?? null))));
  }
  return fecha === 'desde' ? out.filter((x) => enRango(x.f, rg)) : out;
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
/**
 * Un lector por conjunto. El tercer argumento es el gráfico, para los conjuntos que se leen POR
 * DIMENSIÓN (la audiencia de Meta: cada desglose es otra lectura, y juntarlas sumaría tres veces).
 */
export const LECTORES: Record<string, (fecha: string, rg: Rango, g?: Pick<Grafico, 'dimension' | 'desglose'>) => Promise<Fila[]>> = {
  negocio: (_, rg) => filasNegocio(rg),
  meta: (_, rg) => filasMeta(rg),
  // Sin dimensión (un cuadro de resultados) se lee edad y género: trae las agendas y suma el total de la
  // cuenta. Por región Meta NO da agendas (0 de 33 filas, medido), y el KPI saldría en 0.
  audiencia: (_, rg, g) => filasAudiencia(g?.dimension ?? '', g?.desglose ?? null, rg),
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
  // Los conjuntos de las tabs de Analysts (lib/graficos-fuentes-extra.ts).
  ...LECTORES_EXTRA,
};

/**
 * Hasta dónde se lee una fuente: el período cortado en HOY (salvo una fecha que mira hacia adelante,
 * `futuro`) y, la pauta de Meta y lo que la cruza, en AYER — llega por cron y el día en curso todavía no
 * está (medido el 10/10 sobre el ws1). La cuenta es `hastaDeLectura` (lib/graficos-agregar.ts, pura y con
 * test); acá se le pone el hoy.
 *
 * ⚠️ ES EL ÚNICO LUGAR DEL CORTE (contrato v5): lo llaman `datosDeGraficos`, `valoresDeCampo` y
 * `detalleDeGrafico` (lib/graficos-detalle.ts). Sin `fecha`, la primera del conjunto (la que elige
 * `sanearGrafico`). Quien MUESTRA un período cortado (la API de MaKo, el AI Analyst) usa `cortarEnHoyDe`.
 */
export function hastaDeFuente(g: { fuente: string; fecha?: string | null }, desde: string, hasta: string): string {
  return hastaDeLectura(g, desde, hasta, hoyEnTijuana());
}
/** El período cortado en hoy como se MUESTRA (sin el «ayer» de la pauta): `cortarEnHoy` con el hoy de la app. */
export function cortarEnHoyDe(g: { fuente: string; fecha?: string | null }, desde: string, hasta: string): string {
  return cortarEnHoy(g, desde, hasta, hoyEnTijuana());
}

/**
 * Cuánto se espera una lectura antes de devolverle «Tardó demasiado» a sus gráficos. Por debajo del tope de
 * /api/graficos (60 s) con margen para agregar y contestar: así la ruta contesta SIEMPRE, y lo lento no
 * apaga lo rápido.
 */
export const PLAZO_LECTOR_MS = 45_000;
/** El mensaje que llega a la tarjeta: QUÉ tardó, para que no se lea como «no hay datos». */
export const tardoDemasiado = (nombreConjunto: string) => `Tardó demasiado: ${nombreConjunto}`;

/**
 * Los conjuntos cuyo lector devuelve OTRAS filas según la dimensión del gráfico (sin ser `porDimension`):
 * `retencion_vsl` por `corte` es una fila por persona y corte (la curva); por cualquier otra, una por persona.
 * La clave de lectura lleva esa dimensión, o una curva y un cuadro de resultados de la misma hoja se pisarían.
 */
const FILAS_POR_DIMENSION: Readonly<Record<string, readonly string[]>> = { retencion_vsl: ['corte'] };

export type DatosGrafico = { ok: true; resultado: Resultado } | { ok: false; error: string };
/**
 * Lo que pide la pantalla por gráfico: el gráfico, el período y lo que resolvió `efectivoDe`
 * (lib/graficos-catalogo.ts) — los filtros ya traducidos a las dimensiones de SU conjunto y el
 * «agrupar por». El server vuelve a sanear todo: lo que llega del navegador no vale nada.
 */
export type PedidoDatos = { grafico: unknown; desde: string; hasta: string; filtros?: unknown; agrupar?: unknown };

const TOPE_FILTROS = 8;
/** Los filtros que valen para ESTE conjunto: dimensión de categoría que existe, con tope de valores y de largo. */
export function sanearFiltros(raw: unknown, fuenteId: string): Filtro[] {
  const f = fuenteDe(fuenteId);
  if (!f || !Array.isArray(raw)) return [];
  const out: Filtro[] = [];
  for (const x of raw.slice(0, TOPE_FILTROS)) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const dim = f.dimensiones.find((d) => d.id === o.dimension && d.clase === 'categoria');
    if (!dim) continue;
    if (Array.isArray(o.valores)) {
      const valores = [...new Set(o.valores.map((v) => String(v).slice(0, 120)))].slice(0, 50);
      if (valores.length) out.push({ dimension: dim.id, valores });
    } else if (typeof o.texto === 'string' && o.texto.trim()) {
      out.push({ dimension: dim.id, texto: o.texto.trim().slice(0, 80) });
    }
  }
  return out;
}

/**
 * Los datos de VARIOS gráficos, leyendo cada (fuente, fecha, período) UNA vez: ocho gráficos
 * sobre la pauta del mismo mes son una lectura, no ocho. Un fallo vuelve como error de SU
 * gráfico: que no se pueda leer la pauta no apaga el gráfico de leads de al lado.
 *
 * Los FILTROS se aplican en memoria, después de la lectura y antes de agregar: la clave de lectura
 * no los lleva, así las filas crudas se siguen compartiendo entre gráficos. Y se aplican TAMBIÉN al
 * período anterior: comparar lo filtrado contra lo no filtrado haría mentir al chip «↑ 1,3×».
 *
 * El período llega TAL CUAL lo pidió el gráfico: el corte en hoy es de acá (`hastaDeFuente`). Y cada
 * lectura tiene su plazo (`PLAZO_LECTOR_MS`): la que no llega, le dice «Tardó demasiado: <conjunto>» a sus
 * gráficos; el resto contesta igual.
 */
export async function datosDeGraficos(pedidos: PedidoDatos[], opts: { plazoMs?: number } = {}): Promise<Record<string, DatosGrafico>> {
  const lecturas = new Map<string, Promise<Fila[]>>();
  const out: Record<string, DatosGrafico> = {};
  const plazo = opts.plazoMs ?? PLAZO_LECTOR_MS;
  await Promise.all(pedidos.map(async (p) => {
    const g0 = sanearGrafico(p.grafico);
    if (!g0) return;
    const fuente = fuenteDe(g0.fuente);
    const lector = LECTORES[g0.fuente];
    if (!fuente || !lector) { out[g0.id] = { ok: false, error: 'Fuente desconocida' }; return; }
    // «Agrupar por» cambia la dimensión de TIEMPO del gráfico (nunca una categoría).
    const agrupar = p.agrupar === 'dia' || p.agrupar === 'semana' || p.agrupar === 'mes' ? p.agrupar : null;
    const esT = g0.dimension === 'dia' || g0.dimension === 'semana' || g0.dimension === 'mes';
    const g = agrupar && esT ? { ...g0, dimension: agrupar } : g0;
    const filtros = sanearFiltros(p.filtros, g.fuente);
    const sinRango = !!fuente.fechas.find((x) => x.id === g.fecha)?.sinRango;
    const hasta = hastaDeFuente(g, p.desde, p.hasta);
    const rg: Rango = { desde: p.desde, hasta, sinRango };
    const porDim = fuente.porDimension
      ? `|${g.dimension}|${g.desglose ?? ''}`
      : FILAS_POR_DIMENSION[g.fuente]?.includes(g.dimension ?? '') ? `|${g.dimension}` : '';
    const clave = `${g.fuente}|${g.fecha}|${p.desde}|${hasta}|${sinRango}${porDim}`;
    const leerConPlazo = (r: Rango) => conPlazo(lector(g.fecha, r, g), plazo, tardoDemasiado(fuente.nombre));
    if (!lecturas.has(clave)) lecturas.set(clave, leerConPlazo(rg));
    // El período anterior del MISMO largo, que termina el día antes de que empiece éste.
    const ant = g.comparar && !sinRango ? periodoAnterior(p.desde, hasta) : null;
    const claveAnt = ant ? `${g.fuente}|${g.fecha}|${ant.desde}|${ant.hasta}|false${porDim}` : null;
    if (ant && claveAnt && !lecturas.has(claveAnt)) lecturas.set(claveAnt, leerConPlazo({ ...ant, sinRango: false }));
    try {
      const resultado = agregar(g, filtrarFilas(await lecturas.get(clave)!, filtros), p.desde, hasta);
      if (ant && claveAnt) resultado.anterior = agregar(g, filtrarFilas(await lecturas.get(claveAnt)!, filtros), ant.desde, ant.hasta).totales;
      out[g.id] = { ok: true, resultado };
    } catch (e) {
      console.error(`[graficos] ${clave}: ${e instanceof Error ? e.message : String(e)}`);
      out[g.id] = { ok: false, error: e instanceof SinConexionError || e instanceof PlazoVencidoError ? e.message : 'No pude leer los datos' };
    }
  }));
  return out;
}

/**
 * Los conjuntos que NO se leen para ofrecer los valores de un campo. `vsl` baja TODOS los eventos del Pixel
 * del período (48 mil en 30 días en el ws1) y sus páginas son las mismas que ya traen las visitas: abrir el
 * desplegable «Página» de la hoja Landing releía la tabla entera dos veces (relevo v5).
 */
const SIN_VALORES: Readonly<Record<string, readonly string[]>> = { pagina: ['vsl'] };

export type ValorDeCampo = { valor: string; filas: number };
/**
 * Los valores que puede elegir una lista desplegable: los distintos de ese campo en el período, en
 * TODOS los conjuntos donde el campo significa lo mismo (`campoDe(...).en`), con cuántas filas trae
 * cada uno. Se normaliza con la MISMA función que agrupa y filtra (`claveCategoria`). Con tope: una
 * lista de mil campañas no se elige, se busca.
 */
export async function valoresDeCampo(campoId: string, desde: string, hasta: string, soloFuentes?: string[], opts: { plazoMs?: number } = {}): Promise<ValorDeCampo[]> {
  const campo = campoDe(campoId);
  if (!campo) return [];
  const cuenta = new Map<string, number>();
  const caros = SIN_VALORES[campo.id] ?? [];
  const fuentes = Object.keys(campo.en).filter((f) => (!soloFuentes || soloFuentes.includes(f)));
  // Si el campo lo da otro conjunto, el caro no se lee; si es el ÚNICO pedido, sí (sin él no habría valores).
  const aLeer = fuentes.some((f) => !caros.includes(f)) ? fuentes.filter((f) => !caros.includes(f)) : fuentes;
  await Promise.all(aLeer.map(async (fid) => {
    const f = fuenteDe(fid);
    const lector = LECTORES[fid];
    if (!f || !lector) return;
    const dim = campo.en[fid];
    const fecha = f.fechas[0];
    const rg: Rango = { desde, hasta: hastaDeFuente({ fuente: fid, fecha: fecha.id }, desde, hasta), sinRango: !!fecha.sinRango };
    try {
      const filas = await conPlazo(lector(fecha.id, rg, { dimension: dim, desglose: null }), opts.plazoMs ?? PLAZO_LECTOR_MS, tardoDemasiado(f.nombre));
      for (const fl of filas) { const k = claveCategoria(fl.d[dim]); cuenta.set(k, (cuenta.get(k) ?? 0) + 1); }
    } catch (e) {
      console.error(`[graficos] valores ${campoId}/${fid}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }));
  return [...cuenta.entries()].map(([valor, filas]) => ({ valor, filas })).sort((a, b) => b.filas - a.filas || a.valor.localeCompare(b.valor)).slice(0, 300);
}
