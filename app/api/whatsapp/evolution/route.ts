// =============================================================================
// API interna: conexión del WhatsApp NO oficial (Evolution) del workspace
// =============================================================================
// GET  → estado cacheado + config (para pintar el chip y decidir si mostrar QR).
// POST → { action:'conectar' }    → crea/reusa la instancia y devuelve el QR.
//        { action:'estado' }      → estado EN VIVO (para el polling del modal).
//        { action:'refrescar' }   → QR nuevo sin recrear.
//        { action:'desconectar' } → logout + delete.
// Guard: solo el admin del workspace (conectar un número es config sensible).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo } from '@/lib/workspace';
import {
  conectar, estadoEnVivo, refrescarQr, desconectar, getInstanciaRow, evolutionConfigurado,
  estadoWebhook, repararWebhook,
} from '@/lib/evolution';
import { sincronizarDesdeEvolution } from '@/lib/evolution-mensajes';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function soloAdmin(): Promise<Response | null> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede conectar el WhatsApp de empresa.' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const g = await soloAdmin();
  if (g) return g;
  try {
    const row = await getInstanciaRow();
    return Response.json({
      ok: true,
      configurado: evolutionConfigurado(),
      estado: row?.estado ?? 'desconectado',
      numero: row?.numero ?? null,
      perfil: row?.perfil_nombre ?? null,
    });
  } catch (e) {
    console.error(`[api:whatsapp/evolution GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await soloAdmin();
  if (g) return g;
  if (!evolutionConfigurado()) {
    return Response.json({ ok: false, error: 'Evolution API no está configurado en el servidor.' }, { status: 400 });
  }

  let body: { action?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    if (body.action === 'conectar') {
      const r = await conectar();
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
      return Response.json({ ok: true, estado: r.estado, qr: r.qr });
    }
    if (body.action === 'estado') {
      const s = await estadoEnVivo();
      return Response.json({ ok: true, ...s });
    }
    if (body.action === 'refrescar') {
      const r = await refrescarQr();
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
      return Response.json({ ok: true, qr: r.qr });
    }
    if (body.action === 'desconectar') {
      const r = await desconectar();
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
      return Response.json({ ok: true });
    }
    if (body.action === 'webhook-estado') {
      // Salud del espejo de mensajes (webhook Evolution → app).
      const s = await estadoWebhook();
      return Response.json({ ok: true, ...s });
    }
    if (body.action === 'reparar-webhook') {
      const r = await repararWebhook();
      return Response.json({ ok: r.ok, estado: r.estado, error: r.error });
    }
    if (body.action === 'sincronizar') {
      // "Sincronizar todo": trae los chats de Evolution al espejo a pedido.
      const r = await sincronizarDesdeEvolution();
      return Response.json({ ok: true, ...r });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:whatsapp/evolution POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
