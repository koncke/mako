// =============================================================================
// retro-fuentes — resúmenes compactos por área para la Retrospectiva de MaKo
// =============================================================================
// Server-only. Le da a MaKo un RESUMEN de texto (con los números clave, NO
// dumps crudos) de cada ÁREA del negocio, para que la retro "lea todas las tabs
// relevantes". Cada resumen es accionable y breve. Todo resiliente: si una
// fuente falla o queda sin datos, esa área se omite (nunca tira).
// =============================================================================

import 'server-only';

import {
  getMarketingWindow,
  getSenalesRecon,
  getFatigaAdsets,
  getFunnelEtapas,
  getTramosSCL,
  getTramoJ1J2Reciente,
  getSCL,
  getFormulariosSinAgenda,
  getRevenuePeriod,
  getCACAcumulado,
  type MarketingWindow,
  type SenalRecon,
  type FunnelEtapa,
} from './queries';
import { getSecuenciasConStats } from './nutricion';
import { getClosingViewData } from './closing';
import { getScriptAnalystView, type ScriptView } from './script-analyst';
import { getCuotasPendientes } from './pagos';
import { listExperimentos, type Experimento } from '@/lib/experimentos';
import { fmtUSD, fmtNum, fmtDDMMYYYY } from './format';

// ─────────────────────────────────────────────────────────────────────────────
// Contrato
// ─────────────────────────────────────────────────────────────────────────────

export type AreaKey = 'adquisicion' | 'nutricion' | 'conversion' | 'creativos' | 'revenue' | 'experimentos';

export const AREAS: Array<{ key: AreaKey; label: string; sub: string }> = [
  { key: 'adquisicion', label: 'Adquisición · TOFU', sub: 'Meta ads, impresiones → landing → VSL, anuncios ganadores' },
  { key: 'nutricion',   label: 'Nutrición · MOFU',   sub: 'Leads sin agenda, follow-ups y secuencias' },
  { key: 'conversion',  label: 'Conversión · BOFU',  sub: 'Agenda → R1 → R2 → cierre, no-show, closing' },
  { key: 'creativos',   label: 'Creativos y guiones', sub: 'Rendimiento de anuncios y guiones' },
  { key: 'revenue',     label: 'Revenue y cobranza',  sub: 'Ingresos, CAC y cobranza' },
  { key: 'experimentos',label: 'Experimentos',        sub: 'Experimentos en curso y conclusiones' },
];

export type Fuente = { area: AreaKey; label: string; texto: string };

export type Profundidad = 'rapida' | 'estandar' | 'profunda';

const LABEL_DE: Record<AreaKey, string> = Object.fromEntries(
  AREAS.map((a) => [a.key, a.label]),
) as Record<AreaKey, string>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de formato
// ─────────────────────────────────────────────────────────────────────────────

const fechaRango = (desde: string, hasta: string): string => `${fmtDDMMYYYY(desde)} a ${fmtDDMMYYYY(hasta)}`;

const pct = (n: number | null | undefined, dec = 1): string =>
  n === null || n === undefined || !Number.isFinite(n) ? '—' : `${n.toFixed(dec)}%`;

const usd2 = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(n) ? '—' : `$${n.toFixed(2)}`;

const dias = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(n) ? '—' : `${n.toFixed(1)}d`;

/** Ratio "1 de cada X" (safeDiv ya viene calculado). */
const ratio1deX = (r: number | null): string =>
  r === null || !Number.isFinite(r) ? '—' : `1 de cada ${r.toFixed(1)}`;

/** Une líneas no vacías y arma un bloque con encabezado. */
function bloque(header: string, lineas: Array<string | null | undefined>): string {
  const cuerpo = lineas.filter((l): l is string => typeof l === 'string' && l.trim().length > 0);
  return `${header}\n${cuerpo.join('\n')}`;
}

// ¿tiene la ventana algún dato útil? (para omitir el área si está toda vacía)
function ventanaTieneDatos(w: MarketingWindow): boolean {
  return w.impressions > 0 || w.spend_usd > 0 || w.leads_count > 0 || w.landing_page_views > 0 || w.agendamientos > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Área: ADQUISICIÓN (TOFU)
// ─────────────────────────────────────────────────────────────────────────────

async function textoAdquisicion(desde: string, hasta: string, prof: Profundidad): Promise<string | null> {
  let w: MarketingWindow | null = null;
  try { w = await getMarketingWindow(desde, hasta); } catch { w = null; }
  if (!w || !ventanaTieneDatos(w)) return null;

  const header = `ADQUISICIÓN (TOFU) — período ${fechaRango(desde, hasta)}`;

  // Titulares (siempre)
  const titulares: string[] = [
    `- Gasto: ${fmtUSD(w.spend_usd)} · Impresiones: ${fmtNum(w.impressions)} · Alcance: ${fmtNum(w.reach)}`,
    `- Leads (instant forms): ${fmtNum(w.leads_count)} · Agendas (R1): ${fmtNum(w.agendamientos)}`,
    `- CPL (form): ${w.leads_count > 0 ? usd2(w.spend_usd / w.leads_count) : '—'} · CPC: ${usd2(w.cpc_global)} · CPM: ${usd2(w.cpm_global)} · CTR: ${pct(w.ctr_global, 2)}`,
  ];

  if (prof === 'rapida') {
    // Solo titulares + el mejor anuncio si lo tenemos a mano
    let ganador: string | null = null;
    try {
      const recon = await getSenalesRecon(desde, hasta);
      const top = recon.filter((r) => r.leads > 0).sort((a, b) => b.leads - a.leads)[0];
      if (top) ganador = `- Anuncio con más leads: "${top.ad_name}" (${fmtNum(top.leads)} leads, ${fmtUSD(top.spend_usd)}, veredicto ${top.veredicto})`;
    } catch { /* omitir */ }
    return bloque(header, [...titulares, ganador]);
  }

  // Estándar / profunda: tramo del embudo de contenido + recon
  const embudo: Array<string | null> = [
    `Embudo TOFU (impresión → landing → VSL):`,
    `- Impresión → Landing: ${ratio1deX(w.ratio_imp_landing)} (${fmtNum(w.landing_page_views)} vistas de landing)`,
    w.vsl_views !== null ? `- Landing → VSL: ${ratio1deX(w.ratio_landing_vsl)} (${fmtNum(w.vsl_views)} plays de VSL)` : `- VSL: sin datos de plays en el período`,
    w.ratio_vsl_agenda !== null ? `- VSL → Agenda: ${ratio1deX(w.ratio_vsl_agenda)}` : null,
  ];

  // Recon de anuncios (veredictos + ganadores)
  let reconTxt: string | null = null;
  try {
    const recon = await getSenalesRecon(desde, hasta);
    if (recon.length > 0) reconTxt = textoRecon(recon, prof);
  } catch { reconTxt = null; }

  // Fatiga de adsets (opcional)
  let fatigaTxt: string | null = null;
  if (prof === 'profunda') {
    try {
      const fatiga = await getFatigaAdsets(hasta);
      if (fatiga.length > 0) {
        const lineas = fatiga.slice(0, 6).map(
          (f) => `- ${f.adset_name}: freq 7d ${f.frequency_7d.toFixed(1)}, CPL 7d ${usd2(f.cpl_7d_usd)} vs 28d ${usd2(f.cpl_28d_usd)}`,
        );
        fatigaTxt = `Adsets con posible fatiga de creativo (${fatiga.length}):\n${lineas.join('\n')}`;
      }
    } catch { fatigaTxt = null; }
  }

  const embudoTxt = embudo.filter((l): l is string => typeof l === 'string' && l.length > 0).join('\n');
  return bloque(header, [...titulares, '', embudoTxt, reconTxt ? `\n${reconTxt}` : null, fatigaTxt ? `\n${fatigaTxt}` : null]);
}

function textoRecon(recon: SenalRecon[], prof: Profundidad): string {
  const cnt = (v: SenalRecon['veredicto']) => recon.filter((r) => r.veredicto === v).length;
  const resumen = `Anuncios (${recon.length}): validados ${cnt('validada')}, explorando ${cnt('explorando')}, a apagar ${cnt('apagar')}, falso positivo ${cnt('falso_positivo')}, pausados ${cnt('pausada')}.`;

  const nTop = prof === 'profunda' ? 6 : 3;
  const ganadores = [...recon]
    .filter((r) => r.leads > 0)
    .sort((a, b) => b.leads - a.leads)
    .slice(0, nTop)
    .map((r) => `- "${r.ad_name}" [${r.veredicto}]: ${fmtNum(r.leads)} leads, ${fmtUSD(r.spend_usd)}, CPL ${usd2(r.cpl_usd)}${r.cierres > 0 ? `, ${r.cierres} cierre(s)` : ''}`);

  const aApagar = recon
    .filter((r) => r.veredicto === 'apagar')
    .slice(0, nTop)
    .map((r) => `- "${r.ad_name}": ${fmtUSD(r.spend_usd)} sin leads en ${r.dias_corriendo}d`);

  const partes = [`Recon de anuncios: ${resumen}`];
  if (ganadores.length) partes.push(`Top por leads:\n${ganadores.join('\n')}`);
  if (aApagar.length) partes.push(`A apagar:\n${aApagar.join('\n')}`);
  return partes.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Área: NUTRICIÓN (MOFU)
// ─────────────────────────────────────────────────────────────────────────────

async function textoNutricion(desde: string, hasta: string, prof: Profundidad): Promise<string | null> {
  const header = `NUTRICIÓN (MOFU) — período ${fechaRango(desde, hasta)}`;
  const lineas: string[] = [];

  // Leads que completaron formulario pero NO agendaron (ventana propia de 30d de la función)
  let hayFormsSinAgenda = false;
  try {
    const forms = await getFormulariosSinAgenda(hasta);
    if (forms.length > 0) {
      hayFormsSinAgenda = true;
      const nutridos = forms.filter((f) => f.nutricion_realizada).length;
      const sinNutrir = forms.length - nutridos;
      const masViejo = forms[0]; // getFormulariosSinAgenda ordena más viejos primero
      lineas.push(`- Formularios SIN agenda (abiertos, últimos 30d): ${forms.length} · nutridos ${nutridos}, sin nutrir ${sinNutrir}`);
      if (masViejo) lineas.push(`- El más rezagado: "${masViejo.nombre}"${masViejo.empresa ? ` (${masViejo.empresa})` : ''}, ${masViejo.dias}d desde el form`);
      if (prof !== 'rapida') {
        const top = forms.filter((f) => !f.nutricion_realizada).slice(0, prof === 'profunda' ? 8 : 4)
          .map((f) => `  · "${f.nombre}" ${f.dias}d${f.origen ? ` — ${f.origen}` : ''}`);
        if (top.length) lineas.push(`- Sin nutrir (prioridad):\n${top.join('\n')}`);
      }
    }
  } catch { /* omitir sección */ }

  // Estado de las secuencias de nutrición
  let haySecuencias = false;
  try {
    const secs = await getSecuenciasConStats();
    if (secs.length > 0) {
      haySecuencias = true;
      const activas = secs.filter((s) => s.activa);
      const pausadas = secs.filter((s) => !s.activa);
      const inscriptos = secs.reduce((s, x) => s + x.inscriptos, 0);
      const enviados = secs.reduce((s, x) => s + x.enviados, 0);
      const canales = new Set<string>();
      for (const s of secs) for (const p of s.pasos) canales.add(p.canal);
      lineas.push(`- Secuencias: ${activas.length} activas, ${pausadas.length} pausadas · inscriptos ${fmtNum(inscriptos)}, enviados ${fmtNum(enviados)} · canales: ${[...canales].join(', ') || '—'}`);
      if (prof !== 'rapida' && activas.length > 0) {
        const det = activas.slice(0, prof === 'profunda' ? 10 : 5)
          .map((s) => `  · "${s.nombre}" (${s.etapa}, ${s.pasos.length} pasos): ${s.inscriptos} inscriptos, ${s.enviados} enviados`);
        lineas.push(`- Activas:\n${det.join('\n')}`);
      }
      if (prof === 'profunda' && pausadas.length > 0) {
        const det = pausadas.slice(0, 8).map((s) => `  · "${s.nombre}" (pausada): ${s.inscriptos} inscriptos`);
        lineas.push(`- Pausadas:\n${det.join('\n')}`);
      }
    }
  } catch { /* omitir sección */ }

  if (!hayFormsSinAgenda && !haySecuencias) return null;
  return bloque(header, lineas);
}

// ─────────────────────────────────────────────────────────────────────────────
// Área: CONVERSIÓN (BOFU)
// ─────────────────────────────────────────────────────────────────────────────

async function textoConversion(desde: string, hasta: string, prof: Profundidad): Promise<string | null> {
  const header = `CONVERSIÓN (BOFU) — período ${fechaRango(desde, hasta)}`;
  const lineas: string[] = [];
  let hayAlgo = false;

  // Funnel comercial (agenda → R1 → R2/limpia → cierre) + cuello
  try {
    const funnel = await getFunnelEtapas(desde, hasta);
    const comerciales = funnel.etapas.filter((e) => e.bloque === 'comercial' || e.bloque === 'puente');
    if (comerciales.length > 0) {
      hayAlgo = true;
      lineas.push(`Embudo comercial (puente + comercial):`);
      for (const e of comerciales) lineas.push(`- ${etapaLinea(e)}`);
      if (funnel.cuelloKey) {
        const cuello = funnel.etapas.find((e) => e.key === funnel.cuelloKey);
        if (cuello) lineas.push(`- CUELLO del funnel: "${cuello.label}" (${pct(cuello.pct)}, ${cuello.salud})`);
      }
    }
  } catch { /* omitir */ }

  if (prof !== 'rapida') {
    // Tiempos del ciclo (SCL por tramos + total)
    try {
      const tramos = await getTramosSCL();
      if (tramos.tramos.some((t) => t.dias_promedio !== null)) {
        hayAlgo = true;
        const linsTramos = tramos.tramos
          .filter((t) => t.dias_promedio !== null)
          .map((t) => `  · ${t.label}: ${dias(t.dias_promedio)} (n=${t.n})`);
        lineas.push(`Ritmo del ciclo (agenda → pago):\n${linsTramos.join('\n')}`);
        if (tramos.total_dias !== null) lineas.push(`- Ciclo total (suma de tramos): ${dias(tramos.total_dias)}${tramos.tramo_mas_lento ? ` · más lento: ${tramos.tramo_mas_lento}` : ''}`);
      }
    } catch { /* omitir */ }

    // SCL agregado (avg / p90)
    try {
      const scl = await getSCL();
      if (scl.avg_dias !== null) {
        hayAlgo = true;
        lineas.push(`- SCL (agenda → primer pago): promedio ${dias(scl.avg_dias)}, P90 ${dias(scl.p90_dias)} (n=${scl.count})`);
      }
    } catch { /* omitir */ }

    // J1 → J2 reciente (deals que se enfrían)
    try {
      const j1j2 = await getTramoJ1J2Reciente(hasta);
      if (j1j2.promedio !== null) {
        hayAlgo = true;
        lineas.push(`- Tramo R1 → R2 (últimos 60d): ${dias(j1j2.promedio)} promedio (n=${j1j2.n})`);
      }
    } catch { /* omitir */ }
  }

  // Closing: KPIs de las llamadas de venta
  try {
    const closing = await getClosingViewData();
    const k = closing.kpis;
    if (closing.counts.ventas > 0 || k.conScore > 0) {
      hayAlgo = true;
      lineas.push(`Closing (llamadas de venta analizadas):`);
      lineas.push(`- Ventas analizadas: ${closing.counts.ventas} · score promedio ${k.scorePromedio ?? '—'}/100 (n=${k.conScore}) · ganadas ${k.ganadas}`);
      if (k.r1Prom !== null || k.r2Prom !== null) lineas.push(`- Score R1 ${k.r1Prom ?? '—'} · Score R2 ${k.r2Prom ?? '—'}`);
      if (prof === 'profunda' && closing.calls.length > 0) {
        const det = closing.calls.slice(0, 5).map(
          (c) => `  · ${c.tipo ?? 'R?'} "${c.lead_nombre ?? c.title ?? 'sin nombre'}" score ${c.score ?? '—'}${c.outcome ? ` — ${c.outcome}` : ''}`,
        );
        lineas.push(`- Últimas llamadas:\n${det.join('\n')}`);
      }
    }
  } catch { /* omitir */ }

  if (!hayAlgo) return null;
  return bloque(header, lineas);
}

function etapaLinea(e: FunnelEtapa): string {
  if (e.fuente_pendiente) return `${e.label}: sin fuente (pendiente)`;
  if (e.muestra_chica) return `${e.label}: muestra chica — ${e.salida}/${e.entrada}`;
  return `${e.label}: ${pct(e.pct)} (${e.salida}/${e.entrada}, ${e.salud})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Área: CREATIVOS Y GUIONES
// ─────────────────────────────────────────────────────────────────────────────

async function textoCreativos(desde: string, hasta: string, prof: Profundidad): Promise<string | null> {
  let view: Awaited<ReturnType<typeof getScriptAnalystView>> | null = null;
  try { view = await getScriptAnalystView(); } catch { view = null; }
  if (!view || view.scripts.length === 0) return null;

  const header = `CREATIVOS Y GUIONES — período ${fechaRango(desde, hasta)} (guiones analizados, métricas vivas)`;
  const lineas: string[] = [];

  const c = view.counts;
  lineas.push(`- Guiones: ${c.enVista} con señal en vista · ${c.analizadas} analizados · ${c.pendientes} pendientes · ${c.sinTranscript} sin transcript`);

  // Solo videos con retención medible para hook/hold/final
  const videos = view.scripts.filter((s) => !s.esImagen);
  const conSpend = videos.filter((s) => s.spend > 0);

  const top = [...conSpend].sort((a, b) => scoreScript(b) - scoreScript(a)).slice(0, prof === 'rapida' ? 3 : prof === 'profunda' ? 6 : 4);
  const flojos = [...conSpend].sort((a, b) => scoreScript(a) - scoreScript(b)).slice(0, prof === 'rapida' ? 2 : prof === 'profunda' ? 5 : 3);

  if (top.length) lineas.push(`Guiones top:\n${top.map((s) => lineaScript(s)).join('\n')}`);
  if (prof !== 'rapida' && flojos.length) lineas.push(`Guiones flojos:\n${flojos.map((s) => lineaScript(s)).join('\n')}`);

  return bloque(header, lineas);
}

// "Fuerza" del guion para ordenar top vs flojos: prioriza cierres, luego
// retención al final y hook rate (todo dato vivo, sin IA).
function scoreScript(s: ScriptView): number {
  return s.cierres * 1000 + s.agendas * 50 + s.finalRet * 2 + s.hookRate;
}

function lineaScript(s: ScriptView): string {
  const ret = s.esImagen ? 'imagen' : `hook ${pct(s.hookRate)}, final ${pct(s.finalRet)}`;
  return `- "${s.short || s.name}" [${s.angle}]: ${ret}, CTR ${pct(s.ctr)}, ${fmtUSD(s.spend)}, ${s.agendas} agenda(s), ${s.cierres} cierre(s)`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Área: REVENUE Y COBRANZA
// ─────────────────────────────────────────────────────────────────────────────

async function textoRevenue(desde: string, hasta: string, prof: Profundidad): Promise<string | null> {
  const header = `REVENUE Y COBRANZA — período ${fechaRango(desde, hasta)}`;
  const lineas: string[] = [];
  let hayAlgo = false;

  // Revenue del período
  try {
    const rev = await getRevenuePeriod(desde, hasta);
    hayAlgo = true;
    lineas.push(`- Sold (firmado): ${fmtUSD(rev.sold_revenue_usd)} en ${rev.cierres_en_periodo} cierre(s)`);
    lineas.push(`- Cash cobrado: ${fmtUSD(rev.cash_collected_usd)} (${rev.primeros_pagos_en_periodo} primeros pagos) · Outstanding (pipeline): ${fmtUSD(rev.outstanding_usd)}`);
    lineas.push(`- Gasto Meta: ${fmtUSD(rev.meta_spend_usd)} · CAC ${rev.cac_usd !== null ? fmtUSD(rev.cac_usd) : '—'} · ROAS cash ${rev.roas_cash !== null ? `${rev.roas_cash.toFixed(2)}x` : '—'} · ROAS sold ${rev.roas_sold !== null ? `${rev.roas_sold.toFixed(2)}x` : '—'}`);
  } catch { /* omitir sección */ }

  // CAC acumulado (referencia de estado actual)
  if (prof !== 'rapida') {
    try {
      const cac = await getCACAcumulado(hasta);
      if (cac.cierres_total > 0) {
        hayAlgo = true;
        lineas.push(`- CAC acumulado (histórico): ${cac.cac_usd !== null ? fmtUSD(cac.cac_usd) : '—'} (${fmtUSD(cac.spend_total_usd)} / ${cac.cierres_total} cierres)`);
      }
    } catch { /* omitir */ }
  }

  // Cobranza: cuotas vencidas / por vencer
  try {
    const { vencidas, porVencer } = await getCuotasPendientes(hasta);
    if (vencidas.length > 0 || porVencer.length > 0) {
      hayAlgo = true;
      const montoVencido = vencidas.reduce((s, c) => s + c.monto_usd, 0);
      const montoPorVencer = porVencer.reduce((s, c) => s + c.monto_usd, 0);
      lineas.push(`Cobranza:`);
      lineas.push(`- Cuotas vencidas: ${vencidas.length} por ${fmtUSD(montoVencido)} · por vencer (3d): ${porVencer.length} por ${fmtUSD(montoPorVencer)}`);
      if (prof !== 'rapida' && vencidas.length > 0) {
        const det = [...vencidas].sort((a, b) => a.dias - b.dias).slice(0, prof === 'profunda' ? 8 : 4)
          .map((c) => `  · "${c.lead_nombre}" cuota #${c.numero} ${fmtUSD(c.monto_usd)}, vencida hace ${Math.abs(c.dias)}d`);
        lineas.push(`- Vencidas (más atrasadas):\n${det.join('\n')}`);
      }
    }
  } catch { /* omitir */ }

  if (!hayAlgo) return null;
  return bloque(header, lineas);
}

// ─────────────────────────────────────────────────────────────────────────────
// Área: EXPERIMENTOS (sin IA — solo listado)
// ─────────────────────────────────────────────────────────────────────────────

async function textoExperimentos(desde: string, hasta: string, prof: Profundidad): Promise<string | null> {
  let exps: Experimento[] | null = null;
  try { exps = await listExperimentos(); } catch { exps = null; }
  if (!exps || exps.length === 0) return null;

  const activos = exps.filter((e) => e.estado === 'activo');
  const cerrados = exps.filter((e) => e.estado === 'cerrado');
  if (activos.length === 0 && cerrados.length === 0) return null;

  const header = `EXPERIMENTOS — período ${fechaRango(desde, hasta)}`;
  const lineas: string[] = [];

  if (activos.length > 0) {
    const nActivos = prof === 'rapida' ? 4 : prof === 'profunda' ? 20 : 10;
    lineas.push(`En curso (miden, sin conclusión) — ${activos.length}:`);
    for (const e of activos.slice(0, nActivos)) {
      lineas.push(`- "${e.titulo}" mide ${e.metrica_label ?? e.metrica} (${e.direccion})${e.criterio_exito ? ` — éxito: ${e.criterio_exito}` : ''}`);
    }
  }

  if (cerrados.length > 0) {
    const nCerrados = prof === 'rapida' ? 3 : prof === 'profunda' ? 20 : 8;
    const ordenados = [...cerrados].sort((a, b) => (b.cerrado_at ?? '').localeCompare(a.cerrado_at ?? ''));
    lineas.push(`Conclusiones validadas (verdad con datos) — ${cerrados.length}:`);
    for (const e of ordenados.slice(0, nCerrados)) {
      lineas.push(`- [${e.veredicto ?? '?'}] ${e.aprendizaje || e.titulo}`);
    }
  }

  return bloque(header, lineas);
}

// ─────────────────────────────────────────────────────────────────────────────
// Orquestador
// ─────────────────────────────────────────────────────────────────────────────

type Recolector = (desde: string, hasta: string, prof: Profundidad) => Promise<string | null>;

const RECOLECTORES: Record<AreaKey, Recolector> = {
  adquisicion: textoAdquisicion,
  nutricion: textoNutricion,
  conversion: textoConversion,
  creativos: textoCreativos,
  revenue: textoRevenue,
  experimentos: textoExperimentos,
};

/**
 * Recolecta un resumen compacto de texto por cada área seleccionada.
 * - profundidad 'rapida': titulares por área; 'estandar': análisis completo;
 *   'profunda': el máximo detalle disponible.
 * - areas vacío o con todas → recolecta todas, siempre en el orden de AREAS.
 * - Cada área se llama con try/catch: si falla o queda vacía, se omite.
 * - Llama onProgress({ area, label }) ANTES de traer los datos de cada área.
 */
export async function recolectarFuentes(
  desde: string,
  hasta: string,
  opts: { profundidad: Profundidad; areas: AreaKey[] },
  onProgress?: (p: { area: AreaKey; label: string }) => void,
): Promise<Fuente[]> {
  const prof: Profundidad = opts.profundidad ?? 'estandar';
  const todas = AREAS.map((a) => a.key);
  const sel = (!opts.areas || !opts.areas.length) ? todas : todas.filter((k) => opts.areas.includes(k));

  const fuentes: Fuente[] = [];
  for (const key of sel) {
    const label = LABEL_DE[key];
    try {
      onProgress?.({ area: key, label });
    } catch { /* onProgress nunca debe romper la recolección */ }
    try {
      const texto = await RECOLECTORES[key](desde, hasta, prof);
      if (texto && texto.trim().length > 0) fuentes.push({ area: key, label, texto: texto.trim() });
    } catch { /* área omitida ante cualquier fallo */ }
  }
  return fuentes;
}
