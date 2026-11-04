// =============================================================================
// /api/grupos/[ws]/whatsapp — lo de antes, del grupo de WhatsApp (3/11/2026)
// =============================================================================
// «Ver lo anterior de WhatsApp», al llegar al principio del hilo: burbujas de sólo lectura, sin autor. Se lee en el momento: no se copia nada y el jid no sale de acá.
//
// ⚠️ SÓLO PARA QUIEN ADMINISTRA, el mismo corte de hoy. Copiarlo a `grupo_mensajes` NO: no tiene autor, le falta lo que no llegó a `guardarTurno` (la charla, los carteles, la agenda), y un
// invitado lo leería. `mako_doer_conv` es lo que vuelve al modelo, no un hilo.

import { NextResponse, type NextRequest } from 'next/server';
import { accesoAlGrupo } from '@/lib/grupo-puerta';
import { claveDeConversacion } from '@/lib/grupo-app';
import { esClaveDeLaApp } from '@/lib/grupo-salida';
import { hiloDelGrupo } from '@/lib/mako-doer-conv';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ ws: string }> }) {
  const crudo = (await params).ws;
  const ws = /^\d{1,15}$/.test(crudo) ? Number(crudo) : null;
  const quien = ws == null ? null : await accesoAlGrupo(ws);
  if (ws == null || !quien || quien.invitado) return NextResponse.json({ ok: false, error: 'No existe.' }, { status: 404 });
  const antes = req.nextUrl.searchParams.get('antes');
  try {
    const clave = await claveDeConversacion(ws);
    if (esClaveDeLaApp(clave)) return NextResponse.json({ ok: true, mensajes: [], hayMas: false });
    const { filas, hayMas } = await hiloDelGrupo(ws, clave, { antes: antes && !Number.isNaN(Date.parse(antes)) ? antes : null, limite: 60 });
    return NextResponse.json({ ok: true, hayMas, mensajes: filas.map((f) => ({ rol: f.role, texto: f.content, creadoEn: f.created_at })) });
  } catch {
    return NextResponse.json({ ok: false, error: 'No pude leer lo anterior.' }, { status: 503 });
  }
}
