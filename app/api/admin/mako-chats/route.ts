// =============================================================================
// /api/admin/mako-chats — grupos de la línea de MaKo (chat del SuperAdmin)
// =============================================================================
// Solo admin. GET → lista de grupos. GET ?jid= → mensajes de ese grupo.
// POST { jid, texto } → manda al grupo desde la voz de MaKo.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { listarGruposMaKo, mensajesGrupoMaKo, enviarGrupoMaKo } from '@/lib/mako-chat';

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
  let body: { jid?: string; texto?: string };
  try { body = (await req.json()) as typeof body; } catch { return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  if (!body.jid || !body.texto?.trim()) return NextResponse.json({ ok: false, error: 'faltan jid o texto' }, { status: 400 });
  return NextResponse.json(await enviarGrupoMaKo(body.jid, body.texto));
}
