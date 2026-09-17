// =============================================================================
// api-mako/areas/closing.helpers — lo que el área closing necesita y ninguna lib
// exporta todavía
// =============================================================================
// DEUDA, a propósito y escrita: cada pieza de acá debería vivir en lib/closing.ts
// (o en un lib/closing-metricas.ts sin server-only) y la usarían también la
// pantalla y las actions. Hoy:
//   · Las métricas (closers, factores, tendencia, embudo) viven SOLO en el useMemo
//     `ag` de app/closing/ClosingBrowser.tsx. Se copian acá con el MISMO criterio
//     (mismas 7 dimensiones, mean sin nulos, mes UTC): si cambia uno, cambia el otro.
//   · No hay lectura de UNA fila por recording_id: hay cuatro selects distintos.
//   · leadTieneLlamada es la server action de app/crm/insights-actions.ts, pero
//     PAGINADA: la original barre closing_analyses con un select pelado que corta
//     en 1000 filas sin avisar.
//   · La orquestación «candado → after() → resumen → cerrar» vive solo en la ruta
//     app/api/closing/analizar-lead/route.ts.
//
// Solo lee, salvo `enSegundoPlano`, que agenda trabajo que corre DESPUÉS de la
// respuesta y lo llama únicamente ejecutar(). Todo por getTenantDb().
// =============================================================================

import 'server-only';
import { after } from 'next/server';
import { getTenantDb, runWithWorkspace } from '@/lib/workspace';
import { leerTodo, PAGINA_POSTGREST } from '@/lib/supabase-paginado';
import type { ClosingAnalysisRow } from '@/lib/closing';

export const DIMS7 = ['Situación', 'Problema', 'Implicación', 'Necesidad / beneficio', 'Presentación de la propuesta', 'Manejo de objeciones', 'CTA / siguientes pasos'] as const;

// ── Lecturas puntuales ───────────────────────────────────────────────────────

const COLS_DETALLE =
  'recording_id, call_url, share_url, embed_token, title, call_date, started_at, duration_min, closer, invitee_email, ' +
  'lead_id, lead_nombre, lead_empresa, category, origen_clasif, tipo, score, outcome, outcome_tone, summary, next_step, ' +
  'dims, moments, recs, strengths, weaknesses, objections, has_transcript, edit_history, status, error, model, analyzed_at';

/** UNA fila de closing_analyses de este workspace, en cualquier estado. score ya es número. */
export async function leerLlamada(recordingId: number): Promise<ClosingAnalysisRow | null> {
  const { data, error } = await (await getTenantDb())
    .from('closing_analyses').select(COLS_DETALLE).eq('recording_id', recordingId).maybeSingle();
  if (error) throw new Error(`api-mako: no pude leer el análisis ${recordingId}: ${error.message}`);
  if (!data) return null;
  const fila = data as unknown as ClosingAnalysisRow;
  // PostgREST serializa NUMERIC como string.
  return { ...fila, score: fila.score == null || !Number.isFinite(Number(fila.score)) ? null : Number(fila.score) };
}

/** Cuántas filas de closing_analyses hay (todas, o ventas analizadas). null = no se pudo contar. */
export async function contarAnalisis(soloVentasAnalizadas: boolean): Promise<number | null> {
  let q = (await getTenantDb()).from('closing_analyses').select('recording_id', { count: 'exact', head: true });
  if (soloVentasAnalizadas) q = q.eq('category', 'venta').eq('status', 'analizada');
  const { count, error } = await q;
  return error || typeof count !== 'number' ? null : count;
}

/** La salvedad cuando getClosingViewData (sin paginar) pudo quedar corta. null = completo. */
export function avisoRecorteClosing(filas: number | null, que: string): string | null {
  if (filas == null) return `No se pudo comprobar si ${que} está completo: tómalo como aproximado.`;
  if (filas > PAGINA_POSTGREST) return `${que} está calculado sobre ${PAGINA_POSTGREST} de ${filas} filas (la lectura no pagina): no lo presentes como exacto.`;
  return null;
}

export type FilaProblema = { recording_id: number; title: string | null; call_date: string | null; lead_id: number | null; lead_nombre: string | null; category: string; status: string; error: string | null; has_transcript: boolean | null; updated_at: string | null };

/** Las filas con error (cualquier categoría) y las ventas pendientes, más recientes primero. */
export async function llamadasConProblemas(status: 'error' | 'pendiente' | null, limite: number): Promise<{ filas: FilaProblema[]; total: number | null }> {
  const db = await getTenantDb();
  const filtro = status === 'error' ? 'status.eq.error'
    : status === 'pendiente' ? 'and(status.eq.pendiente,category.eq.venta)'
      : 'status.eq.error,and(status.eq.pendiente,category.eq.venta)';
  const { data, error, count } = await db.from('closing_analyses')
    .select('recording_id, title, call_date, lead_id, lead_nombre, category, status, error, has_transcript, updated_at', { count: 'exact' })
    .or(filtro).order('updated_at', { ascending: false }).limit(limite);
  if (error) throw new Error(`api-mako: no pude leer las llamadas con problemas: ${error.message}`);
  return { filas: (data ?? []) as unknown as FilaProblema[], total: typeof count === 'number' ? count : null };
}

export type FilaCoincidente = { recording_id: number; category: string; status: string };

/** ¿Hay un análisis enganchado al lead, o enganchable gratis por email o share_url?
 *  Devuelve la fila que coincidió con su categoría y estado: el Paso 0 de
 *  analizarLlamadasDeLead engancha cualquier fila que no esté en error (también las
 *  internas, test o pendientes), pero llamadas_lead solo muestra ventas analizadas. Si
 *  hay varias, gana una venta analizada. */
export async function leadTieneLlamada(leadId: number): Promise<{ existe: boolean; tiene: boolean; por: 'lead' | 'email' | 'grabacion' | null; fila: FilaCoincidente | null }> {
  const db = await getTenantDb();
  const { data: lr } = await db.from('leads').select('email, fathom_links').eq('id', leadId).maybeSingle();
  if (!lr) return { existe: false, tiene: false, por: null, fila: null };
  const row = lr as { email?: string | null; fathom_links?: Array<{ url?: string }> | null };
  const emailNorm = (row.email ?? '').trim().toLowerCase();
  const norm = (u: string) => u.trim().replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
  const shareSet = new Set((row.fathom_links ?? []).map((f) => norm(f.url ?? '')).filter(Boolean));
  const filas = await leerTodo<{ recording_id: number; lead_id: number | null; invitee_email: string | null; share_url: string | null; category: string; status: string }>(
    db, 'closing_analyses', 'recording_id, lead_id, invitee_email, share_url, category, status',
    { orden: 'recording_id', filtros: (q) => q.neq('status', 'error') },
  );
  // Rango: por lead > por email > por grabación; dentro del mismo, una venta analizada gana.
  const RANGO = { lead: 0, email: 1, grabacion: 2 } as const;
  let mejor: { por: 'lead' | 'email' | 'grabacion'; fila: FilaCoincidente; util: boolean } | null = null;
  for (const r of filas) {
    const por = r.lead_id === leadId ? 'lead'
      : emailNorm && (r.invitee_email ?? '').trim().toLowerCase() === emailNorm ? 'email'
        : r.share_url && shareSet.has(norm(r.share_url)) ? 'grabacion' : null;
    if (!por) continue;
    const util = r.category === 'venta' && r.status === 'analizada';
    const gana = !mejor || RANGO[por] < RANGO[mejor.por] || (RANGO[por] === RANGO[mejor.por] && util && !mejor.util);
    if (gana) mejor = { por, fila: { recording_id: r.recording_id, category: r.category, status: r.status }, util };
  }
  return { existe: true, tiene: mejor != null, por: mejor?.por ?? null, fila: mejor?.fila ?? null };
}

/** ¿Ya hay un borrador post-llamada de este lead en las últimas 6 h? (el mismo anti-duplicado de la lib) */
export async function hayBorradorPostLlamadaReciente(leadId: number): Promise<boolean> {
  const desdeIso = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const { data } = await (await getTenantDb()).from('wa_borradores').select('id')
    .eq('lead_id', leadId).eq('origen', 'post_llamada').gte('created_at', desdeIso).limit(1);
  return !!data?.length;
}

/** La llamada analizada más reciente del lead dentro de las últimas `horas` (el fallback de la lib). */
export async function ultimaLlamadaDelLead(leadId: number, horas: number): Promise<{ recording_id: number } | null> {
  const desdeIso = new Date(Date.now() - horas * 3600 * 1000).toISOString();
  const { data } = await (await getTenantDb()).from('closing_analyses').select('recording_id')
    .eq('lead_id', leadId).gte('started_at', desdeIso).order('started_at', { ascending: false }).limit(1);
  return ((data ?? [])[0] as { recording_id: number } | undefined) ?? null;
}

// ── Métricas (copia del useMemo `ag` de ClosingBrowser) ──────────────────────

const mean = (xs: Array<number | null | undefined>): number | null => {
  const v = xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
export const r1 = (n: number | null): number | null => (n == null ? null : Math.round(n * 10) / 10);
const dimScore = (c: ClosingAnalysisRow, label: string): number | null => c.dims?.find((d) => d.label === label)?.score ?? null;

/** Filtra por call_date (AAAA-MM-DD, hora de Tijuana) inclusive. Sin fecha, la llamada queda afuera si hay ventana. */
export function enVentana(calls: ClosingAnalysisRow[], desde: string | null, hasta: string | null): ClosingAnalysisRow[] {
  if (!desde && !hasta) return calls;
  return calls.filter((c) => !!c.call_date && (!desde || c.call_date >= desde) && (!hasta || c.call_date <= hasta));
}

export function closersDe(calls: ClosingAnalysisRow[]) {
  const por = new Map<string, ClosingAnalysisRow[]>();
  for (const c of calls) { const k = c.closer ?? '(sin closer)'; (por.get(k) ?? por.set(k, []).get(k)!).push(c); }
  return [...por.entries()].map(([closer, G]) => {
    const floja = DIMS7.map((l) => ({ dimension: l, score: mean(G.map((c) => dimScore(c, l))) }))
      .filter((x) => x.score != null).sort((a, b) => (a.score as number) - (b.score as number))[0];
    return { closer, llamadas: G.length, score_promedio_0a10: r1(mean(G.map((c) => c.score))), ganadas: G.filter((c) => c.outcome_tone === 'good').length, dimension_mas_floja: floja ? { dimension: floja.dimension, score_0a10: r1(floja.score) } : null };
  }).sort((a, b) => (b.score_promedio_0a10 ?? -1) - (a.score_promedio_0a10 ?? -1));
}

export function factoresDe(calls: ClosingAnalysisRow[]) {
  const won = calls.filter((c) => c.outcome_tone === 'good');
  const lost = calls.filter((c) => c.outcome_tone === 'bad');
  const ejemplos = (pool: ClosingAnalysisRow[], label: string, dir: 1 | -1) => pool
    .map((c) => ({ c, s: dimScore(c, label) })).filter((x): x is { c: ClosingAnalysisRow; s: number } => x.s != null)
    .sort((a, b) => dir * (b.s - a.s)).slice(0, 2)
    .map((x) => ({ recording_id: x.c.recording_id, fecha: x.c.call_date, tipo: x.c.tipo, score_dimension_0a10: x.s }));
  const filas = DIMS7.map((label) => {
    const w = mean(won.map((c) => dimScore(c, label)));
    const l = mean(lost.map((c) => dimScore(c, label)));
    return { dimension: label, promedio_ganadas: r1(w), promedio_perdidas: r1(l), promedio_equipo: r1(mean(calls.map((c) => dimScore(c, label)))), brecha: w == null || l == null ? null : r1(w - l), ejemplos_donde_brillo: ejemplos(won, label, 1), ejemplos_donde_falto: ejemplos(lost, label, -1) };
  }).sort((a, b) => (b.brecha ?? -99) - (a.brecha ?? -99));
  return { ganadas: won.length, perdidas: lost.length, en_proceso_excluidas: calls.length - won.length - lost.length, dimensiones: filas };
}

export function tendenciaDe(calls: ClosingAnalysisRow[]) {
  const buckets = new Map<string, number[]>();
  for (const c of calls) {
    if (c.score == null) continue;
    const iso = c.started_at || c.call_date;
    if (!iso) continue;
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
    if (Number.isNaN(d.getTime())) continue;
    const mk = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    (buckets.get(mk) ?? buckets.set(mk, []).get(mk)!).push(c.score);
  }
  return [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mes, ys]) => ({ mes, score_promedio_0a10: r1(mean(ys)), llamadas: ys.length }));
}

export function embudoDe(calls: ClosingAnalysisRow[]) {
  const r2 = calls.filter((c) => c.tipo === 'R2');
  const ganadasR2 = r2.filter((c) => c.outcome_tone === 'good').length;
  return { llamadas_r1: calls.filter((c) => c.tipo === 'R1').length, llamadas_r2: r2.length, r2_ganadas: ganadasR2, tasa_cierre_r2_pct: r2.length ? Math.round((ganadasR2 / r2.length) * 100) : null };
}

// ── Trabajo en segundo plano ─────────────────────────────────────────────────

/**
 * Agenda `trabajo` para DESPUÉS de mandar la respuesta, dentro del workspace del
 * contexto (after() corre fuera del AsyncLocalStorage: sin el re-entrar,
 * getTenantDb caería a otro workspace).
 *
 * ⚠️ El techo es el maxDuration de la función que CONFIRMÓ, no el del request. Las
 * acciones `pantalla` se confirman en el server action de /mako/revisar/[id], y el
 * maxDuration de una página gobierna sus server actions (docs/hallazgos-infra.md,
 * «El maxDuration de la PÁGINA…»). Si esa página no declara `maxDuration = 300` —el
 * techo de app/api/closing/analizar-lead y del webhook de Fathom—, la plataforma
 * corta el trabajo adentro de after() sin que corra ningún catch: el candado de
 * closing_jobs queda en 'corriendo' hasta que vence a los 15 min.
 */
export function enSegundoPlano(ws: number, etiqueta: string, trabajo: () => Promise<void>): void {
  after(() => runWithWorkspace(ws, async () => {
    try { await trabajo(); } catch (err) {
      console.error(`[api-mako:closing] ${etiqueta} falló: ${err instanceof Error ? err.message : String(err)}`);
    }
  }));
}
