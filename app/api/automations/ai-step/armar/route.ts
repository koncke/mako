// =============================================================================
// POST /api/automations/ai-step/armar — «✦ Armar» y «✦ Otro con MaKo» de un AI Step (undécima tanda)
// =============================================================================
// { objetivo, medio?, modo?: 'todo' | 'uno', escenarios?: [{ titulo, cuando? }] }
//   → { ok, armado: { escenarios: [{ titulo, cuando, responder, libertad }], lo_demas } } | { ok:false, error }
//
// Con el OBJETIVO del primer paso, MaKo arma los escenarios del AI Step (`modo: 'todo'`, de 2 a 6, y qué pasa con
// «Lo demás») o UNO más que no repita los que ya están (`modo: 'uno'`, «✦ Otro con MaKo»). UNA llamada barata por
// `CASCADA_DOCS` (los clientes que sólo tienen Gemini también: AGENTS.md, «CASCADA_GRATIS no tiene Gemini»), y el
// CÓDIGO repara el JSON (`repararArmado`, lib/ai-step-armar.ts): títulos únicos, «cuándo» obligatorio, nunca «Sola»
// si habla de plata, «Lo demás» nunca «Sola», tope 10. No escribe nada: la pantalla aplica lo armado por la edición
// del flujo (borrador → Publicar), y con escenarios ya puestos pregunta «¿Reemplazo?».
//
// Sólo el admin (la pantalla que lo usa es la del lienzo, que el setter no edita).

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { chatCheapCascade, CASCADA_DOCS, errorDeCascada } from '@/lib/ai-cheap';
import { renderPrompt } from '@/lib/prompt-render';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { parseJsonObject } from '@/lib/json-del-modelo';
import { ARMAR_AI_STEP_SYSTEM_TEMPLATE, NOMBRE_MEDIO_PROMPT, pedidoDeArmado, repararArmado, type ModoArmado } from '@/lib/ai-step-armar';
import { MEDIOS_AI_STEP, TOPE_ESCENARIOS_AI_STEP, type MedioAIStep } from '@/lib/flujo-grafo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  let body: { objetivo?: unknown; medio?: unknown; modo?: unknown; escenarios?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const objetivo = typeof body.objetivo === 'string' ? body.objetivo.trim().slice(0, 600) : '';
  if (objetivo.length < 4) return Response.json({ ok: false, error: 'Escribe el objetivo.' }, { status: 400 });
  const medio: MedioAIStep = (MEDIOS_AI_STEP as readonly unknown[]).includes(body.medio) ? (body.medio as MedioAIStep) : 'whatsapp';
  const modo: ModoArmado = body.modo === 'uno' ? 'uno' : 'todo';
  const yaEstan = (Array.isArray(body.escenarios) ? body.escenarios : [])
    .flatMap((e) => {
      const o = (e && typeof e === 'object' ? e : {}) as { titulo?: unknown; cuando?: unknown };
      const titulo = typeof o.titulo === 'string' ? o.titulo.trim().slice(0, 60) : '';
      return titulo ? [{ titulo, cuando: typeof o.cuando === 'string' ? o.cuando.trim().slice(0, 300) : '' }] : [];
    })
    .slice(0, TOPE_ESCENARIOS_AI_STEP + 2);
  if (modo === 'uno' && yaEstan.length >= TOPE_ESCENARIOS_AI_STEP) {
    return Response.json({ ok: false, error: `Ya tiene ${TOPE_ESCENARIOS_AI_STEP} escenarios.` }, { status: 400 });
  }
  // Los nombres que no se pueden repetir: con «✦ Otro con MaKo», los que ya están; con «✦ Armar», nada (los reemplaza).
  const existentes = modo === 'uno' ? yaEstan.map((e) => e.titulo) : [];

  const [system, perfil] = await Promise.all([
    renderPrompt('automations.ai_step.armar', ARMAR_AI_STEP_SYSTEM_TEMPLATE, { medio: NOMBRE_MEDIO_PROMPT[medio] }),
    perfilNegocioTexto().catch(() => ''),
  ]);
  const errores: string[] = [];
  // Un intento por proveedor que DEVUELVA algo reparable: un JSON que no sirve cuenta como fallo y la cascada
  // sigue (`validar`), en vez de llenar el paso con algo vacío.
  const crudo = await chatCheapCascade({
    system, user: pedidoDeArmado({ objetivo, perfil, modo, yaEstan }), json: true, maxTokens: modo === 'uno' ? 600 : 1800, temperature: 0.3,
    feature: 'automations-ai-step-armar', motivo: modo === 'uno' ? 'AI Step: otro escenario desde el objetivo' : 'AI Step: armar los escenarios desde el objetivo',
    provs: CASCADA_DOCS, erroresOut: errores,
    validar: (t) => { try { return repararArmado(parseJsonObject(t), { existentes, modo }) != null; } catch { return false; } },
  });
  if (!crudo?.trim()) return Response.json({ ok: false, error: await errorDeCascada(errores, 'armar el AI Step') }, { status: 502 });
  try {
    const armado = repararArmado(parseJsonObject(crudo), { existentes, modo });
    if (!armado) return Response.json({ ok: false, error: 'MaKo no pudo armarlo. Prueba con otras palabras.' }, { status: 502 });
    return Response.json({ ok: true, armado });
  } catch {
    return Response.json({ ok: false, error: 'MaKo no pudo armarlo. Prueba con otras palabras.' }, { status: 502 });
  }
}
