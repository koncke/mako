// =============================================================================
// La lógica de «Analizar guion» (Ads Writer) — un módulo PURO, sin 'use client'
// =============================================================================
// Lo que decide la vista sin dibujar nada: cuándo un guion es demasiado corto para valorarlo, qué
// pregunta hace el botón de sincronizar, qué dice cuando termina y qué dice cuando se corta. Vive
// afuera de AnalizarGuion.tsx para que el test lo pueda medir con números sin montar React, y para que
// ningún server tenga que importar un valor de un módulo de cliente (AGENTS.md, «'use client' es una
// frontera de DATOS»).
//
// Se mudó con la tarea desde app/ads-analyst/ScriptsBrowser.tsx (11/10/2026): `syncGate`, `humanizeAgo`
// y los textos de la confirmación son los de allá. Lo que se agregó es lo que allá faltaba:
//   · los TOPES del navegador (AGENTS.md, «Un tope que vive en la RUTA no protege al cliente»): las dos
//     rutas tienen `maxDuration` (120 s y 300 s), pero un `fetch` sin `signal` con la conexión caída no
//     resuelve nunca y deja el botón girando para siempre;
//   · el mensaje del corte, que dice DÓNDE quedó el trabajo y no solo que falló.
// =============================================================================

import type { ScriptAnalystView } from '@/lib/ads-analyst';

export type ConteoGuiones = ScriptAnalystView['counts'];

/** El piso de la ruta (app/api/ads-analyst/valorar/route.ts rechaza menos de 80 con un 400): se chequea antes de gastar el viaje. */
export const MIN_GUION = 80;

/** `maxDuration` de /api/ads-analyst/valorar (120 s) más un margen: más allá, la respuesta ya no puede llegar. */
export const TOPE_VALORAR_MS = 125_000;
/** `maxDuration` de /api/ads-analyst/sync (300 s) más un margen. */
export const TOPE_SYNC_MS = 305_000;
/** Borrar una fila del historial es una consulta: si en 20 s no volvió, no va a volver. */
export const TOPE_BORRAR_MS = 20_000;

/** El conteo de cuando no se pudo leer: todo en cero (la vista lo dice aparte, no lo dibuja como «no hay»). */
export const SIN_CONTEO: ConteoGuiones = { enVista: 0, analizadas: 0, pendientes: 0, descartadas: 0, sinTranscript: 0, errores: 0, total: 0 };

/** null si el guion se puede valorar; si no, la frase que lo dice. */
export function faltaParaValorar(guion: string): string | null {
  return guion.trim().length < MIN_GUION ? 'Pega el guion completo (unas líneas) para poder valorarlo.' : null;
}

export type NivelSync = 'nada' | 'reciente' | 'ok';

/**
 * Qué pregunta el botón de sincronizar antes de gastar IA (el `syncGate` de Ads Analyst):
 *   · `nada`     — no hay guiones nuevos sin analizar: «Ya está todo al día».
 *   · `reciente` — hay, pero la última corrida fue hace menos de una hora: quizá todavía se procesan.
 *   · `ok`       — hay guiones nuevos y nadie sincronizó recién.
 * `pend` cuenta los anuncios de Meta sin fila de análisis más los que quedaron pendientes.
 */
export function puertaSync(conteo: ConteoGuiones, ultimaSync: string | null, ahora: number = Date.now()): { pend: number; nivel: NivelSync } {
  const pend = conteo.sinTranscript + conteo.pendientes;
  const mins = ultimaSync ? Math.round((ahora - Date.parse(ultimaSync)) / 60000) : null;
  const nivel: NivelSync = pend === 0 ? 'nada' : (mins != null && Number.isFinite(mins) && mins < 60) ? 'reciente' : 'ok';
  return { pend, nivel };
}

/** «hace 12m», «hace 3h», «hace 2d». Una fecha rota o en el futuro no se inventa: «sin registro». */
export function haceCuanto(iso: string | null, ahora: number = Date.now()): string {
  if (!iso) return 'sin registro';
  const m = Math.round((ahora - Date.parse(iso)) / 60000);
  if (!Number.isFinite(m) || m < 0) return 'sin registro';
  if (m < 60) return `hace ${m}m`;
  const h = Math.round(m / 60);
  return h < 24 ? `hace ${h}h` : `hace ${Math.round(h / 24)}d`;
}

/**
 * El día de una fecha ISO como dd/mm (o dd/mm/aaaa), sacado del TEXTO: con un `Date` el server y el
 * navegador lo pasarían cada uno a su huso, y el día dibujado podría cambiar al hidratar. (Vivía en
 * AnalizarGuion.tsx; se mudó acá el 16/10/2026 porque el historial del teléfono la usa también.)
 */
export function diaMes(iso: string, conAnio = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}${conAnio ? `/${m[1]}` : ''}` : '';
}

/** Lo que distingue a una fila del historial: el guion en una línea. */
export function extracto(guion: string): string {
  const plano = guion.replace(/\s+/g, ' ').trim();
  return plano.length > 80 ? `${plano.slice(0, 80)}…` : plano;
}

/** La línea de cobertura de la barra: «N guiones analizados · M sin analizar · K con error». */
export function lineaConteo(c: ConteoGuiones): string {
  return `${c.analizadas} guion${c.analizadas === 1 ? '' : 'es'} analizado${c.analizadas === 1 ? '' : 's'}`
    + (c.sinTranscript > 0 ? ` · ${c.sinTranscript} sin analizar` : '')
    + (c.errores > 0 ? ` · ${c.errores} con error` : '');
}

/** Lo que dice la barra cuando el sync terminó: lo que analizó y, si quedó algo, cuánto. */
export function textoResultadoSync(r: { analizados?: unknown; restantes?: unknown }): string {
  const analizados = Number(r.analizados) || 0;
  const restantes = Number(r.restantes) || 0;
  return `${analizados} analizado${analizados === 1 ? '' : 's'}${restantes > 0 ? ` · quedan ${restantes}` : ''}.`;
}

/** ¿El error es el corte de un `AbortSignal.timeout`? (el navegador lo tira como `TimeoutError`; uno manual, como `AbortError`). */
export function esCorte(e: unknown): boolean {
  const n = (e as { name?: unknown } | null)?.name;
  return n === 'TimeoutError' || n === 'AbortError';
}

/**
 * El texto de un fallo, por tarea. Un corte dice dónde quedó el trabajo:
 *   · valorar — la ruta guarda en el historial DESPUÉS de valorar; si terminó del otro lado, aparece
 *     ahí al volver a abrir la vista.
 *   · sync    — cada guion se guarda apenas se analiza, así que lo hecho quedó; lo que falte lo toma
 *     el proceso diario (app/api/cron/ads-analyst-sync).
 *   · borrar  — no se sabe si se borró: la fila vuelve a la lista y se puede intentar de nuevo.
 */
export function mensajeDeFallo(tarea: 'valorar' | 'sync' | 'borrar', e: unknown): string {
  if (esCorte(e)) {
    if (tarea === 'valorar') return 'No llegó la respuesta. Si terminó, aparece en el historial al volver a abrir.';
    if (tarea === 'sync') return 'Se cortó la espera. Lo analizado quedó guardado; el resto lo toma el proceso diario.';
    return 'No llegó la respuesta. Vuelve a intentarlo.';
  }
  const m = e instanceof Error ? e.message : String(e ?? '');
  return m.trim() || 'No se pudo completar.';
}
