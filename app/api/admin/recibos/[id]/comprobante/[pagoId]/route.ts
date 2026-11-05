// =============================================================================
// GET /api/admin/recibos/<id>/comprobante/<pagoId> — ver el comprobante de un pago de un recibo (5/11/2026)
// =============================================================================
// Redirige a una URL firmada de 5 minutos del bucket privado `contratos`, y SÓLO de la carpeta de los recibos
// (`plataforma/recibos/`). ⚠️ `getSesionAdmin()` primero: son comprobantes de pagos de cualquier cliente.

import { getSesionAdmin } from '@/lib/auth';
import { firmarComprobante, leerRecibo } from '@/lib/recibos';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; pagoId: string }> }) {
  if (!(await getSesionAdmin())) return Response.json({ ok: false, error: 'solo admin' }, { status: 403 });
  const p = await params;
  const id = Number(p.id);
  const pagoId = Number(p.pagoId);
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(pagoId) || pagoId <= 0) return Response.json({ ok: false, error: 'No existe.' }, { status: 404 });
  try {
    const leido = await leerRecibo(id);
    const pago = leido?.pagos.find((x) => x.id === pagoId);
    if (!pago?.comprobante_path) return Response.json({ ok: false, error: 'Ese pago no tiene comprobante.' }, { status: 404 });
    const url = await firmarComprobante(pago.comprobante_path);
    if (!url) return Response.json({ ok: false, error: 'No pude abrir el comprobante.' }, { status: 404 });
    return Response.redirect(url, 302);
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'No pude abrir el comprobante.' }, { status: 500 });
  }
}
