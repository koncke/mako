// =============================================================================
// /api/graficos — datos y guardado del Dashboard (el editor de informes)
// =============================================================================
// Una ruta y no server actions: el editor pide los datos de varios gráficos a la vez, y las
// server actions se ENCOLAN de a una (AGENTS.md, «Antes de optimizar una consulta…»). El
// `?ws=` lo pega solo el parche de fetch (app/_components/WsFetch.tsx).
//
// La puerta es la misma que la de la página (`requireRolWs(['closer'], { nav: 'graphics' })`): admin
// del workspace o closer, y la tab en su capa.
//
// ⚠️ EL CLOSER, DESDE EL 11/10/2026 (decisión 6 de Martín: Closing Analyst se retiró y «los closers ven
//    SÓLO la hoja Closing del Dashboard»): entra, pero sólo a lo que esa hoja pide —`datos` de las
//    llamadas, `bloques` de Closing y `valores` de un campo de Closing, recortados a esos conjuntos—, y
//    sólo si su negocio tiene Closing en la capa. Guardar, el detalle de un número y todo lo demás:
//    403. La lista vive en lib/graficos-plantillas.ts (`closerPuedePedir`), al lado de la hoja que la
//    usa, y en positivo: una acción nueva de esta ruta nace cerrada para él. Antes de esto un closer
//    no entraba nunca: leía por acá la plata que su pantalla le esconde, y eso sigue siendo así.
//    Las rutas hermanas (ia, analisis, imagen) siguen sólo para el admin.
//
//   POST { accion: 'datos', pedidos: [{ grafico, desde, hasta, filtros?, agrupar? }] } → { datos: Record<id, DatosGrafico> }
//   POST { accion: 'bloques', pedidos: [{ id, bloque, desde, hasta }] }               → { datos: Record<id, DatosBloque> }
//   POST { accion: 'valores', campo, desde, hasta, fuentes? }                        → { valores: [{ valor, filas }] }
//   POST { accion: 'detalle', grafico, desde, hasta, filtros?, agrupar?, sel }        → { detalle: RespuestaDetalle }
//   POST { accion: 'guardar', tablero }                                               → { tablero }
//
// El DETALLE (lib/graficos-detalle.ts) es lo que hay atrás de un número clickeado: las cosas que lo forman,
// cada una con sus ids y, en `puede`, qué tabs tiene la capa — de eso dependen los botones de cada fila.

import { NextResponse } from 'next/server';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { esFechaValida, hoyEnTijuana } from '@/lib/date-utils';
import { bloqueDe, MAX_COMPONENTES, type BloqueId } from '@/lib/graficos-catalogo';
import { datosDeGraficos, valoresDeCampo, type PedidoDatos } from '@/lib/graficos-datos';
import { datosDeBloques, type PedidoBloque } from '@/lib/graficos-bloques';
import { detalleDeGrafico } from '@/lib/graficos-detalle';
import { guardarTablero } from '@/lib/graficos-tablero';
import { closerPuedePedir, fuentesDeCampoCloser } from '@/lib/graficos-plantillas';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const rol = await getRolWsEfectivo();
  if (rol == null) return err(401, 'no autenticado');
  if (rol !== 'admin' && rol !== 'closer') return err(403, 'Sólo el admin de la cuenta');
  const capa = await getCapaActual();
  if (!tabEnCapa('graphics', capa)) return err(404, 'No existe');
  // El closer ve la hoja Closing si su negocio compró Closing (la key de la capa sigue siendo ésa).
  if (rol === 'closer' && !tabEnCapa('closing', capa)) return err(403, 'Sólo el admin de la cuenta');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err(400, 'JSON inválido'); }
  const closer = rol === 'closer';
  if (closer && !closerPuedePedir(body)) return err(403, 'Sólo la hoja Closing');

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
      pedidos.push({ grafico: p.grafico, desde, hasta, filtros: p.filtros, agrupar: p.agrupar });
    }
    return NextResponse.json({ datos: await datosDeGraficos(pedidos) });
  }

  if (body.accion === 'bloques') {
    // Un bloque decide su propia ventana (el Outstanding mira hasta fin de mes): las fechas llegan sin acotar.
    const lista = Array.isArray(body.pedidos) ? body.pedidos.slice(0, MAX_COMPONENTES) : [];
    const pedidos: PedidoBloque[] = [];
    for (const p of lista as Array<Record<string, unknown>>) {
      const desde = String(p?.desde ?? '');
      const hasta = String(p?.hasta ?? '');
      const id = typeof p?.id === 'string' ? p.id.slice(0, 40) : '';
      const info = bloqueDe(String(p?.bloque ?? ''));
      if (!id || !info || !esFechaValida(desde) || !esFechaValida(hasta) || desde > hasta) continue;
      pedidos.push({ id, bloque: info.id as BloqueId, desde, hasta });
    }
    return NextResponse.json({ datos: await datosDeBloques(pedidos) });
  }

  if (body.accion === 'valores') {
    const hoy = hoyEnTijuana();
    const desde = String(body.desde ?? '');
    let hasta = String(body.hasta ?? '');
    if (!esFechaValida(desde) || !esFechaValida(hasta) || desde > hasta) return err(400, 'Período inválido');
    if (hasta > hoy) hasta = hoy < desde ? desde : hoy;
    // Al closer, los valores salen SÓLO de las llamadas: «Closer» también es un campo de los leads.
    const fuentes = closer
      ? fuentesDeCampoCloser(body.campo, body.fuentes)
      : Array.isArray(body.fuentes) ? body.fuentes.map(String).slice(0, 30) : undefined;
    return NextResponse.json({ valores: await valoresDeCampo(String(body.campo ?? ''), desde, hasta, fuentes) });
  }

  if (body.accion === 'detalle') {
    // El mismo período que el pedido de datos: acotado a hoy, como el gráfico que se clickeó.
    const hoy = hoyEnTijuana();
    const desde = String(body.desde ?? '');
    let hasta = String(body.hasta ?? '');
    if (!esFechaValida(desde) || !esFechaValida(hasta) || desde > hasta) return err(400, 'Período inválido');
    if (hasta > hoy) hasta = hoy < desde ? desde : hoy;
    return NextResponse.json({ detalle: await detalleDeGrafico({ grafico: body.grafico, desde, hasta, filtros: body.filtros, agrupar: body.agrupar, sel: body.sel }) });
  }

  return err(400, 'Acción desconocida');
}
