// =============================================================================
// El nombre del plan que ve el cliente, con sus lecturas (18/11/2026)
// =============================================================================
// La regla es pura y vive en lib/plan-visible-reglas.ts. Esto le junta lo que necesita:
//   · `rige`: si paga un plan de MaKo, `pagaUnPlanDe` (lib/plan-esencial.ts), lo mismo que la ficha de los tickets
//     (`planDelNegocio`, lib/tickets-db.ts);
//   · si es cliente de una agencia, `esClienteDeAgencia` (lib/agencia.ts, con `cache`: la página ya la llama, y la segunda
//     llamada no vuelve a leer);
//   · los nombres del catálogo, `planesMako` (lib/compra-plan.ts), con los de PLANES_MAKO_DEFAULT si falta alguno.
// Una lectura que falla no rompe la pantalla: cuenta como «no sé», y la regla decide con eso.
// =============================================================================

import 'server-only';
import { pagaUnPlanDe } from './plan-esencial';
import { esClienteDeAgencia } from './agencia';
import { planesMako } from './compra-plan';
import { PLANES_MAKO_DEFAULT, type PlanMako } from './planes-mako';
import { nombreDelPlanVisible } from './plan-visible-reglas';

/** El nombre de cada plan, del catálogo vigente; si falta uno, el de PLANES_MAKO_DEFAULT. */
export function nombresDelCatalogo(planes: readonly Pick<PlanMako, 'id' | 'nombre'>[]): { esencial: string; pro: string } {
  const de = (id: string) => planes.find((p) => p.id === id)?.nombre || PLANES_MAKO_DEFAULT.find((p) => p.id === id)!.nombre;
  return { esencial: de('esencial'), pro: de('pro') };
}

/** El nombre del plan del negocio `ws` para el cliente: «MaKo Pro», «MaKo Essential», «Plan de tu agencia» o «Plan a medida». */
export async function nombreDelPlanDe(ws: number, capa: string | null): Promise<string> {
  const [rige, deAgencia, planes] = await Promise.all([
    capa === 'completo' || capa === 'agencia' ? pagaUnPlanDe(ws, capa).catch(() => null) : Promise.resolve(null),
    esClienteDeAgencia(ws).catch(() => null),
    planesMako().catch(() => [] as PlanMako[]),
  ]);
  return nombreDelPlanVisible({ capa, rige, clienteDeAgencia: deAgencia === true, nombres: nombresDelCatalogo(planes) });
}
