// =============================================================================
// graficos-ia-red — la RED DE PLATAFORMA para la IA del Dashboard
// =============================================================================
// Martín, 11/10/2026, sobre la key de Gemini del ws1 que Google bloqueó: «Si, siempre tiene que probar
// con otros provedoores». Las IA del Dashboard —el AI Analyst y las cajas «Conclusiones de MaKo»
// (lib/graficos-analisis-server.ts, `pedirIAGratis`) y «Pídeselo a MaKo» (lib/graficos-ia-generar.ts)—
// corrían SÓLO con las keys del negocio: con la única key de un cliente bloqueada, no había a quién más
// preguntarle y el panel decía que no pudo.
//
// Esto es el escalón que sigue (AGENTS.md, «TODO CAMINO DE IA QUE USE UN CLIENTE NECESITA SU RED DE
// PLATAFORMA»), DESPUÉS de las keys del negocio, con el motivo «⚠ red de plataforma» para que se vea en el
// Saldo de IA, y con sus errores APARTE (sólo al log): con ellos se fabricaría el texto que lee el cliente
// («te quedaste sin cuota» sobre una key suya que contestó 200). El ORDEN es el de `chatCheapCascade`
// (lib/ai-cheap.ts), y esta red no pasa por ella, así que lo aplica acá (AGENTS.md: «un camino con su PROPIA
// red aplica la misma regla él mismo»):
//
//   1. el crédito de Claude de la plataforma (lib/anthropic.ts, `conCreditoDeLaPlataforma`; la tercera puerta
//      de lib/veto-claude.ts). No cobra por pedido: es el crédito ya pagado de los planes Max, que vence cada
//      mes sin acumularse. Y la API de Anthropic no entrena con lo que recibe;
//   2. ⛔ LOS DATOS DE LOS CLIENTES DE UN CLIENTE NUNCA VAN A UN PROVEEDOR QUE ENTRENA CON LO QUE RECIBE (regla
//      del 16/10/2026): si el pedido los lleva —la marca `pii` del catálogo (lib/model-catalogo.ts:
//      «dashboard-conclusiones», porque una caja de un pop-up lee el transcript de una llamada) o `p.pii` (las
//      Conclusiones lo pasan caja por caja: `cajaLlevaDatosDeClientes`, lib/graficos-ia-elemento.ts)— la red se
//      corta acá, y el mensaje que arma quien llama manda a conectar una key;
//   3. las keys GRATIS de la agencia (`provsGratisDePlataforma`: el plan gratis de Gemini, que entrena, y Groq).

import 'server-only';
import { chatCheapTools, provsGratisDePlataforma, type ProvName } from './ai-cheap';
import { CATALOGO_MODELOS } from './model-catalogo';
import { getWorkspaceActual, wsSuperAdmin } from './workspace';

/** Lo mínimo que tiene que quedar del plazo para arrancar un intento (el de lib/ai-cheap.ts). */
const MIN_INTENTO_MS = 15_000;
/** El techo de un intento de la red. */
const TIMEOUT_RED_MS = 60_000;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Quién contestó: una key gratis de la agencia, o el crédito de Claude de la plataforma. */
export type RespuestaRed = { texto: string; provider: ProvName | 'crédito de Claude' };

/** ¿El pedido lleva datos de los clientes del negocio? Lo que diga quien llama, y si no, la marca `pii` del catálogo. */
export const llevaDatosDeClientes = (feature: string, pii?: boolean): boolean =>
  pii ?? CATALOGO_MODELOS.some((f) => f.feature === feature && f.pii === true);

/**
 * Prueba la red de plataforma hasta que alguien devuelva algo que pase `validar`.
 * `null` = nadie contestó algo usable, o el pedido lleva datos de clientes y no quedó nada que no entrene (el
 * caller arma el error con los errores del NEGOCIO, no con éstos).
 */
export async function porLaRedDePlataforma(p: {
  system: string; user: string; maxTokens: number; feature: string; motivo: string;
  /** El plazo absoluto del caller (ms epoch). Sin él, un minuto desde ahora. */
  hastaMs?: number;
  validar: (t: string) => boolean;
  /** ¿Lleva datos de los clientes del negocio? Por default lo dice la marca `pii` del catálogo. */
  pii?: boolean;
}): Promise<RespuestaRed | null> {
  const hasta = p.hastaMs ?? Date.now() + TIMEOUT_RED_MS;
  const errores: string[] = [];

  // 1 · El crédito de Claude de la plataforma, PRIMERO (el porqué, en la cabecera y en lib/ai-cheap.ts).
  const wsCliente = await getWorkspaceActual().catch(() => null);
  if (wsCliente != null && hasta - Date.now() >= MIN_INTENTO_MS) {
    const { conCreditoDeLaPlataforma } = await import('./anthropic');
    const c = await conCreditoDeLaPlataforma({
      // Las IA del Dashboard piden JSON (lo lee `validar`).
      system: p.system, user: p.user, json: true, maxTokens: p.maxTokens, feature: p.feature,
      motivo: `⚠ red de plataforma (crédito de Claude) — las keys del negocio no contestaron · ${p.motivo}`.slice(0, 300),
      timeoutMs: Math.min(TIMEOUT_RED_MS, hasta - Date.now()), wsCliente,
    }).catch((e) => ({ error: msg(e) }));
    if (c && 'texto' in c) {
      if (c.texto.trim() && p.validar(c.texto)) return { texto: c.texto, provider: 'crédito de Claude' };
      errores.push('crédito de Claude: contestó y lo descartamos (no tiene la forma pedida)');
    } else if (c && 'error' in c) errores.push(`crédito de Claude: ${c.error}`);
  }

  // 2 · ⛔ Con datos de clientes, nada que entrene: la red termina acá.
  if (llevaDatosDeClientes(p.feature, p.pii)) {
    errores.push('red gratis salteada: el pedido lleva datos de clientes y el plan gratis entrena con lo que recibe');
    console.warn(`[graficos:ia] ${p.motivo} · red de plataforma sin respuesta usable: ${errores.join(' · ').slice(0, 800)}`);
    return null;
  }

  // 3 · Las keys gratis de la agencia.
  const superWs = await wsSuperAdmin().catch(() => null);
  const red = superWs == null ? [] : await provsGratisDePlataforma().catch(() => []);
  for (const r of red) {
    const queda = hasta - Date.now();
    if (queda < MIN_INTENTO_MS) { errores.push(`sin tiempo para ${r.provider}`); break; }
    try {
      const out = await chatCheapTools(p.system, [{ role: 'user', content: p.user }], [], async () => '', {
        provider: r.provider, clave: r.clave, wsKey: superWs!,
        maxTokens: p.maxTokens, timeoutMs: Math.min(TIMEOUT_RED_MS, queda),
        feature: p.feature,
        motivo: `⚠ red de plataforma (${r.provider}) — las keys del negocio no contestaron · ${p.motivo}`.slice(0, 300),
      });
      if (out.text.trim() && p.validar(out.text)) return { texto: out.text, provider: r.provider };
      errores.push(`${r.provider}: contestó y lo descartamos (no tiene la forma pedida)`);
    } catch (e) { errores.push(`${r.provider}: ${msg(e)}`); }
  }
  if (errores.length) console.warn(`[graficos:ia] ${p.motivo} · red de plataforma sin respuesta usable: ${errores.join(' · ').slice(0, 800)}`);
  return null;
}
