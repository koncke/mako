// =============================================================================
// grabadores/seguimiento-pendiente-reglas — el seguimiento que espera la transcripción (PURO: con test)
// =============================================================================
// Revisión del tren m (26/10/2026): tl;dv avisa MeetingReady ANTES de tener la transcripción. El seguimiento por WhatsApp
// se redactaba igual: el análisis salía vacío («(sin transcript)»), se pagaba el Claude del negocio por nada y el borrador
// no se hacía nunca, porque el aviso de la transcripción (TranscriptReady) no dice de qué negocio es y no hay segunda
// vuelta. Ahora, si la transcripción no llega mientras el aviso espera, el seguimiento queda ANOTADO acá y lo redacta el
// cron del Closing cuando la transcripción esté (lib/grabadores/seguimiento-pendiente.ts).
// =============================================================================

/** Un seguimiento que espera la transcripción de su reunión. `ref` = «grabador:id» (lib/grabadores/reunion.ts). */
export type EsperaSeguimiento = { ref: string; leadId: number; link: string | null; reunion: 'R1' | 'R2'; desde: string };

/** Dónde queda la lista (app_settings del negocio). */
export const KEY_ESPERAN_SEGUIMIENTO = 'mako.post_llamada.esperan_transcripcion';
/** Después de esto ya no es un seguimiento «post-llamada»: se suelta (el mismo plazo que mira `analisisDeLaLlamada`). */
export const VIDA_ESPERA_MS = 48 * 3600_000;
/** Un techo, para que una lista que nadie drena no crezca sin fin. */
const TOPE_ESPERAS = 50;

/** Lee la lista guardada. Basura o vacío = ninguna. */
export function leerEsperas(raw: string | null | undefined): EsperaSeguimiento[] {
  if (!raw || !raw.trim()) return [];
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(v)) return [];
  return v.filter((e): e is EsperaSeguimiento =>
    !!e && typeof e === 'object'
    && typeof (e as EsperaSeguimiento).ref === 'string' && (e as EsperaSeguimiento).ref.includes(':')
    && Number.isSafeInteger((e as EsperaSeguimiento).leadId) && (e as EsperaSeguimiento).leadId > 0
    && ((e as EsperaSeguimiento).reunion === 'R1' || (e as EsperaSeguimiento).reunion === 'R2')
    && typeof (e as EsperaSeguimiento).desde === 'string' && Number.isFinite(Date.parse((e as EsperaSeguimiento).desde)));
}

/** La lista con `nueva`: la misma reunión una sola vez (un aviso que se reentrega no duplica), las más nuevas primero. */
export function conEspera(lista: readonly EsperaSeguimiento[], nueva: EsperaSeguimiento): EsperaSeguimiento[] {
  return [nueva, ...lista.filter((e) => e.ref !== nueva.ref)].slice(0, TOPE_ESPERAS);
}

/** Las que todavía son un seguimiento «post-llamada» (menos de 48 h). */
export const vigentes = (lista: readonly EsperaSeguimiento[], ahora = Date.now()): EsperaSeguimiento[] =>
  lista.filter((e) => ahora - Date.parse(e.desde) < VIDA_ESPERA_MS);
