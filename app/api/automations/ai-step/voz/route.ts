// =============================================================================
// /api/automations/ai-step/voz — las voces de un AI Step y «Escuchar» (AI Step v2, décima tanda)
// =============================================================================
// GET                      → { propia:{nombre}|null, otras:[{voiceId,nombre}], hayKey }
// POST { voz, texto }      → { audio (mp3 en base64) }   la prueba de cómo suena una respuesta
//
// El diseño, en docs/diseno-ai-step-v2.md §5. Clonar (la propia u «otra voz») va por la ruta que ya existe,
// /api/onboarding/voz (`destino: 'otra'`): una sola puerta para crear un clon y para su consentimiento.
//
// «Escuchar» dice el texto con la MISMA partición que el motor (`partirTextoParaVoz`: sin links ni emojis) y
// con el mismo tope (`TOPE_TEXTO_AUDIO`): lo que no entra no se corta, y la pantalla lo dice. Cobra caracteres
// de ElevenLabs del CLIENTE (BYOK): sale sólo cuando la persona aprieta, nunca solo.

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { getVozCliente } from '@/app/video-generator/voz-cliente';
import { decirConVoz, elevenKey } from '@/lib/elevenlabs';
import { partirTextoParaVoz, TOPE_TEXTO_AUDIO } from '@/lib/ai-step-voz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

async function autorizado(): Promise<boolean> {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  return ws != null && rol === 'admin';
}

export async function GET() {
  if (!(await autorizado())) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  try {
    const v = await getVozCliente();
    return Response.json({
      ok: true,
      propia: v.clon ? { nombre: v.clon.nombre } : null,
      otras: (v.otras ?? []).map((o) => ({ voiceId: o.voiceId, nombre: o.nombre })),
      hayKey: (await elevenKey()) != null,
    });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await autorizado())) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  let body: { voz?: unknown; texto?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const voz = typeof body.voz === 'string' ? body.voz : '';
  const { hablado } = partirTextoParaVoz(typeof body.texto === 'string' ? body.texto : '');
  if (!hablado) return Response.json({ ok: false, error: 'No hay nada que decir.' }, { status: 400 });
  const v = await getVozCliente();
  const voiceId = voz === 'propia' ? (v.clon?.voiceId ?? '') : ((v.otras ?? []).some((o) => o.voiceId === voz) ? voz : '');
  if (!voiceId) return Response.json({ ok: false, error: voz === 'propia' ? 'Todavía no clonaste tu voz.' : 'Esa voz ya no está.' }, { status: 400 });
  const r = await decirConVoz(voiceId, hablado, { tope: TOPE_TEXTO_AUDIO });
  if (!r.ok) return Response.json({ ok: false, error: r.error, motivo: r.motivo }, { status: r.motivo === 'nuestra' ? 400 : 502 });
  return Response.json({ ok: true, audio: r.valor.mp3.toString('base64') });
}
