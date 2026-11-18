// =============================================================================
// El nombre del plan que ve el cliente, con sus lecturas (18/11/2026)
// =============================================================================
// La regla es pura y vive en lib/plan-visible-reglas.ts. Esto le junta lo que necesita:
//   · `rige`: si paga un plan de MaKo, `pagaUnPlanDe` (lib/plan-esencial.ts), lo mismo que la ficha de los tickets
//     (`planDelNegocio`, lib/tickets-db.ts);
//   · si es cliente de una agencia, `esClienteDeAgencia` (lib/agencia.ts, con `cache`: la página ya la llama, y la segunda
//     llamada no vuelve a leer);
//   · los nombres del catálogo, `planesMako` (lib/compra-plan.ts), con los de PLANES_MAKO_DEFAULT si falta alguno
//     (`nombresDeLosPlanes`, lib/planes-mako.ts).
// Una lectura que falla no rompe la pantalla: cuenta como «no sé», y la regla decide con eso.
// =============================================================================

import 'server-only';
import { pagaUnPlanDe } from './plan-esencial';
import { esClienteDeAgencia } from './agencia';
import { planesMako } from './compra-plan';
import { nombresDeLosPlanes, type PlanMako } from './planes-mako';
import { nombreDelPlanVisible } from './plan-visible-reglas';

/** El nombre del plan del negocio `ws` para el cliente: «MaKo Pro», «MaKo Essential», «Plan de tu agencia» o «Plan a medida». */
export async function nombreDelPlanDe(ws: number, capa: string | null): Promise<string> {
  const [rige, planes] = await Promise.all([
    capa === 'completo' || capa === 'agencia' ? pagaUnPlanDe(ws, capa).catch(() => null) : Promise.resolve(null),
    planesMako().catch(() => [] as PlanMako[]),
  ]);
  // Con «no sé» (`null`) cuenta como de agencia: lo MISMO que «Tu plan» (`deAgencia`, app/configuraciones/plan/page.tsx), que
  // con «no sé» ya dice «Lo maneja tu agencia». Así el título y el resto de la pantalla no se contradicen. Si paga un plan del
  // catálogo, esto no cambia nada: el nombre es el del catálogo. Lo fija tests/agency-dos-duenos.test.ts.
  const deAgencia = (await esClienteDeAgencia(ws)) !== false;
  return nombreDelPlanVisible({ capa, rige, clienteDeAgencia: deAgencia, nombres: nombresDeLosPlanes(planes) });
}
