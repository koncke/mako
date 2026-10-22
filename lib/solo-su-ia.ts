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
 * La decisión de D6b para el pedido en curso, sin correr nada: la de alguien de afuera si ya decidió; si no, por el
 * workspace. Afuera: las funciones del Plan (SIEMPRE, también adentro de otro pedido que decidió «adentro»), sin workspace,
 * y la plataforma. Falla CERRADA: si no se puede saber, `negocioConSuIA` dice que sí — y ESA respuesta no se recuerda.
 *
 * Revisión adversarial de IA6 (22/10/2026), lo que la primera versión hacía mal:
 *   · sin workspace devolvía `fn()` SIN guardar la decisión, y `fn` es la misma función pública, que volvía a entrar a la
 *     puerta: un bucle de microtareas que CONGELABA el proceso entero (ni un `setTimeout` corría);
 *   · el Plan se miraba DESPUÉS de «ya decidido»: un `plan-fathom` adentro de una herramienta del doer usaba la OpenAI del
 *     negocio (el Plan nunca paga IA) o se quedaba sin nada;
 *   · «no pude saber» quedaba 60 s en la memoria: un bache de la base dejaba a un negocio sin su Gemini un minuto entero.
 */
export async function decidirD6b(feature?: string | null): Promise<boolean> {
  if (esFueraDeD6b(feature)) return false;
  if (d6bDecidida()) return soloSuIA();
  const { getWorkspaceActual, wsSuperAdmin } = await import('./workspace');
  const ws = await getWorkspaceActual().catch(() => null);
  // Sin workspace no hay negocio: lo interno de la plataforma (y los crons antes de elegir a quién atienden).
  if (ws == null) return false;
  const m = memoria.get(ws);
  if (m && m.hasta > Date.now()) return m.suIA;
  let plataforma: number | null = null;
  try { plataforma = await wsSuperAdmin(); } catch { plataforma = null; }
  if (ws === plataforma) {
    memoria.set(ws, { hasta: Date.now() + MEMORIA_MS, suIA: false });
    return false;
  }
  const { negocioConSuIA } = await import('./ia-del-negocio');
  const negocio = await negocioConSuIA(ws);
  if (!negocio.incierto) memoria.set(ws, { hasta: Date.now() + MEMORIA_MS, suIA: negocio.suIA });
  return negocio.suIA;
}

/**
 * LA PUERTA (IA6). Corre `fn` con D6b decidido para el pedido en curso (`decidirD6b`), y la decisión queda GUARDADA para
 * todo lo que `fn` llame: la próxima función de la capa de IA ya no vuelve a entrar.
 */
export async function conD6bDelPedido<T>(feature: string | null | undefined, fn: () => Promise<T>): Promise<T> {
  // El Plan siempre afuera, aunque alguien haya decidido «adentro» antes (la regla de Martín).
  if (esFueraDeD6b(feature)) return conSoloSuIA(false, fn);
  if (d6bDecidida()) return fn();
  return conSoloSuIA(await decidirD6b(feature), fn);
}

/**
 * ¿Esta llamada tiene que pasar por la puerta? Sí si nadie decidió todavía, y también si alguien decidió «adentro» y la
 * función es del Plan (revisión de IA6: con sólo `!d6bDecidida()`, un `plan-fathom` adentro de una herramienta del doer
 * nunca llegaba a su excepción y usaba la OpenAI del negocio).
 */
export const pasaPorLaPuerta = (feature?: string | null): boolean => !d6bDecidida() || (soloSuIA() && esFueraDeD6b(feature));
