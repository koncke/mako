// =============================================================================
// API: interruptor de envío REAL de WhatsApp del workspace (tarea #5)
// =============================================================================
// El flag por workspace (envio_whatsapp_enabled) existía en lib/envio-flags.ts
// y el motor ya lo respeta — pero setEnvioWhatsapp no tenía ningún call-site:
// solo se podía prender tocando app_settings a mano. Este route es el gemelo
// del action 'envio' de /api/email/dominio para el canal WhatsApp.
//
// GET  → estado: flag + qué transporte hay conectado (oficial / no oficial).
// POST → { on:boolean }. Prender exige al menos un transporte conectado
//        (Chatwoot oficial o instancia Evolution); apagar siempre se puede.
// Guard: solo el admin del workspace.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getWorkspaceActual, getRolWsEfectivo } from '@/lib/workspace';
import { envioWhatsappHabilitado, setEnvioWhatsapp } from '@/lib/envio-flags';
import { integracionConectada } from '@/lib/credenciales';
import { getInstanciaRow } from '@/lib/evolution';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function guard(): Promise<{ ws: number } | { error: Response }> {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return { error: Response.json({ ok: false, error: 'Solo el admin del workspace puede configurar el envío.' }, { status: 403 }) };
  }
  return { ws };
}

async function estadoActual(): Promise<Record<string, unknown>> {
  const [habilitado, oficial, inst] = await Promise.all([
    envioWhatsappHabilitado(),
    integracionConectada('whatsapp'),
    getInstanciaRow(),
  ]);
  return {
    envioHabilitado: habilitado,
    oficialConectado: oficial,
    evolutionConectado: inst?.estado === 'conectado',
  };
}

export async function GET() {
  const g = await guard();
  if ('error' in g) return g.error;
  try {
    return Response.json({ ok: true, ...(await estadoActual()) });
  } catch (e) {
    console.error(`[api:whatsapp/envio GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if ('error' in g) return g.error;

  let body: { on?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    if (body.on === true) {
      const estado = await estadoActual();
      if (!estado.oficialConectado && !estado.evolutionConectado) {
        return Response.json({ ok: false, error: 'Primero conectá un número de WhatsApp (API oficial o el número de empresa).' }, { status: 400 });
      }
    }
    await setEnvioWhatsapp(body.on === true);
    return Response.json({ ok: true, ...(await estadoActual()) });
  } catch (e) {
    console.error(`[api:whatsapp/envio POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
