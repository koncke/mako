import 'server-only';

// =============================================================================
// newsletter-ia — la idea de la próxima edición, con la IA del NEGOCIO
// =============================================================================
// La tab Newsletters abre sin IA (MaKo pregunta cada cuánto y de qué trata: lib/newsletter-reglas.ts). Cuando la persona
// contesta, MaKo propone el asunto y la idea de la próxima edición con la IA del negocio: la misma cascada que el
// Copywriter (`chatClaude` con su feature, GRATIS y con Claude vetado sin fila en CLAUDE_PERMITIDO), así que quien paga
// es el negocio, con SU IA. Sin IA, la tab sigue: la edición se escribe en el Copywriter.
// Nunca manda nada: lo que vuelve es una PROPUESTA.
// =============================================================================

import { chatClaude } from './anthropic';
import { errorDeCascada } from './ai-cheap';
import { renderPrompt, contenidoNoConfiable } from './prompt-render';
import { parseJsonObject } from './json-del-modelo';
import { contextoDelNegocio } from './copywriter/contexto';
import { FRECUENCIAS, type ConfigNewsletter } from './newsletter-reglas';
import { PROMPTS_NEWSLETTER, leerPropuesta } from './newsletter-ia-reglas';

export const FEATURE_NEWSLETTER = 'newsletter-ia';
const PLAZO_MS = 45_000;

export type Propuesta = { ok: true; asunto: string; idea: string } | { ok: false; error: string };

export async function proponerEdicion(cfg: ConfigNewsletter, anteriores: readonly string[]): Promise<Propuesta> {
  if (!cfg.tema) return { ok: false, error: 'Primero dime de qué trata tu newsletter.' };
  const t0 = Date.now();
  try {
    const negocio = await contextoDelNegocio(`newsletter sobre ${cfg.tema}`).catch(() => '');
    const sys = await renderPrompt(PROMPTS_NEWSLETTER.propuestaSystem.key, PROMPTS_NEWSLETTER.propuestaSystem.tpl, {});
    const user = await renderPrompt(PROMPTS_NEWSLETTER.propuestaUser.key, PROMPTS_NEWSLETTER.propuestaUser.tpl, {
      tema: contenidoNoConfiable(cfg.tema, 'tema'),
      frecuencia: FRECUENCIAS.find((f) => f.id === cfg.frecuencia)?.label ?? 'sin definir',
      anteriores: anteriores.length ? contenidoNoConfiable(anteriores.slice(0, 12).map((a) => `- ${a}`).join('\n'), 'anteriores') : '(es la primera)',
      negocio: `EL NEGOCIO (del Second Brain, sólo lo que hace falta):\n${negocio ? contenidoNoConfiable(negocio, 'negocio') : '(no hay datos del negocio cargados)'}`,
    });
    const salida = await chatClaude(sys, [{ role: 'user', content: user }], {
      feature: FEATURE_NEWSLETTER,
      motivo: 'Proponer la próxima edición (Newsletter)',
      maxTokens: 400,
      thinking: false,
      hastaMs: t0 + PLAZO_MS,
    });
    let leida: { asunto: string; idea: string } | null = null;
    try { leida = leerPropuesta(parseJsonObject(String(salida ?? ''))); } catch { leida = null; }
    if (!leida) return { ok: false, error: 'MaKo respondió pero no se pudo leer. Vuelve a intentar.' };
    return { ok: true, ...leida };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[newsletter] proponer la edición: ${msg}`);
    return { ok: false, error: await errorDeCascada(/Claude vetado/i.test(msg) ? [] : [msg], 'proponer la próxima edición') };
  }
}
