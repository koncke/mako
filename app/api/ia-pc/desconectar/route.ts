// =============================================================================
// POST /api/ia-pc/desconectar { id } — «Desconectar esta computadora» (docs/ia-del-cliente.md §3, ola 2)
// =============================================================================
// PRIVADA (con sesión). La suya, siempre; la de otra persona del negocio, sólo el admin. Su token deja de servir en el
// acto, y el del turno que tenía en curso también (lib/ia-pc.ts → `desconectar`): el próximo latido de esa PC recibe 401
// `revocado`, y el programa se saca del arranque y se apaga.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { personaDelRequest } from '@/lib/mako-turno-app';
import { desconectar, puedeDesconectar } from '@/lib/ia-pc';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const persona = await personaDelRequest();
  if ('error' in persona) return NextResponse.json({ ok: false, error: persona.error }, { status: persona.status });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Pedido inválido.' }, { status: 400 }); }
  const id = Number(body?.id);
  try {
    if (!Number.isInteger(id) || !(await puedeDesconectar(persona.ws, id, persona.actor, persona.rol === 'admin'))) {
      return NextResponse.json({ ok: false, error: 'Esa computadora no está en tu cuenta.' }, { status: 404 });
    }
    await desconectar(persona.ws, id);
  } catch (e) {
    console.error('[ia-pc/desconectar]', e instanceof Error ? e.message : String(e));
    return NextResponse.json({ ok: false, error: 'No pude desconectarla. Intenta de nuevo.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
