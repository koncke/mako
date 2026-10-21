// =============================================================================
// solo-su-ia — D6b: con su Claude o su GPT, ningún dato del negocio va a Gemini ni a una IA o red gratis
// =============================================================================
// Martín (D6b, 21/10/2026): «un negocio con su Claude o su GPT corre su Ops Center con su cuenta, y Gemini no participa».
// La primera versión lo cortó sólo en la respuesta del modelo (`chatClaudeTools`), y la revisión del Cerebro encontró el
// resto del turno yendo igual a la cascada barata: El Archivero del texto pegado y del PDF, la foto leída con Gemini antes
// de llegar a la PC, la nota de voz, los pedidos del Second Brain (docs/hallazgos-ia.md).
//
// Por eso el corte va ABAJO DE TODO, no en cada llamador: el turno corre DENTRO de `conSoloSuIA`, y lib/ai-cheap.ts no le
// da ninguna key barata (`provDe`) ni la red de la plataforma (`provsGratisDePlataforma`) a nada que corra adentro. Lo
// que se agregue mañana a ese camino lo hereda sin acordarse. Sólo quedan las IA del NEGOCIO que no son la cascada: su
// clave de Claude (la puerta 2 del veto, lib/anthropic.ts) y su OpenAI (PROVS_SU_IA). El contexto viaja con
// AsyncLocalStorage, también a lo que corre después de responder: `after()` de Next lo ata con `AsyncLocalStorage.bind`.
//
// Quién lo prende y por qué: lib/ia-del-negocio.ts (`negocioConSuIA`, por NEGOCIO y fallando cerrado).
// =============================================================================

import { AsyncLocalStorage } from 'node:async_hooks';

/** Las únicas de la cascada que son «su IA» (su GPT, con su key). Lo demás (Gemini, Groq, Mistral, OpenRouter, Cerebras) no. */
export const PROVS_SU_IA: readonly string[] = ['openai'];

const almacen = new AsyncLocalStorage<{ soloSuIA: true }>();

/** Corre `fn` con «sólo su IA» si `prender`; si no, igual que siempre. */
export function conSoloSuIA<T>(prender: boolean, fn: () => Promise<T>): Promise<T> {
  return prender ? almacen.run({ soloSuIA: true }, fn) : fn();
}

/**
 * Lo mismo, para el resto de una función async que ya está corriendo (el turno: envolver sus 300 líneas en un callback
 * era re-indentarlas todas, y cada merge chocaba con todo). Prende el contexto para lo que sigue en ESA función y lo que
 * ella lance —también `after()`—, y no se escapa a quien la llamó: su `await` sigue con el contexto de antes (medido el
 * 21/10/2026 y fijado en tests/solo-su-ia.test.ts). Sólo después de un `await`, nunca en código sincrónico de quien llama.
 */
export function entrarSoloSuIA(prender: boolean): void {
  if (prender) almacen.enterWith({ soloSuIA: true });
}

/** ¿Lo que corre ahora es de un negocio con su IA? (lo pregunta lib/ai-cheap.ts antes de dar una key). */
export const soloSuIA = (): boolean => almacen.getStore()?.soloSuIA === true;

/** ¿Este proveedor de la cascada se puede usar ahora? Con «sólo su IA», únicamente su OpenAI, y nunca con la key de otro. */
export function proveedorPermitido(nombre: string, deLaPlataforma: boolean): boolean {
  if (!soloSuIA()) return true;
  return !deLaPlataforma && PROVS_SU_IA.includes(nombre);
}
