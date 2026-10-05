// =============================================================================
// GET /api/landing-analyst/pulso — lo que el Pixel midió, por página
// =============================================================================
// Vive en una ruta y no en la `page` a propósito: el barrido paginado de
// `landing_visits` + `vsl_events` es la lectura más cara de la tab, y Landing
// Analyst se abre casi siempre para leer el diagnóstico del copy. Si colgara de
// la page, cada visita pagaría ese barrido aunque nadie mire esta pantalla.
// La pantalla la pide cuando se abre su vista.
//
// ⚠️ UN ERROR SALE COMO ERROR, con su 500 y su mensaje. Lo que NO puede hacer es
// contestar un `{ paginas: [] }` optimista: la pantalla dibujaría «nadie llegó a
// tu oferta» sobre una consulta que nunca corrió.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getPulso } from '@/lib/landing-pulso-server';
import { PULSO_DIAS } from '@/lib/landing-pulso';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  // La ventana es un parámetro para poder acortarla desde la pantalla; fuera de
  // rango se usa el default en vez de rechazar, que es lo que hace falta acá.
  const crudo = Number(new URL(req.url).searchParams.get('dias'));
  const dias = Number.isFinite(crudo) && crudo >= 1 && crudo <= 365 ? Math.trunc(crudo) : PULSO_DIAS;
  try {
    return Response.json({ ok: true, data: await getPulso(dias) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[landing-analyst:pulso] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
