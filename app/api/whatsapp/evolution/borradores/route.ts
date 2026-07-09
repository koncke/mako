// =============================================================================
// API interna: cola de BORRADORES del WhatsApp no oficial (F2.3)
// =============================================================================
// GET   → { borradores, pendientes } (los que el setter tiene que revisar/enviar)
// POST  → { id, action:'enviar' }    → manda el borrador por Evolution (1 clic)
//         { id, action:'descartar' } → lo descarta
// Scopeado por getTenantDb; visible/operable por admin/setter que atienden chats.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { listBorradores, contarBorradores, enviarBorrador, descartarBorrador } from '@/lib/evolution-envio';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET() {
  try {
    const [borradores, pendientes] = await Promise.all([listBorradores(), contarBorradores()]);
    return Response.json({ ok: true, borradores, pendientes });
  } catch (e) {
    console.error(`[api:whatsapp/evolution/borradores GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { id?: unknown; action?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const id = Number(body.id);
  if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });

  try {
    if (body.action === 'enviar') {
      const sesion = await getUsuarioActual();
      const r = await enviarBorrador(id, sesion?.email ?? 'setter');
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
      return Response.json({ ok: true });
    }
    if (body.action === 'descartar') {
      await descartarBorrador(id);
      return Response.json({ ok: true });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:whatsapp/evolution/borradores POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
