// =============================================================================
// graficos-detalle — lo que hay ATRÁS de un número del Dashboard (punto 5 del feedback)
// =============================================================================
// Un clic en una KPI, una barra o una fila abre la lista de las cosas que lo forman: los anuncios de un
// gasto, los leads de unas agendas, las cuotas de un cobro. Lo pide POST /api/graficos {accion:'detalle'}
// y lo dibuja app/dashboard/Detalle.tsx; el mapa de «a qué abre cada métrica» es puro y vive en el
// catálogo (`destinoDetalle`, `ENTIDADES`), y las acciones de cada fila en lib/graficos-acciones.ts.
//
// Lo que gobierna:
//   · Se lee con los MISMOS lectores que el gráfico (`LECTORES`), con su período, sus filtros y el del
//     grupo clickeado: el detalle de un número es ese número, no una consulta parecida.
//   · Se agrupa por el ID de la entidad (`agregarPorRef`), no por su nombre: dos anuncios o dos clientes
//     que se llaman igual son dos filas, y cada una con sus ids de la MISMA fila del server.
//   · Qué acciones se ofrecen depende de la CAPA del workspace, que se mira acá y viaja en la respuesta.
//   · No hay IA en este camino, a propósito: devuelve nombres de personas (leads, clientes). El test lo
//     frena si alguien le suma un `lib/ai-*`.

import 'server-only';
import { getCapaActual, getWorkspaceActual } from './workspace';
import { tabEnCapa } from './capas';
import { hoyEnTijuana } from './date-utils';
import { hoyDelWorkspace } from './api-mako/areas/crm.helpers';
import { ENTIDADES, destinoDetalle, fuenteDe, metricaDe, sanearGrafico } from './graficos-catalogo';
import { agregarPorRef, filtrarFilas, SinConexionError } from './graficos-agregar';
import { LECTORES, hastaDeFuente, sanearFiltros } from './graficos-datos';
import { aFilaDetalle, esDimensionTiempo, planDetalle, recortarAlTramo, type Capacidades, type FilaDetalle, type RespuestaDetalle, type SelDetalle } from './graficos-acciones';

/** Cuántas filas trae un detalle. Más que eso no se lee en un modal: se filtra. */
export const TOPE_DETALLE = 50;

export type PedidoDetalle = { grafico: unknown; desde: string; hasta: string; filtros?: unknown; agrupar?: unknown; sel?: unknown };

/** Las tabs que deciden qué botones se dibujan. Sólo admin llega acá (la puerta de /api/graficos). */
async function capacidades(): Promise<Capacidades> {
  const capa = await getCapaActual();
  return { crm: tabEnCapa('crm', capa), ads: tabEnCapa('ads-manager', capa), closing: tabEnCapa('closing', capa), plan: tabEnCapa('todo', capa) };
}

/** El hoy del negocio (su zona), para la fecha de un cobro marcado. Si no se puede leer, el de la app. */
async function hoyDelNegocio(): Promise<string> {
  const ws = await getWorkspaceActual();
  if (ws == null) return hoyEnTijuana();
  try { return (await hoyDelWorkspace(ws)).hoy; } catch { return hoyEnTijuana(); }
}

/** Lo que llega del navegador no vale nada: la dimensión tiene que ser del conjunto y la métrica también. */
function sanearSel(raw: unknown, fuenteId: string): SelDetalle {
  const o = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const f = fuenteDe(fuenteId);
  const dimension = typeof o.dimension === 'string' && f?.dimensiones.some((d) => d.id === o.dimension) ? o.dimension : null;
  const valor = dimension && typeof o.valor === 'string' ? o.valor.slice(0, 120) : null;
  const metrica = typeof o.metrica === 'string' && f && metricaDe(f, o.metrica) ? o.metrica : undefined;
  return { dimension, valor, ...(metrica ? { metrica } : {}) };
}

export async function detalleDeGrafico(p: PedidoDetalle): Promise<RespuestaDetalle> {
  const g = sanearGrafico(p.grafico);
  if (!g || !fuenteDe(g.fuente)) return { ok: false, error: 'Gráfico inválido' };
  const sel = sanearSel(p.sel, g.fuente);
  const agrupar = typeof p.agrupar === 'string' && esDimensionTiempo(p.agrupar) ? p.agrupar : null;
  const [puede, hoy] = await Promise.all([capacidades(), hoyDelNegocio()]);
  const base = { puede, hoy, desde: p.desde, hasta: p.hasta, noAplica: [] as string[], fuera: 0, sinId: 0 };
  const sinLista: RespuestaDetalle = { ok: true, entidad: null, plural: null, columnas: [], filas: [], ...base };

  const destino = destinoDetalle(g.fuente, g.fecha, sel.metrica ?? g.metricas[0]);
  const ent = destino ? ENTIDADES[destino.fuente] : undefined;
  const fDestino = destino ? fuenteDe(destino.fuente) : undefined;
  const lector = destino ? LECTORES[destino.fuente] : undefined;
  if (!destino || !ent || !fDestino || !lector) return sinLista;

  const plan = planDetalle(g.fuente, destino, sanearFiltros(p.filtros, g.fuente), sel, { desde: p.desde, hasta: p.hasta }, agrupar);
  // Si el grupo clickeado no existe en el conjunto del detalle, listar sería listar todo: mejor nada.
  if (plan.grupoPerdido) return { ...sinLista, noAplica: plan.noAplica };

  const sinRango = !!fDestino.fechas.find((x) => x.id === destino.fecha)?.sinRango;
  // Con la fecha del DESTINO: sin ella toma la primera del conjunto, y en pagos ésa es el vencimiento (que mira
  // hacia adelante y no se corta), aunque el detalle sea por fecha de pago (v5).
  const hasta = hastaDeFuente({ fuente: destino.fuente, fecha: destino.fecha }, plan.desde, plan.hasta);
  const metricas = [...new Set([destino.incluye, ...destino.columnas])];
  const columnas = destino.columnas.map((id) => metricaDe(fDestino, id)).filter((x) => !!x).map((x) => ({ id: x!.id, nombre: x!.nombre, formato: x!.formato }));
  const respuesta = { ok: true as const, entidad: ent.entidad, plural: ent.plural, columnas, ...base, desde: plan.desde, hasta, noAplica: plan.noAplica };
  if (!sinRango && plan.desde > hasta) return { ...respuesta, filas: [] };

  try {
    const leidas = await lector(destino.fecha, { desde: plan.desde, hasta, sinRango }, { dimension: ent.nombre[0] ?? null, desglose: null });
    const delGrupo = recortarAlTramo(leidas, plan, sel, sinRango);
    const agg = agregarPorRef(destino.fuente, metricas, filtrarFilas(delGrupo, plan.filtros), ent.ref, TOPE_DETALLE);
    const lista = agg.filas.map((fe) => aFilaDetalle(destino.fuente, fe, metricas, destino.columnas)).filter((x): x is FilaDetalle => !!x);
    return { ...respuesta, filas: lista, fuera: agg.fuera, sinId: agg.sinId };
  } catch (e) {
    console.error(`[graficos] detalle ${destino.fuente}|${destino.fecha}: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, error: e instanceof SinConexionError ? e.message : 'No pude leer el detalle' };
  }
}
