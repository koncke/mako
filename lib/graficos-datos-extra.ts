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
//   · llamadas  → el mismo universo que getClosingViewData: de venta y analizadas.
//   · proyectos y ejecución → `metricasProductividad` (lib/productividad-metricas.ts), lo de la tab.
//
// ⚠️ DESCARTES DE LOS EVENTOS DEL PIXEL: las pruebas (`prueba` no nulo: es quien probaba el Pixel) y la
// vista previa del constructor (`esPreviewDeEditor`) no son visitas del negocio. Los conjuntos viejos
// (`visitas`, `vsl`, `replays`) todavía no los sacan: los números no van a coincidir con ellos.
//
// ⚠️ LA PÁGINA ES `ruta()` (host/ruta, sin esquema ni query), la misma de los conjuntos de siempre: así el
// campo «Página» puede cruzarlos el día que estos conjuntos entren en COMPARTIDOS (lib/graficos-catalogo.ts).

import 'server-only';
import { SinConexionError, type Fila } from './graficos-agregar';
import type { Grafico } from './graficos-catalogo';
import { enRango, fechaTj, leer, lindo, num, ruta, txt, type Rango } from './graficos-lectura';
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
import { avancePorPersona, esEventoDeVideo, type EventoVsl } from './vsl-retencion';
import { getDuracionesVsl } from './leads';
import { idDeclaraHost } from './video-id';
import { tableroActual } from './tablero-actual';
import { listPlanBoard } from './plan-board';
import { listCategorias, listTareas } from './todo';
import { toBoard, toLabel } from '@/app/plan/board/desde-todo';
import { PLABEL, prioFromScore, type BoardTask, type Label } from '@/app/plan/board/types';
import { sinRecurrentes } from './plan-recurrentes';
import { CUADRANTE_ROTULO, cuadranteDe, metricasProductividad } from './productividad-metricas';

export type Lector = (fecha: string, rg: Rango, g?: Pick<Grafico, 'dimension' | 'desglose'>) => Promise<Fila[]>;

const TANDA_IDS = 150;
const enTandas = <T>(xs: T[]): T[][] => { const out: T[][] = []; for (let i = 0; i < xs.length; i += TANDA_IDS) out.push(xs.slice(i, i + TANDA_IDS)); return out; };
const DISPOSITIVO: Record<string, string> = { movil: 'Celular', escritorio: 'Computadora' };
const dispositivo = (ancho: number | null) => { const d = dispositivoDe(ancho); return d ? DISPOSITIVO[d] : null; };
/** Un evento del Pixel que no es del negocio: una prueba o la vista previa del constructor. */
const noEsDelNegocio = (x: { prueba: string | null; landing_url: string | null }) => !!x.prueba || esPreviewDeEditor(x.landing_url ?? '');

// ── Ads Analyst ─────────────────────────────────────────────────────────────────────────

/** Sin Meta, Ads Analyst muestra su pantalla de activación: la tarjeta lo dice en vez de dibujar ceros. */
export const exigirMeta = async () => { if (!(await integracionConectada('meta'))) throw new SinConexionError('Conecta Meta en Integraciones'); };

type FGuion = { ad_id: string; ad_name: string | null; short: string | null; angle: string | null; angle_override: string | null; avatar: string | null; avatar_override: string | null; hook_type: string | null; format: string | null; es_imagen: boolean | null; beats: unknown };
type FMetricaAd = {
  id: number; fecha: string; ad_id: string | null; campaign_name: string | null; adset_name: string | null;
  spend: number | null; impressions: number | null; link_clicks: number | null; leads_count: number | null; agendas_meta: number | null;
  video_3s_views: number | null; video_thruplay: number | null; video_p25: number | null; video_p50: number | null; video_p75: number | null; video_p100: number | null;
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
 */
async function filasGuiones(rg: Rango): Promise<Fila[]> {
  await exigirMeta();
  const todas = await leer<FGuion & { status: string }>('script_analyses', 'ad_id, ad_name, short, angle, angle_override, avatar, avatar_override, hook_type, format, es_imagen, beats, status', { ...rg, sinRango: true }, {
    orden: 'ad_id', extra: (q) => q.eq('status', 'analizada'),
  });
  // Como getScriptAnalystView: los videos con su guion partido en bloques, y los de imagen.
  const analizados = todas.filter((x) => x.es_imagen || (Array.isArray(x.beats) && x.beats.length > 0));
  if (!analizados.length) return [];
  const ids = analizados.map((x) => x.ad_id);
  const [metricas, cierres, conv, cuadrante, angulos, avatares] = await Promise.all([
    Promise.all(enTandas(ids).map((t) => leer<FMetricaAd>('marketing_metrics_daily',
      'id, fecha, ad_id, campaign_name, adset_name, spend, impressions, link_clicks, leads_count, agendas_meta, video_3s_views, video_thruplay, video_p25, video_p50, video_p75, video_p100',
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

  // Lo del anuncio en la ventana: impresiones, plays y agendas (para la confianza y el resultado) y su
  // campaña y conjunto más recientes (las filas vienen por fecha ascendente).
  const ventana = new Map<string, { impresiones: number; v3s: number; agendas: number; campana: string | null; conjunto: string | null }>();
  for (const x of metricas) {
    if (!x.ad_id) continue;
    const a = ventana.get(x.ad_id) ?? { impresiones: 0, v3s: 0, agendas: 0, campana: null, conjunto: null };
    a.impresiones += num(x.impressions); a.v3s += num(x.video_3s_views); a.agendas += num(x.agendas_meta);
    a.campana = txt(x.campaign_name) ?? a.campana; a.conjunto = txt(x.adset_name) ?? a.conjunto;
    ventana.set(x.ad_id, a);
  }
  const porAd = new Map(analizados.map((x) => [x.ad_id, x] as const));
  const dimsDe = (adId: string) => {
    const s = porAd.get(adId)!;
    const w = ventana.get(adId);
    const angulo = txt(s.angle_override) ?? txt(s.angle) ?? 'capataz';
    const avatar = txt(s.avatar_override) ?? txt(s.avatar);
    // Imagen de verdad: marcada así Y sin reproducciones de video (las métricas mandan).
    const esImagen = !!s.es_imagen && (w?.v3s ?? 0) === 0;
    const q = quad.get(adId);
    const veredicto = esImagen ? VEREDICTO_ROTULO.imagen : q ? VEREDICTO_ROTULO[verdictFromVals(q.hookRate, q.hold, q.impressions)] : null;
    const conf = confFromImpr(w?.impresiones ?? 0);
    return {
      guion: txt(s.short) ?? (s.ad_name ?? s.ad_id).slice(0, 24),
      angulo: nombreAngulo.get(angulo) ?? lindo(angulo),
      gancho: lindo(txt(s.hook_type) ?? 'promesa'),
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
  const out: Fila[] = [];
  for (const x of metricas) {
    if (!x.ad_id || !porAd.has(x.ad_id)) continue;
    out.push({
      f: x.fecha,
      d: dimsDe(x.ad_id),
      v: {
        gasto: conv.aUsdNum(num(x.spend)), impresiones: num(x.impressions), plays_3s: num(x.video_3s_views), thruplays: num(x.video_thruplay),
        p25: num(x.video_p25), p50: num(x.video_p50), p75: num(x.video_p75), p100: num(x.video_p100),
        clics: num(x.link_clicks), leads: num(x.leads_count), agendas: num(x.agendas_meta), cierres: 0,
      },
      u: { guiones: x.ad_id },
    });
  }
  for (const c of cierres) {
    if (!c.meta_ad_id || !porAd.has(c.meta_ad_id)) continue;
    out.push({ f: c.fecha_cierre ? c.fecha_cierre.slice(0, 10) : null, d: dimsDe(c.meta_ad_id), v: { cierres: 1 } });
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

type FClic = { id: number; created_at: string; visitor_id: string | null; landing_url: string | null; detalle: string | null; ancho_ventana: number | null; prueba: string | null };
/** Cada clic en un botón o enlace (sin el sello del constructor). Una consulta propia: el índice de los clics es parcial. */
async function filasClics(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FClic>('vsl_events', 'id, created_at, visitor_id, landing_url, detalle, ancho_ventana, prueba', rg, {
    col: 'created_at', ts: true, extra: (q) => q.eq('tipo_evento', 'click'),
  });
  const out: Fila[] = [];
  for (const x of rows) {
    if (noEsDelNegocio(x) || esClicDelConstructor(x.detalle)) continue;
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

type FToque = { id: number; created_at: string; visitor_id: string | null; landing_url: string | null; tipo_evento: string; detalle: string | null; clic_x: number | null; clic_y: number | null; ancho_ventana: number | null; prueba: string | null };
/** Los toques con su punto (los del mapa de calor): `clic_x is not null` es el predicado del índice parcial (mig 0190). */
async function filasToques(rg: Rango): Promise<Fila[]> {
  const rows = await leer<FToque>('vsl_events', 'id, created_at, visitor_id, landing_url, tipo_evento, detalle, clic_x, clic_y, ancho_ventana, prueba', rg, {
    col: 'created_at', ts: true, extra: (q) => q.not('clic_x', 'is', null),
  });
  const out: Fila[] = [];
  for (const x of rows) {
    if (x.tipo_evento !== 'click' && x.tipo_evento !== 'clic_vacio') continue;
    if (noEsDelNegocio(x)) continue;
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

type FEventoVideo = { id: number; created_at: string; visitor_id: string | null; tipo_evento: string | null; porcentaje: number | null; segundos: number | null; video_id: string | null; vsl_titulo: string | null; landing_url: string | null; prueba: string | null };
export type VideoDelPeriodo = {
  /** El `video_id`, o '' para los eventos que no dicen de qué video son. */
  id: string;
  nombre: string;
  eventos: EventoVsl[];
  duracion: number | null;
  /** La primera vez que cada persona aparece en ese video: su fecha y su página. */
  primera: Map<string, { f: string; pagina: string | null }>;
};
/**
 * Los eventos del período agrupados POR VIDEO —dos videos no se promedian: son dos curvas— con la
 * duración de cada uno. Los eventos sin `video_id` forman su propio grupo en vez de entrar en la curva de
 * cualquier video (la deuda de lib/vsl-retencion.ts:150). Lo usan el conjunto `retencion_vsl` y el bloque
 * `curva_vsl` (lib/graficos-bloques-extra.ts): la misma lectura para el número y para la curva.
 */
export async function videosDelPeriodo(rg: Rango): Promise<VideoDelPeriodo[]> {
  const [rows, durs] = await Promise.all([
    leer<FEventoVideo>('vsl_events', 'id, created_at, visitor_id, tipo_evento, porcentaje, segundos, video_id, vsl_titulo, landing_url, prueba', rg, { col: 'created_at', ts: true }),
    getDuracionesVsl(),
  ]);
  const porVideo = new Map<string, FEventoVideo[]>();
  for (const x of rows) {
    // Sólo lo que habla del VIDEO, en positivo (`esEventoDeVideo`, la lista de lib/vsl-retencion.ts): un
    // clic o un scroll no traen `video_id` y armarían un «Sin identificar» de gente que nunca le dio play,
    // y además correrían la fecha y la página de «la primera vez que vio el video».
    if (!esEventoDeVideo(x.tipo_evento)) continue;
    if (noEsDelNegocio(x)) continue;
    const f = fechaTj(x.created_at);
    if (!f || !enRango(f, rg)) continue;
    const k = txt(x.video_id) ?? '';
    (porVideo.get(k) ?? porVideo.set(k, []).get(k)!).push(x);
  }
  const duracion = duracionPara(new Set([...porVideo.keys()].filter(Boolean)), durs);
  return [...porVideo.entries()].map(([id, evs]) => {
    const titulos = new Map<string, number>();
    const primera = new Map<string, { f: string; pagina: string | null }>();
    for (const e of evs) {
      const t = txt(e.vsl_titulo); if (t) titulos.set(t, (titulos.get(t) ?? 0) + 1);
      const quien = (e.visitor_id ?? '').trim(); if (!quien) continue;
      const f = fechaTj(e.created_at)!;
      const p = primera.get(quien);
      if (!p || f < p.f) primera.set(quien, { f, pagina: ruta(e.landing_url) ?? p?.pagina ?? null });
      else if (!p.pagina) p.pagina = ruta(e.landing_url);
    }
    const titulo = [...titulos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { id, nombre: titulo ?? (id || 'Sin identificar'), eventos: evs, duracion: duracion(id || null), primera };
  });
}

/**
 * Una fila por persona y video: hasta dónde lo vio (`avancePorPersona`, el motor de la curva).
 * «Medidos» = con avance positivo: es el denominador de toda tasa (quien dio play y no dejó un solo
 * evento de avance puede ser un agujero de medición).
 */
async function filasRetencionVsl(rg: Rango): Promise<Fila[]> {
  const out: Fila[] = [];
  for (const vid of await videosDelPeriodo(rg)) {
    for (const [persona, av] of avancePorPersona(vid.eventos, vid.duracion, null)) {
      const p = vid.primera.get(persona);
      const a = av ?? 0;
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

type FLlamadaVenta = { recording_id: number; call_date: string | null; duration_min: number | null; closer: string | null; tipo: string | null; score: number | string | null; outcome_tone: string | null; has_transcript: boolean | null };
/**
 * Sin Fathom la tab no muestra nada (pide la key): la tarjeta lo dice en vez de dibujar ceros mudos
 * que se leen como «no hubo llamadas».
 */
export const exigirFathom = async () => { if (!(await integracionConectada('fathom'))) throw new SinConexionError('Conecta Fathom en Integraciones'); };

/** Las llamadas de venta analizadas, el universo de la tab (getClosingViewData). */
async function filasLlamadasVenta(rg: Rango): Promise<Fila[]> {
  await exigirFathom();
  const rows = await leer<FLlamadaVenta>('closing_analyses', 'recording_id, call_date, duration_min, closer, tipo, score, outcome_tone, has_transcript', rg, {
    col: 'call_date', orden: 'recording_id', extra: (q) => q.eq('category', 'venta').eq('status', 'analizada'),
  });
  return rows.map((x) => {
    const p = puntajeDe(x);
    const r2 = x.tipo === 'R2';
    const gano = x.outcome_tone === 'good';
    return {
      f: x.call_date,
      d: { closer: txt(x.closer), reunion: txt(x.tipo), tono: TONO_LLAMADA[x.outcome_tone ?? ''] ?? null },
      v: {
        llamadas: 1, minutos: num(x.duration_min), puntos: p ?? 0, con_puntaje: p != null ? 1 : 0,
        ganadas: gano ? 1 : 0, perdidas: x.outcome_tone === 'bad' ? 1 : 0, r1: x.tipo === 'R1' ? 1 : 0, r2: r2 ? 1 : 0, ganadas_r2: r2 && gano ? 1 : 0,
      },
    };
  });
}

const GRUPO_DIM: Record<string, string> = { spin: 'Método SPIN', exec: 'Ejecución de venta' };
type FLlamadaDims = { recording_id: number; call_date: string | null; closer: string | null; tipo: string | null; outcome_tone: string | null; dims: unknown };
/** Una fila por llamada y dimensión del análisis, con su puntaje de 0 a 10. */
async function filasLlamadasDimensiones(rg: Rango): Promise<Fila[]> {
  await exigirFathom();
  const rows = await leer<FLlamadaDims>('closing_analyses', 'recording_id, call_date, closer, tipo, outcome_tone, dims', rg, {
    col: 'call_date', orden: 'recording_id', extra: (q) => q.eq('category', 'venta').eq('status', 'analizada'),
  });
  const out: Fila[] = [];
  for (const x of rows) {
    for (const d of Array.isArray(x.dims) ? (x.dims as Array<{ g?: unknown; label?: unknown; score?: unknown }>) : []) {
      const s = typeof d?.score === 'number' ? d.score : Number(d?.score);
      if (!d || typeof d.label !== 'string' || !Number.isFinite(s)) continue;
      out.push({
        f: x.call_date,
        d: { dimension: d.label, grupo: GRUPO_DIM[String(d.g ?? '')] ?? null, tono: TONO_LLAMADA[x.outcome_tone ?? ''] ?? null, closer: txt(x.closer), reunion: txt(x.tipo) },
        v: { puntos: s, con_puntaje: 1 },
      });
    }
  }
  return out;
}

// ── Productivity Analyst ────────────────────────────────────────────────────────────────

/** Una fila por proyecto, contado como la tab (sin las tareas recurrentes y en todos sus proyectos). */
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
        impacto: p.l.impacto ?? 0, esfuerzo: p.l.esfuerzo ?? 0,
      },
    };
  });
}

/**
 * El tablero que le toca a quien mira (el del dueño o el del cliente), con las MISMAS lecturas que
 * Productivity Analyst (app/productivity-analyst/page.tsx hasta el 11/10/2026). La usan también los
 * bloques de la plantilla «Productividad» (lib/graficos-bloques-extra.ts).
 */
export async function leerTablero(): Promise<{ tasks: BoardTask[]; labels: Label[] }> {
  if ((await tableroActual()) === 'dueno') {
    const b = await listPlanBoard();
    return { tasks: b.tareas, labels: b.proyectos };
  }
  const [t, c] = await Promise.all([listTareas(), listCategorias()]);
  return { tasks: t.map(toBoard), labels: c.map(toLabel) };
}

/** Una fila por tarea que empieza y termina, con lo que la tab deduce de su historial. */
async function filasEjecucion(): Promise<Fila[]> {
  const { tasks, labels } = await leerTablero();
  const mm = metricasProductividad(tasks, labels, Date.now());
  const ciclo = new Map(mm.ciclos.map((c) => [c.t.id, c.dias] as const));
  const cierre = new Map(mm.conDeadline.map((c) => [c.t.id, c] as const));
  const estancada = new Set(mm.estancadas.map((x) => x.t.id));
  return sinRecurrentes(tasks).map((t) => {
    const activa = t.progress < 100;
    const prio = prioFromScore(t.score);
    const c = cierre.get(t.id);
    const dc = ciclo.get(t.id);
    return {
      f: null,
      d: { prioridad: PLABEL[prio], estado: activa ? 'Activa' : 'Hecha', con_deadline: t.deadline ? 'Sí' : 'No' },
      v: {
        tareas: 1, activas: activa ? 1 : 0, hechas: activa ? 0 : 1, en_curso: activa && t.progress > 0 ? 1 : 0,
        sin_deadline: activa && !t.deadline ? 1 : 0, alta_sin_deadline: activa && prio === 'alta' && !t.deadline ? 1 : 0,
        estancadas: estancada.has(t.id) ? 1 : 0, progreso: Math.min(100, num(t.progress)),
        cerradas_con_deadline: c ? 1 : 0, a_tiempo: c?.aTiempo ? 1 : 0, tarde: c && !c.aTiempo ? 1 : 0, dias_tarde: c && !c.aTiempo ? c.dias : 0,
        dias_ciclo: dc ?? 0, con_ciclo: dc != null ? 1 : 0,
      },
    };
  });
}

// ── El reparto ───────────────────────────────────────────────────────────────────────────

/** Un lector por conjunto de lib/graficos-fuentes-extra.ts. El test exige que estén todos. */
export const LECTORES_EXTRA: Record<string, Lector> = {
  guiones: (_, rg) => filasGuiones(rg),
  clics: (_, rg) => filasClics(rg),
  scroll: (_, rg) => filasScroll(rg),
  toques: (_, rg) => filasToques(rg),
  retencion_vsl: (_, rg) => filasRetencionVsl(rg),
  landing_analisis: (f, rg) => filasLandingAnalisis(f, rg),
  llamadas_venta: (_, rg) => filasLlamadasVenta(rg),
  llamadas_dimensiones: (_, rg) => filasLlamadasDimensiones(rg),
  proyectos: () => filasProyectos(),
  ejecucion: () => filasEjecucion(),
};
