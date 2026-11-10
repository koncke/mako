// =============================================================================
// Marketing CoPilot — el contexto con los prompts EDITABLES vigentes (9/11/2026)
// =============================================================================
// Las reglas del agente, lo que sabe de los otros caminos y lo que sabe de anuncios se editan en /configuraciones (grupo «Marketing
// CoPilot», lib/prompt-registry.ts). El default vive en ./copiloto-contexto.ts (puro, lo leen los tests); acá se lee el override.
// TODO call site del contexto del CoPilot pasa por acá (la ruta del chat y el arnés): uno que use `contextoDelCopiloto` a secas queda
// MUDO a la edición. tests/marketing-copilot-agente.test.ts lo cuenta.
// =============================================================================

import 'server-only';
import { getPromptText } from '@/lib/prompt-render';
import { PROMPTS_COPILOTO, contextoDelCopiloto, type TextosDelCopiloto } from './copiloto-contexto';
import type { PerfilCopiloto } from './copiloto';

/** Los tres textos vigentes. Una lectura que falla vuelve al default (el turno no se cae por la edición). */
export async function textosDelCopilotoVigentes(): Promise<TextosDelCopiloto> {
  const leer = (x: { key: string; tpl: string }) => getPromptText(x.key, x.tpl).catch(() => x.tpl);
  const [reglas, canales, anuncios] = await Promise.all([leer(PROMPTS_COPILOTO.reglas), leer(PROMPTS_COPILOTO.canales), leer(PROMPTS_COPILOTO.anuncios)]);
  return { reglas, canales, anuncios };
}

export async function contextoDelCopilotoVigente(p: PerfilCopiloto): Promise<string> {
  return contextoDelCopiloto(p, await textosDelCopilotoVigentes());
}
