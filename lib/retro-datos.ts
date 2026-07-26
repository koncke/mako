// =============================================================================
// retro-datos — series y números REALES para la Retrospectiva de MaKo
// =============================================================================
// Server-only. Complemento estructurado de retro-fuentes.ts: mismos orígenes
// de datos, pero en vez de texto produce (a) las series para los gráficos del
// Detail (RetroCharts), (b) un paquete de números por área para que MaKo cite
// evidencia verificable, y (c) la cobertura de datos (huecos de medición).
// Sin IA. Todo resiliente: si una fuente falla, esa parte se omite (nunca tira).
// =============================================================================

import 'server-only';

import type { RetroCharts, RetroCoberturaItem, AreaId } from './retro-reporte';

import {
  getMarketingWindow,
  getSenalesRecon,
  getFatigaAdsets,
  getFunnelEtapas,
  getFormulariosSinAgenda,
  getRevenuePeriod,
  type MarketingWindow,
  type SenalRecon,
  type FunnelMes,
  type FormSinAgenda,
  type RevenuePeriod,
  type AdsetFatiga,
} from './queries';
import { getSecuenciasConStats, type SecuenciaConStats } from './nutricion';
import { getClosingViewData, type ClosingViewData } from './closing';
import { getScriptAnalystView, type ScriptAnalystView, type ScriptView } from './ads-analyst';
import { getCuotasPendientes, type CuotaPendiente } from './pagos';
import { listExperimentos, type Experimento } from './experimentos';
import { diasAntes } from './date-utils';

// ─────────────────────────────────────────────────────────────────────────────
// Contrato
// ─────────────────────────────────────────────────────────────────────────────

export type DatosArea = Record<string, number | string | null>; // claves planas con los números clave del área

export type RetroDatos = {
  charts: RetroCharts;                       // series para los gráficos del Detail
  datos: Partial<Record<AreaId, DatosArea>>; // números por área (para prompts + verificación)
  cobertura: RetroCoberturaItem[];           // huecos de medición detectados
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Envuelve una promesa: si rechaza, devuelve null (nada tira hacia arriba). */
async function seguro<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
}

/** USD con 2 decimales; null si no hay dato. */
function rUsd(n: number | null | undefined): number | null {
  return n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 100) / 100;
}

/** Porcentaje con 1 decimal; null si no hay dato. */
function rPct(n: number | null | undefined): number | null {
  return n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 10) / 10;
}

/** Conteo entero; null si no hay dato. */
function rInt(n: number | null | undefined): number | null {
  return n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n);
}

/** Días inclusivos entre dos fechas 'YYYY-MM-DD' (mismo día = 1). */
function diasInclusivos(desde: string, hasta: string): number {
  const [ay, am, ad] = desde.split('-').map(Number);
  const [by, bm, bd] = hasta.split('-').map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86400000) + 1;
}

/** Suma N días a una fecha 'YYYY-MM-DD' (reutiliza diasAntes con n negativo). */
function diasDespues(fecha: string, n: number): string {
  return diasAntes(fecha, -n);
}

/** 'YYYY-MM-DD' → 'dd/mm' para el eje X de los charts. */
function ejeDDMM(fecha: string): string {
  const [, m, d] = fecha.split('-');
  return `${d ?? '??'}/${m ?? '??'}`;
}

/** Recorta un nombre a `max` caracteres (con elipsis si hace falta). */
function recortar(nombre: string, max: number): string {
  const s = nombre.trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** ¿Tiene la ventana algún dato útil? (mismo criterio que retro-fuentes). */
function ventanaTieneDatos(w: MarketingWindow): boolean {
  return w.impressions > 0 || w.spend_usd > 0 || w.leads_count > 0 || w.landing_page_views > 0 || w.agendamientos > 0;
}

/** "Fuerza" del guion (misma fórmula que retro-fuentes, sin IA). */
function scoreScript(s: ScriptView): number {
  return s.cierres * 1000 + s.agendas * 50 + s.finalRet * 2 + s.hookRate;
}

// ─────────────────────────────────────────────────────────────────────────────
// charts.market — tendencia semanal (o diaria si el rango es corto) de spend/CPL
// ─────────────────────────────────────────────────────────────────────────────

type Tramo = { desde: string; hasta: string };

/**
 * Parte [desde,hasta] en ≤12 tramos semanales; si el rango es corto (<14 días)
 * usa tramos diarios. Si aún así saldrían >12 semanas, ensancha el paso.
 */
function partirEnTramos(desde: string, hasta: string): Tramo[] {
  const dias = diasInclusivos(desde, hasta);
  if (dias <= 0) return [];
  const paso = dias < 14 ? 1 : Math.max(7, Math.ceil(dias / 12));
  const tramos: Tramo[] = [];
  let cur = desde;
  // Tope duro de iteraciones por sanidad (diario <14 ⇒ ≤13; semanal ⇒ ≤12).
  for (let i = 0; i < 40 && cur <= hasta; i++) {
    const finTramo = diasDespues(cur, paso - 1);
    const fin = finTramo < hasta ? finTramo : hasta;
    tramos.push({ desde: cur, hasta: fin });
    cur = diasDespues(fin, 1);
  }
  return tramos;
}

async function chartMarket(desde: string, hasta: string): Promise<RetroCharts['market'] | null> {
  const tramos = partirEnTramos(desde, hasta);
  if (tramos.length === 0) return null;

  const ventanas = await Promise.all(
    tramos.map((t) => seguro(getMarketingWindow(t.desde, t.hasta))),
  );

  const puntos = tramos.map((t, i) => {
    const w = ventanas[i];
    if (!w) return { x: ejeDDMM(t.desde), spend: null, cpl: null };
    return {
      x: ejeDDMM(t.desde),
      spend: rUsd(w.spend_usd),
      cpl: w.leads_count > 0 ? rUsd(w.spend_usd / w.leads_count) : null,
    };
  });

  const hayDato = puntos.some((p) => typeof p.spend === 'number' && p.spend > 0);
  if (!hayDato) return null;
  return { puntos, series: ['spend', 'cpl'] };
}

// ─────────────────────────────────────────────────────────────────────────────
// charts.graphics — embudo completo con la fuga (peor ratio de paso)
// ─────────────────────────────────────────────────────────────────────────────

function chartGraphics(w: MarketingWindow): RetroCharts['graphics'] | null {
  if (!ventanaTieneDatos(w)) return null;

  // etapas del embudo; conDato=false cuando el valor es un 0 "falso" (sin fuente)
  const etapas: Array<{ label: string; valor: number; conDato: boolean }> = [
    { label: 'Impresiones', valor: w.impressions, conDato: true },
    { label: 'Landing', valor: w.landing_page_views, conDato: true },
    { label: 'VSL', valor: w.vsl_views ?? 0, conDato: w.vsl_views !== null },
    { label: 'Formularios', valor: w.leads_count, conDato: true },
    { label: 'Agendas', valor: w.agendamientos, conDato: true },
    { label: 'Cierres', valor: w.cierres_en_ventana, conDato: true },
  ];

  // Peor ratio de paso: solo entre etapas con dato real (el VSL sin trackear no
  // puede ganar la fuga con un 0 falso). Se marca la etapa DESTINO del ratio.
  const conDato = etapas
    .map((e, idx) => ({ ...e, idx }))
    .filter((e) => e.conDato);
  let fugaIdx: number | null = null;
  let peor = Number.POSITIVE_INFINITY;
  for (let i = 0; i < conDato.length - 1; i++) {
    const origen = conDato[i];
    const destino = conDato[i + 1];
    if (origen.valor <= 0) continue;
    const ratio = destino.valor / origen.valor;
    if (ratio < peor) {
      peor = ratio;
      fugaIdx = destino.idx;
    }
  }

  const funnel = etapas.map((e, idx) => ({
    label: e.label,
    valor: rInt(e.valor) ?? 0,
    ...(idx === fugaIdx ? { fuga: true as const } : {}),
  }));
  return { funnel };
}

// ─────────────────────────────────────────────────────────────────────────────
// charts.crm — split de nutrición (nutridos vs sin tocar)
// ─────────────────────────────────────────────────────────────────────────────

function chartCrm(forms: FormSinAgenda[]): RetroCharts['crm'] | null {
  if (forms.length === 0) return null;
  const nutridos = forms.filter((f) => f.nutricion_realizada).length;
  const sinTocar = forms.length - nutridos;
  return {
    split: [
      { label: 'Nutridos', valor: nutridos, tone: 'good' },
      { label: 'Sin tocar', valor: sinTocar, tone: 'bad' },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// charts.closing — embudo comercial corto + score promedio
// ─────────────────────────────────────────────────────────────────────────────

/** Saca los pasos Agendas → R1 → R2 → Cierres del funnel (keys reales). */
function pasosComerciales(funnel: FunnelMes): Array<{ label: string; valor: number }> | null {
  const por = new Map(funnel.etapas.map((e) => [e.key, e]));
  const formAgenda = por.get('form_agenda');       // puente: salida = agendas
  const agendaAsistio = por.get('agenda_asistio'); // comercial: salida = asistió R1
  const asistioCalificado = por.get('asistio_calificado'); // salida = limpias (pasan a R2)
  const calificadoCierre = por.get('calificado_cierre');   // salida = cierres

  const agendas = formAgenda?.salida ?? agendaAsistio?.entrada ?? null;
  const r1 = agendaAsistio?.salida ?? null;
  const r2 = asistioCalificado?.salida ?? null;
  const cierres = calificadoCierre?.salida ?? null;
  if (agendas === null && r1 === null && r2 === null && cierres === null) return null;

  return [
    { label: 'Agendas', valor: rInt(agendas) ?? 0 },
    { label: 'R1', valor: rInt(r1) ?? 0 },
    { label: 'R2', valor: rInt(r2) ?? 0 },
    { label: 'Cierres', valor: rInt(cierres) ?? 0 },
  ];
}

function chartClosing(funnel: FunnelMes | null, closing: ClosingViewData | null): RetroCharts['closing'] | null {
  const pasos = funnel ? pasosComerciales(funnel) : null;
  if (!pasos) return null;
  return { pasos, score: closing ? closing.kpis.scorePromedio : null };
}

// ─────────────────────────────────────────────────────────────────────────────
// charts.script — guiones para el cuadrante hook × retención
// ─────────────────────────────────────────────────────────────────────────────

function chartScript(view: ScriptAnalystView): RetroCharts['script'] | null {
  // Solo videos con retención medible (las imágenes no tienen hook/ret).
  const medibles = view.scripts.filter((s) => !s.esImagen && (s.hookRate > 0 || s.finalRet > 0));
  if (medibles.length === 0) return null;
  const top = [...medibles].sort((a, b) => b.spend - a.spend).slice(0, 8);
  return {
    guiones: top.map((s) => ({
      nombre: recortar(s.short || s.name, 24),
      hook: rPct(s.hookRate) ?? 0,
      ret: rPct(s.finalRet) ?? 0,
      spend: rUsd(s.spend) ?? 0,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// datos por área
// ─────────────────────────────────────────────────────────────────────────────

function datosAdquisicion(
  w: MarketingWindow | null,
  recon: SenalRecon[] | null,
  fatiga: AdsetFatiga[] | null,
): DatosArea | null {
  const d: DatosArea = {};
  if (w && ventanaTieneDatos(w)) {
    d.spend_usd = rUsd(w.spend_usd);
    d.impressions = rInt(w.impressions);
    d.landing_views = rInt(w.landing_page_views);
    d.vsl_views = w.vsl_views !== null ? rInt(w.vsl_views) : null;
    d.leads_count = rInt(w.leads_count);
    d.cpl = w.leads_count > 0 ? rUsd(w.spend_usd / w.leads_count) : null;
    d.cpc = rUsd(w.cpc_global);
    d.ctr = rPct(w.ctr_global);
    d.cpm = rUsd(w.cpm_global);
  }
  if (fatiga && fatiga.length > 0) {
    d.frecuencia_max = rPct(Math.max(...fatiga.map((f) => f.frequency_7d)));
  }
  if (recon && recon.length > 0) {
    d.ads_validados = recon.filter((r) => r.veredicto === 'validada').length;
    d.ads_apagar = recon.filter((r) => r.veredicto === 'apagar').length;
  }
  return Object.keys(d).length > 0 ? d : null;
}

function datosNutricion(
  w: MarketingWindow | null,
  forms: FormSinAgenda[] | null,
  secs: SecuenciaConStats[] | null,
): DatosArea | null {
  const d: DatosArea = {};
  if (w) d.total_forms = rInt(w.leads_count);
  if (forms) {
    const nutridos = forms.filter((f) => f.nutricion_realizada).length;
    const sinTocar = forms.length - nutridos;
    d.sin_agenda = forms.length;
    d.nutridos = nutridos;
    d.sin_tocar = sinTocar;
    d.pct_sin_tocar = forms.length > 0 ? rPct((sinTocar / forms.length) * 100) : null;
  }
  if (secs) {
    d.secuencias_activas = secs.filter((s) => s.activa).length;
    d.secuencias_total = secs.length;
    d.inscriptos = rInt(secs.reduce((s, x) => s + x.inscriptos, 0));
  }
  return Object.keys(d).length > 0 ? d : null;
}

function datosConversion(funnel: FunnelMes | null, closing: ClosingViewData | null): DatosArea | null {
  const d: DatosArea = {};
  if (funnel) {
    const pasos = pasosComerciales(funnel);
    if (pasos) {
      const [agendas, r1, r2, cierres] = pasos;
      d.agendas = agendas?.valor ?? null;
      d.r1 = r1?.valor ?? null;
      d.r2 = r2?.valor ?? null;
      d.cierres = cierres?.valor ?? null;
      const agAsistio = funnel.etapas.find((e) => e.key === 'agenda_asistio');
      d.no_show_pct =
        agAsistio && agAsistio.pct !== null && !agAsistio.fuente_pendiente
          ? rPct(100 - agAsistio.pct)
          : null;
      d.tasa_cierre_pct =
        agendas && cierres && agendas.valor > 0 ? rPct((cierres.valor / agendas.valor) * 100) : null;
    }
  }
  if (closing) {
    d.score_promedio = rPct(closing.kpis.scorePromedio);
    d.r1_prom = rPct(closing.kpis.r1Prom);
    d.r2_prom = rPct(closing.kpis.r2Prom);
  }
  return Object.keys(d).length > 0 ? d : null;
}

function datosCreativos(view: ScriptAnalystView | null): DatosArea | null {
  if (!view) return null;
  const d: DatosArea = { guiones_analizados: view.counts.analizadas };

  const conSenal = view.scripts.filter((s) => !s.esImagen && s.spend > 0);
  if (conSenal.length > 0) {
    const ordenados = [...conSenal].sort((a, b) => scoreScript(b) - scoreScript(a));
    const mejor = ordenados[0];
    d.mejor_guion = recortar(mejor.short || mejor.name, 40);
    d.mejor_hook_pct = rPct(mejor.hookRate);
    d.mejor_ret_pct = rPct(mejor.finalRet);
    const peor = ordenados[ordenados.length - 1];
    d.peor_guion = ordenados.length > 1 ? recortar(peor.short || peor.name, 40) : null;
  }
  return d;
}

function datosRevenue(
  rev: RevenuePeriod | null,
  cuotas: { vencidas: CuotaPendiente[]; porVencer: CuotaPendiente[] } | null,
): DatosArea | null {
  const d: DatosArea = {};
  if (rev) {
    d.sold_usd = rUsd(rev.sold_revenue_usd);
    d.cash_usd = rUsd(rev.cash_collected_usd);
    d.cac = rUsd(rev.cac_usd);
    d.roas = rev.roas_cash !== null ? rUsd(rev.roas_cash) : null;
  }
  if (cuotas) {
    d.cuotas_vencidas = cuotas.vencidas.length;
    d.monto_vencido_usd = rUsd(cuotas.vencidas.reduce((s, c) => s + c.monto_usd, 0));
    d.por_vencer_usd = rUsd(cuotas.porVencer.reduce((s, c) => s + c.monto_usd, 0));
  }
  return Object.keys(d).length > 0 ? d : null;
}

function datosExperimentos(exps: Experimento[] | null): DatosArea | null {
  if (!exps) return null;
  const cerrados = exps.filter((e) => e.estado === 'cerrado');
  return {
    activos: exps.filter((e) => e.estado === 'activo').length,
    cerrados: cerrados.length,
    validadas: cerrados.filter((e) => e.veredicto === 'validada').length,
    refutadas: cerrados.filter((e) => e.veredicto === 'refutada').length,
    sin_conclusion: cerrados.filter((e) => e.veredicto === 'no_concluyente' || e.veredicto === null).length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cobertura — huecos de medición detectados por reglas de código
// ─────────────────────────────────────────────────────────────────────────────

function detectarCobertura(src: {
  w: MarketingWindow | null;
  secs: SecuenciaConStats[] | null;
  scripts: ScriptAnalystView | null;
  closing: ClosingViewData | null;
  rev: RevenuePeriod | null;
}): RetroCoberturaItem[] {
  const items: RetroCoberturaItem[] = [];

  // (1) VSL sin trackear o con pocos días de dato real
  if (src.w) {
    const vslNull = src.w.vsl_views === null;
    const vslParcial =
      !vslNull && src.w.dias_con_datos > 0 && src.w.vsl_days_baseline_only >= src.w.dias_con_datos / 2;
    if (vslNull || vslParcial) items.push({ label: 'VSL: dato parcial o sin trackear', tone: 'warn' });
  }

  // (2) Nutrición sin secuencias activas
  if (src.secs && src.secs.filter((s) => s.activa).length === 0) {
    items.push({ label: 'Nutrición sin secuencias activas', tone: 'warn' });
  }

  // (3) Guiones sin analizar
  if (src.scripts && src.scripts.scripts.length === 0) {
    items.push({ label: 'Guiones sin analizar en el período', tone: 'gris' });
  }

  // (4) Closing sin llamadas analizadas
  if (src.closing && src.closing.calls.length === 0) {
    items.push({ label: 'Llamadas sin analizar (Closing)', tone: 'gris' });
  }

  // (5) Cierres sin cobros registrados
  if (src.rev && src.rev.cierres_en_periodo > 0 && src.rev.cash_collected_usd <= 0) {
    items.push({ label: 'Cobros sin registrar en el período', tone: 'warn' });
  }

  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Orquestador
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recolecta series (charts), números por área (datos) y huecos de medición
 * (cobertura) para el rango [desde, hasta] ('YYYY-MM-DD'). Cada fuente va con
 * su propio try/catch: si algo falla, esa parte se omite. NUNCA tira.
 */
export async function recolectarDatos(desde: string, hasta: string): Promise<RetroDatos> {
  // Todas las fuentes en paralelo, cada una a prueba de fallos.
  const [w, recon, fatiga, funnel, forms, secs, closing, scripts, rev, cuotas, exps, market] =
    await Promise.all([
      seguro(getMarketingWindow(desde, hasta)),
      seguro(getSenalesRecon(desde, hasta)),
      seguro(getFatigaAdsets(hasta)),
      seguro(getFunnelEtapas(desde, hasta)),
      seguro(getFormulariosSinAgenda(hasta)),
      seguro(getSecuenciasConStats()),
      seguro(getClosingViewData()),
      seguro(getScriptAnalystView()),
      seguro(getRevenuePeriod(desde, hasta)),
      seguro(getCuotasPendientes(hasta)),
      seguro(listExperimentos()),
      seguro(chartMarket(desde, hasta)), // internamente paraleliza sus tramos
    ]);

  // ── Charts ──
  const charts: RetroCharts = {};
  if (market) charts.market = market;
  if (w) {
    const g = chartGraphics(w);
    if (g) charts.graphics = g;
  }
  if (forms) {
    const c = chartCrm(forms);
    if (c) charts.crm = c;
  }
  const cl = chartClosing(funnel, closing);
  if (cl) charts.closing = cl;
  if (scripts) {
    const sc = chartScript(scripts);
    if (sc) charts.script = sc;
  }

  // ── Datos por área ──
  const datos: Partial<Record<AreaId, DatosArea>> = {};
  const dAdq = datosAdquisicion(w, recon, fatiga);
  if (dAdq) datos.adquisicion = dAdq;
  const dNut = datosNutricion(w, forms, secs);
  if (dNut) datos.nutricion = dNut;
  const dCon = datosConversion(funnel, closing);
  if (dCon) datos.conversion = dCon;
  const dCre = datosCreativos(scripts);
  if (dCre) datos.creativos = dCre;
  const dRev = datosRevenue(rev, cuotas);
  if (dRev) datos.revenue = dRev;
  const dExp = datosExperimentos(exps);
  if (dExp) datos.experimentos = dExp;

  // ── Cobertura ──
  const cobertura = detectarCobertura({ w, secs, scripts, closing, rev });

  return { charts, datos, cobertura };
}
