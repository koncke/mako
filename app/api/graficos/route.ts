// =============================================================================
// /api/graficos — datos y guardado del Dashboard (el editor de informes)
// =============================================================================
// Una ruta y no server actions: el editor pide los datos de varios gráficos a la vez, y las
// server actions se ENCOLAN de a una (AGENTS.md, «Antes de optimizar una consulta…»). El
// `?ws=` lo pega solo el parche de fetch (app/_components/WsFetch.tsx).
//
// La puerta es la misma que la de la página (`requireRolWs(['closer', 'setter'], { nav: 'graphics' })`): admin
// del workspace, o un rol con hoja única (closer, setter), y la tab en su capa.
//
// ⚠️ EL CLOSER, DESDE EL 11/10/2026 (decisión 6 de Martín: Closing Analyst se retiró y «los closers ven
//    SÓLO la hoja Closing del Dashboard»): entra, pero sólo a lo que esa hoja pide —`datos` de las
//    llamadas y `valores` de un campo de Closing, recortados a esos conjuntos—, y
//    sólo si su negocio tiene Closing en la capa. Guardar, el detalle de un número y todo lo demás:
//    403. La lista vive en lib/graficos-plantillas.ts (`puedePedir`), al lado de la hoja que la
//    usa, y en positivo: una acción nueva de esta ruta nace cerrada para él. Antes de esto un closer
//    no entraba nunca: leía por acá la plata que su pantalla le esconde, y eso sigue siendo así.
//    Las rutas hermanas (ia, analisis, imagen) siguen sólo para el admin.
// ⚠️ Y EL SETTER, DESDE EL 12/10/2026 (tanda v5: «El setter ve SÓLO la hoja Chat Analyst»): la misma regla,
//    generalizada a todo rol con hoja ÚNICA (`HOJA_DE_ROL`): `puedePedir(rol, body)` con los conjuntos de SU
//    hoja, su capa (WhatsApp) y su informe en memoria para los pop-ups.
//
//   POST { accion: 'datos', pedidos: [{ grafico, desde, hasta, filtros?, agrupar? }], popupDe? } → { datos: Record<id, DatosGrafico> }
//   POST { accion: 'valores', campo, desde, hasta, fuentes? }                        → { valores: [{ valor, filas }] }
//   POST { accion: 'detalle', grafico, desde, hasta, filtros?, agrupar?, sel }        → { detalle: RespuestaDetalle }
//   POST { accion: 'guardar', version, tablero }                                      → { tablero, version } · 409 si cambió
//
// El DETALLE (lib/graficos-detalle.ts) es lo que hay atrás de un número clickeado: las cosas que lo forman,
// cada una con sus ids y, en `puede`, qué tabs tiene la capa — de eso dependen los botones de cada fila.
//
// ⚠️ EL PERÍODO LLEGA TAL CUAL (contrato v5): el corte en HOY vive en lib/graficos-datos.ts (`hastaDeFuente`),
// adentro de los datos, los valores y el detalle. Acá se valida que sea un período y nada más: cortarlo acá
// hacía imposible una fecha que mira hacia ADELANTE (el vencimiento de una cuota, «Próximos 30 días»).
//
// EL POP-UP (interfaz I5 del contrato): los gráficos de la mini-hoja guardada adentro de un gráfico
// (`Grafico.popup`) se piden con este mismo `datos` y `popupDe: <id del gráfico dueño>`. El server busca al
// dueño en el informe de quien pide —el guardado, o el del closer o el setter en memoria— y lee cada componente con SU
// definición guardada: del cuerpo valen el período, el «agrupar por» y los filtros (el inyectado del clic
// incluido, que se sanea contra el conjunto como cualquier filtro). Lo que no está en el pop-up guardado: al
// admin se le lee tal cual (lo está editando y todavía no se guardó; igual podría pedirlo sin pop-up), al
// closer (ni al setter) no se le lee.

import { NextResponse } from 'next/server';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { esFechaValida } from '@/lib/date-utils';
import { esGrafico, MAX_COMPONENTES, type Componente, type Tablero } from '@/lib/graficos-catalogo';
import { datosDeGraficos, valoresDeCampo, type PedidoDatos } from '@/lib/graficos-datos';
import { detalleDeGrafico } from '@/lib/graficos-detalle';
import { guardarTableroVersion, leerTablero } from '@/lib/graficos-tablero';
import { fuentesDeCampoDeRol, hojaDeRol, informeDeRol, puedePedir } from '@/lib/graficos-plantillas';

/** Los componentes del pop-up del gráfico `id` (en cualquier hoja del informe), o null si no está o no tiene. */
function componentesDePopup(t: Tablero, id: string): Componente[] | null {
  for (const h of t.hojas) for (const c of h.componentes) {
    if (esGrafico(c) && c.id === id) return Array.isArray(c.popup?.componentes) ? c.popup!.componentes : null;
  }
  return null;
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const rol = await getRolWsEfectivo();
  if (rol == null) return err(401, 'no autenticado');
  // La hoja ÚNICA de un rol (el closer, Closing; el setter, Chat Analyst). Sin una, sólo el admin.
  const unica = hojaDeRol(rol);
  if (rol !== 'admin' && !unica) return err(403, 'Sólo el admin de la cuenta');
  const capa = await getCapaActual();
  if (!tabEnCapa('graphics', capa)) return err(404, 'No existe');
  // Ve su hoja si su negocio compró la capa que la hoja pide (Closing / WhatsApp).
  if (unica && !tabEnCapa(unica.capa, capa)) return err(403, 'Sólo el admin de la cuenta');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err(400, 'JSON inválido'); }
  if (unica && !puedePedir(rol, body)) return err(403, unica.error);

  if (body.accion === 'guardar') {
    // v5: el autoguardado manda la VERSIÓN que leyó (compare-and-set, como la API de MaKo). Sin `version` es
    // una pestaña abierta antes de este deploy: su saneo reconstruye campo por campo y borraría lo nuevo
    // (filtros fijos, pop-ups, conectores, secciones, cajas de IA) en el primer guardado — se le pide recargar.
    if (!('version' in body)) return err(409, 'Recarga la página para seguir editando');
    try {
      const r = await guardarTableroVersion(body.tablero, typeof body.version === 'string' ? body.version : null);
      if (!r.ok) return NextResponse.json({ error: 'El informe cambió en otra pestaña', conflicto: true }, { status: 409 });
      return NextResponse.json({ tablero: r.tablero, version: r.version });
    } catch (e) {
      return err(400, e instanceof Error ? e.message : 'No se pudo guardar');
    }
  }

  if (body.accion === 'datos') {
    const lista = Array.isArray(body.pedidos) ? body.pedidos.slice(0, MAX_COMPONENTES) : [];
    // El pop-up: sus componentes se leen con la definición GUARDADA del gráfico dueño.
    let delPopup: Map<string, Componente> | null = null;
    if (typeof body.popupDe === 'string' && body.popupDe) {
      const dueno = informeDeRol(rol) ?? (await leerTablero()).tablero;
      const comps = componentesDePopup(dueno, body.popupDe.slice(0, 40));
      if (!comps && unica) return err(403, unica.error);
      delPopup = new Map((comps ?? []).map((c) => [c.id, c] as const));
    }
    const pedidos: PedidoDatos[] = [];
    for (const p of lista as Array<Record<string, unknown>>) {
      const desde = String(p?.desde ?? '');
      const hasta = String(p?.hasta ?? '');
      if (!esFechaValida(desde) || !esFechaValida(hasta) || desde > hasta) continue;
      let grafico = p.grafico;
      if (delPopup) {
        const id = grafico && typeof grafico === 'object' ? String((grafico as { id?: unknown }).id ?? '') : '';
        const guardado = delPopup.get(id);
        if (guardado) grafico = guardado;
        else if (unica) continue;
      }
      // El período va TAL CUAL: el corte en hoy (y el «futuro») lo decide `datosDeGraficos`.
      pedidos.push({ grafico, desde, hasta, filtros: p.filtros, agrupar: p.agrupar });
    }
    return NextResponse.json({ datos: await datosDeGraficos(pedidos) });
  }

  // (Hasta el 13/10/2026 había una acción `bloques`: desde v5 ningún bloque llega a la pantalla —el saneo los
  // convierte en gráficos, lib/graficos-migrar-v5.ts— y la acción contestaba siempre vacío. Ahora cae en
  // «Acción desconocida».)

  if (body.accion === 'valores') {
    const desde = String(body.desde ?? '');
    const hasta = String(body.hasta ?? '');
    if (!esFechaValida(desde) || !esFechaValida(hasta) || desde > hasta) return err(400, 'Período inválido');
    // A un rol con hoja única, los valores salen SÓLO de los conjuntos de su hoja: «Closer» también es un campo de
    // los leads, y «Setter» también.
    const fuentes = unica
      ? fuentesDeCampoDeRol(rol, body.campo, body.fuentes)
      : Array.isArray(body.fuentes) ? body.fuentes.map(String).slice(0, 30) : undefined;
    return NextResponse.json({ valores: await valoresDeCampo(String(body.campo ?? ''), desde, hasta, fuentes) });
  }

  if (body.accion === 'detalle') {
    // El mismo período que el pedido de datos, TAL CUAL: el detalle lo corta con la misma regla que el gráfico.
    const desde = String(body.desde ?? '');
    const hasta = String(body.hasta ?? '');
    if (!esFechaValida(desde) || !esFechaValida(hasta) || desde > hasta) return err(400, 'Período inválido');
    return NextResponse.json({ detalle: await detalleDeGrafico({ grafico: body.grafico, desde, hasta, filtros: body.filtros, agrupar: body.agrupar, sel: body.sel }) });
  }

  return err(400, 'Acción desconocida');
}
