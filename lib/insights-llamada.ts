import 'server-only';

// =============================================================================
// insights-llamada — lo que salió de la LLAMADA, separado de lo que el lead
// contestó en el formulario
// =============================================================================
// DECISIÓN DEL DUEÑO (04/10/2026), textual: «las respuestas del Calendly son
// diferentes, debería haber un apartado para los insights que salieron de la
// llamada». O sea que la pregunta que quedaba abierta —si lo que escribe MaKo
// PISA la respuesta del lead o se muestra al lado— está contestada: NO SE PISA.
// Lo que dijo al agendar vive en `lead_respuestas` (lo escribe el webhook de
// Calendly) y lo que dijo en la charla vive en `closing_analyses` (lo escribe el
// Closing Analyst). Son dos cosas y se leen por separado.
//
// ⚠️ ACÁ NO SE GUARDA NADA NUEVO, Y ES EL PUNTO. El Closing Analyst YA persiste
// una fila por grabación en `closing_analyses` con el resumen de la charla, el
// desenlace, las objeciones (abiertas o respondidas), los momentos y el próximo
// paso. El apartado LEE esa fila. Una segunda copia del mismo análisis —una
// tabla de «insights de la llamada»— se desincroniza con el re-análisis, con la
// revisión manual y con la re-evaluación de MaKo, que escriben en la primera.
//
// Y `lead_respuestas` tampoco servía para meterlo adentro: su CHECK la ata a
// Calendly (reunion in R1/R2, mig 0062), así que abrirla para guardar algo que
// no es una respuesta de formulario es exactamente la mezcla que esta decisión
// vino a cortar.
//
// NO GASTA IA AL LEER. Abrir la ficha cien veces cuesta cero: el análisis ya lo
// pagó la feature `closing`, que es la única que lo declara para esto en
// `lib/model-catalogo.ts`. Este módulo no agrega ninguna feature que cobre.
// =============================================================================

import { getTenantDb } from './workspace';
import { leerTodo } from './supabase-paginado';
import { analizarLlamadasDeLead, RESERVA_LLAMADA_MS } from './closing';
import { arrancarAnalisis, cerrarAnalisis } from './closing-job';
import { resumenDeCorrida } from './closing-job-estado';
import { leadsPendientesDeInsights, type InsightLlamada, type LeadConGrabacion } from './insights-llamada-reparto';
import type { ClosingObjection, ClosingMoment, CallTipo, Tone } from './closing';

export type { InsightLlamada } from './insights-llamada-reparto';

const COLS = [
  'recording_id', 'tipo', 'title', 'started_at', 'call_date', 'duration_min',
  'outcome', 'outcome_tone', 'summary', 'next_step', 'objections', 'moments',
  'share_url', 'call_url', 'analyzed_at',
].join(', ');

type Fila = {
  recording_id: number;
  tipo: CallTipo | null;
  title: string | null;
  started_at: string | null;
  call_date: string | null;
  duration_min: number | null;
  outcome: string | null;
  outcome_tone: Tone | null;
  summary: string | null;
  next_step: string | null;
  objections: ClosingObjection[] | null;
  moments: ClosingMoment[] | null;
  share_url: string | null;
  call_url: string | null;
  analyzed_at: string | null;
};

function aInsight(f: Fila): InsightLlamada {
  return {
    recordingId: f.recording_id,
    tipo: f.tipo,
    titulo: f.title,
    startedAt: f.started_at,
    callDate: f.call_date,
    duracionMin: f.duration_min,
    outcome: f.outcome,
    outcomeTone: f.outcome_tone,
    resumen: f.summary,
    proximoPaso: f.next_step,
    // Las objeciones ABIERTAS primero: es lo único de todo el apartado que hay
    // que resolver, y lo que queda abajo no se lee.
    objeciones: [...(f.objections ?? [])].sort((a, b) => Number(a.handled) - Number(b.handled)),
    momentos: f.moments ?? [],
    url: f.share_url || f.call_url || null,
    analizadoEn: f.analyzed_at,
  };
}

/**
 * Las llamadas YA analizadas de un lead, de la más nueva a la más vieja.
 *
 * ES EL ÚNICO LECTOR de `closing_analyses` por lead: lo consumen el apartado de
 * la ficha y `lib/lead-resumen.ts` (la pantalla que MaKo linkea por WhatsApp).
 * Con dos lecturas, el día que una agregue un campo o cambie el filtro, la ficha
 * y el resumen del celular cuentan dos versiones de la misma llamada.
 *
 * `status = 'analizada'` y no «todas»: una fila `pendiente` es una venta sin
 * transcript (no hay nada que mostrar) y una `descartada` es una llamada que no
 * es de venta. Mostrar sus campos vacíos como un apartado sería afirmar que MaKo
 * escuchó la charla y no encontró nada.
 */
export async function insightsDeLlamadaDeLead(leadId: number): Promise<InsightLlamada[]> {
  const db = await getTenantDb();
  const { data, error } = await db
    .from('closing_analyses')
    .select(COLS)
    .eq('lead_id', leadId)
    .eq('status', 'analizada')
    .order('started_at', { ascending: false });
  // ⚠️ EL ERROR NO SE TRAGA: un `?? []` acá hace que «no pude leer» se vea igual
  // que «esta llamada no se analizó», y el apartado mandaría a apretar un botón
  // que paga un análisis que ya está hecho. El caller decide qué mostrar.
  if (error) throw new Error(`No pude leer el análisis de las llamadas del lead ${leadId}: ${error.message}`);
  return ((data ?? []) as unknown as Fila[]).map(aInsight);
}

// ─────────────────────────────────────────────────────────────────────────────
// El disparo: que al terminar la reunión el análisis llegue a la ficha
// ─────────────────────────────────────────────────────────────────────────────
// Son dos mitades, porque una es gratis y la otra cuesta plata:
//
//  1. ENLAZAR (gratis, al instante, en el choke point). La grabación que se
//     acaba de enganchar puede estar YA analizada y colgada de otro lead o de
//     ninguno: el cron de closing le pone `lead_id` sólo cuando el email del
//     invitado matchea un lead, así que una grabación matcheada por NOMBRE o
//     pegada a mano se analiza y nunca llega a la ficha. Esto es un SELECT por
//     `embed_token` y un UPDATE: sin Fathom, sin Claude y sin barrer la tabla.
//
//  2. ANALIZAR (cuesta una llamada al modelo). No puede correr en el choke
//     point: `applyFathomRecording` lo llaman el webhook, el barrido de
//     `fathom-auto` —que a su vez dispara el render del CRM con un `void`— y el
//     alta a mano, y una llamada a Claude de 90-120 s colgada de un render es
//     plata que se gasta y se pierde cuando la plataforma mata la función. Va en
//     el cron, que es el único con presupuesto (ver `drenarInsightsDeLlamada`).

/** Extrae el token de un `share_url` de Fathom (`…/share/<token>`). */
function tokenDeShare(shareUrl: string | null): string | null {
  return (shareUrl ?? '').match(/\/share\/([^/?]+)/)?.[1] ?? null;
}

export type Enlace = { enlazado: boolean; motivo: string };

/**
 * Engancha a ESTE lead el análisis que ya existe de esa grabación.
 *
 * Vive colgado de `applyFathomRecording`, que es el CHOKE POINT por el que pasan
 * los tres caminos que enganchan una grabación (el webhook de Fathom, el barrido
 * de `fathom-auto` y el link que alguien pega a mano). Puesto en los tres, el
 * cuarto que se escriba mañana nace sin esto.
 *
 * ⚠️ NUNCA TIRA. Lo llama el camino que escribe el lead: una grabación que no se
 * pudo enlazar no puede dejar la asistencia sin marcar. El motivo queda en el
 * resultado para que lo cuente quien llama.
 */
export async function enlazarAnalisisDeGrabacion(
  leadId: number,
  shareUrl: string | null,
  lead: { nombre?: string | null; empresa?: string | null },
): Promise<Enlace> {
  const token = tokenDeShare(shareUrl);
  if (!token) return { enlazado: false, motivo: 'la grabación no trae token de Fathom' };
  try {
    const db = await getTenantDb();
    const { data, error } = await db
      .from('closing_analyses')
      .select('recording_id, lead_id, status')
      .eq('embed_token', token)
      .maybeSingle();
    if (error) return { enlazado: false, motivo: `no pude leer el análisis: ${error.message}` };
    const fila = data as { recording_id: number; lead_id: number | null; status: string } | null;
    if (!fila) return { enlazado: false, motivo: 'esa grabación todavía no está analizada' };
    if (fila.status === 'error') return { enlazado: false, motivo: 'el análisis de esa grabación quedó en error' };
    if (fila.lead_id === leadId) return { enlazado: false, motivo: 'ya estaba enlazado a este lead' };
    const { error: upErr } = await db
      .from('closing_analyses')
      .update({ lead_id: leadId, lead_nombre: lead.nombre ?? null, lead_empresa: lead.empresa ?? null })
      .eq('recording_id', fila.recording_id);
    if (upErr) return { enlazado: false, motivo: `no pude enlazarlo: ${upErr.message}` };
    return { enlazado: true, motivo: 'análisis enlazado a este lead' };
  } catch (e) {
    return { enlazado: false, motivo: e instanceof Error ? e.message : String(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// La cola CALCULADA de los que todavía no tienen análisis
// ─────────────────────────────────────────────────────────────────────────────

export type Drenaje = {
  /** Cuántos leads tienen grabación y ninguna llamada analizada (la cola ENTERA). */
  pendientes: number;
  /** A cuántos se les corrió el análisis en esta ronda. */
  corridos: number;
  /** Salteados porque ya había un análisis corriendo (el candado de closing_jobs). */
  ocupados: number;
  /** Quedaron para la próxima ronda: no entraba otra llamada entera. */
  sinTurno: number;
};

/**
 * Corre el Closing Analyst sobre los leads que tienen grabación y todavía no
 * tienen análisis. Cuántas llamadas al modelo paga cada lead lo decide
 * `analizarLlamadasDeLead`, que saltea lo ya analizado.
 *
 * ⚠️ EL PRESUPUESTO ES ABSOLUTO (epoch ms) y se arranca un lead SOLO si entra
 * ENTERO antes del corte, con la misma unidad que reparte el cron de closing
 * (`RESERVA_LLAMADA_MS`). Acotar el INICIO y no el fin es cómo se paga un
 * análisis que la plataforma mata antes de escribir la fila.
 *
 * El candado y el cierre son los MISMOS que usa el botón «Analizar la llamada»
 * (`closing_jobs` + `resumenDeCorrida`): así dos corridas no pagan dos veces la
 * misma grabación, y el desenlace queda escrito en castellano donde la pantalla
 * ya lo lee.
 */
export async function drenarInsightsDeLlamada(opts: { deadline: number; max?: number }): Promise<Drenaje> {
  const max = opts.max ?? 2;
  const db = await getTenantDb();

  const [leads, analizadas, jobs] = await Promise.all([
    // Paginado: `leads` pasó las 1000 filas en el ws1 y un `.select()` suelto
    // corta en silencio — los que caen del corte son los más viejos, justo los
    // que ya tuvieron sus reuniones.
    leerTodo<{ id: number; fathom_links: Array<{ url?: string }> | null }>(db, 'leads', 'id, fathom_links', { orden: 'id' }),
    leerTodo<{ lead_id: number | null }>(db, 'closing_analyses', 'recording_id, lead_id', { orden: 'recording_id', eq: { status: 'analizada' } }),
    leerTodo<{ lead_id: number }>(db, 'closing_jobs', 'lead_id', { orden: 'lead_id' }),
  ]);

  const conAnalisis = new Set<number>();
  for (const a of analizadas) if (a.lead_id != null) conAnalisis.add(a.lead_id);
  const yaIntentados = new Set<number>(jobs.map((j) => j.lead_id));

  const conGrabacion: LeadConGrabacion[] = leads.map((l) => ({
    id: l.id,
    fathomLinks: (l.fathom_links ?? []).filter((f) => f?.url).length,
  }));
  // Sin tope para CONTAR (la cola entera es el dato que se reporta) y con tope
  // para CORRER: son dos preguntas distintas, y contar sólo lo que entró en la
  // ronda esconde el backlog.
  const todos = leadsPendientesDeInsights(conGrabacion, conAnalisis, yaIntentados, Number.MAX_SAFE_INTEGER);

  const r: Drenaje = { pendientes: todos.length, corridos: 0, ocupados: 0, sinTurno: 0 };
  for (const leadId of todos) {
    const resto = () => todos.length - r.corridos - r.ocupados;
    if (r.corridos >= max) { r.sinTurno = resto(); break; }
    if (Date.now() + RESERVA_LLAMADA_MS > opts.deadline) { r.sinTurno = resto(); break; }
    if (!(await arrancarAnalisis(leadId))) { r.ocupados++; continue; }
    try {
      const { estado, detalle } = resumenDeCorrida(await analizarLlamadasDeLead(leadId));
      await cerrarAnalisis(leadId, estado, detalle);
    } catch (e) {
      await cerrarAnalisis(leadId, 'error', `No pude analizarla: ${e instanceof Error ? e.message : String(e)}`);
    }
    r.corridos++;
  }
  return r;
}
