// =============================================================================
// api-mako/funnels-del-pedido — el parámetro `funnels` de la API de MaKo, leído UNA vez para todas las áreas
// =============================================================================
// «todos» (el negocio entero) o ids separados por coma, que tienen que ser funnels ACTIVOS del negocio (los lista
// listar_objetivos en `funnels_del_negocio`). Lo usan guardar_objetivo y guardar_kpi (General, mig 0306) y, desde el
// 17/10/2026, diagnosticar_funnel (Métricas, #896). Vivía adentro de general.run.ts: dos copias de esta lectura serían
// dos respuestas distintas a «¿de qué funnels?».
//
// `null` = no vino (al editar queda el que estaba; al leer, el negocio entero). Con la lista de funnels caída no se
// puede elegir: se dice, no se adivina.
// =============================================================================

import 'server-only';
import { leerFunnelsDeGeneral, type FunnelDeGeneral } from '@/lib/general-alcance';
import { sanearFunnelIds } from '@/lib/funnels-elegidos';

export async function funnelsDelPedido(input: Record<string, unknown>): Promise<{ ids: number[]; nombres: FunnelDeGeneral[] } | { error: string } | null> {
  const v = input.funnels;
  const crudo = typeof v === 'string' && v.trim() ? v.trim() : null;
  if (crudo == null) return null;
  const disponibles = await leerFunnelsDeGeneral();
  if (/^tod[oa]s?$/i.test(crudo)) return { ids: [], nombres: disponibles ?? [] };
  const partes = crudo.split(/[,\s]+/).filter(Boolean);
  const ids = sanearFunnelIds(partes);
  if (!ids.length || ids.length !== new Set(partes).size) return { error: `funnels: «${crudo}» no es «todos» ni una lista de ids de funnels separados por coma.` };
  if (!disponibles) return { error: 'No se pudieron leer los funnels del negocio: ahora no se puede elegir de cuáles suma.' };
  const faltan = ids.filter((id) => !disponibles.some((f) => f.id === id));
  if (faltan.length) return { error: `No hay un funnel activo con id ${faltan.join(', ')}. Los del negocio están en listar_objetivos (funnels_del_negocio).` };
  return { ids, nombres: disponibles };
}
