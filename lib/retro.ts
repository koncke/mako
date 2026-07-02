// =============================================================================
// retro — retrospectivas de /experimentos (tab Retro)
// =============================================================================
// MaKo lee el funnel real + los experimentos + las conclusiones + las tareas de
// un período y produce:
//   - destacados: métricas clave del funnel con su delta vs el período anterior
//     de igual largo (DATO duro, calculado acá, no inventado por MaKo).
//   - resumen: reporte narrativo (MaKo interpreta el dato; enmarca causa-efecto
//     como hipótesis, salvo las conclusiones ya validadas).
//   - recomendaciones: separadas en "probá esto" (→ experimento) y "hacé esto"
//     (→ tarea), listas para aplicar con 1 clic.
// Se guarda como snapshot histórico para comparar retros en el tiempo.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { chatClaude } from './anthropic';
import { getPromptText, renderPrompt } from './prompt-render';
import { getMarketingWindow, type MarketingWindow } from './queries';
import { diasAntes, ayerEnTijuana } from './date-utils';
import { METRICAS, fmtMetrica, metricaDef, type Direccion } from './experimentos';
import { type Prioridad } from './todo';
import { recolectarFuentes, AREAS, type AreaKey, type Fuente } from './retro-fuentes';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type Tono = 'good' | 'bad' | 'neutral';

export type RetroDestacado = {
  metrica: string;
  label: string;
  valor: string;          // valor del período, formateado
  valor_prev: string;     // valor del período anterior, formateado
  delta: number | null;   // variación % vs período anterior (firmada)
  tono: Tono;             // ¿mejoró o empeoró, según la dirección natural?
};

export type RetroRecoExperimento = {
  tipo: 'experimento';
  titulo: string; hipotesis: string; cambio: string;
  metrica: string; direccion: Direccion; objetivo_valor: number | null;
  criterio_exito: string; ventana_dias: number; racional: string;
};
export type RetroRecoTarea = {
  tipo: 'tarea';
  titulo: string; detalle: string; prioridad: Prioridad;
};
export type RetroReco = RetroRecoExperimento | RetroRecoTarea;

export type Retro = {
  id: number;
  periodo_desde: string;
  periodo_hasta: string;
  titulo: string;
  resumen: string;
  destacados: RetroDestacado[] | null;
  recomendaciones: RetroReco[] | null;
  snapshot: Record<string, unknown> | null;
  model: string | null;
  created_at: string;
};

const COLS = '*';
const rowTo = (r: Record<string, unknown>): Retro => r as unknown as Retro;

// ─────────────────────────────────────────────────────────────────────────────
// Destacados (DATO duro: métricas del período vs período anterior de igual largo)
// ─────────────────────────────────────────────────────────────────────────────

const DESTACADOS: string[] = ['spend_usd', 'leads_count', 'cp_form', 'agendamientos', 'cpa', 'cierres', 'cac'];

const diaInclusive = (a: string, b: string): number =>
  Math.floor((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) -
    Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000) + 1;

async function calcularDestacados(desde: string, hasta: string): Promise<{ destacados: RetroDestacado[]; snapshot: Record<string, unknown> }> {
  const dias = Math.max(1, diaInclusive(desde, hasta));
  const prevHasta = diasAntes(desde, 1);
  const prevDesde = diasAntes(desde, dias);
  let w: MarketingWindow | null = null;
  let wPrev: MarketingWindow | null = null;
  try { w = await getMarketingWindow(desde, hasta); } catch { /* sin datos */ }
  try { wPrev = await getMarketingWindow(prevDesde, prevHasta); } catch { /* sin datos */ }

  const destacados: RetroDestacado[] = DESTACADOS.map((key) => {
    const def = metricaDef(key);
    const val = w && def ? def.extraer(w) : null;
    const prev = wPrev && def ? def.extraer(wPrev) : null;
    const delta = val != null && prev != null && prev !== 0 ? ((val - prev) / Math.abs(prev)) * 100 : null;
    let tono: Tono = 'neutral';
    if (delta != null && Math.abs(delta) >= 3 && def) {
      const subioBien = def.mejor === 'subir' ? delta > 0 : delta < 0;
      tono = subioBien ? 'good' : 'bad';
    }
    return {
      metrica: key,
      label: def?.label ?? key,
      valor: fmtMetrica(val, key),
      valor_prev: fmtMetrica(prev, key),
      delta,
      tono,
    };
  });

  const snapshot: Record<string, unknown> = { desde, hasta, prevDesde, prevHasta };
  if (w) for (const m of METRICAS) snapshot[m.key] = m.extraer(w);
  return { destacados, snapshot };
}

// Texto compacto de los destacados para el prompt de MaKo.
function destacadosTexto(d: RetroDestacado[]): string {
  return d.map((x) => {
    const delta = x.delta != null ? ` (${x.delta > 0 ? '+' : ''}${x.delta.toFixed(1)}% vs período anterior, ${x.tono === 'good' ? 'mejor' : x.tono === 'bad' ? 'peor' : 'igual'})` : '';
    return `- ${x.label}: ${x.valor}${delta}`;
  }).join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompts (editables vía getPromptText; listos para el registro)
// ─────────────────────────────────────────────────────────────────────────────

const catalogoTexto = (): string =>
  METRICAS.map((m) => `- ${m.key} — ${m.label} (${m.desc}; mejora natural: ${m.mejor})`).join('\n');

export const RETRO_SYSTEM_DEFAULT = `Sos MaKo haciendo la RETROSPECTIVA del negocio de Martín. Te paso el DATO DURO del funnel del período (ya calculado, con su delta vs el período anterior) y RESÚMENES POR ÁREA (adquisición, nutrición, conversión, creativos, revenue/cobranza, experimentos) con sus números.

Tu trabajo:
1) RESUMEN (markdown): qué pasó en el período, leído sobre el DATO, cruzando las áreas. Contá una historia clara y accionable — dónde está la palanca. Sé concreto y usá los números. Enmarcá cualquier causa-efecto como HIPÓTESIS ("el dato sugiere…"), NUNCA como verdad cerrada. Las conclusiones ya validadas SÍ podés afirmarlas y citarlas. No inventes datos que no te pasé.
2) RECOMENDACIONES: una lista corta y priorizada, cada una es "probá esto" (un EXPERIMENTO para validar una hipótesis con datos) o "hacé esto" (una TAREA concreta a ejecutar ya, sin necesidad de experimentar). Preferí pocas y potentes. No repitas experimentos ya en curso.

Si Martín te deja una PERSPECTIVA, tratala como una HIPÓTESIS suya, no como un hecho: puede estar equivocado. Contrastala contra el dato — si el dato la respalda, decilo; si la contradice, decilo con respeto y con el número. Nunca ajustes el análisis para darle la razón.

Para cada experimento elegí UNA métrica del CATÁLOGO (key exacta) como termómetro. Para las tareas, poné prioridad alta/media/baja.

Devolvé SOLO este JSON, sin texto alrededor:
{
  "titulo": "string corto que titule la retro (ej. 'Junio: el CPL bajó pero cayó la agenda')",
  "resumen": "markdown",
  "recomendaciones": [
    { "tipo": "experimento", "titulo": "...", "hipotesis": "...", "cambio": "la intervención concreta", "metrica": "key del catálogo", "direccion": "subir"|"bajar", "objetivo_valor": number|null, "criterio_exito": "...", "ventana_dias": number, "racional": "..." },
    { "tipo": "tarea", "titulo": "...", "detalle": "qué hacer, concreto", "prioridad": "alta"|"media"|"baja" }
  ]
}

CATÁLOGO DE MÉTRICAS:
{{catalogo}}`;

export const RETRO_USER_DEFAULT = `{{profundidad}}{{perspectiva}}
DATO DURO DEL FUNNEL (con delta vs período anterior):
{{destacados}}

RESÚMENES POR ÁREA:
{{fuentes}}

Escribí la retrospectiva cruzando las áreas y las recomendaciones. Devolvé el JSON.`;

// Sistema para la pasada "área por área" (solo en profundidad profunda).
export const RETRO_AREA_SYSTEM_DEFAULT = `Sos MaKo analizando UNA área del negocio de Martín dentro de una retrospectiva. Te paso el resumen con los números de esa área. Devolvé 3-6 viñetas con los INSIGHTS clave: qué está pasando (con el número), dónde está la palanca y qué hipótesis vale probar. Enmarcá causa-efecto como hipótesis, no como verdad. No inventes datos. Solo las viñetas, sin JSON ni preámbulo.`;

// ─────────────────────────────────────────────────────────────────────────────
// Parseo / normalización
// ─────────────────────────────────────────────────────────────────────────────

function parseJson<T>(text: string): T {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const s = cleaned.indexOf('{');
  const e = cleaned.lastIndexOf('}');
  if (s === -1 || e <= s) throw new Error('Retro: respuesta sin JSON');
  return JSON.parse(cleaned.slice(s, e + 1)) as T;
}

const numOrNull = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fb: T): T =>
  (typeof v === 'string' && (allowed as readonly string[]).includes(v)) ? (v as T) : fb;

function normalizarReco(j: Record<string, unknown>): RetroReco | null {
  const tipo = j.tipo === 'tarea' ? 'tarea' : 'experimento';
  if (tipo === 'tarea') {
    const titulo = String(j.titulo ?? '').trim();
    if (!titulo) return null;
    return { tipo, titulo: titulo.slice(0, 140), detalle: String(j.detalle ?? '').trim(), prioridad: oneOf<Prioridad>(j.prioridad, ['alta', 'media', 'baja'], 'media') };
  }
  const metrica = metricaDef(String(j.metrica)) ? String(j.metrica) : 'cpl';
  const def = metricaDef(metrica)!;
  const titulo = String(j.titulo ?? '').trim();
  if (!titulo) return null;
  return {
    tipo: 'experimento',
    titulo: titulo.slice(0, 140),
    hipotesis: String(j.hipotesis ?? '').trim(),
    cambio: String(j.cambio ?? '').trim(),
    metrica,
    direccion: oneOf<Direccion>(j.direccion, ['subir', 'bajar'], def.mejor),
    objetivo_valor: numOrNull(j.objetivo_valor),
    criterio_exito: String(j.criterio_exito ?? '').trim(),
    ventana_dias: Math.max(3, Math.min(90, Math.round(numOrNull(j.ventana_dias) ?? 14))),
    racional: String(j.racional ?? '').trim(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Generación + persistencia
// ─────────────────────────────────────────────────────────────────────────────

export type Profundidad = 'rapida' | 'estandar' | 'profunda';
export type OpcionesRetro = { perspectiva?: string; profundidad?: Profundidad; areas?: AreaKey[] };
export type RetroProgreso = { fase: string; label: string };

const EFFORT_POR_PROF: Record<Profundidad, 'medium' | 'high' | 'xhigh'> = { rapida: 'medium', estandar: 'high', profunda: 'xhigh' };
const PROF_TXT: Record<Profundidad, string> = {
  rapida: 'PROFUNDIDAD: lectura rápida — lo esencial y 1-2 recomendaciones.',
  estandar: 'PROFUNDIDAD: estándar — análisis completo y plan priorizado.',
  profunda: 'PROFUNDIDAD: profunda — cruzá todas las señales, buscá causas de segundo orden y sé exhaustivo con el plan.',
};

const perspectivaTexto = (p?: string) => (p && p.trim()
  ? `\nPERSPECTIVA DE MARTÍN (su hipótesis, puede estar equivocada — verificala contra el dato, NO la asumas): "${p.trim()}"\n`
  : '');

/** La síntesis final: MaKo escribe el resumen + recomendaciones sobre los destacados y las fuentes/insights. */
async function sintetizar(
  destacados: RetroDestacado[], contexto: string, perspectivaTxt: string, prof: Profundidad, tituloFallback: string,
): Promise<{ titulo: string; resumen: string; recomendaciones: RetroReco[] }> {
  const system = await renderPrompt('experimentos.retro.system', RETRO_SYSTEM_DEFAULT, { catalogo: catalogoTexto() });
  const user = await renderPrompt('experimentos.retro.user', RETRO_USER_DEFAULT, {
    profundidad: `${PROF_TXT[prof]}\n`,
    perspectiva: perspectivaTxt,
    destacados: destacadosTexto(destacados),
    fuentes: contexto || '(sin resúmenes de área disponibles)',
  });
  const raw = await chatClaude(system, [{ role: 'user', content: user }], { feature: 'experimentos', effort: EFFORT_POR_PROF[prof] });
  const j = parseJson<Record<string, unknown>>(raw);
  const titulo = typeof j.titulo === 'string' && j.titulo.trim() ? j.titulo.trim().slice(0, 160) : tituloFallback;
  const resumen = String(j.resumen ?? '').trim();
  const recomendaciones = Array.isArray(j.recomendaciones)
    ? (j.recomendaciones as Array<Record<string, unknown>>).map(normalizarReco).filter((x): x is RetroReco => x != null).slice(0, 12)
    : [];
  return { titulo, resumen, recomendaciones };
}

/**
 * Genera una retrospectiva del período y la guarda como snapshot.
 * `onProgress` recibe cada paso (para transmitirlo en vivo al cliente).
 * En profundidad 'profunda' analiza ÁREA POR ÁREA (una pasada de insights por área)
 * y luego sintetiza; en 'rapida'/'estandar' hace una sola pasada.
 */
export async function generarRetro(
  desde: string, hasta: string, opts: OpcionesRetro = {}, onProgress?: (p: RetroProgreso) => void,
): Promise<Retro> {
  const prof: Profundidad = opts.profundidad && EFFORT_POR_PROF[opts.profundidad] ? opts.profundidad : 'estandar';
  const step = (fase: string, label: string) => { try { onProgress?.({ fase, label }); } catch { /* noop */ } };
  const perspectivaTxt = perspectivaTexto(opts.perspectiva);

  // 1) Dato duro (destacados) — lo calcula el código, no MaKo.
  step('destacados', 'Midiendo el funnel del período…');
  const { destacados, snapshot } = await calcularDestacados(desde, hasta);

  // 2) Áreas efectivas (siempre sumamos experimentos como contexto de conclusiones).
  const pedidas = opts.areas && opts.areas.length ? opts.areas : AREAS.map((a) => a.key);
  const areasEff = Array.from(new Set<AreaKey>([...pedidas, 'experimentos']));

  // 3) Recolectar las fuentes de cada área (streamea el progreso por área).
  const fuentes = await recolectarFuentes(desde, hasta, { profundidad: prof, areas: areasEff },
    (p) => step(`fuente:${p.area}`, `Leyendo ${p.label}…`)).catch(() => [] as Fuente[]);

  let titulo = `Retro ${desde} a ${hasta}`;
  let resumen = '';
  let recomendaciones: RetroReco[] = [];

  try {
    if (prof === 'profunda' && fuentes.length) {
      const insights: string[] = [];
      for (const f of fuentes) {
        step(`insight:${f.area}`, `Sacando insights de ${f.label}…`);
        const ins = await chatClaude(
          await getPromptText('experimentos.retro.area_system', RETRO_AREA_SYSTEM_DEFAULT),
          [{ role: 'user', content: `${f.texto}\n${perspectivaTxt}` }],
          { feature: 'experimentos', effort: 'high' },
        ).catch(() => '');
        if (ins.trim()) insights.push(`## ${f.label}\n${ins.trim()}`);
      }
      step('sintesis', 'MaKo está sintetizando la retrospectiva…');
      ({ titulo, resumen, recomendaciones } = await sintetizar(destacados, insights.join('\n\n'), perspectivaTxt, prof, titulo));
    } else {
      step('sintesis', 'MaKo está escribiendo la retrospectiva…');
      const fuentesTxt = fuentes.map((f) => f.texto).join('\n\n');
      ({ titulo, resumen, recomendaciones } = await sintetizar(destacados, fuentesTxt, perspectivaTxt, prof, titulo));
    }
  } catch (err) {
    resumen = `No se pudo redactar la retrospectiva automática (${err instanceof Error ? err.message : 'error'}). Los destacados de abajo son dato real del período.`;
  }

  snapshot.perspectiva = opts.perspectiva?.trim() || null;
  snapshot.profundidad = prof;
  snapshot.areas = pedidas;
  snapshot.fuentes = fuentes.map((f) => f.label);

  step('guardando', 'Guardando la retrospectiva…');
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('retros').insert({
    periodo_desde: desde,
    periodo_hasta: hasta,
    titulo,
    resumen,
    destacados,
    recomendaciones,
    snapshot,
    model: 'claude-opus-4-8',
  }).select(COLS).single();
  if (error) throw new Error(`generarRetro: ${error.message}`);
  return rowTo(data);
}

export async function listRetros(): Promise<Retro[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('retros').select(COLS).order('created_at', { ascending: false });
  if (error) throw new Error(`listRetros: ${error.message}`);
  return (data ?? []).map(rowTo);
}

export async function getRetro(id: number): Promise<Retro | null> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('retros').select(COLS).eq('id', id).maybeSingle();
  if (error) throw new Error(`getRetro: ${error.message}`);
  return data ? rowTo(data) : null;
}

export async function borrarRetro(id: number): Promise<void> {
  const supabase = (await getTenantDb());
  const { error } = await supabase.from('retros').delete().eq('id', id);
  if (error) throw new Error(`borrarRetro: ${error.message}`);
}

/** Período por defecto para una retro nueva: últimos 30 días completos. */
export function periodoDefault(dias = 30): { desde: string; hasta: string } {
  const hasta = ayerEnTijuana();
  const desde = diasAntes(hasta, dias - 1);
  return { desde, hasta };
}

/** Período "todo el histórico": desde el primer día con datos de marketing hasta ayer. */
export async function periodoHistorico(): Promise<{ desde: string; hasta: string }> {
  const hasta = ayerEnTijuana();
  let desde = diasAntes(hasta, 729); // fallback: ~2 años
  try {
    const supabase = (await getTenantDb());
    const { data } = await supabase.from('marketing_metrics_daily').select('fecha').order('fecha', { ascending: true }).limit(1);
    const f = data && data[0] ? (data[0] as { fecha?: string }).fecha : null;
    if (f && /^\d{4}-\d{2}-\d{2}/.test(f)) desde = f.slice(0, 10);
  } catch { /* sin datos → fallback */ }
  return { desde: desde < hasta ? desde : hasta, hasta };
}
