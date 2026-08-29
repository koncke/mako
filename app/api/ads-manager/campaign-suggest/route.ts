// =============================================================================
// POST /api/ads-manager/campaign-suggest — MaKo PROPONE (o AJUSTA) una campaña
// =============================================================================
// mode='suggest': { prompt, creativos? } → MaKo arma un CampaignSpec aterrizado
//   en el funnel + KPIs + ganadores del negocio (objetivo elegido según el funnel).
// mode='adjust' : { specActual, instruccion } → MaKo aplica el cambio pedido.
// Devuelve { ok, spec, uso }. El prompt es editable en /configuraciones.
// =============================================================================

import type { NextRequest } from 'next/server';
import { chatClaude } from '@/lib/anthropic';
import { renderPrompt } from '@/lib/prompt-render';
import {
  CAMPAIGN_SUGGEST_SYSTEM_TEMPLATE, CAMPAIGN_SUGGEST_USER_TEMPLATE,
  CAMPAIGN_ADJUST_SYSTEM_TEMPLATE, CAMPAIGN_ADJUST_USER_TEMPLATE,
  CAMPAIGN_METODOLOGIA, CAMPAIGN_JSON_SHAPE, objetivosTexto,
  buildCampaignBrief, brandSystem, parseCampaignSpec,
} from '@/lib/campaign-structurer';
import type { CampaignSpec, Objective } from '@/lib/campaign-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: { mode?: string; prompt?: string; creativos?: string; specActual?: CampaignSpec; instruccion?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const mode = body.mode === 'adjust' ? 'adjust' : 'suggest';
  const prompt = String(body.prompt ?? '').trim();
  const instruccion = String(body.instruccion ?? '').trim();
  if (mode === 'suggest' && !prompt) return Response.json({ ok: false, error: 'Escribe qué campaña quieres que arme MaKo.' }, { status: 400 });
  if (mode === 'adjust' && (!instruccion || !body.specActual)) return Response.json({ ok: false, error: 'Falta el cambio a aplicar o el spec actual.' }, { status: 400 });

  try {
    let uso: { tokens: number; costUsd: number } | null = null;
    const contexto = await buildCampaignBrief(prompt || instruccion);

    let text: string;
    if (mode === 'adjust') {
      const sys = await brandSystem(await renderPrompt('campaign.adjust.system', CAMPAIGN_ADJUST_SYSTEM_TEMPLATE, { jsonShape: CAMPAIGN_JSON_SHAPE }));
      const user = await renderPrompt('campaign.adjust.user', CAMPAIGN_ADJUST_USER_TEMPLATE, { specActual: JSON.stringify(body.specActual, null, 2), instruccion, contexto });
      text = await chatClaude(sys, [{ role: 'user', content: user }], {
        thinking: true, effort: 'high', maxTokens: 16000, feature: 'campaign-suggest',
        onUsage: (u) => { uso = { tokens: u.inputTokens + u.outputTokens, costUsd: u.costUsd }; },
      });
    } else {
      const sys = await brandSystem(await renderPrompt('campaign.suggest.system', CAMPAIGN_SUGGEST_SYSTEM_TEMPLATE, { metodologia: CAMPAIGN_METODOLOGIA, objetivos: objetivosTexto(), jsonShape: CAMPAIGN_JSON_SHAPE }));
      const creativos = String(body.creativos ?? '').trim() || 'Ninguno especificado todavía (el usuario adjunta los creativos en la app).';
      const user = await renderPrompt('campaign.suggest.user', CAMPAIGN_SUGGEST_USER_TEMPLATE, { prompt, creativos, contexto });
      text = await chatClaude(sys, [{ role: 'user', content: user }], {
        thinking: true, effort: 'high', maxTokens: 16000, feature: 'campaign-suggest',
        onUsage: (u) => { uso = { tokens: u.inputTokens + u.outputTokens, costUsd: u.costUsd }; },
      });
    }

    const fallbackObjective: Objective = body.specActual?.objective ?? 'OUTCOME_LEADS';
    const spec = parseCampaignSpec(text, fallbackObjective);
    return Response.json({ ok: true, spec, uso });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ads-manager:campaign-suggest] ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
