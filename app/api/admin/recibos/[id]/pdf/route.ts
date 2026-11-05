// =============================================================================
// GET /api/admin/recibos/<id>/pdf — «Bajar» un recibo de MaKo (5/11/2026)
// =============================================================================
// Devuelve el PDF que se MANDÓ (guardado en el primer despacho, con su huella), o el que se arma de la foto si todavía no salió
// (lib/recibos.ts, `pdfDelReciboGuardado`). ⚠️ `getSesionAdmin()` primero, además del proxy (/api/admin está en SOLO_ADMIN):
// esta ruta sirve los recibos de TODOS los clientes.

import { getSesionAdmin } from '@/lib/auth';
import { leerRecibo, pdfDelReciboGuardado } from '@/lib/recibos';
import { nombreDelPdf } from '@/lib/recibos-reglas';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSesionAdmin())) return Response.json({ ok: false, error: 'solo admin' }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ ok: false, error: 'Ese recibo no existe.' }, { status: 404 });
  try {
    const leido = await leerRecibo(id);
    if (!leido) return Response.json({ ok: false, error: 'Ese recibo no existe.' }, { status: 404 });
    const pdf = await pdfDelReciboGuardado(leido.recibo, leido.pagos);
    const nombre = nombreDelPdf({ numero: leido.recibo.numero, mes: leido.recibo.mes, aNombre: leido.recibo.a_nombre });
    return new Response(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="recibo-${leido.recibo.numero}.pdf"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'No pude armar el PDF.' }, { status: 500 });
  }
}
