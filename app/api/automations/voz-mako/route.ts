// =============================================================================
// /api/automations/voz-mako — la VOZ DE MAKO de las tarjetas «MaKo en WhatsApp» (undécima tanda)
// =============================================================================
// GET               → { ok, audios: [{ id, titulo, transcript, url }] }   las ya generadas en este negocio
// POST { texto }    → { ok, audio: { id, titulo, transcript, url }, cache } | { ok:false, error }
//
// Es el ÚNICO audio de una tarjeta «MaKo en WhatsApp» (decisión 2 de la décima: «que se pueda configurar con
// ElevenLabs que salga la voz de MaKo. La que usamos para crear los VSL»). La genera ElevenLabs con la key de
// la PLATAFORMA (lib/voz-mako.ts) al apretar ➤ en el editor; la misma frase sale de la caché, sin pagar otra
// vez. El motor nunca llama a ElevenLabs: manda el mp3 guardado por su id.
//
// Sólo el admin (el lienzo, que el setter no edita). Nunca reintenta solo: cada POST es UN pedido.

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { generarVozMaKo } from '@/lib/voz-mako';
import { listAudiosDeOrigen, audioUrlFirmada, type AudioSetting } from '@/lib/setting-audios';
import { ORIGEN_VOZ_MAKO } from '@/lib/voz-mako-reglas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

async function adminDe(): Promise<number | null> {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  return ws != null && rol === 'admin' ? ws : null;
}

const dto = async (a: AudioSetting) => ({ id: a.id, titulo: a.titulo, transcript: a.transcript, url: await audioUrlFirmada(a.media_path) });

export async function GET() {
  if ((await adminDe()) == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  try {
    const audios = await listAudiosDeOrigen(ORIGEN_VOZ_MAKO);
    return Response.json({ ok: true, audios: await Promise.all(audios.map(dto)) });
  } catch (e) {
    console.error('[voz-mako] listar:', msg(e));
    return Response.json({ ok: false, error: 'No pude leer los audios.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ws = await adminDe();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  let body: { texto?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const texto = typeof body.texto === 'string' ? body.texto.slice(0, 4000) : '';
  const r = await generarVozMaKo(ws, texto);
  if (!r.ok) {
    const status = r.motivo === 'texto' ? 400 : r.motivo === 'tope' ? 429 : r.motivo === 'ocupado' ? 409 : r.motivo === 'eleven' ? 502 : 500;
    return Response.json({ ok: false, error: r.error }, { status });
  }
  return Response.json({ ok: true, audio: await dto(r.audio), cache: r.cache });
}
