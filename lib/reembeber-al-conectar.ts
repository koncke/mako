// =============================================================================
// reembeber-al-conectar — con su IA, el buscador de su conocimiento vuelve a entender (IA16, 22/10/2026; 25/10/2026)
// =============================================================================
// El buscador de conocimiento embebe con la IA DEL NEGOCIO: su OpenAI, o su Gemini si es lo único (lib/embeddings.ts). Lo que
// un negocio guardó sin ella quedó sin vector (se busca por palabras), y lo que guardó con la otra quedó con el vector de otro
// modelo. Al guardar su clave de OpenAI o de Gemini en /integraciones, esto corre en segundo plano y lo embebe con su cuenta, por
// tandas de `REEMBEBER_DE_A` y hasta `PLAZO_MS`; lo que quede, lo sigue el goteo de cada búsqueda (`gotear`,
// lib/mako-knowledge.ts). Mismo molde que `arrancarHistoricoEnSegundoPlano` (lib/onboarding-extract.ts): `after()` si hay
// pedido, en línea si no.
// =============================================================================

import 'server-only';
import { after } from 'next/server';
import { runWithWorkspace } from './workspace';
import { reembeberLoQueFalta, REEMBEBER_DE_A } from './mako-knowledge';

/** Las claves que embeben (lib/embeddings.ts, `embebedorDelNegocio`). */
export const EMBEBEN = ['openai', 'gemini'] as const;
const PLAZO_MS = 40_000;

export async function reembeberAlConectarSuIA(ws: number): Promise<void> {
  const trabajo = async () => {
    const hasta = Date.now() + PLAZO_MS;
    let total = 0;
    try {
      for (let n = REEMBEBER_DE_A; n === REEMBEBER_DE_A && Date.now() < hasta; total += n) n = await reembeberLoQueFalta(REEMBEBER_DE_A);
      if (total) console.log(`[conocimiento] ws ${ws}: conectó su IA, re-embebí ${total} entradas`);
    } catch (e) {
      console.error(`[conocimiento] ws ${ws}: no pude re-embeber al conectar su IA:`, e instanceof Error ? e.message : e);
    }
  };
  try {
    after(() => runWithWorkspace(ws, trabajo));
    return;
  } catch { /* sin pedido: en línea */ }
  await runWithWorkspace(ws, trabajo);
}
