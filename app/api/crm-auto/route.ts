// =============================================================================
// API: interruptor del CRM automático del workspace (tarea #5)
// =============================================================================
// El commit del CRM automático era un env GLOBAL (CRM_AUTO_ENABLED): prenderlo
// movía leads de TODOS los clientes a la vez. Ahora el cron decide por
// workspace con el setting crm_auto_enabled (lib/envio-flags.ts) y este route
// es el toggle: GET estado / POST { on:boolean }.
// Guard: solo el admin del workspace. Apagar siempre se puede.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getWorkspaceActual, getRolWsEfectivo } from '@/lib/workspace';
import { crmAutoHabilitado, setCrmAuto } from '@/lib/envio-flags';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function guard(): Promise<{ ws: number } | { error: Response }> {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return { error: Response.json({ ok: false, error: 'Solo el admin del workspace puede configurar el CRM automático.' }, { status: 403 }) };
  }
  return { ws };
}

export async function GET() {
  const g = await guard();
  if ('error' in g) return g.error;
  try {
    return Response.json({ ok: true, habilitado: await crmAutoHabilitado() });
  } catch (e) {
    console.error(`[api:crm-auto GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if ('error' in g) return g.error;

  let body: { on?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    await setCrmAuto(body.on === true);
    return Response.json({ ok: true, habilitado: await crmAutoHabilitado() });
  } catch (e) {
    console.error(`[api:crm-auto POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
