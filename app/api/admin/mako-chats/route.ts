// =============================================================================
// /api/admin/mako-chats — grupos de la línea de MaKo (chat del SuperAdmin)
// =============================================================================
// Solo admin. GET → lista de grupos. GET ?jid= → mensajes de ese grupo.
// POST { jid, texto }  (JSON)        → manda texto desde la voz de MaKo.
// POST multipart { chat, tipo, archivo, caption? } → manda media / nota de voz
//   (mismo contrato que el inbox del cliente: tipo='audio' para voz).

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import {
  listarGruposMaKo, mensajesGrupoMaKo, enviarGrupoMaKo,
  enviarMediaGrupoMaKo, enviarAudioGrupoMaKo,
} from '@/lib/mako-chat';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  const jid = new URL(req.url).searchParams.get('jid');
  if (jid) return NextResponse.json({ ok: true, mensajes: await mensajesGrupoMaKo(jid) });
  return NextResponse.json({ ok: true, grupos: await listarGruposMaKo() });
}

export async function POST(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  const ct = req.headers.get('content-type') || '';

  // ── Media / nota de voz (multipart) ──
  if (ct.includes('multipart/form-data')) {
    const fd = await req.formData();
    const jid = String(fd.get('chat') || fd.get('jid') || '');
    const tipo = String(fd.get('tipo') || '');
    const caption = String(fd.get('caption') || '') || undefined;
    const file = fd.get('archivo');
    if (!jid || !(file instanceof File)) return NextResponse.json({ ok: false, error: 'faltan jid o archivo' }, { status: 400 });
    const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    if (tipo === 'audio') return NextResponse.json(await enviarAudioGrupoMaKo(jid, base64));
    const mtipo = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document';
    return NextResponse.json(await enviarMediaGrupoMaKo(jid, { base64, mimetype: file.type || 'application/octet-stream', fileName: file.name, tipo: mtipo }, caption));
  }

  // ── Texto (JSON) ──
  let body: { jid?: string; texto?: string };
  try { body = (await req.json()) as typeof body; } catch { return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  if (!body.jid || !body.texto?.trim()) return NextResponse.json({ ok: false, error: 'faltan jid o texto' }, { status: 400 });
  return NextResponse.json(await enviarGrupoMaKo(body.jid, body.texto));
}
