// =============================================================================
// /api/cron/grupo-turno — el turno de MaKo sobre un mensaje del grupo de la app (3/11/2026)
// =============================================================================
// Lo llama /api/grupos/[ws]/mensajes después de responderle a la persona. NO va en vercel.json: no es un cron programado; vive acá porque corre con el secreto del cron y SIN COOKIES, igual que
// el webhook de Evolution.
//
// ⚠️ POR QUÉ OTRA INVOCACIÓN: el turno de MaKo se diseñó para correr sin sesión. Corrido adentro del pedido, `getUsuarioActual`, `getRolWsEfectivo` y `adminDeWorkspaceActual` verían a quien
// escribió: `cobros.run` trataría el turno como del Super Admin, y un admin de OTRO negocio pasaría `adminDeWorkspaceActual` sobre este ws. Si este llamado falla, el mensaje ya está en la cola y lo
// levanta `doer-flush`.

import { after, NextResponse, type NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { manejarEntranteDeLaApp } from '@/lib/mako-doer-in';
import { mensajeParaElTurno } from '@/lib/grupo-app';

export const dynamic = 'force-dynamic';
// 420 como el webhook (tests/mako-doer-plazo.test.ts): una confirmación por el grupo puede correr replicar_landing.
export const maxDuration = 420;

export async function POST(req: NextRequest) {
  const denegado = checkCronAuth(req);
  if (denegado) return denegado;
  const b = (await req.json().catch(() => null)) as { ws?: unknown; id?: unknown } | null;
  const ws = Number(b?.ws); const id = Number(b?.id);
  if (!Number.isSafeInteger(ws) || ws <= 0 || !Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: 'Falta el mensaje.' }, { status: 400 });
  const msg = await mensajeParaElTurno(ws, id);
  if (!msg) return NextResponse.json({ ok: false, error: 'No existe.' }, { status: 404 });
  after(async () => {
    try { await manejarEntranteDeLaApp(ws, msg); } catch (e) { console.error(`[grupo-turno] ws${ws}: ${e instanceof Error ? e.message : String(e)}`); }
  });
  return NextResponse.json({ ok: true }, { status: 202 });
}
