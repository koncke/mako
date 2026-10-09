// =============================================================================
// API: interruptor de envío REAL de WhatsApp del workspace (tarea #5)
// =============================================================================
// El flag por workspace (envio_whatsapp_enabled) existía en lib/envio-flags.ts
// y el motor ya lo respeta — pero setEnvioWhatsapp no tenía ningún call-site:
// solo se podía prender tocando app_settings a mano. Este route es el gemelo
// del action 'envio' de /api/email/dominio para el canal WhatsApp.
//
// GET  → estado: flag + si hay una línea del número de empresa (Evolution) conectada.
// POST → { on:boolean }. Prender exige una línea conectada; apagar siempre se puede.
// (Hasta el 09/10/2026 también contaba el oficial, Chatwoot, que se borró.)
// Guard: solo el admin del workspace.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getWorkspaceActual, getRolWsEfectivo } from '@/lib/workspace';
import { envioWhatsappHabilitado, setEnvioWhatsapp } from '@/lib/envio-flags';
import { listarLineas } from '@/lib/evolution';

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
  // CUALQUIER línea conectada cuenta, no sólo la de por default: con varias líneas por
  // negocio (mig 0198), un negocio con la de por default caída y otra andando no podía
  // prender el envío («Primero conecta un número») aunque tuviera por dónde mandar.
  const [habilitado, lineas] = await Promise.all([
    envioWhatsappHabilitado(),
    listarLineas().catch(() => []),
  ]);
  return {
    envioHabilitado: habilitado,
    // Sigue en el contrato porque lo lee el paso 'wa_oficial' de app/chatbot/OnboardingChatAgent.tsx,
    // que ninguna tab ofrece desde la tarea #832 (pendiente de borrar con el resto del oficial).
    oficialConectado: false,
    evolutionConectado: lineas.some((l) => l.estado === 'conectado'),
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
      if (!estado.evolutionConectado) {
        return Response.json({ ok: false, error: 'Primero conecta un número de WhatsApp.' }, { status: 400 });
      }
    }
    await setEnvioWhatsapp(body.on === true);
    return Response.json({ ok: true, ...(await estadoActual()) });
  } catch (e) {
    console.error(`[api:whatsapp/envio POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
