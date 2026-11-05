// =============================================================================
// GET /api/admin/recibos/ejemplo — «Ver ejemplo»: cómo sale un recibo, con datos de muestra y sin número (5/11/2026)
// =============================================================================
// Con los «Datos del recibo» de hoy (el emisor), así se ve el cambio antes de que salga uno de verdad. Los datos son ficticios
// (AGENTS.md: un ejemplo de UI nunca lleva datos de un cliente real). Sirve también para probar en un preview que jsPDF carga
// dentro del bundle de Next antes de enganchar los pagos (docs/relevo/recibos-encargo.md, «Riesgos»). `?medio=creem` muestra la
// confirmación de una pasarela merchant of record. ⚠️ `getSesionAdmin()` primero.

import { getSesionAdmin } from '@/lib/auth';
import { leerEmisor } from '@/lib/recibos';
import { pdfDelRecibo } from '@/lib/recibo-pdf';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await getSesionAdmin())) return Response.json({ ok: false, error: 'solo admin' }, { status: 403 });
  const creem = new URL(req.url).searchParams.get('medio') === 'creem';
  try {
    const emisor = await leerEmisor();
    const ahora = new Date().toISOString();
    const pdf = await pdfDelRecibo({
      numero: null, ejemplo: true, aNombre: 'Agencia de ejemplo', emitidoAt: ahora, zona: 'America/Argentina/Buenos_Aires', emisor,
      lineas: creem ? [{ concepto: 'Plan Pro', mes: null, monto: 56.87, moneda: 'USD' }] : [{ concepto: 'Plan Pro', mes: 'noviembre', monto: 97, moneda: 'USD' }, { concepto: 'Cuenta de un cliente', mes: 'noviembre', monto: 47, moneda: 'USD' }],
      totalDetalle: creem ? 56.87 : 144, monedaDetalle: 'USD', totales: [{ moneda: creem ? 'USD' : 'USDT', monto: creem ? 56.87 : 144 }], impuesto: creem ? 9.87 : null,
      pagos: [{ medio: creem ? 'creem' : 'binance', referencia: creem ? 'tran_ejemplo' : '000000000000000000', fecha: ahora, monto: creem ? 56.87 : 144, moneda: creem ? 'USD' : 'USDT' }],
      notaPdf: creem ? null : 'Una nota de ejemplo: cubre hasta el día 4 del mes que viene.',
    });
    return new Response(Buffer.from(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="recibo-ejemplo.pdf"', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'No pude armar el ejemplo.' }, { status: 500 });
  }
}
