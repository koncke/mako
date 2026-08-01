// =============================================================================
// API: biblioteca de notas de voz del setting (mig 0108)
// =============================================================================
// GET    → { audios } (con URL firmada para escucharlos en la UI)
// POST   → { titulo, base64, mime, duracionS } → sube y transcribe
// DELETE → ?id=N
// Guard: admin del workspace (los audios son la voz del dueño saliendo a leads).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { listAudios, crearAudio, borrarAudio, audioUrlFirmada } from '@/lib/setting-audios';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function guard(): Promise<Response | null> {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede gestionar los audios.' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const g = await guard();
  if (g) return g;
  try {
    const audios = await listAudios();
    const conUrl = await Promise.all(audios.map(async (a) => ({ ...a, url: await audioUrlFirmada(a.media_path) })));
    return Response.json({ ok: true, audios: conUrl });
  } catch (e) {
    console.error(`[api:setting/audios GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (g) return g;
  let body: { titulo?: unknown; base64?: unknown; mime?: unknown; duracionS?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  if (typeof body.base64 !== 'string' || !body.base64) {
    return Response.json({ ok: false, error: 'falta el audio' }, { status: 400 });
  }
  try {
    const a = await crearAudio({
      titulo: String(body.titulo ?? '').trim(),
      base64: body.base64,
      mime: typeof body.mime === 'string' ? body.mime : undefined,
      duracionS: Number.isFinite(Number(body.duracionS)) ? Number(body.duracionS) : null,
    });
    return Response.json({ ok: true, audio: { ...a, url: await audioUrlFirmada(a.media_path) } });
  } catch (e) {
    console.error(`[api:setting/audios POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const g = await guard();
  if (g) return g;
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
  try {
    await borrarAudio(id);
    return Response.json({ ok: true });
  } catch (e) {
    console.error(`[api:setting/audios DELETE] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
