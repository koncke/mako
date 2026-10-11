// =============================================================================
// /api/graficos — datos y guardado del Dashboard (el editor de informes)
// =============================================================================
// Una ruta y no server actions: el editor pide los datos de varios gráficos a la vez, y las
// server actions se ENCOLAN de a una (AGENTS.md, «Antes de optimizar una consulta…»). El
// `?ws=` lo pega solo el parche de fetch (app/_components/WsFetch.tsx).
//
// La puerta es la misma que la de la página (`requireRolWs([], { nav: 'graphics' })`): admin del
// workspace y la tab en su capa. Sin eso, un closer leía por acá la plata que su pantalla le
// esconde.
//
//   POST { accion: 'datos', pedidos: [{ grafico, desde, hasta }] } → { datos: Record<id, DatosGrafico> }
//   POST { accion: 'guardar', tablero }                             → { tablero }

import { NextResponse } from 'next/server';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { esFechaValida, hoyEnTijuana } from '@/lib/date-utils';
import { MAX_COMPONENTES } from '@/lib/graficos-catalogo';
import { datosDeGraficos, type PedidoDatos } from '@/lib/graficos-datos';
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
    const hoy = hoyEnTijuana();
    const lista = Array.isArray(body.pedidos) ? body.pedidos.slice(0, MAX_COMPONENTES) : [];
    const pedidos: PedidoDatos[] = [];
    for (const p of lista as Array<Record<string, unknown>>) {
      const desde = String(p?.desde ?? '');
      let hasta = String(p?.hasta ?? '');
      if (!esFechaValida(desde) || !esFechaValida(hasta) || desde > hasta) continue;
      // Un período que termina después de hoy se acota a hoy; no se descarta.
      if (hasta > hoy) hasta = hoy < desde ? desde : hoy;
      pedidos.push({ grafico: p.grafico, desde, hasta });
    }
    return NextResponse.json({ datos: await datosDeGraficos(pedidos) });
  }

  return err(400, 'Acción desconocida');
}
