// =============================================================================
// reembeber-al-conectar — con su Gemini, el buscador de su conocimiento vuelve (IA16, 22/10/2026)
// =============================================================================
// Desde IA16 el buscador de conocimiento embebe con la Gemini DEL NEGOCIO (lib/embeddings.ts). Lo que un negocio guardó sin
// ella quedó sin vector (o con el viejo de OpenAI, o en `error`), y nada lo volvía a embeber: la revisión adversarial del
// 22/10. Al guardar su Gemini en /integraciones, esto corre en segundo plano y lo embebe con su cuenta. Mismo molde que
// `arrancarHistoricoEnSegundoPlano` (lib/onboarding-extract.ts): `after()` si hay pedido, en línea si no.
// =============================================================================

import 'server-only';
import { after } from 'next/server';
import { runWithWorkspace } from './workspace';
import { reembeberLoQueFalta } from './mako-knowledge';

export async function reembeberAlConectarGemini(ws: number): Promise<void> {
  const trabajo = async () => {
    try {
      const n = await reembeberLoQueFalta();
      if (n) console.log(`[conocimiento] ws ${ws}: conectó su Gemini, re-embebí ${n} entradas`);
    } catch (e) {
      console.error(`[conocimiento] ws ${ws}: no pude re-embeber al conectar su Gemini:`, e instanceof Error ? e.message : e);
    }
  };
  try {
    after(() => runWithWorkspace(ws, trabajo));
    return;
  } catch { /* sin pedido: en línea */ }
  await runWithWorkspace(ws, trabajo);
}
