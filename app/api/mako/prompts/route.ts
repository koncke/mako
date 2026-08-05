// =============================================================================
// /api/mako/prompts — prompts de MaKo (núcleo fijo + módulos versionados)
// =============================================================================

import type { NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { getRolWsEfectivo } from '@/lib/workspace';
import { MAKO_NUCLEO, getPrompts, savePrompt, restorePrompt } from '@/lib/mako-prompts';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// LOS PROMPTS DEL SISTEMA SON DE LA AGENCIA, NO DEL WORKSPACE.
// El guard era `getRolWsEfectivo() !== 'admin'`, y eso NO alcanza: `rol_ws` vale
// 'admin' para el dueño de CADA workspace (medido en prod: los 5 usuarios no-admin
// lo tienen literalmente en 'admin'). O sea que cualquier cliente podía pedir este
// GET y bajarse la biblioteca ENTERA de prompts de MaKo — que es el producto.
//
// Tampoco sirve `esDuenoAdmin()`: incluye `ws === OWNER_WS`, y OWNER_WS es 1, que hoy
// es el workspace de un CLIENTE (Mauricio). El único guard correcto acá es
// `getSesionAdmin()` (rol de plataforma 'admin'), que es el mismo que ya usa la
// página que consume esta API.
async function soloAdmin(): Promise<Response | null> {
  if (!(await getSesionAdmin())) {
    return Response.json({ error: 'Solo el equipo de MaKo puede ver o tocar estos prompts.' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const g = await soloAdmin();
  if (g) return g;
  try {
    return Response.json({ nucleo: MAKO_NUCLEO, modos: await getPrompts() });
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await soloAdmin();
  if (g) return g;
  let body: { action?: string; modo?: string; text?: string; ts?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  if (!body.modo) return Response.json({ error: 'modo requerido' }, { status: 400 });
  try {
    if (body.action === 'save') {
      await savePrompt(body.modo, body.text ?? '');
      return Response.json({ ok: true });
    }
    if (body.action === 'restore') {
      if (!body.ts) return Response.json({ error: 'ts requerido' }, { status: 400 });
      await restorePrompt(body.modo, body.ts);
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'action inválida' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 500 });
  }
}
