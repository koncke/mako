// =============================================================================
// informe-compartido — leer un informe del Dashboard por su link, SIN sesión
// =============================================================================
// Lo llaman la página (/compartido/<token>, la primera pintada) y el endpoint de datos
// (/api/compartido/graficos, cada cambio de la vista). Los dos terminan en las MISMAS funciones de
// lectura y de limpieza; lo único que cambia es de dónde sale el pedido: la página lo arma con
// `pedidosDeHoja` y la vista vacía (como app/dashboard/page.tsx, o las firmas no coinciden con la pantalla
// y cada gráfico se pide dos veces), y el endpoint lo REARMA desde el componente guardado con lo que la
// vista puede mover (./informe-reglas.ts, que es puro y tiene test).
//
// ⚠️ TODO LO QUE LEE VA ADENTRO DE `runWithWorkspace(<el del share>)`. Sin sesión, `getWorkspaceActual()`
//    cae al dueño (OWNER_WS = ws1, que es un CLIENTE) y lib/settings.ts lee los settings del ws1: el
//    informe de otro negocio se leería con los datos del ws1, sin un error. El workspace sale de la FILA
//    que resolvió el token, nunca del pedido (docs/hallazgos-seguridad.md, «/conocimientos se comparte por
//    link público»).
// ⚠️ CADA PEDIDO RESUELVE EL TOKEN CONTRA LA FILA VIVA (`resolverToken`, sin caché): revocar corta el
//    acceso al instante, también a una pestaña que ya tenía el informe abierto.
// ⚠️ Lo que NO se arregla desde acá: si quien abre el link TIENE sesión de MaKo, `queTableroLeer`
//    (lib/graficos-lectura.ts) decide el tablero de Tareas por SU sesión y no por la capa del share. No
//    trae datos de otro negocio (todo sigue en el workspace del share), pero puede leer la tabla vacía.

import 'server-only';
import { resolverToken, puedeVerInforme, type Acceso } from '@/lib/shares';
import { runWithWorkspace } from '@/lib/workspace';
import { leerTableroVersionado } from '@/lib/graficos-tablero';
import { datosDeGraficos, valoresDeCampo, type DatosGrafico, type ValorDeCampo } from '@/lib/graficos-datos';
import { datosDeBloques, type DatosBloque } from '@/lib/graficos-bloques';
import type { Bloque, Grafico, Hoja, Tablero } from '@/lib/graficos-catalogo';
import { esFechaValida, hoyEnTijuana } from '@/lib/date-utils';
import { pedidosDeHoja, type PedidoBloqueHoja, type PedidoGrafico } from '@/app/dashboard/exportar';
import { Alias } from '@/lib/graficos-analisis';
import {
  BLOQUE_NO_SE_COMPARTE, BLOQUES_COMPARTIBLES, campoCompartible, controlDeLista, pedidoBloqueCompartido,
  pedidoGraficoCompartido, pedidosDeBloques, pedidosDeGraficos, repartirBloques, resultadoCompartible,
} from './informe-reglas';

/** Un acceso al informe ya validado: el share vivo, su workspace y la persona dueña del informe. */
export type AccesoInforme = { acceso: Acceso; ws: number; sub: string };

/** Un acceso ya resuelto, preguntado con `puedeVerInforme` (lib/shares.ts). null = no es un informe que se pueda ver. */
export function informeDeAcceso(acceso: Acceso | null): AccesoInforme | null {
  if (!acceso) return null;
  const sub = acceso.share.recurso_id;
  if (!puedeVerInforme(acceso.share, sub)) return null;
  return { acceso, ws: Number(acceso.share.workspace_id), sub: sub as string };
}

/** El token, contra la fila VIVA. null = 404, sin distinguir por qué (eso ayudaría a enumerar tokens). */
export async function accesoAInforme(token: string): Promise<AccesoInforme | null> {
  return informeDeAcceso(await resolverToken(token).catch(() => null));
}

/** Corre `fn` en el workspace DEL SHARE. */
const enSuWorkspace = <T,>(a: AccesoInforme, fn: () => Promise<T>): Promise<T> => runWithWorkspace(a.ws, fn);

/** El informe de la persona dueña del share, o null si la lectura falló: «no pude leer» no es «no armó ninguno». */
export async function leerInformeCompartido(a: AccesoInforme): Promise<Tablero | null> {
  try {
    return (await enSuWorkspace(a, () => leerTableroVersionado(a.sub))).tablero;
  } catch (e) {
    console.error(`[compartido] no pude leer el informe del share ${a.acceso.share.id}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** El «hoy» de los pedidos: el mismo de app/dashboard/page.tsx, o las firmas no coinciden con la pantalla. */
export const hoyDelInforme = (): string => hoyEnTijuana();

/**
 * Lee los GRÁFICOS en el workspace del share y los limpia (`resultadoCompartible`). El período va TAL CUAL:
 * el corte en hoy vive en `datosDeGraficos` (contrato v5, «el corte en hoy en UN lugar»).
 */
async function leerGraficos(a: AccesoInforme, pedidos: Array<{ g: Grafico; pedido: PedidoGrafico }>, _hoy: string): Promise<Record<string, DatosGrafico>> {
  if (!pedidos.length) return {};
  const crudo = await enSuWorkspace(a, () => datosDeGraficos(pedidos.map(({ pedido }) => pedido)));
  const out: Record<string, DatosGrafico> = {};
  // Un alias por pedido: la misma persona es el mismo «Closer N» en todos los gráficos que llegan juntos.
  const alias = new Alias();
  for (const { g } of pedidos) {
    const d = crudo[g.id];
    if (!d) continue;
    out[g.id] = d.ok ? { ok: true, resultado: resultadoCompartible(g, d.resultado, alias) } : d;
  }
  return out;
}

/**
 * Lee los BLOQUES en el workspace del share. Uno que no está en `BLOQUES_COMPARTIBLES` ni se lee: contesta
 * «No se comparte en un link» y la tarjeta lo dice. Los que salen, salen con lo suyo recortado.
 */
async function leerBloques(a: AccesoInforme, pedidos: Array<{ b: Bloque; pedido: PedidoBloqueHoja }>): Promise<Record<string, DatosBloque>> {
  const out: Record<string, DatosBloque> = {};
  const { salen, noSalen } = repartirBloques(pedidos);
  for (const x of noSalen) out[x.b.id] = { ok: false, error: BLOQUE_NO_SE_COMPARTE };
  if (!salen.length) return out;
  const crudo = await enSuWorkspace(a, () => datosDeBloques(salen.map((x) => x.pedido)));
  for (const x of salen) {
    const d = crudo[x.b.id];
    if (!d) continue;
    out[x.b.id] = d.ok ? { ok: true, datos: BLOQUES_COMPARTIBLES[x.b.bloque](d.datos) } : d;
  }
  return out;
}

/** La primera pintada de una hoja: lo que el informe muestra de entrada, con la vista vacía y la versión 0. */
export async function datosInicialesDeHoja(a: AccesoInforme, hoja: Hoja, hoy: string): Promise<{ datos: Record<string, DatosGrafico>; bloques: Record<string, DatosBloque> }> {
  const p = pedidosDeHoja(hoja, {}, hoy, 0);
  const [datos, bloques] = await Promise.all([
    leerGraficos(a, p.graficos.map((x) => ({ g: x.g, pedido: x.pedido })), hoy),
    leerBloques(a, p.bloques.map((x) => ({ b: x.b, pedido: x.pedido }))),
  ]);
  return { datos, bloques };
}

/** Los gráficos que pidió el cuerpo (`pedidos` del contrato de la pantalla), REARMADOS desde el informe guardado. */
export function graficosDelCuerpo(a: AccesoInforme, hoja: Hoja, crudo: unknown, hoy: string): Promise<Record<string, DatosGrafico>> {
  const pedidos = pedidosDeGraficos(hoja, crudo).map(({ comp, cliente }) => ({ g: comp, pedido: pedidoGraficoCompartido(comp, hoja, cliente, hoy) }));
  return leerGraficos(a, pedidos, hoy);
}

/** Los bloques que pidió el cuerpo, REARMADOS desde el informe guardado. */
export function bloquesDelCuerpo(a: AccesoInforme, hoja: Hoja, crudo: unknown, hoy: string): Promise<Record<string, DatosBloque>> {
  const pedidos = pedidosDeBloques(hoja, crudo).map(({ comp, cliente }) => ({ b: comp, pedido: pedidoBloqueCompartido(comp, hoja, cliente, hoy) }));
  return leerBloques(a, pedidos);
}

export type ValoresCompartidos =
  | { ok: true; valores: ValorDeCampo[] }
  | { ok: false; motivo: 'periodo' | 'campo' };

/**
 * Los valores de una lista desplegable: sólo de un control de LISTA que la hoja (o ese gráfico) YA tiene,
 * y sólo si su campo es público en las fuentes de la hoja (`campoCompartible`): sus valores se muestran
 * como opciones, y los de un campo de personas serían los nombres. El campo y las fuentes salen del
 * informe guardado; del cuerpo, sólo el período.
 */
export async function valoresCompartidos(
  a: AccesoInforme, hoja: Hoja, controlId: unknown, componenteId: unknown, desde: unknown, hasta: unknown, hoy: string,
): Promise<ValoresCompartidos> {
  const control = controlDeLista(hoja, controlId, componenteId);
  const campo = control?.campo ?? null;
  const fuentes = campo ? campoCompartible(hoja, campo) : null;
  if (!campo || !fuentes) return { ok: false, motivo: 'campo' };
  const d = typeof desde === 'string' ? desde : '';
  const h = typeof hasta === 'string' ? hasta : '';
  if (!esFechaValida(d) || !esFechaValida(h) || d > h) return { ok: false, motivo: 'periodo' };
  // El período TAL CUAL: `valoresDeCampo` lo corta en hoy con la regla de cada conjunto.
  const valores = await enSuWorkspace(a, () => valoresDeCampo(campo, d, h, fuentes));
  return { ok: true, valores };
}
