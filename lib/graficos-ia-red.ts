// =============================================================================
// graficos-ia-red — la RED DE PLATAFORMA para la IA del Dashboard
// =============================================================================
// Martín, 11/10/2026, sobre la key de Gemini del ws1 que Google bloqueó: «Si, siempre tiene que probar
// con otros provedoores». Las dos IA del Dashboard —el AI Analyst (lib/graficos-analisis-server.ts) y
// «Pídeselo a MaKo» (app/api/graficos/ia/route.ts)— corrían SÓLO con las keys del negocio: con la única
// key de un cliente bloqueada, no había a quién más preguntarle y el panel decía que no pudo.
//
// Esto es el escalón que sigue (AGENTS.md, «TODO CAMINO DE IA QUE USE UN CLIENTE NECESITA SU RED DE
// PLATAFORMA»; molde: lib/offer-ia.ts): las keys GRATIS de la agencia (gemini y groq,
// `provsGratisDePlataforma`), DESPUÉS de las del negocio, con el motivo «⚠ red de plataforma» para que se
// vea en el Saldo de IA, y con sus errores APARTE (sólo al log): con ellos se fabricaría el texto que
// lee el cliente («te quedaste sin cuota» sobre una key suya que contestó 200).
//
// ⚠️ Nunca Claude ni nada que cobre: la red es gratis por construcción.

import 'server-only';
import { chatCheapTools, provsGratisDePlataforma, type ProvName } from './ai-cheap';
import { wsSuperAdmin } from './workspace';

/** Lo mínimo que tiene que quedar del plazo para arrancar un intento (el de lib/ai-cheap.ts). */
const MIN_INTENTO_MS = 15_000;
/** El techo de un intento de la red. */
const TIMEOUT_RED_MS = 60_000;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type RespuestaRed = { texto: string; provider: ProvName };

/**
 * Prueba la red de plataforma, proveedor por proveedor, hasta que uno devuelva algo que pase `validar`.
 * `null` = nadie contestó algo usable (el caller arma el error con los errores del NEGOCIO, no con éstos).
 */
export async function porLaRedDePlataforma(p: {
  system: string; user: string; maxTokens: number; feature: string; motivo: string;
  /** El plazo absoluto del caller (ms epoch). Sin él, un minuto desde ahora. */
  hastaMs?: number;
  validar: (t: string) => boolean;
}): Promise<RespuestaRed | null> {
  const superWs = await wsSuperAdmin().catch(() => null);
  if (superWs == null) return null;
  const red = await provsGratisDePlataforma().catch(() => []);
  const hasta = p.hastaMs ?? Date.now() + TIMEOUT_RED_MS;
  const errores: string[] = [];
  for (const r of red) {
    const queda = hasta - Date.now();
    if (queda < MIN_INTENTO_MS) { errores.push(`sin tiempo para ${r.provider}`); break; }
    try {
      const out = await chatCheapTools(p.system, [{ role: 'user', content: p.user }], [], async () => '', {
        provider: r.provider, clave: r.clave, wsKey: superWs,
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
