// =============================================================================
// La propuesta de MaKo EN la página: se construye a la vista, se marca, y se acepta, se descarta o se reintenta
// =============================================================================
// Diseño: docs/diseno-copywriter.md (D5, D11). Notion (help/notion-ai-faqs): «When Notion AI creates or edits content for
// you, you'll have the option to accept or discard those changes, or have Notion AI try again». Y la regla de la casa
// para un chat que edita lo abierto (AGENTS.md): proponer, no aplicar; aceptar en UN paso de deshacer.
//
// El editor es BlockNote (./CuerpoNotion.tsx) y este módulo no lo conoce: habla con el DOCUMENTO VIVO (`DocVivo`), que
// lee y pone el documento GUARDADO (JsonNodo). Así las operaciones de MaKo (lib/copywriter/operaciones.ts) siguen siendo
// puras y probadas, y el editor se puede cambiar sin tocar el chat.
//   · CONSTRUIR: los cuadros de `cuadrosDeConstruccion` se pintan de a uno, con un pequeño delay (AGENTS.md, «Lo que
//     MaKo construye se ve CONSTRUYÉNDOSE»), FUERA del historial de deshacer; el editor no los manda a guardar. Lo escrito
//     por MaKo va marcado. Con «reducir movimiento» del sistema, o si la persona toca «Saltear», va el último cuadro.
//   · ACEPTAR: vuelve a la foto de ANTES (sin historial) y pone el resultado CON historial: un Ctrl+Z lo deshace entero.
//   · DESCARTAR: vuelve a la foto de antes, exacta.
// Sin React: lo usa el chat (app/copywriter/PanelMaKo.tsx), que es quien sabe cuándo.
// =============================================================================

import type { JsonNodo } from '@/lib/copywriter/tipos';

/** El documento abierto, visto desde afuera del editor (lo implementa CuerpoNotion). */
export type DocVivo = {
  /** El documento de AHORA, en el formato guardado. */
  leer: () => JsonNodo;
  /**
   * Pone un documento entero. Sin `historial`, fuera del deshacer (`tr.setMeta('addToHistory', false)` adentro del
   * editor); `marcas` son los bids que se ven como propuesta. Lo que pone no se manda a guardar como un cambio de la
   * persona. Devuelve false si no se pudo (el editor ya no está o el documento no entra).
   */
  poner: (doc: JsonNodo, op?: { historial?: boolean; marcas?: ReadonlySet<string> }) => boolean;
  /** ¿Sigue montado? (cambiar de página lo desmonta en el medio de una construcción). */
  vivo: () => boolean;
};

/** Pone el documento (sin historial, salvo que se pida: aceptar). */
export function ponerDoc(doc: DocVivo, d: JsonNodo, op: { historial?: boolean; marcas?: ReadonlySet<string> } = {}): boolean {
  if (!doc.vivo()) return false;
  return doc.poner(d, op);
}

/** ¿El sistema pide reducir el movimiento? */
export const sinMovimiento = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Lo que tarda cada cuadro: fracciones de segundo (el total, segundos). */
export const MS_POR_CUADRO = 110;

/**
 * Pinta los cuadros de a uno. Devuelve cuando llegó al último (o antes, si `saltear()` dice que sí: va el último). Los
 * bloques nuevos de cada cuadro se marcan como propuesta. `nuevos` son todos los ids que escribió MaKo.
 */
export async function construir(doc: DocVivo, cuadros: readonly JsonNodo[], nuevos: ReadonlySet<string>, op: { saltear: () => boolean; ms?: number }): Promise<boolean> {
  if (!cuadros.length) return true;
  const ms = op.ms ?? MS_POR_CUADRO;
  const marcasDe = (d: JsonNodo) => new Set((d.content ?? []).map((b) => b.attrs?.bid).filter((x): x is string => typeof x === 'string' && nuevos.has(x)));
  if (!sinMovimiento()) {
    for (let i = 0; i < cuadros.length - 1; i++) {
      if (op.saltear() || !doc.vivo()) break;
      if (!ponerDoc(doc, cuadros[i], { marcas: marcasDe(cuadros[i]) })) return false;
      await new Promise((r) => setTimeout(r, ms));
    }
  }
  const ultimo = cuadros[cuadros.length - 1];
  return ponerDoc(doc, ultimo, { marcas: marcasDe(ultimo) });
}

/** Aceptar: la foto de antes sin historial, y el resultado en UN paso de deshacer. */
export function aceptar(doc: DocVivo, antes: JsonNodo, final: JsonNodo): boolean {
  return ponerDoc(doc, antes) && ponerDoc(doc, final, { historial: true });
}

/** Descartar: la foto de antes, exacta. */
export function descartar(doc: DocVivo, antes: JsonNodo): boolean {
  return ponerDoc(doc, antes);
}
