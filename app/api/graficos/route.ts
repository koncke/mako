// =============================================================================
// /api/graficos — datos y guardado de «Mis gráficos» (Graphics › Mis gráficos)
// =============================================================================
// Una ruta y no server actions: el editor pide los datos de varios gráficos a la vez, y las
// server actions se ENCOLAN de a una (AGENTS.md, «Antes de optimizar una consulta…»). El
// `?ws=` lo pega solo el parche de fetch (app/_components/WsFetch.tsx).
//
// La puerta es la misma que la de la página (`requireRolWs([], { nav: 'graphics' })`): admin del
// workspace y la tab en su capa. Sin eso, un closer leía por acá la plata que su pantalla le
// esconde.
//
//   POST { accion: 'datos', graficos: Grafico[], desde, hasta } → { datos: Record<id, DatosGrafico> }
//   POST { accion: 'guardar', tablero }                          → { tablero }

import { NextResponse } from 'next/server';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { esFechaValida, hoyEnTijuana } from '@/lib/date-utils';
import { MAX_GRAFICOS, sanearGrafico, type Grafico } from '@/lib/graficos-catalogo';
import { datosDeTablero } from '@/lib/graficos-datos';
import { guardarTablero } from '@/lib/graficos-tablero';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const rol = await getRolWsEfectivo();
  if (rol == null) return err(401, 'no autenticado');
  if (rol !== 'admin') return err(403, 'Sólo el admin de la cuenta');
  if (!tabEnCapa('graphics', await getCapaActual())) return err(404, 'No existe');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err(400, 'JSON inválido'); }

  if (body.accion === 'guardar') {
    try {
      return NextResponse.json({ tablero: await guardarTablero(body.tablero) });
    } catch (e) {
      return err(400, e instanceof Error ? e.message : 'No se pudo guardar');
    }
  }

  if (body.accion === 'datos') {
    const desde = String(body.desde ?? '');
    let hasta = String(body.hasta ?? '');
    if (!esFechaValida(desde) || !esFechaValida(hasta) || desde > hasta) return err(400, 'Rango inválido');
    // Un rango que termina después de hoy se acota a hoy; no se descarta (/comercial volvía
    // a 30 días sin avisar: docs/hallazgos-ads.md).
    const hoy = hoyEnTijuana();
    if (hasta > hoy) hasta = hoy < desde ? desde : hoy;
    const lista = Array.isArray(body.graficos) ? body.graficos.slice(0, MAX_GRAFICOS) : [];
    const graficos = lista.map(sanearGrafico).filter((g): g is Grafico => !!g);
    return NextResponse.json({ datos: await datosDeTablero(graficos, desde, hasta) });
  }

  return err(400, 'Acción desconocida');
}
