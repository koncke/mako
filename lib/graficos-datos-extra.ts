// =============================================================================
// graficos-datos-extra — los lectores de los conjuntos de las tabs de Analysts
// =============================================================================
// Uno por cada conjunto de lib/graficos-fuentes-extra.ts. Las mismas reglas que lib/graficos-datos.ts:
// el workspace EXPLÍCITO en cada lectura (`leer`), todo paginado, y nunca el contenido de una
// conversación (sólo se cuentan filas).
//
// ⚠️ CADA LECTOR CUENTA CON LAS MISMAS FUNCIONES QUE LA TAB QUE REEMPLAZA (pedido del 11/10/2026),
// para que la hoja y la tab no den dos números distintos sobre el mismo dato:
//   · guiones   → el veredicto con `verdictFromVals` y la retención al CTA de `getQuadrantData`
//                 (lib/ads-analyst.ts), igual que el cuadrante de Ads Analyst sobre una ventana.
//   · clics     → `clavePorClic` (lib/landing-pulso.ts) y el sello del constructor descartado.
//   · scroll    → el MÁXIMO por persona, como `profundidadDe`.
//   · toques    → los mismos descartes que `recorrerToques` (lib/landing-mapa-server.ts) y el rótulo
//                 de «Lo más tocado» (`rotuloDe`).
//   · retencion → `avancePorPersona` (lib/vsl-retencion.ts), con la duración de Panda.
//   · llamadas  → el mismo universo que getClosingViewData: de venta y analizadas, y nombradas como en la
//                 lista de la hoja (`nombreDeLlamada`, lib/llamadas-modelo.ts).
//   · proyectos y ejecución → `metricasProductividad` (lib/productividad-metricas.ts), lo de la tab.
//
// ⚠️ DESCARTES DE LOS EVENTOS DEL PIXEL: las pruebas (`prueba` no nulo: es quien probaba el Pixel) y la
// vista previa del constructor (`esPreviewDeEditor`) no son visitas del negocio. Desde el v5 TODOS los
// conjuntos los sacan con `noEsDelNegocio` (también `visitas`, `vsl` y `replays`, en lib/graficos-datos.ts).
//
// ⚠️ LA PÁGINA ES `ruta()` (host/ruta, sin esquema ni query), la misma de los conjuntos de siempre: así el
// campo «Página» puede cruzarlos el día que estos conjuntos entren en COMPARTIDOS (lib/graficos-catalogo.ts).
//
// ⚠️ LA RETENCIÓN DEL VIDEO SE LEE DE UN RESUMEN (v5): `retencion_vsl_resumen` (mig 0261) agrupa en la base
// lo que antes eran 48 mil eventos bajados dos veces por hoja; la cuenta del avance sigue en TS
// (`avancesDeResumen`, lib/vsl-retencion.ts, con su test de paridad). Si la función todavía no está en la
// base, se resume en TS sobre los eventos (`resumirEventos`): la misma cuenta, más lenta.

import 'server-only';
import { SinConexionError, type Fila } from './graficos-agregar';
import { rangoDe, type Grafico } from './graficos-catalogo';
import { enRango, queTableroLeer, fechaTj, leer, leerPorIds, lindo, num, rotulosDelCrm, ruta, txt, type Rango } from './graficos-lectura';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { conversorGastoMeta } from './moneda-meta';
import { integracionConectada } from './credenciales';
import { getQuadrantData } from './ads-analyst';
import { getAngles } from './script-angles';
import { getAvatares } from './script-avatares';
import { VEREDICTO_ROTULO, confFromImpr, verdictFromVals } from './ads-analyst-patrones';
import { esClicDelConstructor } from './clic-ruido';
import { esPreviewDeEditor } from './landing-paginas';
import { clavePorClic } from './landing-pulso';
import { destinoCorto } from '@/app/crm/lead-view/clic-detalle';
import { dispositivoDe } from './landing-mapa';
import { rotuloDe } from './landing-mapa-rotulo';
import { avancesDeResumen, resumirEventos, type EventoResumible, type ResumenVsl } from './vsl-retencion';
import { getDuracionesVsl } from './leads';
import { idDeclaraHost } from './video-id';
import { listPlanBoard } from './plan-board';
import { listCategorias, listTareas } from './todo';
import { toBoard, toLabel } from '@/app/plan/board/desde-todo';
import { PLABEL, prioFromScore, type BoardTask, type Label } from '@/app/plan/board/types';
import { sinRecurrentes } from './plan-recurrentes';
import { CUADRANTE_ROTULO, DAY, cuadranteDe, deadlineMoves, metricasProductividad, ultActividad } from './productividad-metricas';
import { nombreDeLlamada } from './llamadas-modelo';
import { diasAntes, hoyEnTijuana, TZ_TIJUANA } from './date-utils';
import { hoyEnWorkspace } from './timezone';
import { getMrrActivo } from './queries';
import { getOutstandingDetalle } from './pagos';
import { noEsDeuda } from './cobrado-lead';
import { armarCobranza, nombreCuota } from './datos-comercial';
import { cartera } from './cs-cartera';
import {
  CORTES_VSL, MOTIVO_DE_REGLA, chatsEsperando, esChatIndividual, esSelloDelConstructor, fraccionCta, gano, llegaronAlCta,
  regionIso, rotuloSenal, rotuloUrgencia, tramoDeContacto, tramoVisto, turnosDeChats, type MensajeChat,
} from './graficos-datos-puro';

export type Lector = (fecha: string, rg: Rango, g?: Pick<Grafico, 'dimension' | 'desglose'>) => Promise<Fila[]>;

const TANDA_IDS = 150;
const enTandas = <T>(xs: T[]): T[][] => { const out: T[][] = []; for (let i = 0; i < xs.length; i += TANDA_IDS) out.push(xs.slice(i, i + TANDA_IDS)); return out; };
const DISPOSITIVO: Record<string, string> = { movil: 'Celular', escritorio: 'Computadora' };
const dispositivo = (ancho: number | null) => { const d = dispositivoDe(ancho); return d ? DISPOSITIVO[d] : null; };
/**
 * Un evento del Pixel que no es del negocio: una prueba (`?mko_test=`) o la vista previa del constructor.
 * La usan TODOS los conjuntos del Pixel (también los de lib/graficos-datos.ts): una sola regla.
 */
export const noEsDelNegocio = (x: { prueba: string | null; landing_url: string | null }) => !!x.prueba || esPreviewDeEditor(x.landing_url ?? '');
/** El inicio de «Todo» (sale de `rangoDe`, no se copia): desde ahí, una cuota sin fecha también es deuda. */
const DESDE_TODO = rangoDe('todo', '2000-01-01').desde;

// ── Ads Analyst ─────────────────────────────────────────────────────────────────────────

/** Sin Meta, Ads Analyst muestra su pantalla de activación: la tarjeta lo dice en vez de dibujar ceros. */
export const exigirMeta = async () => { if (!(await integracionConectada('meta'))) throw new SinConexionError('Conecta Meta en Integraciones'); };

type FGuion = { ad_id: string; ad_name: string | null; short: string | null; angle: string | null; angle_override: string | null; avatar: string | null; avatar_override: string | null; hook_type: string | null; format: string | null; es_imagen: boolean | null; beats: unknown; dur: number | null };
type FMetricaAd = {
  id: number; fecha: string; ad_id: string | null; campaign_name: string | null; adset_name: string | null;
  spend: number | null; impressions: number | null; link_clicks: number | null; leads_count: number | null; agendas_meta: number | null;
  video_3s_views: number | null; video_thruplay: number | null; video_p25: number | null; video_p50: number | null; video_p75: number | null; video_p100: number | null;
  ad_thumbnail_url: string | null;
};
type FCierreAd = { id: number; meta_ad_id: string | null; fecha_cierre: string | null };

/**
 * La pauta de Meta de cada anuncio ANALIZADO (los que la tab muestra: con beats o de imagen), una
 * fila por anuncio por día, más una fila por cierre del CRM atribuido al anuncio (fechada por su
 * cierre: la tab los cuenta sin fecha, así que sólo coinciden con el período «Todo», y un ganado sin
 * `fecha_cierre` no entra en ninguno).
 *
 * El veredicto, la confianza y el resultado son del ANUNCIO EN LA VENTANA, y se estampan en cada
 * una de sus filas: así un filtro «Veredicto = Escalar» se lleva todos sus días.
 *
 * Lo del v5: cada fila lleva el ad_id en `r.anuncio` y `r.guion` (el clic abre el ANUNCIO: la entidad
 * del conjunto) y la miniatura del creativo (`img`, la columna que ya lee Ads Analyst) para las Tarjetas;
 * `llegaron_cta` es la retención al llamado del cuadrante hecha suma (`llegaronAlCta`). ⛔ Y sin los
 * defaults de UN cliente: un guion sin ángulo era «Capataz» y sin gancho, «Promesa» (el vocabulario de
 * Mauricio, lib/script-angles.ts): ahora es «(sin dato)», que es lo que se sabe.
 */
async function filasGuiones(rg: Rango): Promise<Fila[]> {
  await exigirMeta();
  const todas = await leer<FGuion & { status: string }>('script_analyses', 'ad_id, ad_name, short, angle, angle_override, avatar, avatar_override, hook_type, format, es_imagen, beats, dur, status', { ...rg, sinRango: true }, {
    orden: 'ad_id', extra: (q) => q.eq('status', 'analizada'),
  });
  // Como getScriptAnalystView: los videos con su guion partido en bloques, y los de imagen.
  const analizados = todas.filter((x) => x.es_imagen || (Array.isArray(x.beats) && x.beats.length > 0));
  if (!analizados.length) return [];
  const ids = analizados.map((x) => x.ad_id);
  const [metricas, cierres, conv, cuadrante, angulos, avatares] = await Promise.all([
    Promise.all(enTandas(ids).map((t) => leer<FMetricaAd>('marketing_metrics_daily',
      'id, fecha, ad_id, campaign_name, adset_name, spend, impressions, link_clicks, leads_count, agendas_meta, video_3s_views, video_thruplay, video_p25, video_p50, video_p75, video_p100, ad_thumbnail_url',
      rg, { col: 'fecha', orden: [{ col: 'fecha' }, { col: 'ad_id' }, { col: 'id' }], extra: (q) => q.eq('plataforma', 'meta').in('ad_id', t) }))).then((x) => x.flat()),
    Promise.all(enTandas(ids).map((t) => leer<FCierreAd>('leads', 'id, meta_ad_id, fecha_cierre', rg, {
      col: 'fecha_cierre', extra: (q) => q.eq('estado_lead', 'ganado').in('meta_ad_id', t),
    }))).then((x) => x.flat()),
    conversorGastoMeta(),
    getQuadrantData(rg.desde, rg.hasta),
    getAngles().catch(() => []),
    getAvatares().catch(() => []),
  ]);
  const nombreAngulo = new Map(angulos.map((a) => [a.key, a.label] as const));
  const nombreAvatar = new Map(avatares.map((a) => [a.key, a.label] as const));
  const quad = new Map(cuadrante.map((p) => [p.id, p] as const));

  // Lo del anuncio en la ventana: impresiones, plays y agendas (para la confianza y el resultado), su
  // campaña y conjunto más recientes y su miniatura más reciente (las filas vienen por fecha ascendente).
  const ventana = new Map<string, { impresiones: number; v3s: number; agendas: number; campana: string | null; conjunto: string | null; img: string | null }>();
  for (const x of metricas) {
    if (!x.ad_id) continue;
    const a = ventana.get(x.ad_id) ?? { impresiones: 0, v3s: 0, agendas: 0, campana: null, conjunto: null, img: null };
    a.impresiones += num(x.impressions); a.v3s += num(x.video_3s_views); a.agendas += num(x.agendas_meta);
    a.campana = txt(x.campaign_name) ?? a.campana; a.conjunto = txt(x.adset_name) ?? a.conjunto;
    a.img = txt(x.ad_thumbnail_url) ?? a.img;
    ventana.set(x.ad_id, a);
  }
  const porAd = new Map(analizados.map((x) => [x.ad_id, x] as const));
  // En qué fracción del video arranca el llamado a la acción de cada anuncio (el último bloque del guion).
  const cta = new Map(analizados.map((x) => [x.ad_id, fraccionCta(x.beats, x.dur)] as const));
  const dimsDe = (adId: string) => {
    const s = porAd.get(adId)!;
    const w = ventana.get(adId);
    const angulo = txt(s.angle_override) ?? txt(s.angle);
    const avatar = txt(s.avatar_override) ?? txt(s.avatar);
    // Imagen de verdad: marcada así Y sin reproducciones de video (las métricas mandan).
    const esImagen = !!s.es_imagen && (w?.v3s ?? 0) === 0;
    const q = quad.get(adId);
    const veredicto = esImagen ? VEREDICTO_ROTULO.imagen : q ? VEREDICTO_ROTULO[verdictFromVals(q.hookRate, q.hold, q.impressions)] : null;
    const conf = confFromImpr(w?.impresiones ?? 0);
    return {
      guion: txt(s.short) ?? (s.ad_name ?? s.ad_id).slice(0, 24),
      angulo: angulo ? nombreAngulo.get(angulo) ?? lindo(angulo) : null,
      gancho: lindo(txt(s.hook_type)),
      formato: txt(s.format) ?? 'Video',
      avatar: avatar ? nombreAvatar.get(avatar) ?? lindo(avatar) : null,
      tipo: esImagen ? 'Imagen' : 'Video',
      campana: w?.campana ?? null,
      conjunto: w?.conjunto ?? null,
      veredicto,
      confianza: conf === 'alta' ? 'Alta' : conf === 'media' ? 'Media' : 'Baja',
      resultado: (w?.agendas ?? 0) > 0 ? 'Agendó' : 'Sin agendas',
    };
  };
  // El clic abre el ANUNCIO (`r.anuncio`); `r.guion` le da a un grupo por guion su `ref`.
  const refDe = (adId: string) => ({ anuncio: adId, guion: adId });
  const out: Fila[] = [];
  for (const x of metricas) {
    if (!x.ad_id || !porAd.has(x.ad_id)) continue;
    const plays = num(x.video_3s_views);
    out.push({
      f: x.fecha,
      d: dimsDe(x.ad_id),
      v: {
        gasto: conv.aUsdNum(num(x.spend)), impresiones: num(x.impressions), plays_3s: plays, thruplays: num(x.video_thruplay),
        p25: num(x.video_p25), p50: num(x.video_p50), p75: num(x.video_p75), p100: num(x.video_p100),
        llegaron_cta: llegaronAlCta({ v3s: plays, thru: num(x.video_thruplay), p25: num(x.video_p25), p50: num(x.video_p50), p75: num(x.video_p75), p100: num(x.video_p100) }, cta.get(x.ad_id) ?? 1),
        clics: num(x.link_clicks), leads: num(x.leads_count), agendas: num(x.agendas_meta), cierres: 0,
      },
      u: { guiones: x.ad_id },
      r: refDe(x.ad_id),
      img: ventana.get(x.ad_id)?.img ?? null,
    });
  }
  for (const c of cierres) {
    if (!c.meta_ad_id || !porAd.has(c.meta_ad_id)) continue;
    out.push({ f: c.fecha_cierre ? c.fecha_cierre.slice(0, 10) : null, d: dimsDe(c.meta_ad_id), v: { cierres: 1 }, r: refDe(c.meta_ad_id), img: ventana.get(c.meta_ad_id)?.img ?? null });
  }
  return out.filter((x) => enRango(x.f, rg));
}

// ── Landing Analyst ─────────────────────────────────────────────────────────────────────

/** El destino de un clic, en palabras: «Botón “Agendar”», `#registro` o `negocio.com/precios`. */
const destinoDeClic = (clave: string, texto: string | null): string => {
  if (clave === '(sin destino)') return clave;
  if (clave === 'boton:' || clave.startsWith('boton: ')) return texto ? `Botón «${texto}»` : 'Botón sin texto';
  return destinoCorto(clave);
};

type FClic = { id: number; created_at: string; visitor_id: string | null; landing_url: string | null; detalle: string | null; ancho_ventana: number | null; prueba: string | null; sel: string | null };
/**
 * Cada clic en un botón o enlace (sin el sello del constructor: por su texto, `esClicDelConstructor`, y desde
 * el v5 también por su SELECTOR, `esSelloDelConstructor` — la cruz del sello llega con el texto vacío). Una
 * consulta propia: el índice de los clics es parcial.
 */
async function filasClics(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FClic>('vsl_events', 'id, created_at, visitor_id, landing_url, detalle, ancho_ventana, prueba, sel', rg, {
    col: 'created_at', ts: true, extra: (q) => q.eq('tipo_evento', 'click'),
  });
  const out: Fila[] = [];
  for (const x of rows) {
    if (noEsDelNegocio(x) || esClicDelConstructor(x.detalle) || esSelloDelConstructor(x.sel)) continue;
    const { clave, texto } = clavePorClic(x.detalle);
    out.push({
      f: fechaTj(x.created_at),
      d: { pagina: ruta(x.landing_url), destino: destinoDeClic(clave, texto), texto, dispositivo: dispositivo(x.ancho_ventana) },
      v: { clics: 1 }, u: { personas: txt(x.visitor_id) },
    });
  }
  return out.filter((x) => enRango(x.f, rg));
}

type FScroll = { id: number; created_at: string; visitor_id: string | null; landing_url: string | null; porcentaje: number | null; prueba: string | null };
/**
 * Una fila por persona y página: hasta dónde bajó, contado UNA vez. El snippet manda un evento por hito
 * Y uno exacto al irse, así que contar eventos daría más gente en el 25% que la que entró. La fecha es
 * la del primer scroll de esa persona en esa página dentro del período.
 */
async function filasScroll(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FScroll>('vsl_events', 'id, created_at, visitor_id, landing_url, porcentaje, prueba', rg, {
    col: 'created_at', ts: true, extra: (q) => q.eq('tipo_evento', 'scroll'),
  });
  const max = new Map<string, { f: string; pagina: string | null; pct: number }>();
  for (const x of rows) {
    if (noEsDelNegocio(x)) continue;
    // Sin visitante o sin porcentaje no se puede contar como persona ni ubicar en un hito.
    if (!x.visitor_id || typeof x.porcentaje !== 'number' || !Number.isFinite(x.porcentaje)) continue;
    const f = fechaTj(x.created_at);
    if (!f || !enRango(f, rg)) continue;
    const pagina = ruta(x.landing_url);
    const k = `${x.visitor_id}|${pagina ?? ''}`;
    const a = max.get(k);
    if (!a) max.set(k, { f, pagina, pct: x.porcentaje });
    else { if (x.porcentaje > a.pct) a.pct = x.porcentaje; if (f < a.f) a.f = f; }
  }
  return [...max.values()].map((a) => ({
    f: a.f, d: { pagina: a.pagina },
    v: { medidos: 1, llegaron_25: a.pct >= 25 ? 1 : 0, llegaron_50: a.pct >= 50 ? 1 : 0, llegaron_75: a.pct >= 75 ? 1 : 0, llegaron_100: a.pct >= 100 ? 1 : 0 },
  }));
}

type FToque = { id: number; created_at: string; visitor_id: string | null; landing_url: string | null; tipo_evento: string; detalle: string | null; clic_x: number | null; clic_y: number | null; ancho_ventana: number | null; prueba: string | null; sel: string | null };
/**
 * Los toques con su punto (los del mapa de calor): `clic_x is not null` es el predicado del índice parcial
 * (mig 0190). ⚠️ Sin el SELLO del constructor (`#lovable-badge-*`, v5): medido el 11/10/2026, era lo más
 * tocado del ws1 (9 de 31 toques) y encabezaba «Lo más tocado».
 */
async function filasToques(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FToque>('vsl_events', 'id, created_at, visitor_id, landing_url, tipo_evento, detalle, clic_x, clic_y, ancho_ventana, prueba, sel', rg, {
    col: 'created_at', ts: true, extra: (q) => q.not('clic_x', 'is', null),
  });
  const out: Fila[] = [];
  for (const x of rows) {
    if (x.tipo_evento !== 'click' && x.tipo_evento !== 'clic_vacio') continue;
    if (noEsDelNegocio(x)) continue;
    if (esSelloDelConstructor(x.sel)) continue;
    if (x.tipo_evento === 'click' && esClicDelConstructor(x.detalle)) continue;
    const disp = dispositivo(x.ancho_ventana);
    if (!disp || typeof x.clic_x !== 'number' || typeof x.clic_y !== 'number') continue;
    const tipo = x.tipo_evento as 'click' | 'clic_vacio';
    const etiqueta = (x.detalle ?? '').slice(0, 120) || (tipo === 'clic_vacio' ? 'vacio' : 'clic');
    out.push({
      f: fechaTj(x.created_at),
      d: { pagina: ruta(x.landing_url), lugar: rotuloDe({ tipo, etiqueta }), tipo: tipo === 'click' ? 'Botón' : 'Fuera de un botón', dispositivo: disp },
      v: { toques: 1 }, u: { personas: txt(x.visitor_id) },
    });
  }
  return out.filter((x) => enRango(x.f, rg));
}

/**
 * La duración de cada video, sabiendo QUÉ videos hay en juego. ⚠️ ES LA REGLA DE `resolverDuracion`
 * (lib/leads.ts), que es privada: con un solo video en juego se le presta «la única duración conocida»
 * (los hitos `sNN` de Panda llegan sin porcentaje), nunca a un id que declara otro host, y con dos
 * videos no se presta nada. Si esa función se exporta, esto pasa a ser un import.
 */
function duracionPara(videos: Set<string>, durs: Map<string, number>): (videoId: string | null) => number | null {
  const unica = durs.size === 1 ? [...durs.values()][0] : null;
  const hayUnoSolo = videos.size <= 1;
  return (videoId) => {
    const v = videoId?.trim();
    if (v && durs.has(v)) return durs.get(v)!;
    if (v && idDeclaraHost(v)) return null;
    return hayUnoSolo ? unica : null;
  };
}

type FEventoVideo = EventoResumible & { id: number; created_at: string; visitor_id: string | null; tipo_evento: string | null; porcentaje: number | null; segundos: number | null; video_id: string | null; vsl_titulo: string | null; landing_url: string | null; prueba: string | null };

/** ¿La función del resumen no está en la base (la migración 0261 todavía no se aplicó)? */
const funcionNoExiste = (e: { code?: string; message?: string } | null): boolean =>
  !!e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function|function .* does not exist/i.test(e.message ?? ''));

/**
 * ⚠️ UNA SOLA LECTURA POR HOJA (contrato v5): el conjunto `retencion_vsl` por persona y su curva por corte
 * (dos claves de lectura en `datosDeGraficos`), `vsl_leads` y el bloque viejo de la curva piden el MISMO
 * resumen en el mismo pedido. Se comparte la PROMESA por un rato corto, por workspace y período: dentro de
 * un pedido corren todas a la vez en la misma instancia. No es una caché entre instancias, y no pretende serlo.
 */
const MEMO_RESUMEN_MS = 20_000;
const memoResumen = new Map<string, { t: number; p: Promise<ResumenVsl[]> }>();

/**
 * El resumen de la retención del video en el período (Tijuana, como el resto): una fila por (video, persona,
 * host), de `retencion_vsl_resumen` (mig 0261). `visitantes` acota a esas personas (los leads de `vsl_leads`).
 * Si la función todavía no está en la base, se resume en TS sobre los eventos —la MISMA cuenta
 * (`resumirEventos`), con su test de paridad—, más lenta pero con el mismo resultado.
 */
async function leerResumenVsl(rg: Rango, visitantes?: readonly string[]): Promise<ResumenVsl[]> {
  const ws = await getWorkspaceActual();
  if (ws == null) return [];
  const clave = `${ws}|${rg.desde}|${rg.hasta}|${visitantes ? [...visitantes].sort().join(',') : '*'}`;
  const ahora = Date.now();
  for (const [k, v] of memoResumen) if (ahora - v.t > MEMO_RESUMEN_MS) memoResumen.delete(k);
  const previo = memoResumen.get(clave);
  if (previo) return previo.p;
  const p = (async (): Promise<ResumenVsl[]> => {
    const db = await getTenantDb();
    const { data, error } = await db.rpc('retencion_vsl_resumen', {
      p_ws: ws, p_desde: rg.desde, p_hasta: rg.hasta, p_tz: TZ_TIJUANA, p_visitantes: visitantes ? [...visitantes] : null,
    });
    if (!error) return Array.isArray(data) ? (data as ResumenVsl[]) : [];
    if (!funcionNoExiste(error)) throw new Error(`No pude leer el resumen del video: ${error.message}`);
    console.warn('[graficos] retencion_vsl_resumen no está en la base (mig 0261): se resume sobre los eventos');
    const crudos = await leer<FEventoVideo>('vsl_events', 'id, created_at, visitor_id, tipo_evento, porcentaje, segundos, video_id, vsl_titulo, landing_url, prueba', rg, { col: 'created_at', ts: true });
    const quienes = visitantes ? new Set(visitantes) : null;
    return resumirEventos(crudos.filter((x) => {
      const f = fechaTj(x.created_at);
      return !!f && enRango(f, rg) && (!quienes || quienes.has((x.visitor_id ?? '').trim()));
    }));
  })();
  memoResumen.set(clave, { t: ahora, p });
  // Un error no se recuerda: el próximo pedido vuelve a intentar.
  p.catch(() => memoResumen.delete(clave));
  return p;
}

export type VideoDelPeriodo = {
  /** El `video_id`, o '' para los eventos que no dicen de qué video son. */
  id: string;
  nombre: string;
  duracion: number | null;
  /** Cada persona que le dio play: su mejor avance (null = no se pudo medir) y dónde abandonó (de sus `exit`). */
  personas: Map<string, { avance: number | null; salida: number | null }>;
  /** La primera vez que cada persona aparece en ese video: su fecha y su página. */
  primera: Map<string, { f: string; pagina: string | null }>;
};
/**
 * Los videos del período —dos videos no se promedian: son dos curvas— con la duración de cada uno y lo que
 * vio cada persona, desde el RESUMEN (`leerResumenVsl`). Los eventos sin `video_id` forman su propio grupo
 * en vez de entrar en la curva de cualquier video (la deuda de lib/vsl-retencion.ts:150). Sin la vista
 * previa del constructor (por el host: `esPreviewDeEditor`) ni las pruebas (en la base). Lo usan el conjunto
 * `retencion_vsl` y `vsl_leads`: la misma lectura (también la usaba el bloque `curva_vsl`, que se fue con v5).
 */
export async function videosDelPeriodo(rg: Rango, visitantes?: readonly string[]): Promise<VideoDelPeriodo[]> {
  const [filas, durs] = await Promise.all([leerResumenVsl(rg, visitantes), getDuracionesVsl()]);
  const porVideo = new Map<string, ResumenVsl[]>();
  for (const r of filas) {
    if (r.host && esPreviewDeEditor(`https://${r.host}`)) continue;
    const k = (r.video_id ?? '').trim();
    (porVideo.get(k) ?? porVideo.set(k, []).get(k)!).push(r);
  }
  const duracion = duracionPara(new Set([...porVideo.keys()].filter(Boolean)), durs);
  return [...porVideo.entries()].map(([id, rs]) => {
    const titulos = new Map<string, number>();
    const primera = new Map<string, { f: string; pagina: string | null; t: string }>();
    for (const r of rs) {
      for (const [t, n] of Object.entries(r.titulos ?? {})) titulos.set(t, (titulos.get(t) ?? 0) + (Number(n) || 0));
      const quien = (r.visitor_id ?? '').trim();
      const f = fechaTj(r.primera);
      if (!quien || !f || !r.primera) continue;
      const p = primera.get(quien);
      if (!p || r.primera < p.t) primera.set(quien, { f, t: r.primera, pagina: ruta(r.url) ?? p?.pagina ?? null });
      else if (!p.pagina) p.pagina = ruta(r.url);
    }
    const titulo = [...titulos.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
    const dur = duracion(id || null);
    return {
      id, nombre: titulo ?? (id || 'Sin identificar'), duracion: dur, personas: avancesDeResumen(rs, dur),
      primera: new Map([...primera.entries()].map(([k, v]) => [k, { f: v.f, pagina: v.pagina }] as const)),
    };
  });
}

/**
 * Una fila por persona y video: hasta dónde lo vio (el mejor avance del resumen, el motor de la curva).
 * «Medidos» = con avance positivo: es el denominador de toda tasa (quien dio play y no dejó un solo
 * evento de avance puede ser un agujero de medición).
 *
 * Con la dimensión `corte` (la curva, lo que era el bloque `curva_vsl`) es una fila por persona MEDIDA y
 * corte: `pasaron_corte` = llegó a ese corte, `medidos_corte` = 1. `siguen` = llegaron ÷ medidos es la curva
 * de `curvaRetencion` (sin redondear). Quien no se pudo medir no entra en la curva, como allá.
 */
async function filasRetencionVsl(rg: Rango, g?: Pick<Grafico, 'dimension' | 'desglose'>): Promise<Fila[]> {
  const porCorte = g?.dimension === 'corte';
  const out: Fila[] = [];
  for (const vid of await videosDelPeriodo(rg)) {
    for (const [persona, x] of vid.personas) {
      const p = vid.primera.get(persona);
      const a = x.avance ?? 0;
      if (porCorte) {
        if (!(a > 0)) continue;
        for (const corte of CORTES_VSL) {
          out.push({ f: p?.f ?? null, d: { video: vid.nombre, pagina: p?.pagina ?? null, corte }, v: { pasaron_corte: a >= Number(corte) ? 1 : 0, medidos_corte: 1 } });
        }
        continue;
      }
      out.push({
        f: p?.f ?? null, d: { video: vid.nombre, pagina: p?.pagina ?? null },
        // La vara del final es 90%, la de lib/landing-analyst.ts: los últimos segundos suelen ser créditos.
        v: { arrancaron: 1, medidos: a > 0 ? 1 : 0, pasaron_25: a >= 25 ? 1 : 0, pasaron_50: a >= 50 ? 1 : 0, pasaron_75: a >= 75 ? 1 : 0, llegaron_final: a >= 90 ? 1 : 0 },
      });
    }
  }
  return out;
}

const TONO_LANDING: Record<string, string> = { good: 'Bien', warn: 'Regular', bad: 'Mal' };
const ESTADO_LANDING: Record<string, string> = { analizada: 'Analizada', error: 'Con error', pendiente: 'Analizando' };
type FLandingAnalisis = { id: number; url: string; status: string | null; score: number | string | null; veredicto: string | null; veredicto_tone: string | null; hallazgos: unknown; analyzed_at: string | null };
/** El diagnóstico guardado de cada página. `score` es NUMERIC (llega como texto) y null es «sin puntaje», nunca 0. */
async function filasLandingAnalisis(fecha: string, rg: Rango): Promise<Fila[]> {
  const r2 = { ...rg, sinRango: fecha === 'actual' };
  const rows = await leer<FLandingAnalisis>('landing_analyses', 'id, url, status, score, veredicto, veredicto_tone, hallazgos, analyzed_at', r2, { col: 'analyzed_at', ts: true });
  return rows.map((x) => {
    const s = x.score == null || x.score === '' ? null : Number(x.score);
    const conPuntaje = s != null && Number.isFinite(s);
    const hallazgos = Array.isArray(x.hallazgos) ? (x.hallazgos as Array<{ severidad?: unknown }>) : [];
    return {
      f: fechaTj(x.analyzed_at),
      d: { pagina: ruta(x.url), veredicto: txt(x.veredicto)?.slice(0, 80) ?? null, tono: TONO_LANDING[x.veredicto_tone ?? ''] ?? null, estado: ESTADO_LANDING[x.status ?? ''] ?? lindo(txt(x.status)) },
      v: { paginas: 1, puntos: conPuntaje ? s! : 0, con_puntaje: conPuntaje ? 1 : 0, hallazgos: hallazgos.length, hallazgos_altos: hallazgos.filter((h) => h?.severidad === 'alta').length },
    };
  }).filter((x) => enRango(x.f, r2));
}

// ── Closing Analyst ─────────────────────────────────────────────────────────────────────

const TONO_LLAMADA: Record<string, string> = { good: 'Ganada', warn: 'En proceso', bad: 'Perdida' };
/** El puntaje de una llamada, como los KPI de la tab: sólo con transcript real y un número (no se promedian ceros falsos). */
const puntajeDe = (x: { score: number | string | null; has_transcript: boolean | null }): number | null => {
  if (x.has_transcript === false || x.score == null || x.score === '') return null;
  const n = Number(x.score);
  return Number.isFinite(n) ? n : null;
};

type FLlamadaVenta = {
  recording_id: number; call_date: string | null; duration_min: number | null; closer: string | null; tipo: string | null; score: number | string | null;
  outcome_tone: string | null; has_transcript: boolean | null; title: string | null; lead_id: number | null; lead_nombre: string | null; invitee_email: string | null;
};
/**
 * Sin Fathom la tab no muestra nada (pide la key): la tarjeta lo dice en vez de dibujar ceros mudos
 * que se leen como «no hubo llamadas».
 */
export const exigirFathom = async () => { if (!(await integracionConectada('fathom'))) throw new SinConexionError('Conecta Fathom en Integraciones'); };

/**
 * Las llamadas de venta analizadas, el universo de la tab (getClosingViewData). Cada fila es UNA llamada con
 * su id (`r.llamada`) y el de su lead (`r.lead`): el detalle de un número lista llamadas y cada una abre su
 * ficha. `llamada` la nombra como la nombraba la tab (`nombreDeLlamada`): trae nombres y emails de personas
 * (DIMENSIONES_PERSONA, lib/graficos-acciones.ts), y no viaja a ningún modelo.
 */
async function filasLlamadasVenta(rg: Rango): Promise<Fila[]> {
  await exigirFathom();
  const rows = await leer<FLlamadaVenta>('closing_analyses', 'recording_id, call_date, duration_min, closer, tipo, score, outcome_tone, has_transcript, title, lead_id, lead_nombre, invitee_email', rg, {
    col: 'call_date', orden: 'recording_id', extra: (q) => q.eq('category', 'venta').eq('status', 'analizada'),
  });
  return rows.map((x) => {
    const p = puntajeDe(x);
    const r2 = x.tipo === 'R2';
    const gano = x.outcome_tone === 'good';
    return {
      f: x.call_date,
      d: { closer: txt(x.closer), reunion: txt(x.tipo), tono: TONO_LLAMADA[x.outcome_tone ?? ''] ?? null, llamada: nombreDeLlamada(x) },
      r: { llamada: String(x.recording_id), lead: x.lead_id != null ? String(x.lead_id) : null },
      v: {
        llamadas: 1, minutos: num(x.duration_min), puntos: p ?? 0, con_puntaje: p != null ? 1 : 0,
        ganadas: gano ? 1 : 0, perdidas: x.outcome_tone === 'bad' ? 1 : 0, r1: x.tipo === 'R1' ? 1 : 0, r2: r2 ? 1 : 0, ganadas_r2: r2 && gano ? 1 : 0,
      },
    };
  });
}

const GRUPO_DIM: Record<string, string> = { spin: 'Método SPIN', exec: 'Ejecución de venta' };
type FLlamadaDims = { recording_id: number; call_date: string | null; closer: string | null; tipo: string | null; outcome_tone: string | null; dims: unknown; title: string | null; lead_nombre: string | null; invitee_email: string | null };
/**
 * Una fila por llamada y dimensión del análisis, con su puntaje de 0 a 10. Desde el v5 cada fila trae SU
 * llamada (`llamada`, nombrada como en la lista de la hoja, y el recording_id en `r.llamada`): el clic en una
 * barra de «Qué decide los cierres» lista las llamadas de esa dimensión y cada una abre su ficha (lo que
 * eran los ejemplos del bloque `factores_cierre`). Trae nombres de personas: no viaja a ningún modelo.
 */
async function filasLlamadasDimensiones(rg: Rango): Promise<Fila[]> {
  await exigirFathom();
  const rows = await leer<FLlamadaDims>('closing_analyses', 'recording_id, call_date, closer, tipo, outcome_tone, dims, title, lead_nombre, invitee_email', rg, {
    col: 'call_date', orden: 'recording_id', extra: (q) => q.eq('category', 'venta').eq('status', 'analizada'),
  });
  const out: Fila[] = [];
  for (const x of rows) {
    const llamada = nombreDeLlamada(x);
    for (const d of Array.isArray(x.dims) ? (x.dims as Array<{ g?: unknown; label?: unknown; score?: unknown }>) : []) {
      const s = typeof d?.score === 'number' ? d.score : Number(d?.score);
      if (!d || typeof d.label !== 'string' || !Number.isFinite(s)) continue;
      out.push({
        f: x.call_date,
        d: { dimension: d.label, grupo: GRUPO_DIM[String(d.g ?? '')] ?? null, tono: TONO_LLAMADA[x.outcome_tone ?? ''] ?? null, closer: txt(x.closer), reunion: txt(x.tipo), llamada },
        v: { puntos: s, con_puntaje: 1 },
        r: { llamada: String(x.recording_id) },
      });
    }
  }
  return out;
}

// ── Productivity Analyst ────────────────────────────────────────────────────────────────

/**
 * Una fila por proyecto, contado como la tab (sin las tareas recurrentes y en todos sus proyectos).
 * ⚠️ Un proyecto SIN EVALUAR no trae impacto ni esfuerzo (v5): hasta el 12/10/2026 iban en 0 y la matriz los
 * dibujaba en la esquina (0, 0) como si fueran «De relleno». Sin el atributo, el agregador devuelve null y
 * la dispersión los saltea.
 */
async function filasProyectos(): Promise<Fila[]> {
  const { tasks, labels } = await leerTablero();
  const mm = metricasProductividad(tasks, labels, Date.now());
  return mm.projMeta.map((p) => {
    const evaluado = p.l.impacto != null && p.l.esfuerzo != null;
    return {
      f: null,
      d: {
        proyecto: txt(p.l.name), estado: p.completo ? 'Completo' : 'Activo', con_deadline: p.l.deadline ? 'Sí' : 'No',
        cuadrante: evaluado ? CUADRANTE_ROTULO[cuadranteDe(p.l.impacto!, p.l.esfuerzo!)] : 'Sin evaluar',
      },
      v: {
        proyectos: 1, completos: p.completo ? 1 : 0, tareas: p.total, hechas: p.done, pct_suma: p.pct,
        ...(p.l.impacto != null ? { impacto: p.l.impacto } : {}),
        ...(p.l.esfuerzo != null ? { esfuerzo: p.l.esfuerzo } : {}),
      },
    };
  });
}

/**
 * El tablero que le toca a quien mira (el del dueño o el del cliente), con las MISMAS lecturas que
 * Productivity Analyst (app/productivity-analyst/page.tsx hasta el 11/10/2026). (La usaban también los
 * bloques de la plantilla «Productividad», que se fueron con v5.)
 */
export async function leerTablero(): Promise<{ tasks: BoardTask[]; labels: Label[] }> {
  if ((await queTableroLeer()) === 'dueno') {
    const b = await listPlanBoard();
    return { tasks: b.tareas, labels: b.proyectos };
  }
  const [t, c] = await Promise.all([listTareas(), listCategorias()]);
  return { tasks: t.map(toBoard), labels: c.map(toLabel) };
}

/**
 * Una fila por tarea que empieza y termina, con lo que la tab deduce de su historial. Lo del v5 (el bloque
 * «Lo que huele mal» y la pirámide hechos gráficos): la tarea misma (`tarea`, con su id en `r.tarea`: abre la
 * tarea), si está estancada y si su deadline se corrió —con los MISMOS umbrales que `metricasProductividad`:
 * 7 días sin actividad, 2 o más movidas—, los días sin tocarla (sólo de las activas) y las activas en Alta.
 */
async function filasEjecucion(): Promise<Fila[]> {
  const { tasks, labels } = await leerTablero();
  const ahora = Date.now();
  const mm = metricasProductividad(tasks, labels, ahora);
  const ciclo = new Map(mm.ciclos.map((c) => [c.t.id, c.dias] as const));
  const cierre = new Map(mm.conDeadline.map((c) => [c.t.id, c] as const));
  const estancada = new Set(mm.estancadas.map((x) => x.t.id));
  const corrido = new Set(mm.corridos.map((x) => x.t.id));
  return sinRecurrentes(tasks).map((t) => {
    const activa = t.progress < 100;
    const prio = prioFromScore(t.score);
    const c = cierre.get(t.id);
    const dc = ciclo.get(t.id);
    // La cuenta de `estancadas` (lib/productividad-metricas.ts): desde la última entrada del historial.
    const quieta = activa ? Math.round((ahora - ultActividad(t.historial)) / DAY) : null;
    return {
      f: null,
      d: {
        prioridad: PLABEL[prio], estado: activa ? 'Activa' : 'Hecha', con_deadline: t.deadline ? 'Sí' : 'No',
        // Puede nombrar personas: fuera de DIMENSIONES_PUBLICAS.
        tarea: txt(t.title)?.slice(0, 120) ?? null,
        estancada: estancada.has(t.id) ? 'Sí' : 'No', deadline_corrido: corrido.has(t.id) ? 'Sí' : 'No',
      },
      r: { tarea: String(t.id) },
      v: {
        tareas: 1, activas: activa ? 1 : 0, hechas: activa ? 0 : 1, en_curso: activa && t.progress > 0 ? 1 : 0,
        sin_deadline: activa && !t.deadline ? 1 : 0, alta_sin_deadline: activa && prio === 'alta' && !t.deadline ? 1 : 0,
        estancadas: estancada.has(t.id) ? 1 : 0, progreso: Math.min(100, num(t.progress)),
        cerradas_con_deadline: c ? 1 : 0, a_tiempo: c?.aTiempo ? 1 : 0, tarde: c && !c.aTiempo ? 1 : 0, dias_tarde: c && !c.aTiempo ? c.dias : 0,
        dias_ciclo: dc ?? 0, con_ciclo: dc != null ? 1 : 0,
        ...(quieta != null && Number.isFinite(quieta) ? { dias_quieta: quieta } : {}),
        movidas_deadline: deadlineMoves(t.historial),
        activas_alta: activa && prio === 'alta' ? 1 : 0,
      },
    };
  });
}

// ── CRM y ventas: lo que eran los bloques de Comercial (v5) ─────────────────────────────

type FLeadVenta = { id: number; fecha_cierre: string | null; cerro: boolean | null; estado_lead: string | null; venta_tipo: string | null; monto_cierre_usd: number | null };
type FCuota = { id: number; lead_id: number | null; monto_usd: number | null; fecha_pago: string | null; fecha_esperada: string | null; proveedor?: string | null; cobro_id?: number | null; baja_at?: string | null };
/**
 * Lo vendido, lo cobrado y lo pendiente, cada uno por SU fecha, en una lectura: el viejo bloque Revenue. Lo
 * vendido son los cierres que son venta (`gano`, la definición del Dashboard) por fecha de cierre; lo cobrado,
 * las cuotas pagadas por fecha de pago; lo pendiente, las cuotas SIN pagar por su vencimiento — con «Todo»,
 * también las que no tienen fecha (sin fecha no se pueden ubicar en un día, pero son deuda: entran al total).
 * Cada fila lleva el id de lo que es (`r.lead` o `r.cuota` + `r.cliente`) para que el detalle abra lo suyo.
 */
async function filasRevenue(rg: Rango): Promise<Fila[]> {
  const todo = rg.desde <= DESDE_TODO;
  const [cierres, cobros, pendientes, sinFecha] = await Promise.all([
    leer<FLeadVenta>('leads', 'id, fecha_cierre, cerro, estado_lead, venta_tipo, monto_cierre_usd', rg, { col: 'fecha_cierre' }),
    leer<FCuota>('pagos', 'id, lead_id, monto_usd, fecha_pago, fecha_esperada', rg, { col: 'fecha_pago', extra: (q) => q.eq('pagado', true) }),
    leer<FCuota>('pagos', 'id, lead_id, monto_usd, fecha_pago, fecha_esperada', rg, { col: 'fecha_esperada', extra: (q) => q.eq('pagado', false) }),
    // `*`: la regla mira proveedor, cobro_id y `baja_at` (mig 0307); con `*` una base sin la migración no rompe el Revenue.
    todo ? leer<FCuota>('pagos', '*', { ...rg, sinRango: true }, { extra: (q) => q.eq('pagado', false).is('fecha_esperada', null) }) : Promise.resolve([] as FCuota[]),
  ]);
  // Las sin fecha son deuda… salvo las DEVUELTAS por un reembolso, que también quedan impagas y sin vencimiento (15/10/2026).
  // Y las de un cliente que se DIO DE BAJA (#871, 17/10/2026): la baja las deja igual, impagas y sin vencimiento.
  const sinFechaDeuda = sinFecha.filter((x) => !noEsDeuda({ pagado: false, fecha_esperada: x.fecha_esperada, proveedor: x.proveedor ?? null, cobro_id: x.cobro_id ?? null, baja_at: x.baja_at ?? null }));
  const out: Fila[] = [];
  for (const x of cierres) {
    if (!gano(x)) continue;
    out.push({ f: x.fecha_cierre, d: {}, v: { cierres: 1, vendido: num(x.monto_cierre_usd) }, r: { lead: String(x.id) } });
  }
  const cuota = (x: FCuota) => ({ cuota: String(x.id), cliente: x.lead_id != null ? String(x.lead_id) : null });
  for (const x of cobros) out.push({ f: x.fecha_pago, d: {}, v: { cobrado: num(x.monto_usd), cuotas_cobradas: 1 }, r: cuota(x) });
  for (const x of [...pendientes, ...sinFechaDeuda]) out.push({ f: x.fecha_esperada, d: {}, v: { pendiente: num(x.monto_usd), cuotas_pendientes: 1 }, r: cuota(x) });
  return out;
}

/**
 * Una fila por CLIENTE con algo pendiente: lo que leía «A quién cobrarle», con las MISMAS funciones que «A
 * quién cobrar» de la API de MaKo (`getOutstandingDetalle` + `armarCobranza`): la pantalla y WhatsApp no
 * pueden contar distinto. La ventana es la del período, sobre el VENCIMIENTO (`futuro`): con «Próximos 30
 * días» trae lo que vence; con «Todo», el pipeline entero (cuotas futuras y sin fecha incluidas). El hoy de
 * los días y la urgencia es el del NEGOCIO.
 *
 * ⚠️ Los dos ids salen de la MISMA fila (`r.cliente` y `r.cuota` = la próxima cuota de ESE cliente):
 * «Marcar cobrada» no comprueba que la cuota sea de ese lead (lib/graficos-acciones.ts).
 * ⚠️ `getOutstandingDetalle` (lib/pagos.ts) lee la tabla `pagos` sin paginar (hallazgo abierto): con más de
 * 1000 cuotas en un negocio, faltarían clientes. Es de otra área; la API tiene el mismo techo.
 */
async function filasCobranza(rg: Rango): Promise<Fila[]> {
  const hoy = await hoyEnWorkspace().catch(() => hoyEnTijuana());
  const todo = rg.desde <= DESDE_TODO;
  const o = await getOutstandingDetalle(hoy, todo ? null : rg.desde, todo ? null : rg.hasta);
  return armarCobranza(o.items, hoy).filas.map((c) => ({
    f: c.cuota?.vence ?? null,
    // El cliente es una PERSONA (fuera de DIMENSIONES_PUBLICAS).
    d: { cliente: c.nombre, urgencia: rotuloUrgencia(c.urgencia, c.cuota?.vence), proxima: c.cuota ? nombreCuota(c.cuota.numero) : null },
    v: {
      vendido: num(c.vendido), cobrado_total: c.cobrado, pendiente: c.pendiente, proxima_monto: c.cuota?.monto ?? 0,
      ...(c.dias != null ? { dias: c.dias } : {}),
    },
    u: { clientes: String(c.leadId) },
    r: { cliente: String(c.leadId), cuota: c.cuota ? String(c.cuota.pagoId) : null },
  }));
}

/** El MRR, con `getMrrActivo` (lib/queries.ts), la función de «ver MRR» de la API de MaKo, al hoy del negocio. */
async function filasSuscripciones(): Promise<Fila[]> {
  const hoy = await hoyEnWorkspace().catch(() => hoyEnTijuana());
  const r = await getMrrActivo(hoy);
  return [{ f: null, d: {}, v: { mrr: num(r.mrr), activas: num(r.activas) } }];
}

// ── Marketing: el VSL por lead y la ubicación de las visitas (v5) ────────────────────────

type FLeadVisitante = { id: number; created_at: string | null; visitor_id: string | null; fecha_junta_1: string | null; cerro: boolean | null; estado_lead: string | null; venta_tipo: string | null };
/**
 * Cada lead con `visitor_id` (pasó por la página con el Pixel) y cuánto vio del video: su MEJOR avance en
 * cualquier video y en TODA su historia (no sólo el período: el período decide qué leads entran, por su
 * alta), del mismo resumen que la curva (`videosDelPeriodo` acotado a sus visitantes). «No lo vio» = ningún
 * evento del video; «Sin medir» = arrancó y no dejó un avance medible (`tramoVisto`).
 */
async function filasVslLeads(fecha: string, rg: Rango): Promise<Fila[]> {
  const r2 = { ...rg, sinRango: fecha === 'actual' };
  const leads = (await leer<FLeadVisitante>('leads', 'id, created_at, visitor_id, fecha_junta_1, cerro, estado_lead, venta_tipo', r2, {
    col: 'created_at', ts: true, extra: (q) => q.not('visitor_id', 'is', null),
  })).filter((x) => txt(x.visitor_id) && enRango(fechaTj(x.created_at), r2));
  if (!leads.length) return [];
  const visitantes = [...new Set(leads.map((x) => txt(x.visitor_id)!))];
  const hoy = hoyEnTijuana();
  const videos = await videosDelPeriodo({ desde: DESDE_TODO, hasta: hoy, sinRango: false }, visitantes);
  // Su mejor avance en cualquier video; la clave presente = le dio play a alguno.
  const mejor = new Map<string, number | null>();
  for (const v of videos) for (const [quien, x] of v.personas) {
    const a = mejor.get(quien);
    mejor.set(quien, a == null ? x.avance : x.avance == null ? a : Math.max(a, x.avance));
  }
  return leads.map((x) => {
    const quien = txt(x.visitor_id)!;
    return {
      f: fechaTj(x.created_at),
      d: { tramo_visto: tramoVisto(mejor.has(quien), mejor.get(quien)) },
      v: { leads: 1, agendas: x.fecha_junta_1 ? 1 : 0, cierres: gano(x) ? 1 : 0 },
      r: { lead: String(x.id) },
    };
  });
}

type FVisitaGeo = { id: number; created_at: string; visitor_id: string | null; landing_url: string | null; prueba: string | null; pais: string | null; region: string | null; ciudad: string | null; lat: number | null; lon: number | null };
/**
 * Cada visita con DÓNDE estaba quien la hizo (mig 0262: lo guarda el beacon del Pixel desde los headers de
 * Vercel, NUNCA la IP). La región sale como ISO 3166-2 completo («MX-BCN»: la del país más la de Vercel) y
 * la fila lleva sus coordenadas redondeadas (`geo`): el mapa dibuja las ciudades como burbujas en el
 * promedio de sus visitas. Las visitas de antes de la migración no tienen ubicación: salen «(sin dato)».
 * Sin las pruebas ni la vista previa del constructor.
 */
async function filasUbicacion(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FVisitaGeo>('landing_visits', 'id, created_at, visitor_id, landing_url, prueba, pais, region, ciudad, lat, lon', rg, { col: 'created_at', ts: true });
  return rows.filter((x) => !noEsDelNegocio(x)).map((x) => {
    const pais = txt(x.pais);
    const lat = x.lat == null ? null : Number(x.lat);
    const lon = x.lon == null ? null : Number(x.lon);
    return {
      f: fechaTj(x.created_at),
      d: { pais, region: regionIso(pais, txt(x.region)), ciudad: txt(x.ciudad), pagina: ruta(x.landing_url) },
      v: { visitas: 1 }, u: { visitantes: txt(x.visitor_id) },
      geo: lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null,
    };
  }).filter((x) => enRango(x.f, rg));
}

// ── Customer Success: la cartera (v5) ────────────────────────────────────────────────────

/**
 * Una fila por cliente ganado, con `cartera()` (lib/cs-cartera.ts) — la que lee la API de Customer Success:
 * su señal y el motivo (la REGLA en palabras: la frase trae números), su estado, cuántas cuotas vencidas,
 * sus sesiones y hace cuánto no hablan. La deuda vencida en dólares se suma con la MISMA vara que las cuotas
 * vencidas de la cartera (`fecha_esperada <= hoy`, en UTC como allá), para que los dos números no se
 * contradigan. El producto es el del embudo del lead (el de `leads.producto`).
 */
async function filasCartera(): Promise<Fila[]> {
  const [clientes, rot] = await Promise.all([cartera(), rotulosDelCrm()]);
  if (!clientes.length) return [];
  const ids = clientes.map((c) => c.leadId);
  const hoyUtc = new Date().toISOString().slice(0, 10);
  const [embudos, impagas] = await Promise.all([
    leerPorIds<{ id: number; funnel_id: number | null }>('leads', 'id, funnel_id', 'id', ids),
    leerPorIds<{ id: number; lead_id: number; monto_usd: number | null; fecha_esperada: string | null }>('pagos', 'id, lead_id, monto_usd, fecha_esperada', 'lead_id', ids, { extra: (q) => q.eq('pagado', false) }),
  ]);
  const embudo = new Map(embudos.map((x) => [Number(x.id), x.funnel_id] as const));
  const deuda = new Map<number, number>();
  for (const p of impagas) if (p.fecha_esperada && p.fecha_esperada.slice(0, 10) <= hoyUtc) deuda.set(Number(p.lead_id), (deuda.get(Number(p.lead_id)) ?? 0) + num(p.monto_usd));
  return clientes.map((c) => ({
    f: null,
    // El cliente es una PERSONA (fuera de DIMENSIONES_PUBLICAS).
    d: {
      cliente: c.nombre, producto: rot.producto(embudo.get(c.leadId) ?? null), estado: lindo(c.estado),
      senal: rotuloSenal(c.senal.nivel), motivo: MOTIVO_DE_REGLA[c.senal.regla] ?? null,
      tramo_contacto: tramoDeContacto(c.ultimoContactoHace, c.contactoLeido),
    },
    v: {
      clientes: 1, atencion: c.senal.nivel === 'atencion' ? 1 : 0, cuotas_vencidas: num(c.cuotasVencidas),
      deuda_vencida_usd: deuda.get(c.leadId) ?? 0, sesiones: num(c.sesiones),
    },
    r: { cliente: String(c.leadId) },
  }));
}

// ── Comunicación: las conversaciones de WhatsApp (v5) ────────────────────────────────────

type FWaChat = { id: number; created_at: string; wa_timestamp: string | null; from_me: boolean | null; instance_name: string | null; chat_jid: string | null; lead_id: number | null };
/** Cuántos días antes y después del período se leen para saber si un turno abre racha y si se respondió. */
const MARGEN_TURNOS = 7;
/** Con la fecha «Hoy», qué ventana de mensajes cuenta como conversación viva. */
const VENTANA_HOY = 30;
/**
 * Las conversaciones 1-a-1 (`esChatIndividual`, en positivo) como TURNOS (`turnosDeChats`): una fila por cada
 * vez que alguien escribió, con si le respondieron y en cuántos minutos. Se leen `MARGEN_TURNOS` días de más
 * a cada lado: antes, para saber si el primer mensaje del período abre una racha; después, para encontrar la
 * respuesta. Con la fecha «Hoy», una fila por chat CON LEAD de los últimos `VENTANA_HOY` días: si espera
 * respuesta hace más de 24 h (`chatsEsperando`). NUNCA se lee el texto de un mensaje.
 *
 * El setter y la etapa son los del lead del chat (`leads.setter` es un texto libre: no se ata a un usuario).
 */
async function filasConversaciones(fecha: string, rg: Rango): Promise<Fila[]> {
  const hoy = hoyEnTijuana();
  const actual = fecha === 'actual';
  const lectura: Rango = actual
    ? { desde: diasAntes(hoy, VENTANA_HOY), hasta: hoy, sinRango: false }
    : { desde: diasAntes(rg.desde, MARGEN_TURNOS), hasta: diasAntes(rg.hasta, -MARGEN_TURNOS), sinRango: false };
  const rows = await leer<FWaChat>('wa_mensajes', 'id, created_at, wa_timestamp, from_me, instance_name, chat_jid, lead_id', lectura, { col: 'created_at', ts: true });
  const mensajes: MensajeChat[] = rows.filter((x) => esChatIndividual(x.chat_jid)).map((x) => ({
    linea: txt(x.instance_name), chat: x.chat_jid!.trim(), deMi: !!x.from_me, t: Date.parse(x.wa_timestamp ?? x.created_at), leadId: x.lead_id != null ? Number(x.lead_id) : null,
  }));
  const leadIds = [...new Set(mensajes.map((m) => m.leadId).filter((x): x is number => x != null))];
  const [info, rot] = await Promise.all([
    leerPorIds<{ id: number; setter: string | null; pipeline_stage: string | null; funnel_id: number | null }>('leads', 'id, setter, pipeline_stage, funnel_id', 'id', leadIds),
    rotulosDelCrm(),
  ]);
  const lead = new Map(info.map((x) => [Number(x.id), x] as const));
  const dimsDe = (linea: string | null, leadId: number | null) => {
    const l = leadId != null ? lead.get(leadId) : undefined;
    return {
      linea, setter: leadId == null ? 'Sin lead' : txt(l?.setter),
      etapa: l ? rot.etapa(l.funnel_id, txt(l.pipeline_stage)) : null, con_lead: leadId != null ? 'Sí' : 'No',
    };
  };
  if (actual) {
    return chatsEsperando(mensajes, Date.now()).map((c) => ({
      f: null, d: dimsDe(c.linea, c.leadId), v: { sin_responder: c.espera ? 1 : 0 }, u: { chats: `${c.linea ?? ''}|${c.chat}` },
    }));
  }
  const out: Fila[] = [];
  for (const t of turnosDeChats(mensajes)) {
    const f = fechaTj(new Date(t.t).toISOString());
    if (!enRango(f, rg)) continue;
    const min = t.minutos;
    out.push({
      f, d: dimsDe(t.linea, t.leadId),
      v: {
        turnos: 1, respondidos: min != null ? 1 : 0, rapidos_15: min != null && min <= 15 ? 1 : 0, rapidos_60: min != null && min <= 60 ? 1 : 0,
        ...(min != null ? { minutos_respuesta: min } : {}),
      },
      u: { chats: `${t.linea ?? ''}|${t.chat}` },
    });
  }
  return out;
}

// ── El reparto ───────────────────────────────────────────────────────────────────────────

/** Un lector por conjunto de lib/graficos-fuentes-extra.ts. El test exige que estén todos. */
export const LECTORES_EXTRA: Record<string, Lector> = {
  guiones: (_, rg) => filasGuiones(rg),
  clics: (_, rg) => filasClics(rg),
  scroll: (_, rg) => filasScroll(rg),
  toques: (_, rg) => filasToques(rg),
  retencion_vsl: (_, rg, g) => filasRetencionVsl(rg, g),
  landing_analisis: (f, rg) => filasLandingAnalisis(f, rg),
  llamadas_venta: (_, rg) => filasLlamadasVenta(rg),
  llamadas_dimensiones: (_, rg) => filasLlamadasDimensiones(rg),
  proyectos: () => filasProyectos(),
  ejecucion: () => filasEjecucion(),
  revenue: (_, rg) => filasRevenue(rg),
  cobranza: (_, rg) => filasCobranza(rg),
  suscripciones: () => filasSuscripciones(),
  vsl_leads: (f, rg) => filasVslLeads(f, rg),
  ubicacion: (_, rg) => filasUbicacion(rg),
  cartera: () => filasCartera(),
  conversaciones: (f, rg) => filasConversaciones(f, rg),
};
