// =============================================================================
// API: cerebro de copywriting de MaKo (owner-only) — metodología + swipe
// =============================================================================
// GET  → { metodoSembrado, ejemplos: EjemploSwipe[] }
// POST → { action:'seed' }                          → siembra la metodología curada
//        { action:'add-ejemplo', asunto?, cuerpo, nota?, fuente? } → guarda un ejemplo
//        { action:'del-ejemplo', id }               → borra un ejemplo
// Guard: SOLO el dueño de la agencia (rol global admin / legacy). Escribe conocimiento
// compartido a todos los clientes (OWNER_WS), por eso no alcanza el admin-de-workspace.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import {
  metodoSembrado, seedCopywritingMetodo, addEjemplo, listEjemplos, deleteEjemplo,
} from '@/lib/copywriting-metodo';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Solo el dueño de la agencia (rol GLOBAL admin o sesión legacy/dev). */
async function soloOwner(): Promise<Response | null> {
  const s = await getUsuarioActual();
  if (!s || !(s.legacy || s.rol === 'admin')) {
    return Response.json({ ok: false, error: 'Solo el dueño de la agencia puede tocar el cerebro de copywriting de MaKo.' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const g = await soloOwner();
  if (g) return g;
  try {
    const [sembrado, ejemplos] = await Promise.all([metodoSembrado(), listEjemplos()]);
    return Response.json({ ok: true, metodoSembrado: sembrado, ejemplos });
  } catch (e) {
    console.error(`[api:mako/copywriting GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await soloOwner();
  if (g) return g;
  let body: { action?: string; id?: number; asunto?: string; cuerpo?: string; nota?: string; fuente?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    if (body.action === 'seed') {
      const creadas = await seedCopywritingMetodo();
      return Response.json({ ok: true, creadas, metodoSembrado: true });
    }
    if (body.action === 'add-ejemplo') {
      const ej = await addEjemplo({ asunto: body.asunto, cuerpo: String(body.cuerpo ?? ''), nota: body.nota, fuente: body.fuente });
      return Response.json({ ok: true, ejemplo: ej });
    }
    if (body.action === 'del-ejemplo') {
      const id = Number(body.id);
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
      await deleteEjemplo(id);
      return Response.json({ ok: true });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:mako/copywriting POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 400 });
  }
}
