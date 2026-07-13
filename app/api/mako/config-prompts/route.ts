// =============================================================================
// /api/mako/config-prompts — todos los prompts editables de MaKo en un solo lugar
// =============================================================================
// GET  → grupos con cada prompt resuelto (valor vigente, isDefault, versiones).
// POST → { action: 'save'|'restore'|'reset', key, text?, ts? } ruteado por fuente.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo } from '@/lib/workspace';
import { getAllPrompts, savePromptByKey, restorePromptByKey, resetPromptByKey } from '@/lib/prompt-registry';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Config del cerebro de MaKo: piso = admin del workspace (patrón /api/mako/voz).
// Antes NO gateaba a nadie → un closer/setter podía reescribir cualquier prompt.
// NOTA para Martín: el editor completo (/contexto) es SUPER-admin y estos prompts
// son del sistema; si querés, endurecé a owner-only (esWorkspaceDueno) en vez de
// admin-de-workspace. El piso admin ya cierra el agujero del closer/setter.
async function soloAdmin(): Promise<Response | null> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return Response.json({ error: 'Solo el admin del workspace puede tocar los prompts de MaKo.' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const g = await soloAdmin();
  if (g) return g;
  try {
    return Response.json({ grupos: await getAllPrompts() });
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await soloAdmin();
  if (g) return g;
  let body: { action?: string; key?: string; text?: string; ts?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  if (!body.key) return Response.json({ error: 'key requerido' }, { status: 400 });

  try {
    if (body.action === 'save') {
      await savePromptByKey(body.key, body.text ?? '');
      return Response.json({ ok: true });
    }
    if (body.action === 'restore') {
      if (!body.ts) return Response.json({ error: 'ts requerido' }, { status: 400 });
      await restorePromptByKey(body.key, body.ts);
      return Response.json({ ok: true });
    }
    if (body.action === 'reset') {
      await resetPromptByKey(body.key);
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'action inválida' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 500 });
  }
}
