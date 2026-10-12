// =============================================================================
// /api/perfil/notif-push — qué Web Push quiere recibir la persona logueada
// =============================================================================
// GET  → { push: NotifPush }        (con el default por rol si nunca lo tocó)
// POST { push: NotifPush } → { push, guardado }
//
// Molde: app/api/perfil/notif-inapp/route.ts. La preferencia es de la PERSONA (vive en
// `usuarios.perfil.notifPush`, lib/perfil.ts) y NO sigue a la cuenta que está mirando: un
// super admin viendo un cliente edita SUS avisos. Qué se ofrece prender y apagar es
// `PUSH_TIPOS` (lib/notif-catalogo.ts, sin server-only: la pantalla lo importa directo).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getNotifPush, setNotifPush } from '@/lib/perfil';
import type { NotifPush } from '@/lib/notif-catalogo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  if (!(await getUsuarioActual())) return Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });
  return Response.json({ ok: true, push: await getNotifPush() });
}

export async function POST(req: NextRequest) {
  if (!(await getUsuarioActual())) return Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });
  let body: { push?: NotifPush };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ ok: false, error: 'json inválido' }, { status: 400 }); }
  if (!body.push || typeof body.push !== 'object') return Response.json({ ok: false, error: 'falta push' }, { status: 400 });
  try {
    // `guardado:false` = sesión sin cuenta propia: la pantalla lo dice en vez de un tilde falso.
    const { push, guardado } = await setNotifPush(body.push);
    return Response.json({ ok: true, push, guardado });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
