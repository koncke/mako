// =============================================================================
// GET /api/offer/pdf?id=<sesión>[&v=<versión>] — el PDF de una versión de la conclusión de Offer
// =============================================================================
// Lee la sesión GUARDADA del workspace actual (nunca lo que mande el navegador:
// el PDF dice lo que MaKo concluyó, no lo que una pestaña cree que concluyó) y la
// pasa por lib/offer-pdf.ts, que arma el archivo sin ninguna librería.
//
// `v` (12/10/2026): la versión que se pide —la del mensaje del chat que trae ese PDF (`OfferMensaje.pdf`)—.
// Sin `v`, la última. Una versión que la sesión no tiene es un 404: nunca se cae a otra (bajar la v2 cuando
// se pidió la v1 es entregar un documento que dice otra cosa con el nombre del que se pidió).
//
// Gate: `adminDeWorkspaceActual()`, igual que POST /api/offer. NO `resolverWsAdmin`,
// que al super admin sin impersonar le devuelve el ws1 —el workspace de un cliente—.
// El error va en JSON; el éxito, en binario (la excepción a «Response.json siempre»
// de la skill nextjs16-conventions; molde: app/api/second-brain/exportar/route.ts).
// =============================================================================

import type { NextRequest } from 'next/server';
import { adminDeWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { leerFila, nombreNegocioOffer } from '@/lib/offer-sesiones';
import { conclusionDeVersion } from '@/lib/offer-reglas';
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
  const vCruda = req.nextUrl.searchParams.get('v');
  const version = vCruda == null || vCruda === '' ? null : Number(vCruda);
  if (version != null && (!Number.isInteger(version) || version <= 0)) return Response.json({ ok: false, error: 'Esa versión no es válida.' }, { status: 400 });

  return runWithWorkspace(ws, async () => {
    try {
      const fila = await leerFila(id);
      if (!fila) return Response.json({ ok: false, error: 'No encontré esa oferta.' }, { status: 404 });
      if (!fila.conclusiones.length) return Response.json({ ok: false, error: 'Esta oferta todavía no tiene conclusión.' }, { status: 404 });
      const conclusion = conclusionDeVersion(fila.conclusiones, version);
      if (!conclusion) return Response.json({ ok: false, error: `Esta oferta no tiene la versión ${version}.` }, { status: 404 });
      const [negocio, zona] = await Promise.all([
        nombreNegocioOffer().catch(() => ''),
        tzDeWorkspace(ws).catch(() => ''),
      ]);
      const bytes = pdfDeOferta(conclusion, { negocio, titulo: fila.titulo, fecha: new Date(), zona: zona || undefined });
      const nombre = nombreArchivoOferta(conclusion.propuesta.nombre || fila.titulo, conclusion.version);
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
