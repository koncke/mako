// =============================================================================
// funnels-de-la-hoja — qué funnel mira un bloque de General cuando la HOJA filtra por funnel
// =============================================================================
// El «Filtro» de arriba de una hoja (el control «Funnel», `funnelsDeLaHoja` en lib/graficos-controles-texto.ts) llega a
// los bloques de General por nombre. Un bloque con funnels PROPIOS (elegidos en su panel) los usa; uno sin, toma los de
// la hoja. Así la hoja entera mira el mismo CRM o CRMs.
//   · «A quién cobrarle» (varios) desde el 22/10/2026.
//   · «Tu funnel hoy» (uno) desde el 18/11/2026 (pendiente O10 (3) de docs/pendientes-verificados-17-11.md): con la hoja
//     filtrada por un funnel, el bloque mostraba igual el principal. Toma el PRIMERO de la hoja que el negocio tiene.
// Puro (sin React ni base): lo usa app/general/ProveedorGeneral.tsx y lo ejecuta tests/general-funnels-de-la-hoja.test.ts.
// =============================================================================

import { funnelsDeBloque } from '@/lib/general-piezas';
import type { Elemento } from '@/lib/graficos-catalogo';
import type { DatosGeneral } from './datos-tipos';

/** Lo que la hoja le pasa a un bloque: los funnels elegidos en su «Filtro», por nombre (null = sin filtro). */
export type HojaDeBloque = { funnels: readonly string[] | null };

/** Los ids de los funnels de la hoja que el negocio tiene, en el orden de la hoja. */
function idsDeLaHoja(d: DatosGeneral, hoja?: HojaDeBloque): number[] {
  if (!hoja?.funnels?.length || !d.funnels.ok) return [];
  const lista = d.funnels.d;
  return hoja.funnels.flatMap((n) => lista.filter((f) => f.nombre === n).map((f) => f.id));
}

/** «A quién cobrarle»: los suyos; si no tiene, los de la hoja; si la hoja no filtra, ninguno (= todos). */
export function funnelsDeCobranza(g: NonNullable<Elemento['general']>, d: DatosGeneral, hoja?: HojaDeBloque): number[] {
  const propios = funnelsDeBloque(g);
  if (propios.length) return propios;
  return idsDeLaHoja(d, hoja);
}

/** «Tu funnel hoy»: el suyo; si no tiene, el primero de la hoja; si la hoja no filtra, null (= el principal). */
export function funnelDeFunnelHoy(g: NonNullable<Elemento['general']>, d: DatosGeneral, hoja?: HojaDeBloque): number | null {
  if (g.funnel != null) return g.funnel;
  return idsDeLaHoja(d, hoja)[0] ?? null;
}
