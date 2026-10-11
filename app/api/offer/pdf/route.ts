// =============================================================================
// GET /api/offer/pdf?id=<sesión> — el PDF de la conclusión vigente de Offer
// =============================================================================
// Lee la sesión GUARDADA del workspace actual (nunca lo que mande el navegador:
// el PDF dice lo que MaKo concluyó, no lo que una pestaña cree que concluyó) y la
// pasa por lib/offer-pdf.ts, que arma el archivo sin ninguna librería.
//
// Gate: `adminDeWorkspaceActual()`, igual que POST /api/offer. NO `resolverWsAdmin`,
// que al super admin sin impersonar le devuelve el ws1 —el workspace de un cliente—.
// El error va en JSON; el éxito, en binario (la excepción a «Response.json siempre»
// de la skill nextjs16-conventions; molde: app/api/second-brain/exportar/route.ts).
// =============================================================================

import type { NextRequest } from 'next/server';
import { adminDeWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { leerSesion, nombreNegocioOffer } from '@/lib/offer-sesiones';
import { pdfDeOferta, nombreArchivoOferta } from '@/lib/offer-pdf';
import { tzDeWorkspace } from '@/lib/timezone';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET(req: NextRequest) {
  const ws = await adminDeWorkspaceActual();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del negocio puede descargar la oferta.' }, { status: 403 });
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) return Response.json({ ok: false, error: 'Falta la oferta a descargar.' }, { status: 400 });

  return runWithWorkspace(ws, async () => {
    try {
      const sesion = await leerSesion(id);
      if (!sesion) return Response.json({ ok: false, error: 'No encontré esa oferta.' }, { status: 404 });
      if (!sesion.conclusion) return Response.json({ ok: false, error: 'Esta oferta todavía no tiene conclusión.' }, { status: 404 });
      const [negocio, zona] = await Promise.all([
        nombreNegocioOffer().catch(() => ''),
        tzDeWorkspace(ws).catch(() => ''),
      ]);
      const bytes = pdfDeOferta(sesion.conclusion, { negocio, titulo: sesion.titulo, fecha: new Date(), zona: zona || undefined });
      const nombre = nombreArchivoOferta(sesion.conclusion.propuesta.nombre || sesion.titulo, sesion.conclusion.version);
      // Un `Uint8Array` es un BodyInit válido; el buffer se copia para que el tipo
      // sea un ArrayBuffer «de verdad» (no SharedArrayBuffer) en todos los runtimes.
      return new Response(bytes.slice().buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${nombre}"`,
          'Content-Length': String(bytes.byteLength),
          'Cache-Control': 'no-store',
        },
      });
    } catch (e) {
      console.error('[offer:pdf]', e);
      return Response.json({ ok: false, error: `No se pudo armar el PDF: ${msg(e)}` }, { status: 500 });
    }
  });
}
