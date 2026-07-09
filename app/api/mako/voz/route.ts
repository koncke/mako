// =============================================================================
// API: guía de voz del negocio (MaKo la destila; el cliente la edita) — F3.1
// =============================================================================
// GET   → { guia } (la guía de voz actual del workspace, o null)
// POST  → { action:'destilar' }        → MaKo la aprende de ads + perfil → { guia, fuentes }
//         { action:'save', texto }     → guarda la edición del cliente
// Guard: solo el admin del workspace (es config de MaKo).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { getVozGuia, setVozGuia, destilarVoz } from '@/lib/nutricion-generator';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function soloAdmin(): Promise<Response | null> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede tocar la voz de MaKo.' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const g = await soloAdmin();
  if (g) return g;
  try {
    return Response.json({ ok: true, guia: await getVozGuia() });
  } catch (e) {
    console.error(`[api:mako/voz GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await soloAdmin();
  if (g) return g;
  // Exigir workspace concreto: un admin de agencia SIN impersonar tiene ws=null
  // → los transcripts fallan-cerrado (0) pero el setting caería a OWNER_WS y
  // pisaría la guía del dueño con una versión degradada. Cortamos antes.
  if ((await getWorkspaceActual()) == null) {
    return Response.json({ ok: false, error: 'Entrá al workspace del cliente (impersonando) para enseñarle la voz a MaKo.' }, { status: 400 });
  }
  let body: { action?: string; texto?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    if (body.action === 'destilar') {
      const r = await destilarVoz();
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 400 });
      return Response.json({ ok: true, guia: r.guia, fuentes: r.fuentes, uso: r.uso });
    }
    if (body.action === 'save') {
      const texto = String(body.texto ?? '').trim();
      if (!texto) return Response.json({ ok: false, error: 'la guía no puede quedar vacía' }, { status: 400 });
      await setVozGuia(texto);
      return Response.json({ ok: true, guia: texto });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:mako/voz POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
