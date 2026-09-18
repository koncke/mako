// =============================================================================
// plan-criterio-juez — el criterio de compromisos del cliente, aplicado a una reunión
// =============================================================================
// Juzga con el criterio del dueño del tablero las tareas que YA sacó el extractor
// (lib/plan-fathom.ts). No extrae nada nuevo y no toca el extractor: ese texto lo comparte
// el importador de archivos de todos los clientes. Lo que no depende del modelo —la cita,
// el saneo— vive en lib/plan-criterio-reglas.ts, con sus tests.
//
// Lee la transcripción ENTERA de una vez, sin trocear. El extractor trocea porque tiene
// que ESCRIBIR muchas tareas y se quedaba sin salida; el juez escribe un veredicto corto
// por tarea y necesita ver la reunión completa para las reglas 1 (pasos del mismo
// producto) y 4 (si el dueño sugirió y el otro aceptó más adelante).
// =============================================================================

import 'server-only';
import { chatClaude } from './anthropic';
import { brandSystem, parseJsonObject } from './campaign-structurer';
import { renderPrompt, contenidoNoConfiable } from './prompt-render';
import type { UsageInfo } from './anthropic-usage';
import {
  sanearVeredictos, sanearFaltantes, transcriptParaCitas, resumenVeredictos,
  CRITERIO_JUEZ_SYSTEM_TEMPLATE, CRITERIO_JUEZ_USER_TEMPLATE, CRITERIO_JUEZ_JSON_SHAPE,
  type Veredicto, type Faltante,
} from './plan-criterio-reglas';

export type CandidataJuez = { titulo: string; detalle?: string; dueño?: string; esDeOtro?: boolean };

export type SalidaJuez = {
  /** uno por candidata, en el mismo orden. null = no se juzgó (entra como siempre). */
  veredictos: Array<Veredicto | null>;
  /** lo que cumple el criterio y la lista no tenía, con cita verificada. */
  faltantes: Faltante[];
  /** la llamada falló (dos veces): NADA se juzgó, y quien llama no debe tratarlo como juicio. */
  fallo: boolean;
  usage?: UsageInfo;
};

const paraPrompt = (d?: string): string => (d ? d.replace(/\s+/g, ' ').trim().slice(0, 500) : '');

/** Los que hablaron, sacados de la transcripción misma (`[hh:mm:ss] Nombre: …`). */
function hablantes(transcript: string): string[] {
  const vistos = new Set<string>();
  for (const l of transcript.split('\n')) {
    const m = l.match(/^\s*\[\d{1,2}:\d{2}(?::\d{2})?\]\s*([^:\n]{1,80}):/);
    if (m && m[1].trim() !== '—') vistos.add(m[1].trim());
  }
  return [...vistos];
}

export async function juzgarConCriterio(p: {
  criterio: string;
  candidatas: CandidataJuez[];
  /** la transcripción como la arma transcriptToText (renglones `[hh:mm:ss] Nombre: texto`). */
  transcript: string;
  /** el dueño del tablero, como lo nombra el criterio («Mauricio»). */
  dueno: string;
  usoMotivo?: string;
}): Promise<SalidaJuez> {
  // Sin candidatas TAMBIÉN se juzga: una reunión de la que el extractor no sacó nada
  // puede tener compromisos que faltan.
  const n = p.candidatas.length;
  if (!p.criterio.trim() || !p.transcript.trim()) return { veredictos: p.candidatas.map(() => null), faltantes: [], fallo: true };

  const sys = await brandSystem(await renderPrompt('plan-criterio.juez.system', CRITERIO_JUEZ_SYSTEM_TEMPLATE, {
    criterio: p.criterio.trim(), dueno: p.dueno, jsonShape: CRITERIO_JUEZ_JSON_SHAPE,
  }));
  const lista = p.candidatas
    .map((c, i) => `${i} · ${c.esDeOtro ? (c.dueño?.trim() || 'otra persona') : `${p.dueno} (dueño del tablero)`} · ${c.titulo}${c.detalle ? ` — ${paraPrompt(c.detalle)}` : ''}`)
    .join('\n') || '(el extractor no sacó ninguna tarea de esta reunión)';
  const quienes = hablantes(p.transcript);
  const user = await renderPrompt('plan-criterio.juez.user', CRITERIO_JUEZ_USER_TEMPLATE, {
    dueno: p.dueno,
    participantes: quienes.length ? quienes.map((q) => `- ${q}`).join('\n') : '(la transcripción no trae los nombres)',
    tareas: contenidoNoConfiable(lista, 'tareas'),
    reunion: contenidoNoConfiable(p.transcript, 'reunion'),
  });
  const norm = transcriptParaCitas(p.transcript);

  const unaVez = async (): Promise<{ veredictos: Array<Veredicto | null>; faltantes: Faltante[]; usage?: UsageInfo } | null> => {
    let usage: UsageInfo | undefined;
    const raw = await chatClaude(sys, [{ role: 'user', content: user }], {
      // Un veredicto son ~120 tokens; 60 tareas son ~7k. El resto es para pensar: el
      // pensamiento sale del MISMO presupuesto, y con poco el JSON llega cortado — que
      // es lo que le pasó a la audiencia del Perro con 2000 y lo que avisa el documento
      // de Mauricio para su configuración.
      effort: 'high', maxTokens: 32000, feature: 'plan-criterio',
      motivo: p.usoMotivo || 'Juzgar tareas con el criterio del cliente',
      onUsage: (u) => { usage = u; },
    });
    let obj: Record<string, unknown>;
    try { obj = parseJsonObject(raw); } catch (e) {
      console.error(`[plan-criterio] el juez no devolvió JSON válido (${raw.length} chars): ${e instanceof Error ? e.message : String(e)} · arranca con: ${raw.slice(0, 120)}`);
      return null;
    }
    return { veredictos: sanearVeredictos(obj, n, norm), faltantes: sanearFaltantes(obj, norm), usage };
  };

  // Un reintento, como el extractor: un 429 o un JSON cortado no pueden leerse como
  // «el juez no se pronunció» sin que nadie se entere.
  const primera = await unaVez().catch((e) => { console.error('[plan-criterio] el juez falló:', e instanceof Error ? e.message : String(e)); return null; });
  const salida = primera ?? await new Promise((r) => setTimeout(r, 1500)).then(unaVez).catch((e) => {
    console.error('[plan-criterio] el juez falló también en el reintento:', e instanceof Error ? e.message : String(e));
    return null;
  });
  if (!salida) return { veredictos: p.candidatas.map(() => null), faltantes: [], fallo: true };
  const r = resumenVeredictos(salida.veredictos);
  console.log(`[plan-criterio] ${n} tareas → ${r.compromiso} compromisos · ${r.acuerdo_interno} acuerdos internos · ${r.descartado} descartadas (${r.degradadas} por cita que no aparece) · ${r.fuera} fuera · ${r.sin_juzgar} sin juzgar · +${salida.faltantes.length} que faltaban`);
  return { veredictos: salida.veredictos, faltantes: salida.faltantes, fallo: false, usage: salida.usage };
}
