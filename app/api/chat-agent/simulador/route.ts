// =============================================================================
// API: simulador de conversación de /setting — MaKo responde como setter
// =============================================================================
// POST { secuenciaId, historial: [{ de: 'lead'|'negocio', texto }] } → { respuesta }
// El dueño (o el setter) escribe como el lead y MaKo contesta con la secuencia de mensajes de
// la secuencia. Sandbox puro: no envía nada, no persiste nada. Admin y setter
// (el setter entrena con el simulador; no puede editar secuencias igual).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { responderSimulador, type TurnoSim } from '@/lib/setting-simulador';
import { transcribirAudio } from '@/lib/ai-cheap';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function POST(req: NextRequest) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || (rol !== 'admin' && rol !== 'setter')) {
    return Response.json({ ok: false, error: 'Sin acceso al simulador en este workspace.' }, { status: 403 });
  }
  let body: { secuenciaId?: unknown; historial?: unknown; audioBase64?: unknown; audioMime?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const id = Number(body.secuenciaId);
  if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'secuenciaId inválido' }, { status: 400 });
  const historial: TurnoSim[] = Array.isArray(body.historial)
    ? (body.historial as Array<Record<string, unknown>>)
        .filter((t) => (t?.de === 'lead' || t?.de === 'negocio') && typeof t?.texto === 'string' && (t.texto as string).trim())
        .map((t) => ({ de: t.de as 'lead' | 'negocio', texto: String(t.texto) }))
    : [];

  try {
    // Nota de voz del "lead": se transcribe (STT barato) y entra como su turno.
    let transcript: string | null = null;
    if (typeof body.audioBase64 === 'string' && body.audioBase64) {
      if (body.audioBase64.length > 8_000_000) return Response.json({ ok: false, error: 'El audio es muy largo para el simulador.' }, { status: 400 });
      transcript = (await transcribirAudio(body.audioBase64, typeof body.audioMime === 'string' && body.audioMime ? body.audioMime : 'audio/mpeg')).trim();
      if (!transcript) return Response.json({ ok: false, error: 'No entendí el audio — probá de nuevo o escribilo.' }, { status: 400 });
      historial.push({ de: 'lead', texto: transcript });
    }
    if (!historial.length) return Response.json({ ok: false, error: 'Escribí un mensaje como el lead primero.' }, { status: 400 });

    const r = await responderSimulador(id, historial);
    if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 400 });
    return Response.json({ ok: true, respuesta: r.respuesta, ...(transcript ? { transcript } : {}) });
  } catch (e) {
    console.error(`[api:setting/simulador POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
