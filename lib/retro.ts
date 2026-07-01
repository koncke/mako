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
import { getSupabaseServer } from './supabase';
import { chatClaude } from './anthropic';
import { renderPrompt } from './prompt-render';
import { getMarketingWindow, type MarketingWindow } from './queries';
import { diasAntes, ayerEnTijuana } from './date-utils';
import {
  METRICAS, fmtMetrica, listExperimentos, metricaDef,
  type Direccion, type Experimento,
} from './experimentos';
import { listTareas, type Prioridad } from './todo';

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

function experimentosTexto(exps: Experimento[]): { activos: string; conclusiones: string } {
  const activos = exps.filter((e) => e.estado === 'activo');
  const cerrados = exps.filter((e) => e.estado === 'cerrado');
  const activosTxt = activos.length
    ? activos.map((e) => `- "${e.titulo}" mide ${e.metrica_label ?? e.metrica} (${e.direccion}); sin conclusión todavía`).join('\n')
    : '(ninguno)';
  const conclTxt = cerrados.length
    ? cerrados.map((e) => `- [${e.veredicto ?? '?'}] ${e.aprendizaje || e.titulo}`).join('\n')
    : '(ninguna todavía)';
  return { activos: activosTxt, conclusiones: conclTxt };
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompts (editables vía getPromptText; listos para el registro)
// ─────────────────────────────────────────────────────────────────────────────

const catalogoTexto = (): string =>
  METRICAS.map((m) => `- ${m.key} — ${m.label} (${m.desc}; mejora natural: ${m.mejor})`).join('\n');

export const RETRO_SYSTEM_DEFAULT = `Sos MaKo haciendo la RETROSPECTIVA del negocio de Martín. Te paso el dato duro del funnel del período (ya calculado, con su delta vs el período anterior), los experimentos en curso, las conclusiones ya validadas y las tareas abiertas.

Tu trabajo:
1) RESUMEN (markdown, 4-8 líneas + viñetas): qué pasó en el período, leído sobre el DATO. Sé concreto y usá los números. Enmarcá cualquier causa-efecto como HIPÓTESIS ("el dato sugiere…"), NUNCA como verdad cerrada. Las conclusiones ya validadas SÍ podés afirmarlas y citarlas. No inventes datos que no te pasé.
2) RECOMENDACIONES: una lista corta y priorizada, cada una es "probá esto" (un EXPERIMENTO para validar una hipótesis con datos) o "hacé esto" (una TAREA concreta a ejecutar ya, sin necesidad de experimentar). Preferí pocas y potentes. No repitas experimentos ya en curso.

Para cada experimento elegí UNA métrica del CATÁLOGO (key exacta) como termómetro. Para las tareas, poné prioridad alta/media/baja.

Devolvé SOLO este JSON, sin texto alrededor:
{
  "titulo": "string corto que titule la retro (ej. 'Semana del 1 al 7: el CPL bajó pero cayó la agenda')",
  "resumen": "markdown",
  "recomendaciones": [
    { "tipo": "experimento", "titulo": "...", "hipotesis": "...", "cambio": "la intervención concreta", "metrica": "key del catálogo", "direccion": "subir"|"bajar", "objetivo_valor": number|null, "criterio_exito": "...", "ventana_dias": number, "racional": "..." },
    { "tipo": "tarea", "titulo": "...", "detalle": "qué hacer, concreto", "prioridad": "alta"|"media"|"baja" }
  ]
}

CATÁLOGO DE MÉTRICAS:
{{catalogo}}`;

export const RETRO_USER_DEFAULT = `PERÍODO: {{desde}} a {{hasta}}

DATO DURO DEL FUNNEL (con delta vs período anterior):
{{destacados}}

EXPERIMENTOS EN CURSO (no los repitas):
{{activos}}

CONCLUSIONES YA VALIDADAS (podés afirmarlas):
{{conclusiones}}

TAREAS ABIERTAS EN EL TABLERO:
{{tareas}}

Escribí la retrospectiva y las recomendaciones. Devolvé el JSON.`;

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

/** Genera una retrospectiva del período y la guarda como snapshot. */
export async function generarRetro(desde: string, hasta: string): Promise<Retro> {
  const [{ destacados, snapshot }, exps, tareas] = await Promise.all([
    calcularDestacados(desde, hasta),
    listExperimentos().catch(() => [] as Experimento[]),
    listTareas().catch(() => []),
  ]);
  const { activos, conclusiones } = experimentosTexto(exps);
  const tareasTxt = tareas.filter((t) => t.estado !== 'hecho').length
    ? tareas.filter((t) => t.estado !== 'hecho').map((t) => `- [${t.estado}] ${t.titulo}`).join('\n')
    : '(ninguna)';

  const system = await renderPrompt('experimentos.retro.system', RETRO_SYSTEM_DEFAULT, { catalogo: catalogoTexto() });
  const user = await renderPrompt('experimentos.retro.user', RETRO_USER_DEFAULT, {
    desde, hasta,
    destacados: destacadosTexto(destacados),
    activos, conclusiones, tareas: tareasTxt,
  });

  let titulo = `Retro ${desde} a ${hasta}`;
  let resumen = '';
  let recomendaciones: RetroReco[] = [];
  try {
    const raw = await chatClaude(system, [{ role: 'user', content: user }], { feature: 'experimentos', effort: 'high' });
    const j = parseJson<Record<string, unknown>>(raw);
    if (typeof j.titulo === 'string' && j.titulo.trim()) titulo = j.titulo.trim().slice(0, 160);
    resumen = String(j.resumen ?? '').trim();
    if (Array.isArray(j.recomendaciones)) {
      recomendaciones = (j.recomendaciones as Array<Record<string, unknown>>)
        .map(normalizarReco).filter((x): x is RetroReco => x != null).slice(0, 10);
    }
  } catch (err) {
    resumen = `No se pudo redactar la retrospectiva automática (${err instanceof Error ? err.message : 'error'}). Los destacados de abajo son dato real del período.`;
  }

  const supabase = getSupabaseServer();
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
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from('retros').select(COLS).order('created_at', { ascending: false });
  if (error) throw new Error(`listRetros: ${error.message}`);
  return (data ?? []).map(rowTo);
}

export async function getRetro(id: number): Promise<Retro | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from('retros').select(COLS).eq('id', id).maybeSingle();
  if (error) throw new Error(`getRetro: ${error.message}`);
  return data ? rowTo(data) : null;
}

export async function borrarRetro(id: number): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('retros').delete().eq('id', id);
  if (error) throw new Error(`borrarRetro: ${error.message}`);
}

/** Período por defecto para una retro nueva: últimos 30 días completos. */
export function periodoDefault(dias = 30): { desde: string; hasta: string } {
  const hasta = ayerEnTijuana();
  const desde = diasAntes(hasta, dias - 1);
  return { desde, hasta };
}
