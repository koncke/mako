// =============================================================================
// POST /api/automations/ai-step/armar — «✦ Armar el resto» de un AI Step (AI Step v2, décima tanda)
// =============================================================================
// { objetivo, medio?, hermanos?: { titulos, hayCualquiera } } → { ok, armado } | { ok:false, error }
//
// Con el OBJETIVO del primer paso, MaKo propone el nombre, cuándo entra, cómo responder y la libertad. UNA
// llamada barata por `CASCADA_DOCS` (los clientes que sólo tienen Gemini también: AGENTS.md, «CASCADA_GRATIS
// no tiene Gemini»), y el CÓDIGO repara el JSON (`repararArmado`, lib/ai-step-armar.ts): nunca «Sola» si habla
// de plata, «Cualquier respuesta» sólo si no la tiene otra tarjeta. No escribe nada: la pantalla aplica lo
// armado por la edición del flujo (borrador → Publicar), y no pisa lo escrito a mano sin preguntar.
//
// Sólo el admin (la pantalla que lo usa es la del lienzo, que el setter no edita).

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { chatCheapCascade, CASCADA_DOCS, errorDeCascada } from '@/lib/ai-cheap';
import { renderPrompt } from '@/lib/prompt-render';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { parseJsonObject } from '@/lib/json-del-modelo';
import { ARMAR_AI_STEP_SYSTEM_TEMPLATE, NOMBRE_MEDIO_PROMPT, pedidoDeArmado, repararArmado } from '@/lib/ai-step-armar';
import { MEDIOS_AI_STEP, type MedioAIStep } from '@/lib/flujo-grafo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  let body: { objetivo?: unknown; medio?: unknown; hermanos?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const objetivo = typeof body.objetivo === 'string' ? body.objetivo.trim().slice(0, 600) : '';
  if (objetivo.length < 4) return Response.json({ ok: false, error: 'Escribe qué tiene que lograr.' }, { status: 400 });
  const medio: MedioAIStep = (MEDIOS_AI_STEP as readonly unknown[]).includes(body.medio) ? (body.medio as MedioAIStep) : 'whatsapp';
  const h = (body.hermanos && typeof body.hermanos === 'object' ? body.hermanos : {}) as { titulos?: unknown; hayCualquiera?: unknown };
  const hermanos = {
    titulos: Array.isArray(h.titulos) ? h.titulos.filter((t): t is string => typeof t === 'string').map((t) => t.slice(0, 60)).slice(0, 20) : [],
    hayCualquiera: h.hayCualquiera === true,
  };

  const [system, perfil] = await Promise.all([
    renderPrompt('automations.ai_step.armar', ARMAR_AI_STEP_SYSTEM_TEMPLATE, { medio: NOMBRE_MEDIO_PROMPT[medio] }),
    perfilNegocioTexto().catch(() => ''),
  ]);
  const errores: string[] = [];
  // Un intento por proveedor que DEVUELVA algo reparable: un JSON que no sirve cuenta como fallo y la cascada
  // sigue (`validar`), en vez de llenar los pasos con algo vacío.
  const crudo = await chatCheapCascade({
    system, user: pedidoDeArmado({ objetivo, perfil, hermanos }), json: true, maxTokens: 900, temperature: 0.3,
    feature: 'automations-ai-step-armar', motivo: 'AI Step: armar el resto desde el objetivo',
    provs: CASCADA_DOCS, erroresOut: errores,
    validar: (t) => { try { return repararArmado(parseJsonObject(t), hermanos) != null; } catch { return false; } },
  });
  if (!crudo?.trim()) return Response.json({ ok: false, error: await errorDeCascada(errores, 'armar el AI Step') }, { status: 502 });
  try {
    const armado = repararArmado(parseJsonObject(crudo), hermanos);
    if (!armado) return Response.json({ ok: false, error: 'MaKo no pudo armarlo. Prueba con otras palabras.' }, { status: 502 });
    return Response.json({ ok: true, armado });
  } catch {
    return Response.json({ ok: false, error: 'MaKo no pudo armarlo. Prueba con otras palabras.' }, { status: 502 });
  }
}
