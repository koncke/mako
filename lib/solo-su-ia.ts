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
const almacen = new AsyncLocalStorage<{
  soloSuIA: boolean;
  /** Es la decisión del PLAN (`planConSuClave`): adentro, otra función del Plan no vuelve a la puerta. */
  delPlan?: true;
  /** Con `delPlan`: la decisión del pedido de AFUERA, si había una. Lo que no es del Plan y se llama desde adentro usa ésa. */
  deAfuera?: boolean;
}>();

/** Corre `fn` con la decisión tomada: «sólo su IA» si `prender`, como siempre si no. Ya decidido, la puerta no re-decide. */
export function conSoloSuIA<T>(prender: boolean, fn: () => Promise<T>): Promise<T> {
  return almacen.run({ soloSuIA: prender }, fn);
}

/**
 * La decisión del PLAN, marcada, guardando la del pedido de afuera: sin eso, lo que no era del Plan y se llamaba desde
 * adentro de una función del Plan heredaba la decisión del Plan (revisión adversarial de IA15, 22/10/2026).
 */
function conDecisionDelPlan<T>(prender: boolean, fn: () => Promise<T>): Promise<T> {
  const st = almacen.getStore();
  const deAfuera = st ? (st.delPlan ? st.deAfuera : st.soloSuIA) : undefined;
  return almacen.run({ soloSuIA: prender, delPlan: true, ...(deAfuera === undefined ? {} : { deAfuera }) }, fn);
}

/** ¿Lo que corre ya tiene la decisión del Plan? */
const planDecidido = (): boolean => almacen.getStore()?.delPlan === true;

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

/**
 * ¿Es una función del Plan? Su D6b se decide APARTE (`planConSuClave`, lib/ia-del-negocio.ts): hasta el 22/10/2026 el Plan
 * quedaba siempre afuera («el Plan nunca paga IA»); desde ahí, Martín: «Sí, si es su clave». Con una clave de API propia que
 * paga el negocio, su Plan usa SÓLO esa (D6b); sin ninguna —o con su PC sola, o con el crédito de Martín—, como siempre.
 */
export const esDelPlan = (feature?: string | null): boolean => FEATURES_DEL_PLAN.includes((feature ?? '').trim());

/**
 * La decisión por negocio, con una memoria corta: la puerta la pide en cada llamada a un modelo, y `negocioConSuIA` lee
 * tres tablas. 60 s: conectar o sacar su IA se nota al minuto. En `globalThis`, como las otras memorias del repo.
 */
const MEMORIA_MS = 60_000;
const g = globalThis as unknown as { __d6bPorNegocioYPlan?: Map<string, { hasta: number; suIA: boolean }> };
/** Por negocio (`"3"`) y, aparte, la del Plan de ese negocio (`"plan:3"`). */
const memoria = (g.__d6bPorNegocioYPlan ??= new Map());

/** Para los tests: olvidar lo decidido. */
export const olvidarD6b = (): void => memoria.clear();

/**
 * La decisión de D6b para el pedido en curso, sin correr nada: la de alguien de afuera si ya decidió; si no, por el
 * workspace. Las funciones del Plan, SIEMPRE con la suya (`planConSuClave`: su clave paga, sí; su PC o el crédito de
 * Martín, no), también adentro de otro pedido que ya decidió. Afuera: sin workspace y la plataforma. Falla CERRADA: si no
 * se puede saber, se dice que sí — y ESA respuesta no se recuerda.
 *
 * Revisión adversarial de IA6 (22/10/2026), lo que la primera versión hacía mal:
 *   · sin workspace devolvía `fn()` SIN guardar la decisión, y `fn` es la misma función pública, que volvía a entrar a la
 *     puerta: un bucle de microtareas que CONGELABA el proceso entero (ni un `setTimeout` corría);
 *   · el Plan se miraba DESPUÉS de «ya decidido»: un `plan-fathom` adentro de una herramienta del doer seguía la decisión
 *     del doer y no la del Plan;
 *   · «no pude saber» quedaba 60 s en la memoria: un bache de la base dejaba a un negocio sin su Gemini un minuto entero.
 */
export async function decidirD6b(feature?: string | null): Promise<boolean> {
  // El Plan se decide SIEMPRE aparte, también adentro de otro pedido que ya decidió (su regla no es la del pedido). Y lo
  // que no es del Plan, adentro de una función del Plan, usa la decisión de AFUERA (o la propia), nunca la del Plan.
  const plan = esDelPlan(feature);
  const st = almacen.getStore();
  if (plan && st?.delPlan) return st.soloSuIA;
  if (!plan && st && !st.delPlan) return st.soloSuIA;
  if (!plan && st?.delPlan && st.deAfuera !== undefined) return st.deAfuera;
  return (await decisionPorNegocio(plan)).suIA;
}

/**
 * Lo que dice el negocio en curso, por workspace y con la memoria de 60 s: «tiene su IA» (`negocioConSuIA`) o, para el
 * Plan, «tiene su clave paga» (`planConSuClave`). Con su «no pude saber» (`incierto`), que no se recuerda.
 */
async function decisionPorNegocio(plan: boolean): Promise<{ suIA: boolean; incierto?: true }> {
  const { getWorkspaceActual, wsSuperAdmin } = await import('./workspace');
  const ws = await getWorkspaceActual().catch(() => null);
  // Sin workspace no hay negocio: lo interno de la plataforma (y los crons antes de elegir a quién atienden).
  if (ws == null) return { suIA: false };
  const k = plan ? `plan:${ws}` : String(ws);
  const m = memoria.get(k);
  if (m && m.hasta > Date.now()) return { suIA: m.suIA };
  let plataforma: number | null = null;
  try { plataforma = await wsSuperAdmin(); } catch { plataforma = null; }
  if (ws === plataforma) {
    memoria.set(k, { hasta: Date.now() + MEMORIA_MS, suIA: false });
    return { suIA: false };
  }
  const { negocioConSuIA, planConSuClave } = await import('./ia-del-negocio');
  const r = plan ? await planConSuClave(ws).then((x) => ({ suIA: x.suClave, incierto: x.incierto })) : await negocioConSuIA(ws);
  if (!r.incierto) memoria.set(k, { hasta: Date.now() + MEMORIA_MS, suIA: r.suIA });
  return r.incierto ? { suIA: r.suIA, incierto: true } : { suIA: r.suIA };
}

/**
 * ¿El Plan del negocio en curso puede pagar con SU clave? Sólo con la decisión del Plan en «sí» y CIERTA. La pide la
 * puerta 2 (lib/anthropic.ts → `permisoDeLaClaveDelNegocio`) para toda función del Plan: la cascada prueba la puerta 2
 * en cualquier pedido, y sin esto un «no pude saber» —o una frontera que no reconoció el crédito— dejaba pagar al Plan
 * (revisión adversarial de IA15).
 */
export async function planPuedePagarConSuClave(): Promise<boolean> {
  const d = await decisionPorNegocio(true).catch(() => ({ suIA: false, incierto: true as const }));
  return d.suIA && !d.incierto;
}

/**
 * LA PUERTA (IA6). Corre `fn` con D6b decidido para el pedido en curso (`decidirD6b`), y la decisión queda GUARDADA para
 * todo lo que `fn` llame: la próxima función de la capa de IA ya no vuelve a entrar.
 */
export async function conD6bDelPedido<T>(feature: string | null | undefined, fn: () => Promise<T>): Promise<T> {
  // El Plan, con SU decisión (`planConSuClave`), aunque alguien haya decidido antes otra cosa para el pedido.
  if (esDelPlan(feature)) return planDecidido() ? fn() : conDecisionDelPlan(await decidirD6b(feature), fn);
  if (d6bDecidida() && !planDecidido()) return fn();
  return conSoloSuIA(await decidirD6b(feature), fn);
}

/**
 * ¿Esta llamada tiene que pasar por la puerta? Sí si nadie decidió todavía, y también si la función es del Plan, que se
 * decide aparte (revisión de IA6: con sólo `!d6bDecidida()`, un `plan-fathom` adentro de una herramienta del doer nunca
 * llegaba a su regla). Para que no re-entre sin fin, la puerta del Plan guarda su decisión y re-entra con ella: la segunda
 * vez `d6bDecidida()` y `planDecidido()` ya son ciertos. Y al revés: lo que NO es del Plan y trae su `feature`, adentro de
 * una función del Plan, vuelve a pasar para usar SU decisión (la de afuera, o la del negocio), no la del Plan (revisión
 * adversarial de IA15). Lo que no trae `feature` (`provsDe`, la red) sigue con la del Plan.
 */
export const pasaPorLaPuerta = (feature?: string | null): boolean =>
  !d6bDecidida() || (esDelPlan(feature) ? !planDecidido() : planDecidido() && !!feature?.trim());
