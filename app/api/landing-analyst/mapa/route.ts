// =============================================================================
// GET /api/landing-analyst/mapa — el mapa de calor: páginas, o los toques de una
// =============================================================================
//   · sin `url`: las páginas que se pueden elegir, con cuántos toques tiene cada
//     una en celular y en computadora;
//   · con `url` y `disp` (movil | escritorio): los toques de esa página.
//
// EL PERÍODO Y LOS FILTROS (v5, 12/10/2026): el gráfico «Mapa de calor de página» del
// Dashboard manda `desde` y `hasta` (YYYY-MM-DD) y `filtros` (JSON, los de los controles
// de la hoja ya traducidos a las dimensiones de `toques`). Sin `desde`/`hasta` vale lo de
// antes: `dias` (por defecto 30) y las páginas declaradas aunque no tengan toques, que es
// lo que mira la tab vieja (app/landing-analyst/MapaDeCalor.tsx).
//
// En una ruta y no en la page, como el pulso: es una lectura que sólo hace falta
// cuando alguien abre la pestaña del mapa.
//
// ⚠️ UN ERROR SALE COMO ERROR (500 con su mensaje), nunca como `{ toques: [] }`: la
// pantalla dibujaría «nadie tocó tu página» sobre una consulta que no corrió.
//
// Sólo para quien ve Landing Analyst: el admin del negocio (o el super admin).
// =============================================================================
import type { NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { getRolWsEfectivo } from '@/lib/workspace';
import { paginasDelMapa, datosDelMapa, ventanaDeDias } from '@/lib/landing-mapa-server';
import { MAPA_DIAS, type Dispositivo } from '@/lib/landing-mapa';
import { sanearFiltrosToques, sanearVentana } from '@/lib/landing-mapa-filtros';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if ((await getSesionAdmin()) == null && (await getRolWsEfectivo()) !== 'admin') {
    return Response.json({ ok: false, error: 'solo admin' }, { status: 403 });
  }
  const q = new URL(req.url).searchParams;
  const delPeriodo = sanearVentana(q.get('desde'), q.get('hasta'));
  const crudo = Number(q.get('dias'));
  const dias = Number.isFinite(crudo) && crudo >= 1 && crudo <= 180 ? Math.trunc(crudo) : MAPA_DIAS;
  const ventana = delPeriodo ?? ventanaDeDias(dias);
  const filtros = sanearFiltrosToques(q.get('filtros'));
  const url = q.get('url');
  const disp: Dispositivo = q.get('disp') === 'escritorio' ? 'escritorio' : 'movil';
  try {
    if (!url) return Response.json({ ok: true, paginas: await paginasDelMapa(ventana, filtros, { declaradas: !delPeriodo }) });
    return Response.json({ ok: true, data: await datosDelMapa(url, disp, ventana, filtros) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[landing-analyst:mapa] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
