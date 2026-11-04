// =============================================================================
// /api/grupos/[ws]/adjunto/[id] — el archivo de un mensaje del grupo (3/11/2026)
// =============================================================================
// ⚠️ LOS IDS SON GLOBALES Y CORRELATIVOS: recorrer `adjunto/1..N` no tiene que dar archivos de otro negocio, ni a un invitado los de antes de entrar (`filaParaPersona`). 302 a una firma corta del
// bucket privado. Lo que le queda a alguien que sacaron es esa firma: 300 s como máximo.

import { NextResponse, type NextRequest } from 'next/server';
import { accesoAlGrupo } from '@/lib/grupo-puerta';
import { filaParaPersona, firmarArchivoDelGrupo } from '@/lib/grupo-app';
import { esPathDelGrupo } from '@/lib/grupo-reglas';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ ws: string; id: string }> }) {
  const p = await params;
  const ws = /^\d{1,15}$/.test(p.ws) ? Number(p.ws) : null;
  const id = /^\d{1,15}$/.test(p.id) ? Number(p.id) : null;
  const quien = ws == null ? null : await accesoAlGrupo(ws);
  const no = NextResponse.json({ ok: false, error: 'No existe.' }, { status: 404 });
  if (ws == null || id == null || !quien) return no;
  const fila = await filaParaPersona(ws, id, quien);
  const path = fila?.adjunto?.path;
  if (!esPathDelGrupo(ws, path)) return no;
  const url = await firmarArchivoDelGrupo(path);
  if (!url) return no;
  return NextResponse.redirect(url, { status: 302, headers: { 'cache-control': 'private, no-store' } });
}
