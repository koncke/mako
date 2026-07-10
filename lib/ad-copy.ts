// =============================================================================
// ad-copy — MaKo escribe copy de anuncios de Meta (Ads Writer)
// =============================================================================
// Toma un pedido del usuario + el brief REAL del negocio (funnel, oferta, avatar,
// ganadores — reusa buildCampaignBrief de campaign-structurer) y devuelve variantes
// de copy en JSON, cada una con un ángulo distinto. Plantillas editables en
// /configuraciones. NO persiste nada: genera a pedido (patrón "writer", ver skill
// scaffold-mako-writer). El copy sale en español mexicano (audiencia del cliente);
// la voz rioplatense de MaKo va solo en la "nota".
// =============================================================================

import 'server-only';
import { chatClaude } from './anthropic';
import { renderPrompt } from './prompt-render';
import { buildCampaignBrief, brandSystem, parseJsonObject } from './campaign-structurer';

export type AdCopyVariant = {
  angulo: string;
  primary_text: string;
  headline: string;
  description: string;
  cta: string;
};
export type AdCopySet = { variants: AdCopyVariant[]; nota: string };
export type Uso = { tokens: number; costUsd: number } | null;
export type AdCopyResult = { ok: true; set: AdCopySet; uso: Uso } | { ok: false; error: string };

// ── Contrato JSON exacto que MaKo debe devolver (editable como referencia) ──────
export const AD_COPY_JSON_SHAPE = `Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin texto fuera del JSON) con esta forma EXACTA:
{
  "variants": [
    {
      "angulo": "el ángulo/gancho de esta variante en 2-4 palabras (ej: 'dolor', 'prueba social', 'urgencia', 'aspiracional', 'contraintuitivo')",
      "primary_text": "el texto principal del anuncio (cuerpo), 1-4 líneas, con gancho fuerte en la primera línea",
      "headline": "título corto (máx ~40 caracteres)",
      "description": "descripción opcional (máx ~30 caracteres); puede ir vacía",
      "cta": "el llamado a la acción en 1-3 palabras (ej: 'Agenda tu llamada', 'Más información')"
    }
  ],
  "nota": "UNA frase para el dueño (en tu voz rioplatense, hablándome a MÍ): qué variante probar primero y por qué. Máx ~160 caracteres"
}
Devolvé entre 3 y 5 variantes, cada una con un ÁNGULO psicológico DISTINTO.`;

// ── Plantillas (con {{slots}}) — editables en /configuraciones ─────────────────
export const AD_COPY_SUGGEST_SYSTEM_TEMPLATE = `Sos MaKo escribiendo COPY de anuncios de Meta (Facebook/Instagram) para el negocio. Tu trabajo: escribir variantes de copy potentes y accionables, aterrizadas en los DATOS REALES del negocio que te paso (oferta, avatar, funnel, ganadores). Cada variante ataca un ÁNGULO distinto.

REGLAS DE COPY:
- Gancho fuerte en la PRIMERA línea del primary_text (interrumpí el scroll). Nada de "En [empresa] creemos que…".
- Concreto y específico > genérico. Hablá del dolor/deseo real del avatar, no de features.
- Cada línea trazable a lo que sé del negocio; NO inventes cifras, garantías ni resultados que no estén en el contexto.
- Un solo CTA claro por variante.

IDIOMA (IMPORTANTE): el copy del anuncio es para la AUDIENCIA del cliente, que es de MÉXICO. Escribilo en ESPAÑOL NEUTRO/MEXICANO, SIN voseo ni modismos argentinos: usá "tú / tienes / quieres / puedes / agenda / mira", NUNCA "vos / tenés / querés / podés / agendá / mirá / che". Tu voz rioplatense va SOLO en el campo "nota" (cuando me hablás a mí), JAMÁS en el copy del anuncio.

{{jsonShape}}`;

export const AD_COPY_SUGGEST_USER_TEMPLATE = `PEDIDO DEL USUARIO (qué anuncio quiere):
{{prompt}}

CONTEXTO DEL NEGOCIO (datos reales):
{{contexto}}

Devolvé el JSON con tus variantes de copy.`;

export const AD_COPY_ADJUST_SYSTEM_TEMPLATE = `Sos MaKo ajustando variantes de copy que YA escribiste. El usuario te pide un cambio. Aplicá SOLO lo que pide (tono, ángulo, largo, un dato), conservando lo que ya funciona. Mantené las mismas REGLAS DE COPY y de IDIOMA (español mexicano, sin voseo en el copy; tu voz rioplatense solo en "nota").

{{jsonShape}}`;

export const AD_COPY_ADJUST_USER_TEMPLATE = `VARIANTES ACTUALES (JSON):
{{setActual}}

CAMBIO QUE PIDE EL USUARIO:
{{instruccion}}

CONTEXTO DEL NEGOCIO (por si lo necesitás):
{{contexto}}

Devolvé el JSON COMPLETO con las variantes ya ajustadas.`;

// ── Parseo + coerción del JSON de MaKo → AdCopySet ─────────────────────────────
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function parseAdCopySet(text: string): AdCopySet {
  const raw = parseJsonObject(text);
  const arr = Array.isArray(raw.variants) ? raw.variants : [];
  const variants: AdCopyVariant[] = arr
    .slice(0, 5)
    .map((v) => {
      const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
      return {
        angulo: str(o.angulo),
        primary_text: str(o.primary_text),
        headline: str(o.headline),
        description: str(o.description),
        cta: str(o.cta),
      };
    })
    .filter((v) => v.primary_text || v.headline);
  return { variants, nota: str(raw.nota) };
}

// ── Generación pura (envelope {ok}; nunca lanza) ───────────────────────────────
export async function generarAdCopy(opts: {
  mode: 'suggest' | 'adjust';
  prompt?: string;
  setActual?: AdCopySet;
  instruccion?: string;
}): Promise<AdCopyResult> {
  try {
    const prompt = (opts.prompt ?? '').trim();
    const instruccion = (opts.instruccion ?? '').trim();
    // Mismo brief del negocio que usa el creador de campañas (funnel + perfil +
    // KPIs + ganadores + conocimiento). Tolerante a fallos: degrada a "—".
    const contexto = await buildCampaignBrief(prompt || instruccion);
    let uso: Uso = null;

    let text: string;
    if (opts.mode === 'adjust') {
      const sys = await brandSystem(
        await renderPrompt('ads_writer.adjust.system', AD_COPY_ADJUST_SYSTEM_TEMPLATE, { jsonShape: AD_COPY_JSON_SHAPE }),
      );
      const user = await renderPrompt('ads_writer.adjust.user', AD_COPY_ADJUST_USER_TEMPLATE, {
        setActual: JSON.stringify(opts.setActual ?? {}, null, 2),
        instruccion,
        contexto,
      });
      text = await chatClaude(sys, [{ role: 'user', content: user }], {
        model: 'claude-opus-4-8', thinking: true, effort: 'high', maxTokens: 12000, feature: 'ads-writer',
        onUsage: (u) => { uso = { tokens: u.inputTokens + u.outputTokens, costUsd: u.costUsd }; },
      });
    } else {
      const sys = await brandSystem(
        await renderPrompt('ads_writer.suggest.system', AD_COPY_SUGGEST_SYSTEM_TEMPLATE, { jsonShape: AD_COPY_JSON_SHAPE }),
      );
      const user = await renderPrompt('ads_writer.suggest.user', AD_COPY_SUGGEST_USER_TEMPLATE, { prompt, contexto });
      text = await chatClaude(sys, [{ role: 'user', content: user }], {
        model: 'claude-opus-4-8', thinking: true, effort: 'high', maxTokens: 12000, feature: 'ads-writer',
        onUsage: (u) => { uso = { tokens: u.inputTokens + u.outputTokens, costUsd: u.costUsd }; },
      });
    }

    const set = parseAdCopySet(text);
    if (!set.variants.length) return { ok: false, error: 'MaKo no devolvió variantes. Probá reformular el pedido.' };
    return { ok: true, set, uso };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
