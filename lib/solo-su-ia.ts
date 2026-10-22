// =============================================================================
// solo-su-ia — D6b: con su Claude o su GPT, ningún dato del negocio va a Gemini ni a una IA o red gratis
// =============================================================================
// Martín (D6b, 21/10/2026): «un negocio con su Claude o su GPT corre su Ops Center con su cuenta, y Gemini no participa».
// La primera versión lo cortó sólo en la respuesta del modelo (`chatClaudeTools`), y la revisión del Cerebro encontró el
// resto del turno yendo igual a la cascada barata: El Archivero del texto pegado y del PDF, la foto leída con Gemini antes
// de llegar a la PC, la nota de voz, los pedidos del Second Brain (docs/hallazgos-ia.md).
//
// Por eso el corte va ABAJO DE TODO, no en cada llamador: lib/ai-cheap.ts no le da ninguna key barata (`provDe`) ni la
// red de la plataforma (`provsGratisDePlataforma`) a nada que corra adentro. Sólo quedan las IA del NEGOCIO que no son la
// cascada: su clave de Claude (la puerta 2 del veto, lib/anthropic.ts) y su OpenAI (PROVS_SU_IA). El contexto viaja con
// AsyncLocalStorage, también a lo que corre después de responder: `after()` de Next lo ata con `AsyncLocalStorage.bind`.
//
// ⚠️ IA6 (22/10/2026): «con su IA conectada, TODO el negocio usa la suya». Hasta acá el contexto lo prendía QUIEN ATENDÍA el
// pedido (el turno del Ops Center y sus pantallas), y todo lo demás —los crons, los webhooks, WhatsApp, Offer, Automations,
// el simulador, los Analyst— seguía en Gemini aunque el negocio tuviera su Claude (medido: el simulador del ws11 corrió con
// Groq y OpenRouter el 21/10 a las 20:51 UTC, con D6b ya desplegado). Ahora lo decide la PUERTA de la capa de IA: cada
// función pública de lib/ai-cheap.ts y lib/anthropic.ts que llama a un modelo, si nadie decidió antes, decide con el
// workspace en curso (`conD6bDelPedido`). Lo que se agregue mañana con un workspace lo hereda sin acordarse. Quedan afuera
// sólo dos cosas, y las dos por regla de Martín:
//   · las funciones del Plan (`FEATURES_DEL_PLAN`, lib/veto-claude.ts: «JAMÁS algo pago para el Plan»);
//   · lo interno de la plataforma (el workspace del super admin, y lo que corre sin workspace).
//
// Quién decide si el negocio «tiene su IA» y por qué falla cerrado: lib/ia-del-negocio.ts (`negocioConSuIA`).
// =============================================================================

import { AsyncLocalStorage } from 'node:async_hooks';
import { FEATURES_DEL_PLAN } from './veto-claude';

/** Las únicas de la cascada que son «su IA» (su GPT, con su key). Lo demás (Gemini, Groq, Mistral, OpenRouter, Cerebras) no. */
export const PROVS_SU_IA: readonly string[] = ['openai'];

/** La decisión de ESTE pedido: con su IA (`true`) o como siempre (`false`). Sin store = nadie decidió todavía. */
const almacen = new AsyncLocalStorage<{ soloSuIA: boolean }>();

/** Corre `fn` con la decisión tomada: «sólo su IA» si `prender`, como siempre si no. Ya decidido, la puerta no re-decide. */
export function conSoloSuIA<T>(prender: boolean, fn: () => Promise<T>): Promise<T> {
  return almacen.run({ soloSuIA: prender }, fn);
}

/**
 * Lo mismo, para el resto de una función async que ya está corriendo (el turno: envolver sus 300 líneas en un callback
 * era re-indentarlas todas, y cada merge chocaba con todo). Fija la decisión para lo que sigue en ESA función y lo que
 * ella lance —también `after()`—, y no se escapa a quien la llamó: su `await` sigue con el contexto de antes (medido el
 * 21/10/2026 y fijado en tests/solo-su-ia.test.ts). Sólo después de un `await`, nunca en código sincrónico de quien llama.
 */
export function entrarSoloSuIA(prender: boolean): void {
  almacen.enterWith({ soloSuIA: prender });
}

/** ¿Lo que corre ahora es de un negocio con su IA? (lo pregunta lib/ai-cheap.ts antes de dar una key). */
export const soloSuIA = (): boolean => almacen.getStore()?.soloSuIA === true;

/** ¿Alguien ya decidió D6b para este pedido? (la puerta de la capa de IA decide sólo si no). */
export const d6bDecidida = (): boolean => almacen.getStore() !== undefined;

/** ¿Este proveedor de la cascada se puede usar ahora? Con «sólo su IA», únicamente su OpenAI, y nunca con la key de otro. */
export function proveedorPermitido(nombre: string, deLaPlataforma: boolean): boolean {
  if (!soloSuIA()) return true;
  return !deLaPlataforma && PROVS_SU_IA.includes(nombre);
}

/** ¿Esta función queda afuera de D6b por regla de Martín? Hoy, sólo las del Plan. */
export const esFueraDeD6b = (feature?: string | null): boolean => FEATURES_DEL_PLAN.includes((feature ?? '').trim());

/**
 * La decisión por negocio, con una memoria corta: la puerta la pide en cada llamada a un modelo, y `negocioConSuIA` lee
 * tres tablas. 60 s: conectar o sacar su IA se nota al minuto. En `globalThis`, como las otras memorias del repo.
 */
const MEMORIA_MS = 60_000;
const g = globalThis as unknown as { __d6bPorNegocio?: Map<number, { hasta: number; suIA: boolean }> };
const memoria = (g.__d6bPorNegocio ??= new Map());

/** Para los tests: olvidar lo decidido. */
export const olvidarD6b = (): void => memoria.clear();

/**
 * LA PUERTA (IA6). Corre `fn` con D6b decidido para el pedido en curso: si ya lo decidió alguien (el turno, una ruta del
 * Ops Center), igual; si no, por el workspace en curso. Afuera: las funciones del Plan, sin workspace, y la plataforma.
 * Falla CERRADA: si no se puede saber, `negocioConSuIA` dice que sí (lib/ia-del-negocio.ts).
 */
export async function conD6bDelPedido<T>(feature: string | null | undefined, fn: () => Promise<T>): Promise<T> {
  if (d6bDecidida()) return fn();
  if (esFueraDeD6b(feature)) return conSoloSuIA(false, fn);
  const { getWorkspaceActual, wsSuperAdmin } = await import('./workspace');
  const ws = await getWorkspaceActual().catch(() => null);
  // Sin workspace no hay negocio: lo interno de la plataforma (y los crons antes de elegir a quién atienden).
  if (ws == null) return fn();
  const m = memoria.get(ws);
  let suIA: boolean;
  if (m && m.hasta > Date.now()) suIA = m.suIA;
  else {
    let plataforma: number | null = null;
    try { plataforma = await wsSuperAdmin(); } catch { plataforma = null; }
    if (ws === plataforma) suIA = false;
    else {
      const { negocioConSuIA } = await import('./ia-del-negocio');
      suIA = (await negocioConSuIA(ws)).suIA;
    }
    memoria.set(ws, { hasta: Date.now() + MEMORIA_MS, suIA });
  }
  return conSoloSuIA(suIA, fn);
}
