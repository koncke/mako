// =============================================================================
// experimentos — hipótesis → prueba medible → aprendizaje con datos
// =============================================================================
// La filosofía del producto: en TODO el dashboard MaKo sugiere, hipotetiza y
// propone EXPERIMENTOS — nunca declara una conclusión como verdad. La única
// vista donde el sistema afirma verdades es /experimentos, y esas verdades están
// respaldadas por el dato medido contra el funnel real.
//
// Un experimento toma una hipótesis en lenguaje natural y la fija en:
//   - una MÉTRICA del catálogo (mapeada a getMarketingWindow → dato real)
//   - una DIRECCIÓN de éxito (subir/bajar)
//   - una VENTANA de medición (días) y, opcional, un objetivo y un presupuesto
//   - un BASELINE medido en la ventana de igual largo previa al inicio.
// Mientras corre, su valor se mide EN VIVO (no se cachea la serie). Al cerrar,
// MaKo lee baseline vs resultado y la serie, y redacta el APRENDIZAJE + veredicto
// (validada | refutada | no_concluyente). Ese es el único lugar donde concluye,
// porque concluye sobre el dato.
//
// IMPORTANTE: este módulo importa SOLO libs ya commiteadas (supabase, anthropic,
// prompt-render, queries, date-utils, format). No depende de trabajo en vuelo.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { chatClaude } from './anthropic';
import { getPromptText, renderPrompt } from './prompt-render';
import { getMarketingWindow, type MarketingWindow } from './queries';
import { hoyEnTijuana, ayerEnTijuana, diasAntes } from './date-utils';
import { fmtUSD, fmtNum } from './format';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type Estado = 'propuesto' | 'activo' | 'cerrado' | 'descartado';
export type Origen = 'mako' | 'manual';
export type Direccion = 'subir' | 'bajar';
export type Veredicto = 'validada' | 'refutada' | 'no_concluyente';
export type Formato = 'usd' | 'pct' | 'num';

/** Punto de la serie diaria/por-tramo de un experimento. */
export type Punto = { fecha: string; valor: number | null };

/** Fila persistida en `experimentos` (snake_case = columnas de la DB). */
export type Experimento = {
  id: number;
  titulo: string;
  hipotesis: string;
  cambio: string | null;
  estado: Estado;
  origen: Origen;
  metrica: string;
  metrica_label: string | null;
  direccion: Direccion;
  objetivo_valor: number | null;
  criterio_exito: string | null;
  baseline_valor: number | null;
  baseline_desde: string | null;
  baseline_hasta: string | null;
  ventana_dias: number;
  presupuesto_usd: number | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  veredicto: Veredicto | null;
  resultado_valor: number | null;
  aprendizaje: string | null;
  cerrado_at: string | null;
  config: Record<string, unknown> | null;
  racional: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
};

/** Medición en vivo de un experimento activo (calculada contra el dato real). */
export type Medicion = {
  baseline: number | null;        // baseline COMPARABLE (mismo largo que lo corrido)
  actual: number | null;
  objetivo: number | null;
  dias_corridos: number;
  dias_total: number;
  delta_pct: number | null;       // variación vs baseline comparable (firmada, en %)
  va_bien: boolean | null;        // ¿se mueve en la dirección de éxito?
  serie: Punto[];                 // evolución por tramo
  desde: string;                  // inicio de la ventana corriente
  hasta: string;                  // último día completo medido
  baseline_desde: string;         // ventana del baseline comparable
  baseline_hasta: string;
};

export type ExperimentoConMedicion = Experimento & { medicion: Medicion | null };

export type ExperimentosView = {
  activos: ExperimentoConMedicion[];
  propuestos: Experimento[];
  aprendizajes: Experimento[];     // cerrados (verdad con datos), más recientes primero
  descartados: Experimento[];
  counts: { activos: number; propuestos: number; cerrados: number; validadas: number };
};

/** Propuesta estructurada que devuelve MaKo a partir de una hipótesis. */
export type Propuesta = {
  titulo: string;
  hipotesis: string;
  cambio: string;
  metrica: string;
  metrica_label: string;
  direccion: Direccion;
  objetivo_valor: number | null;
  criterio_exito: string;
  ventana_dias: number;
  presupuesto_usd: number | null;
  racional: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo de métricas medibles (vocabulario cerrado que ve y usa MaKo)
// ─────────────────────────────────────────────────────────────────────────────
// Cada métrica sabe extraerse de una MarketingWindow (dato real del funnel) y
// cómo se formatea/qué dirección es "mejor" por defecto. La dirección final la
// fija el experimento (la hipótesis manda), no el default.

type MetricaDef = {
  key: string;
  label: string;
  formato: Formato;
  mejor: Direccion;        // dirección natural de mejora (sugerencia)
  desc: string;            // descripción para el prompt de MaKo
  extraer: (w: MarketingWindow) => number | null;
};

const safeDiv = (a: number | null, b: number | null): number | null =>
  a != null && b != null && b > 0 ? a / b : null;

export const METRICAS: MetricaDef[] = [
  { key: 'cpl', label: 'Costo por vista de landing', formato: 'usd', mejor: 'bajar',
    desc: 'spend ÷ vistas de landing', extraer: (w) => w.cpl_global },
  { key: 'cp_form', label: 'Costo por formulario', formato: 'usd', mejor: 'bajar',
    desc: 'spend ÷ formularios completados', extraer: (w) => safeDiv(w.spend_usd, w.leads_count) },
  { key: 'cpc', label: 'Costo por clic', formato: 'usd', mejor: 'bajar',
    desc: 'spend ÷ clics', extraer: (w) => w.cpc_global },
  { key: 'cpm', label: 'CPM (costo por mil impresiones)', formato: 'usd', mejor: 'bajar',
    desc: 'spend ÷ impresiones × 1000', extraer: (w) => w.cpm_global },
  { key: 'cpa', label: 'Costo por agenda', formato: 'usd', mejor: 'bajar',
    desc: 'spend ÷ agendas', extraer: (w) => safeDiv(w.spend_usd, w.reuniones_en_ventana) },
  { key: 'cac', label: 'CAC (costo por cierre)', formato: 'usd', mejor: 'bajar',
    desc: 'spend ÷ cierres en la ventana', extraer: (w) => w.cac },
  { key: 'ctr', label: 'CTR', formato: 'pct', mejor: 'subir',
    desc: 'clics ÷ impresiones (%)', extraer: (w) => w.ctr_global },
  { key: 'tasa_landing', label: 'Tasa impresión → landing', formato: 'pct', mejor: 'subir',
    desc: 'vistas de landing ÷ impresiones (%)', extraer: (w) => pct(w.landing_page_views, w.impressions) },
  { key: 'tasa_form', label: 'Tasa clic → formulario', formato: 'pct', mejor: 'subir',
    desc: 'formularios ÷ clics al enlace (%)', extraer: (w) => pct(w.leads_count, w.link_clicks) },
  { key: 'tasa_agenda', label: 'Tasa formulario → agenda', formato: 'pct', mejor: 'subir',
    desc: 'agendas ÷ formularios (%)', extraer: (w) => pct(w.reuniones_en_ventana, w.leads_count) },
  { key: 'impressions', label: 'Impresiones', formato: 'num', mejor: 'subir',
    desc: 'impresiones servidas (Meta)', extraer: (w) => w.impressions },
  { key: 'landing_page_views', label: 'Vistas de landing', formato: 'num', mejor: 'subir',
    desc: 'vistas de landing (Meta Pixel)', extraer: (w) => w.landing_page_views },
  { key: 'leads_count', label: 'Formularios completados', formato: 'num', mejor: 'subir',
    desc: 'instant forms completados (Meta)', extraer: (w) => w.leads_count },
  // ⚠️ La `key` NO se toca: viaja a la columna `experimentos.metrica` (mig 0047)
  // y renombrarla deja huérfano a todo experimento ya guardado. Lo que sí se
  // corrigió es la `desc`, que es lo ÚNICO que lee MaKo para decidir: decía
  // «fecha de agenda» y el número sale de `fecha_junta_1`.
  { key: 'agendamientos', label: 'Agendas', formato: 'num', mejor: 'subir',
    desc: 'reuniones con fecha en la ventana (leads con fecha_junta_1 en rango)', extraer: (w) => w.reuniones_en_ventana },
  { key: 'vsl_views', label: 'Vistas de VSL', formato: 'num', mejor: 'subir',
    desc: 'vistas del VSL (YouTube)', extraer: (w) => w.vsl_views },
  { key: 'cierres', label: 'Cierres', formato: 'num', mejor: 'subir',
    desc: 'cierres por fecha de cierre en la ventana', extraer: (w) => w.cierres_en_ventana },
  { key: 'spend_usd', label: 'Inversión', formato: 'usd', mejor: 'bajar',
    desc: 'gasto en Meta en la ventana', extraer: (w) => w.spend_usd },
];

const META_BY_KEY = new Map(METRICAS.map((m) => [m.key, m] as const));

function pct(a: number | null, b: number | null): number | null {
  const r = safeDiv(a, b);
  return r == null ? null : r * 100;
}

export function metricaDef(key: string): MetricaDef | undefined {
  return META_BY_KEY.get(key);
}

/** Formatea un valor según el formato de su métrica (para UI y prompts). */
export function fmtMetrica(valor: number | null | undefined, metrica: string): string {
  if (valor == null || !Number.isFinite(valor)) return '—';
  const def = META_BY_KEY.get(metrica);
  const fmt = def?.formato ?? 'num';
  if (fmt === 'usd') return fmtUSD(valor);
  if (fmt === 'pct') return `${valor.toFixed(1)}%`;
  return fmtNum(Math.round(valor));
}

// ─────────────────────────────────────────────────────────────────────────────
// Medición contra el dato real
// ─────────────────────────────────────────────────────────────────────────────

/** Mide el agregado de una métrica en [start, end] (ambos YYYY-MM-DD, inclusive). */
async function medirVentana(metrica: string, start: string, end: string): Promise<number | null> {
  const def = META_BY_KEY.get(metrica);
  if (!def) return null;
  try {
    const w = await getMarketingWindow(start, end);
    const v = def.extraer(w);
    return v != null && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

const diaInclusive = (start: string, end: string): number => {
  const a = Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1, +start.slice(8, 10));
  const b = Date.UTC(+end.slice(0, 4), +end.slice(5, 7) - 1, +end.slice(8, 10));
  return Math.floor((b - a) / 86400000) + 1;
};

/**
 * Serie de la métrica en [start, end], partida en ≤ maxPuntos tramos contiguos.
 * Reutiliza getMarketingWindow por tramo (maneja YouTube/agendas/cierres bien) y
 * corre los tramos en paralelo. Para ventanas cortas → un punto por día.
 */
async function serie(metrica: string, start: string, end: string, maxPuntos = 21): Promise<Punto[]> {
  const def = META_BY_KEY.get(metrica);
  if (!def) return [];
  const dias = diaInclusive(start, end);
  if (dias <= 0) return [];
  const nTramos = Math.min(dias, maxPuntos);
  const base = Math.floor(dias / nTramos);
  const resto = dias % nTramos;

  // Construye los tramos [desde, hasta] cubriendo todo el rango sin huecos.
  const tramos: Array<{ desde: string; hasta: string }> = [];
  let cursor = 0; // offset en días desde `start`
  for (let i = 0; i < nTramos; i++) {
    const len = base + (i < resto ? 1 : 0);
    const desde = diasAntes(start, -cursor);
    const hasta = diasAntes(start, -(cursor + len - 1));
    tramos.push({ desde, hasta });
    cursor += len;
  }

  const valores = await Promise.all(tramos.map((t) => medirVentana(metrica, t.desde, t.hasta)));
  return tramos.map((t, i) => ({ fecha: t.hasta, valor: valores[i] }));
}

/** ¿El valor `actual` mejoró respecto del `baseline` en la dirección de éxito? */
function vaBien(actual: number | null, baseline: number | null, direccion: Direccion): boolean | null {
  if (actual == null || baseline == null) return null;
  return direccion === 'subir' ? actual >= baseline : actual <= baseline;
}

/** Variación firmada vs baseline, en % (positivo = subió). */
function deltaPct(actual: number | null, baseline: number | null): number | null {
  if (actual == null || baseline == null || baseline === 0) return null;
  return ((actual - baseline) / Math.abs(baseline)) * 100;
}

/** Ventana corriente del experimento: [inicio, último día COMPLETO dentro de la ventana]. */
function ventanaCorriente(exp: Experimento): { desde: string; hasta: string; dias: number } {
  const inicio = exp.fecha_inicio as string;
  const hoy = hoyEnTijuana();
  // El dato se ancla al último día completo (ayer), no a hoy (incompleto), y se topa al fin de ventana.
  const finVentana = exp.fecha_fin && exp.fecha_fin < hoy ? exp.fecha_fin : ayerEnTijuana();
  const hasta = finVentana < inicio ? inicio : finVentana;
  return { desde: inicio, hasta, dias: Math.max(1, diaInclusive(inicio, hasta)) };
}

/**
 * Mide un experimento activo en vivo. CLAVE: el baseline se recomputa con la
 * MISMA cantidad de días que lleva corrido el experimento, inmediatamente antes
 * del inicio — así no comparamos una ventana parcial (p.ej. 3 de 14 días) contra
 * una completa, que para métricas acumulativas (conteos, gasto) daría siempre un
 * delta falso. Para tasas/costos da igual; para conteos es lo único honesto.
 */
async function medir(exp: Experimento): Promise<Medicion | null> {
  if (!exp.fecha_inicio) return null;
  const { desde, hasta, dias } = ventanaCorriente(exp);
  const baseHasta = diasAntes(exp.fecha_inicio, 1);          // inicio - 1
  const baseDesde = diasAntes(exp.fecha_inicio, dias);       // inicio - dias_corridos
  const [actual, baseline, serieDias] = await Promise.all([
    medirVentana(exp.metrica, desde, hasta),
    medirVentana(exp.metrica, baseDesde, baseHasta),
    serie(exp.metrica, desde, hasta),
  ]);
  return {
    baseline,
    actual,
    objetivo: exp.objetivo_valor,
    dias_corridos: dias,
    dias_total: exp.ventana_dias,
    delta_pct: deltaPct(actual, baseline),
    va_bien: vaBien(actual, baseline, exp.direccion),
    serie: serieDias,
    desde,
    hasta,
    baseline_desde: baseDesde,
    baseline_hasta: baseHasta,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistencia (CRUD)
// ─────────────────────────────────────────────────────────────────────────────

const COLS = '*';

function rowToExp(r: Record<string, unknown>): Experimento {
  return r as unknown as Experimento;
}

export async function listExperimentos(): Promise<Experimento[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('experimentos').select(COLS).order('created_at', { ascending: false });
  if (error) throw new Error(`listExperimentos: ${error.message}`);
  return (data ?? []).map(rowToExp);
}

export async function getExperimento(id: number): Promise<Experimento | null> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('experimentos').select(COLS).eq('id', id).maybeSingle();
  if (error) throw new Error(`getExperimento: ${error.message}`);
  return data ? rowToExp(data) : null;
}

/** Arma la vista completa: activos (con medición en vivo), propuestos, aprendizajes. */
export async function getExperimentosView(): Promise<ExperimentosView> {
  const todos = await listExperimentos();
  const activos = todos.filter((e) => e.estado === 'activo');
  const propuestos = todos.filter((e) => e.estado === 'propuesto');
  const cerrados = todos.filter((e) => e.estado === 'cerrado');
  const descartados = todos.filter((e) => e.estado === 'descartado');

  // Medición en vivo SOLO de los activos (acota el costo de queries).
  const mediciones = await Promise.all(activos.map((e) => medir(e).catch(() => null)));
  const activosConMed: ExperimentoConMedicion[] = activos.map((e, i) => ({ ...e, medicion: mediciones[i] }));

  return {
    activos: activosConMed,
    propuestos,
    aprendizajes: cerrados,
    descartados,
    counts: {
      activos: activos.length,
      propuestos: propuestos.length,
      cerrados: cerrados.length,
      validadas: cerrados.filter((e) => e.veredicto === 'validada').length,
    },
  };
}

/** Datos mínimos para crear/arrancar un experimento. */
export type NuevoExperimento = {
  titulo: string;
  hipotesis: string;
  cambio?: string | null;
  metrica: string;
  direccion: Direccion;
  objetivo_valor?: number | null;
  criterio_exito?: string | null;
  ventana_dias: number;
  presupuesto_usd?: number | null;
  origen?: Origen;
  racional?: string | null;
  config?: Record<string, unknown> | null;
  arrancar?: boolean; // true → estado 'activo' con baseline medido; false → 'propuesto'
};

function sanea(input: NuevoExperimento) {
  const def = META_BY_KEY.get(input.metrica);
  if (!def) throw new Error(`métrica desconocida: ${input.metrica}`);
  const ventana = Math.max(3, Math.min(90, Math.round(input.ventana_dias || 14)));
  return { def, ventana };
}

/** Crea un experimento. Si arranca, mide el baseline en la ventana previa al inicio. */
export async function crearExperimento(input: NuevoExperimento): Promise<Experimento> {
  const { def, ventana } = sanea(input);
  const supabase = (await getTenantDb());
  const arrancar = input.arrancar ?? true;

  const fila: Record<string, unknown> = {
    titulo: input.titulo.trim() || 'Experimento',
    hipotesis: input.hipotesis.trim(),
    cambio: input.cambio ?? null,
    estado: arrancar ? 'activo' : 'propuesto',
    origen: input.origen ?? 'mako',
    metrica: def.key,
    metrica_label: def.label,
    direccion: input.direccion,
    objetivo_valor: input.objetivo_valor ?? null,
    criterio_exito: input.criterio_exito ?? null,
    ventana_dias: ventana,
    presupuesto_usd: input.presupuesto_usd ?? null,
    racional: input.racional ?? null,
    config: input.config ?? null,
    updated_at: new Date().toISOString(),
  };

  if (arrancar) {
    const inicio = hoyEnTijuana();
    const baselineHasta = diasAntes(inicio, 1);
    const baselineDesde = diasAntes(inicio, ventana);
    const baseline = await medirVentana(def.key, baselineDesde, baselineHasta);
    fila.fecha_inicio = inicio;
    fila.fecha_fin = diasAntes(inicio, -(ventana - 1)); // inicio + (ventana-1) días, inclusive
    fila.baseline_valor = baseline;
    fila.baseline_desde = baselineDesde;
    fila.baseline_hasta = baselineHasta;
  }

  const { data, error } = await supabase.from('experimentos').insert(fila).select(COLS).single();
  if (error) throw new Error(`crearExperimento: ${error.message}`);
  return rowToExp(data);
}

/** Arranca un experimento propuesto: fija fechas y mide el baseline. */
export async function iniciarExperimento(id: number): Promise<Experimento> {
  const exp = await getExperimento(id);
  if (!exp) throw new Error('experimento inexistente');
  if (exp.estado === 'activo') return exp;
  const ventana = Math.max(3, Math.min(90, exp.ventana_dias || 14));
  const inicio = hoyEnTijuana();
  const baselineHasta = diasAntes(inicio, 1);
  const baselineDesde = diasAntes(inicio, ventana);
  const baseline = await medirVentana(exp.metrica, baselineDesde, baselineHasta);
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('experimentos').update({
    estado: 'activo',
    fecha_inicio: inicio,
    fecha_fin: diasAntes(inicio, -(ventana - 1)),
    baseline_valor: baseline,
    baseline_desde: baselineDesde,
    baseline_hasta: baselineHasta,
    updated_at: new Date().toISOString(),
  }).eq('id', id).select(COLS).single();
  if (error) throw new Error(`iniciarExperimento: ${error.message}`);
  return rowToExp(data);
}

export async function descartarExperimento(id: number): Promise<void> {
  const supabase = (await getTenantDb());
  const { error } = await supabase.from('experimentos')
    .update({ estado: 'descartado', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(`descartarExperimento: ${error.message}`);
}

export async function eliminarExperimento(id: number): Promise<void> {
  const supabase = (await getTenantDb());
  const { error } = await supabase.from('experimentos').delete().eq('id', id);
  if (error) throw new Error(`eliminarExperimento: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MaKo: sugerir, idear y redactar el aprendizaje
// ─────────────────────────────────────────────────────────────────────────────

/** Extrae el primer objeto/array JSON de un texto (tolera fences ```json). */
function parseJson<T>(text: string): T {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const s = Math.min(...['{', '['].map((c) => { const i = cleaned.indexOf(c); return i === -1 ? Infinity : i; }));
  const e = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (!Number.isFinite(s) || e <= s) throw new Error('Respuesta sin JSON');
  return JSON.parse(cleaned.slice(s, e + 1)) as T;
}

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  (typeof v === 'string' && (allowed as readonly string[]).includes(v)) ? (v as T) : fallback;

const numOrNull = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const catalogoTexto = (): string =>
  METRICAS.map((m) => `- ${m.key} — ${m.label} (${m.desc}; ${m.formato}; mejora natural: ${m.mejor})`).join('\n');

/** Snapshot compacto del funnel (últimos 30 días) para encuadrar a MaKo. */
export async function snapshotFunnelTexto(dias = 30): Promise<string> {
  try {
    const end = ayerEnTijuana();
    const start = diasAntes(end, dias - 1);
    const w = await getMarketingWindow(start, end);
    const linea = (m: MetricaDef) => `- ${m.label}: ${fmtMetrica(m.extraer(w), m.key)}`;
    return `FUNNEL REAL (últimos ${dias} días, ${start} a ${end}):\n${METRICAS.map(linea).join('\n')}`;
  } catch {
    return 'FUNNEL REAL: sin datos disponibles ahora mismo.';
  }
}

// ── Defaults de prompts (editables vía getPromptText; listos para el registro) ──

export const EXP_SUGGEST_SYSTEM_DEFAULT = `Eres MaKo. Conviertes una HIPÓTESIS de marketing en un EXPERIMENTO medible y honesto.

Reglas:
- Elige UNA sola métrica del CATÁLOGO (devuelve su key EXACTA). Es el único termómetro válido.
- La dirección de éxito ("subir" o "bajar") la manda la hipótesis, no el default de la métrica.
- Propón una ventana de medición razonable en días (entre 3 y 90) según cuánto tarda esa métrica en mover con la muestra del negocio.
- Si tiene sentido, fija un objetivo numérico concreto (objetivo_valor) en la unidad de la métrica; si no, déjalo null.
- "cambio" = la intervención concreta y accionable a probar (qué se toca exactamente).
- NO declares conclusiones ni asegures resultados: estás diseñando una prueba, no afirmando una verdad.
- Devuelve SOLO un objeto JSON, sin texto alrededor.

Forma EXACTA del JSON:
{
  "titulo": "string corto",
  "cambio": "la intervención concreta",
  "metrica": "key del catálogo",
  "direccion": "subir" | "bajar",
  "objetivo_valor": number | null,
  "criterio_exito": "qué cuenta como éxito, en una frase",
  "ventana_dias": number,
  "presupuesto_usd": number | null,
  "racional": "por qué esta métrica y esta ventana (2-3 frases)"
}

CATÁLOGO DE MÉTRICAS:
{{catalogo}}`;

export const EXP_SUGGEST_USER_DEFAULT = `HIPÓTESIS DE MARTÍN:
{{hipotesis}}
{{contexto}}
{{snapshot}}

Diseña el experimento y devuelve el JSON.`;

export const EXP_IDEAS_SYSTEM_DEFAULT = `Eres MaKo. Miras el funnel real del negocio y propones EXPERIMENTOS para correr — nunca conclusiones.

Tu trabajo: encontrar los puntos más flojos o las apuestas con más palanca y convertir cada uno en una hipótesis testeable. Cada idea debe ser algo que se PRUEBA y se MIDE, no algo que afirmas.

Reglas:
- Cada idea elige UNA métrica del CATÁLOGO (key exacta) como termómetro.
- Sé concreto en "cambio" (la intervención) y honesto en "racional" (por qué podría mover la métrica).
- No repitas experimentos que ya están corriendo (te los paso abajo).
- Devuelve SOLO un array JSON de {{n}} objetos, sin texto alrededor.

Forma de cada objeto (idéntica al diseño de un experimento):
{
  "titulo": "string corto",
  "hipotesis": "la apuesta en una frase (¿y si...?)",
  "cambio": "la intervención concreta",
  "metrica": "key del catálogo",
  "direccion": "subir" | "bajar",
  "objetivo_valor": number | null,
  "criterio_exito": "qué contaría como éxito",
  "ventana_dias": number,
  "presupuesto_usd": number | null,
  "racional": "por qué vale la pena probarlo"
}

CATÁLOGO DE MÉTRICAS:
{{catalogo}}`;

export const EXP_IDEAS_USER_DEFAULT = `{{snapshot}}

EXPERIMENTOS YA EN CURSO (no los repitas):
{{enCurso}}

Propón {{n}} experimentos nuevos y devuelve el array JSON.`;

export const EXP_CLOSE_SYSTEM_DEFAULT = `Eres MaKo cerrando un experimento. Aquí SÍ concluyes — pero SOLO sobre el dato medido, nunca sobre la intuición.

Te paso el baseline, el resultado medido, el objetivo (si había) y la serie. Decide el veredicto:
- "validada": el dato respalda la hipótesis con claridad (se movió en la dirección de éxito de forma relevante / alcanzó el objetivo).
- "refutada": el dato la contradice (no se movió o se movió en contra).
- "no_concluyente": la muestra es chica, el movimiento es ruido, o no alcanza para afirmar nada.

El "aprendizaje" es la VERDAD que queda guardada sobre ESTE negocio: una o dos frases, con el número clave adentro (de cuánto a cuánto), sin adornos. Si es no_concluyente, di qué faltó (más días, más muestra) y qué reintentar.

Devuelve SOLO este JSON:
{ "veredicto": "validada" | "refutada" | "no_concluyente", "aprendizaje": "string con el número adentro" }`;

export const EXP_CLOSE_USER_DEFAULT = `EXPERIMENTO: {{titulo}}
Hipótesis: {{hipotesis}}
Cambio probado: {{cambio}}
Métrica: {{metrica_label}} — éxito = {{direccion}}
Criterio de éxito: {{criterio}}

DATO MEDIDO:
- Baseline ({{baseline_rango}}): {{baseline}}
- Resultado ({{resultado_rango}}): {{resultado}}
- Objetivo: {{objetivo}}
- Variación: {{delta}}
- Serie por tramo: {{serie}}

Dictá el veredicto y el aprendizaje en JSON.`;

/** Convierte una hipótesis en lenguaje natural en una propuesta de experimento. */
export async function sugerirExperimento(hipotesis: string, contexto?: string): Promise<Propuesta> {
  const system = await renderPrompt('experimentos.suggest.system', EXP_SUGGEST_SYSTEM_DEFAULT, { catalogo: catalogoTexto() });
  const snapshot = await snapshotFunnelTexto();
  const ctxTxt = contexto && contexto.trim()
    ? `\nCONTEXTO DE MARTÍN (lo que vio o por qué lo cree — úsalo para elegir mejor la métrica y el cambio, sin darlo por hecho):\n"${contexto.trim()}"\n`
    : '';
  const user = await renderPrompt('experimentos.suggest.user', EXP_SUGGEST_USER_DEFAULT, { hipotesis: hipotesis.trim(), contexto: ctxTxt, snapshot });
  const raw = await chatClaude(system, [{ role: 'user', content: user }], { feature: 'experimentos', effort: 'high' });
  const j = parseJson<Record<string, unknown>>(raw);
  return normalizarPropuesta(j, hipotesis);
}

/** Propone ideas de experimentos a partir del funnel (proactivo). */
export async function idearExperimentos(n = 3): Promise<Propuesta[]> {
  const system = await renderPrompt('experimentos.ideas.system', EXP_IDEAS_SYSTEM_DEFAULT, { catalogo: catalogoTexto(), n: String(n) });
  const snapshot = await snapshotFunnelTexto();
  const activos = (await listExperimentos()).filter((e) => e.estado === 'activo' || e.estado === 'propuesto');
  const enCurso = activos.length
    ? activos.map((e) => `- ${e.titulo} (${e.metrica_label ?? e.metrica})`).join('\n')
    : '(ninguno)';
  const user = await renderPrompt('experimentos.ideas.user', EXP_IDEAS_USER_DEFAULT, { snapshot, enCurso, n: String(n) });
  const raw = await chatClaude(system, [{ role: 'user', content: user }], { feature: 'experimentos', effort: 'high' });
  const arr = parseJson<Array<Record<string, unknown>>>(raw);
  if (!Array.isArray(arr)) throw new Error('ideas: respuesta no es un array');
  return arr.slice(0, n).map((j) => normalizarPropuesta(j, String(j.hipotesis ?? '')));
}

function normalizarPropuesta(j: Record<string, unknown>, hipotesis: string): Propuesta {
  const metrica = META_BY_KEY.has(String(j.metrica)) ? String(j.metrica) : 'cpl';
  const def = META_BY_KEY.get(metrica)!;
  const ventana = Math.max(3, Math.min(90, Math.round(numOrNull(j.ventana_dias) ?? 14)));
  return {
    titulo: String(j.titulo ?? '').slice(0, 120) || 'Experimento',
    hipotesis: (String(j.hipotesis ?? '') || hipotesis).trim(),
    cambio: String(j.cambio ?? '').trim(),
    metrica,
    metrica_label: def.label,
    direccion: oneOf<Direccion>(j.direccion, ['subir', 'bajar'], def.mejor),
    objetivo_valor: numOrNull(j.objetivo_valor),
    criterio_exito: String(j.criterio_exito ?? '').trim(),
    ventana_dias: ventana,
    presupuesto_usd: numOrNull(j.presupuesto_usd),
    racional: String(j.racional ?? '').trim(),
  };
}

/** Cierra un experimento: mide el resultado y deja que MaKo dicte veredicto + aprendizaje. */
export async function cerrarExperimento(id: number): Promise<Experimento> {
  const exp = await getExperimento(id);
  if (!exp) throw new Error('experimento inexistente');
  if (!exp.fecha_inicio) throw new Error('el experimento no arrancó');

  const med = await medir(exp);
  const resultado = med?.actual ?? null;
  // Baseline COMPARABLE (mismo largo que lo corrido) y rango, reusados de medir()
  // para que el veredicto compare manzanas con manzanas y el texto no se invierta.
  const baseline = med?.baseline ?? exp.baseline_valor;
  const hasta = med?.hasta ?? (exp.fecha_fin && exp.fecha_fin < hoyEnTijuana() ? exp.fecha_fin : ayerEnTijuana());
  const baseDesde = med?.baseline_desde ?? exp.baseline_desde;
  const baseHasta = med?.baseline_hasta ?? exp.baseline_hasta;

  const def = META_BY_KEY.get(exp.metrica);
  const serieTxt = (med?.serie ?? []).map((p) => `${p.fecha}=${fmtMetrica(p.valor, exp.metrica)}`).join(', ') || '(sin serie)';

  const system = await getPromptText('experimentos.close.system', EXP_CLOSE_SYSTEM_DEFAULT);
  const user = await renderPrompt('experimentos.close.user', EXP_CLOSE_USER_DEFAULT, {
    titulo: exp.titulo,
    hipotesis: exp.hipotesis,
    cambio: exp.cambio ?? '(sin especificar)',
    metrica_label: exp.metrica_label ?? def?.label ?? exp.metrica,
    direccion: exp.direccion,
    criterio: exp.criterio_exito ?? '(sin criterio explícito)',
    baseline_rango: `${baseDesde ?? '?'} a ${baseHasta ?? '?'}`,
    baseline: fmtMetrica(baseline, exp.metrica),
    resultado_rango: `${exp.fecha_inicio} a ${hasta}`,
    resultado: fmtMetrica(resultado, exp.metrica),
    objetivo: exp.objetivo_valor != null ? fmtMetrica(exp.objetivo_valor, exp.metrica) : 'sin objetivo numérico',
    delta: med?.delta_pct != null ? `${med.delta_pct > 0 ? '+' : ''}${med.delta_pct.toFixed(1)}%` : 'n/d',
    serie: serieTxt,
  });

  let veredicto: Veredicto = 'no_concluyente';
  let aprendizaje = '';
  try {
    const raw = await chatClaude(system, [{ role: 'user', content: user }], { feature: 'experimentos', effort: 'high' });
    const j = parseJson<Record<string, unknown>>(raw);
    veredicto = oneOf<Veredicto>(j.veredicto, ['validada', 'refutada', 'no_concluyente'], 'no_concluyente');
    aprendizaje = String(j.aprendizaje ?? '').trim();
  } catch {
    // Sin IA: queda no_concluyente con un aprendizaje numérico mínimo.
    aprendizaje = `De ${fmtMetrica(baseline, exp.metrica)} a ${fmtMetrica(resultado, exp.metrica)} en ${exp.metrica_label ?? exp.metrica}. No se pudo redactar la lectura automática.`;
  }

  const config = { ...(exp.config ?? {}), serie_cierre: med?.serie ?? [] };
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('experimentos').update({
    estado: 'cerrado',
    veredicto,
    aprendizaje,
    // Guardamos el baseline comparable (mismo largo que lo corrido) para que la
    // tarjeta de aprendizaje muestre baseline → resultado manzanas con manzanas.
    baseline_valor: baseline,
    baseline_desde: baseDesde,
    baseline_hasta: baseHasta,
    resultado_valor: resultado,
    cerrado_at: new Date().toISOString(),
    config,
    updated_at: new Date().toISOString(),
  }).eq('id', id).select(COLS).single();
  if (error) throw new Error(`cerrarExperimento: ${error.message}`);
  return rowToExp(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Resumen para el contexto de MaKo (las verdades viven acá)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bloque de texto para inyectar en el system prompt de MaKo en todo el dashboard:
 * las VERDADES VALIDADAS (aprendizajes cerrados y validados) y los experimentos
 * en curso. Sirve para que MaKo cite lo ya probado y, para lo no probado, sugiera
 * abrir un experimento en vez de concluir.
 */
export async function resumenExperimentos(): Promise<string> {
  let todos: Experimento[];
  try {
    todos = await listExperimentos();
  } catch {
    return '';
  }
  const validadas = todos.filter((e) => e.estado === 'cerrado' && e.veredicto === 'validada');
  const activos = todos.filter((e) => e.estado === 'activo');
  if (!validadas.length && !activos.length) return '';

  const partes: string[] = [];
  if (validadas.length) {
    const lineas = validadas.slice(0, 12).map((e) => `- ${e.aprendizaje || e.titulo}`).join('\n');
    partes.push(`VERDADES VALIDADAS (lo ÚNICO probado con datos en este negocio — citá esto cuando aplique):\n${lineas}`);
  }
  if (activos.length) {
    const lineas = activos.slice(0, 12).map((e) => `- "${e.titulo}" mide ${e.metrica_label ?? e.metrica} (sin verdad todavía)`).join('\n');
    partes.push(`EXPERIMENTOS EN CURSO (todavía sin conclusión — no adelantes el resultado):\n${lineas}`);
  }
  return partes.join('\n\n');
}
