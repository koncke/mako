// =============================================================================
// GET /api/landing-analyst/mapa/fondo — la foto de la página para dibujar encima
// =============================================================================
// Sale de la FOTO COMPLETA de una grabación (lib/landing-mapa-foto.ts), no de la
// página en vivo: un iframe con la página real corre el Pixel adentro y graba al
// que mira. Devuelve el HTML ya reconstruido —sin scripts— y el tamaño de la
// ventana de quien grabó.
//
// Aparte de los toques porque es lo más pesado (baja hasta 8 grabaciones) y la
// pantalla puede mostrar la tabla mientras tanto.
//
// Sólo para quien ve Landing Analyst: la foto es la vista de una visita real.
// =============================================================================
import type { NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { getRolWsEfectivo } from '@/lib/workspace';
import { fondoDelMapa } from '@/lib/landing-mapa-server';
import type { Dispositivo } from '@/lib/landing-mapa';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if ((await getSesionAdmin()) == null && (await getRolWsEfectivo()) !== 'admin') {
    return Response.json({ ok: false, error: 'solo admin' }, { status: 403 });
  }
  const q = new URL(req.url).searchParams;
  const url = q.get('url');
  if (!url) return Response.json({ ok: false, error: 'Falta la url.' }, { status: 400 });
  const disp: Dispositivo = q.get('disp') === 'escritorio' ? 'escritorio' : 'movil';
  try {
    return Response.json({ ok: true, fondo: await fondoDelMapa(url, disp) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[landing-analyst:mapa-fondo] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
