// =============================================================================
// /m/experimentos — el modelo PURO de la pantalla (lo que se escribe, qué se ofrece y con qué rótulo)
// =============================================================================
// Sin React y sin la base: lo llama la page (server) para bajar los datos YA escritos, lo usan los
// componentes de cliente y lo prueba tests/m-experimentos.test.ts. Los números se escriben con los
// formateadores de escritorio (lib/experimentos-formato.ts), nunca con una copia.
//
// ⚠️ LOS RÓTULOS SON LOS DE ESCRITORIO (app/experimentos/*.tsx). Van en `R` y el test los cruza
//    contra el fuente de escritorio: si allá se renombra un botón, esto falla y se renombra acá.
//    Lo único que cambia es «Aceptar» a secas, que en el teléfono lleva su objeto (app/m/_ui/LEEME.md:
//    nunca «Sí/No/Aceptar/Cancelar»).
// =============================================================================

import type { Experimento, ExperimentoConMedicion, Veredicto } from '@/lib/experimentos';
import type { Retro } from '@/lib/retro';
import type {
  Evidencia, FindingTipo, PlanStatus, RetroPlanItem, RetroReporte, RetroSeguimientoItem, SaludArea,
} from '@/lib/retro-reporte';
import { TOOL_LABEL } from '@/lib/retro-reporte';
import type { TabExperimentos } from '@/app/experimentos/tabs';
import { dirLabel, fmtDelta, fmtFechaLarga, fmtVal, rangoHace, RANGOS_ANALISIS } from '@/lib/experimentos-formato';

export type { TabExperimentos };

/** Las cuatro tabs de escritorio, en su orden y con su nombre (app/experimentos/ExperimentosApp.tsx). */
export const VISTAS_EXPERIMENTOS: ReadonlyArray<{ id: TabExperimentos; label: string }> = [
  { id: 'retro', label: 'Retro' },
  { id: 'experiments', label: 'Experiments' },
  { id: 'conclusions', label: 'Conclusions' },
  { id: 'analisis', label: 'Análisis' },
];

/** Las dos vistas de una Retro que entran en el teléfono (app/experimentos/RetroReport.tsx: Overview · Plan · Detail). */
export type VistaRetro = 'overview' | 'plan';
export const VISTAS_RETRO: ReadonlyArray<{ id: VistaRetro; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'plan', label: 'Plan' },
];

/** Los rótulos de escritorio que el teléfono repite. Cada uno sale de un archivo de app/experimentos (el test lo cruza). */
export const R = {
  // ExperimentsTab.tsx
  nuevo: 'Nuevo experimento',
  sinCorrer: 'No hay experimentos corriendo',
  primero: 'Diseñar mi primer experimento',
  guardados: 'Guardados · sin arrancar',
  cerrar: 'Cerrar y concluir',
  descartar: 'Descartar',
  pregunta: '¿Qué quieres probar?',
  disenar: 'Diseñar con MaKo',
  iniciar: 'Iniciar experimento',
  queCambia: 'Qué se cambia',
  criterio: 'Criterio de éxito',
  // ConclusionsTab.tsx
  sinConclusiones: 'Todavía no hay conclusiones',
  // RetroTab.tsx
  sinRetros: 'Todavía no hay retrospectivas',
  nuevaRetro: 'Nueva Retro',
  todas: 'Todas las retros',
  // RetroReport.tsx
  tesis: 'La tesis del período',
  hallazgos: 'Hallazgos',
  planExps: 'Experiments',
  planExp: 'Experiment',
  planTodo: 'To-do',
  seguimiento: 'Lo que quedó del retro pasado',
  paraProbarlo: 'Para poder probarlo',
  motivo: 'Motivo del descarte',
  aceptar: 'Aceptar',
  posponer: 'Posponer',
  deshacer: 'Deshacer',
  sinExps: 'MaKo no recomendó experimentos este período.',
  sinTareas: 'Sin tareas directas este período.',
  // VistaAnalisis.tsx
  antesDeLeer: 'Antes de leer los números',
  cascada: 'La cascada',
  calificaban: 'Los que asistieron y no calificaban',
  creativos: 'Los creativos',
  masTrajeron: 'Los que más trajeron',
  masBaratos: 'Los más baratos por agenda',
  escondidos: 'Los que el ranking por cantidad esconde',
  meta: 'Para llegar a la meta',
  mesAMes: 'Mes a mes',
} as const;

/** Los motivos de un descarte, los de escritorio (RetroReport.tsx, `MOTIVOS`). */
export const MOTIVOS_DESCARTE = ['ya lo probé', 'no aplica al negocio', 'no es prioridad', 'el dato está mal'] as const;

export type TonoM = 'good' | 'warn' | 'bad' | 'info' | 'neutro';

// ── Experiments ──────────────────────────────────────────────────────────────

/** Un experimento EN CURSO, ya escrito (la tarjeta del prototipo y su hoja). */
export type ExpActivoM = {
  id: number;
  titulo: string;
  hipotesis: string;
  cambio: string | null;
  metrica: string;
  /** La píldora de escritorio: «va bien», «en contra» o «sin dato aún». */
  estado: string;
  tono: TonoM;
  /** El color de la línea (una marca, no un texto): el mismo criterio que escritorio. */
  linea: 'good' | 'bad' | 'primary';
  antes: string;
  ahora: string;
  /** «+35.0%»; null si todavía no hay con qué comparar. */
  delta: string | null;
  objetivo: string | null;
  dia: number;
  dias: number;
  /** 0..1 */
  avance: number;
  /** Ya corrió la ventana entera: cerrarlo es lo que sigue. */
  listo: boolean;
  desde: string | null;
  serie: number[];
};

/** Un experimento guardado sin arrancar (las tarjetas de «Guardados · sin arrancar»). */
export type ExpGuardadoM = {
  id: number;
  titulo: string;
  hipotesis: string;
  cambio: string | null;
  metrica: string;
  objetivo: string;
  ventana: string;
};

export function activoM(e: ExperimentoConMedicion): ExpActivoM {
  const m = e.medicion;
  const vaBien = m?.va_bien ?? null;
  const dia = m?.dias_corridos ?? 0;
  const dias = m?.dias_total ?? e.ventana_dias;
  return {
    id: e.id,
    titulo: e.titulo,
    hipotesis: e.hipotesis,
    cambio: e.cambio?.trim() || null,
    metrica: e.metrica_label ?? e.metrica,
    estado: vaBien == null ? 'sin dato aún' : vaBien ? 'va bien' : 'en contra',
    tono: vaBien == null ? 'neutro' : vaBien ? 'good' : 'bad',
    linea: vaBien === true ? 'good' : vaBien === false ? 'bad' : 'primary',
    antes: fmtVal(m?.baseline, e.metrica),
    ahora: fmtVal(m?.actual, e.metrica),
    delta: m?.delta_pct != null ? fmtDelta(m.delta_pct) : null,
    objetivo: e.objetivo_valor != null ? fmtVal(e.objetivo_valor, e.metrica) : null,
    dia,
    dias,
    avance: m ? Math.min(1, Math.max(0, dia / Math.max(1, dias))) : 0,
    listo: m != null && dia >= dias,
    desde: e.fecha_inicio ? fmtFechaLarga(e.fecha_inicio) : null,
    serie: (m?.serie ?? []).map((p) => p.valor).filter((v): v is number => v != null && Number.isFinite(v)),
  };
}

export function guardadoM(e: Experimento): ExpGuardadoM {
  return {
    id: e.id,
    titulo: e.titulo,
    hipotesis: e.hipotesis,
    cambio: e.cambio?.trim() || null,
    metrica: e.metrica_label ?? e.metrica,
    objetivo: dirLabel(e.direccion),
    ventana: diasTexto(e.ventana_dias),
  };
}

export const diasTexto = (n: number): string => `${n} ${n === 1 ? 'día' : 'días'}`;

// ── Conclusions ──────────────────────────────────────────────────────────────

/** Los veredictos con el rótulo de escritorio (ConclusionsTab.tsx, `VER`). */
export const VEREDICTOS: Record<Veredicto, { label: string; tono: TonoM; linea: 'good' | 'bad' | 'warn' }> = {
  validada: { label: 'Validada', tono: 'good', linea: 'good' },
  refutada: { label: 'Refutada', tono: 'bad', linea: 'bad' },
  no_concluyente: { label: 'No concluyente', tono: 'warn', linea: 'warn' },
};

export type ConclusionM = {
  id: number;
  titulo: string;
  veredicto: string;
  tono: TonoM;
  linea: 'good' | 'bad' | 'warn';
  aprendizaje: string;
  metrica: string;
  antes: string;
  despues: string;
  cerrado: string;
  serie: number[];
};

export function conclusionM(e: Experimento): ConclusionM {
  const v = VEREDICTOS[e.veredicto ?? 'no_concluyente'];
  const serie = Array.isArray(e.config?.serie_cierre) ? (e.config!.serie_cierre as Array<{ valor?: unknown }>) : [];
  return {
    id: e.id,
    titulo: e.titulo,
    veredicto: v.label,
    tono: v.tono,
    linea: v.linea,
    aprendizaje: e.aprendizaje?.trim() || '—',
    metrica: e.metrica_label ?? e.metrica,
    antes: fmtVal(e.baseline_valor, e.metrica),
    despues: fmtVal(e.resultado_valor, e.metrica),
    cerrado: fmtFechaLarga(e.cerrado_at),
    serie: serie.map((p) => p?.valor).filter((x): x is number => typeof x === 'number' && Number.isFinite(x)),
  };
}

// ── Retro ────────────────────────────────────────────────────────────────────

export type HallazgoM = {
  id: string;
  tipo: FindingTipo;
  /** El rótulo de la etiqueta de escritorio, sin su glifo (RetroReport.tsx, `BADGE`). */
  tipoLabel: string;
  herramienta: string;
  salud: SaludArea;
  corto: string;
  insight: string;
  fuente: string;
  ev: Evidencia;
  recId: string | null;
};

export type PlanItemM = Pick<RetroPlanItem, 'id' | 'kind' | 'titulo' | 'why' | 'impacto' | 'origen' | 'status'> & {
  prio: RetroPlanItem['prio'] | null;
  destacado: boolean;
  chain: string[];
};

export type ReporteM = {
  tesis: { texto: string; highlight: string | null };
  fuga: { valor: string; unidad: string; titulo: string; texto: string } | null;
  hallazgos: HallazgoM[];
  plan: PlanItemM[];
  seguimiento: RetroSeguimientoItem[];
};

export type RetroM = {
  id: number;
  titulo: string;
  /** «12 oct · 5 recomendaciones» */
  segunda: string;
  /** «2 aceptadas», o null. */
  aceptadas: string | null;
  /** «Corrida el 12 oct 2026 · analiza 1 sep 2026 – 30 sep 2026» (las dos fechas importan: RetroTab.tsx). */
  periodo: string;
  reporte: ReporteM | null;
  /** Las retros de antes del reporte v3: su resumen, en texto. */
  resumen: string;
};

const TIPO_LABEL: Record<FindingTipo, string> = { cruce: 'Cruce', anomalia: 'Anomalía', hallazgo: 'Hallazgo' };

export function planItemM(p: RetroPlanItem): PlanItemM {
  return {
    id: p.id, kind: p.kind, titulo: p.titulo, why: p.why, impacto: p.impacto, origen: p.origen,
    status: p.status, prio: p.prio ?? null, destacado: !!p.destacado, chain: p.chain ?? [],
  };
}

export function reporteM(r: RetroReporte): ReporteM {
  const salud = (id: string): SaludArea => r.areas.find((a) => a.id === id)?.st ?? 'gris';
  return {
    tesis: { texto: r.tesis.texto, highlight: r.tesis.highlight || null },
    fuga: r.fuga ?? null,
    hallazgos: r.findings.map((f) => ({
      id: f.id, tipo: f.tipo, tipoLabel: TIPO_LABEL[f.tipo] ?? 'Hallazgo', herramienta: TOOL_LABEL[f.tool] ?? f.tab,
      salud: salud(f.area), corto: f.short, insight: f.insight, fuente: f.source, ev: f.ev, recId: f.recId ?? null,
    })),
    plan: r.plan.map(planItemM),
    seguimiento: r.seguimiento ?? [],
  };
}

/** «12 oct» (la fecha larga de escritorio sin el año). */
export const fechaSinAno = (iso: string | null | undefined): string => fmtFechaLarga(iso).split(' ').slice(0, 2).join(' ');

export function retroM(r: Retro): RetroM {
  const plan = r.reporte?.plan ?? [];
  const n = plan.length || (r.recomendaciones?.length ?? 0);
  // «Aceptadas», no «aplicadas»: aceptar es decir que sí, no haberlo hecho (RetroTab.tsx, RetroFila).
  const k = plan.filter((p) => p.status?.estado === 'aceptada').length;
  return {
    id: r.id,
    titulo: r.titulo,
    segunda: `${fechaSinAno(r.created_at)} · ${n} ${n === 1 ? 'recomendación' : 'recomendaciones'}`,
    aceptadas: k > 0 ? `${k} aceptada${k === 1 ? '' : 's'}` : null,
    periodo: `Corrida el ${fmtFechaLarga(r.created_at)} · analiza ${fmtFechaLarga(r.periodo_desde)} – ${fmtFechaLarga(r.periodo_hasta)}`,
    reporte: r.reporte ? reporteM(r.reporte) : null,
    resumen: textoPlano(r.resumen ?? ''),
  };
}

/** El mini-markdown del resumen viejo, como texto: sin `**`, sin `#`, las viñetas con «·». */
export function textoPlano(md: string): string {
  return md
    .split('\n')
    .map((l) => l.trim().replace(/^#{1,3}\s+/, '').replace(/^[-*•]\s+/, '· ').replace(/\*\*([^*]+)\*\*/g, '$1'))
    .filter((l, i, a) => l !== '' || (i > 0 && a[i - 1] !== ''))
    .join('\n')
    .trim();
}

/** El estado de una recomendación del plan, con el rótulo de escritorio (RetroReport.tsx, `statusChip`). */
export function estadoDelPlan(st: PlanStatus | undefined): { label: string; tono: TonoM } | null {
  if (!st) return null;
  if (st.estado === 'aceptada') return { label: 'Aceptada', tono: 'good' };
  if (st.estado === 'pospuesta') return { label: 'Pospuesta', tono: 'warn' };
  return { label: st.motivo ? `Descartada · ${st.motivo}` : 'Descartada', tono: 'neutro' };
}

/**
 * Qué se ofrece en la hoja de una recomendación.
 * ⚠️ «Deshacer» una ACEPTADA no se ofrece: en el server sólo borra la marca (lib/retro-pipeline.ts,
 *    `aplicarPlan`), y el experimento y sus tareas quedan corriendo. Un botón que dice «Deshacer» y no
 *    deshace es peor que no tenerlo; el experimento se descarta en Experiments.
 */
export function accionesDelPlan(st: PlanStatus | undefined): 'decidir' | 'deshacer' | 'ninguna' {
  if (!st) return 'decidir';
  return st.estado === 'aceptada' ? 'ninguna' : 'deshacer';
}

export type OpPlan = 'aceptar' | 'posponer' | 'descartar' | 'deshacer';

/** El botón de aceptar, con su objeto. */
export const rotuloAceptar = (kind: PlanItemM['kind']): string => `${R.aceptar} ${kind === 'exp' ? 'experimento' : 'tarea'}`;

/** El toast de una decisión del plan (3-4 palabras). '' = no dice nada (la pantalla ya lo muestra). */
export function toastDelPlan(op: OpPlan, kind: PlanItemM['kind']): string {
  if (op === 'aceptar') return kind === 'exp' ? 'Experimento iniciado' : 'Tarea en el Plan';
  if (op === 'posponer') return 'Pospuesta';
  if (op === 'descartar') return 'Descartada';
  return '';
}

// ── Análisis ─────────────────────────────────────────────────────────────────

/** Cuál de los tres rangos de escritorio es el de la URL (o null: el rango por defecto u otro). */
export function rangoElegido(desde: string | null, hasta: string | null, hoy: Date = new Date()): string | null {
  if (!desde || !hasta) return null;
  for (const r of RANGOS_ANALISIS) {
    const x = rangoHace(r.dias, hoy);
    if (x.desde === desde && x.hasta === hasta) return String(r.dias);
  }
  return null;
}

/** «2026-03» → «mar 2026»; lo que no es un mes queda como vino. */
export function mesTexto(periodo: string): string {
  if (!/^\d{4}-\d{2}$/.test(periodo)) return periodo;
  return fmtFechaLarga(`${periodo}-01`).split(' ').slice(1).join(' ');
}

/** Una advertencia del análisis: su tono (la de «⚠️» es un aviso) y el texto sin el glifo. */
export function advertenciaM(w: string): { tono: 'warn' | 'info'; texto: string } {
  return w.startsWith('⚠️') ? { tono: 'warn', texto: w.replace(/^⚠️\s*/, '') } : { tono: 'info', texto: w };
}

// ── La línea chica (sparkline) ────────────────────────────────────────────────

/** El trazo SVG de una serie en una caja de `ancho`×`alto` (con `m` de margen), o null si no hay dos puntos. */
export function trazoSpark(vals: readonly number[], ancho: number, alto: number, m = 3): string | null {
  const v = vals.filter((x) => Number.isFinite(x));
  if (v.length < 2) return null;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const rango = max - min || 1;
  const paso = (ancho - 2 * m) / (v.length - 1);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return v
    .map((x, i) => `${i === 0 ? 'M' : 'L'}${r1(m + i * paso)} ${r1(max === min ? alto / 2 : alto - m - ((x - min) / rango) * (alto - 2 * m))}`)
    .join(' ');
}

// ── La URL de la pantalla ─────────────────────────────────────────────────────

/** La URL actual con cambios (null saca la clave). Conserva el `?ws=` y todo lo demás. */
export function urlCon(href: string, cambios: Record<string, string | null>): string {
  const u = new URL(href, 'https://x');
  for (const [k, v] of Object.entries(cambios)) {
    if (v == null) u.searchParams.delete(k); else u.searchParams.set(k, v);
  }
  return u.pathname + u.search + u.hash;
}

/** El id de una Retro de la URL (`?retro=12`), o null. */
export function retroDeParam(v: string | null | undefined): number | null {
  const n = Number(v);
  return v && Number.isSafeInteger(n) && n > 0 ? n : null;
}
