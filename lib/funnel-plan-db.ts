import 'server-only';

// La lectura y la escritura del plan del funnel y de los referentes elegidos: una fila de app_settings por negocio (lib/settings.ts,
// que ya resuelve el workspace). Lo puro está en lib/funnel-plan.ts y lib/asesores/catalogo.ts.

import { getSetting, setSetting } from './settings';
import { CLAVE_PLAN_FUNNEL, sanearPlan, type PlanFunnel } from './funnel-plan';
import { CLAVE_REFERENTES, sanearReferentes, type ReferentesElegidos } from './asesores/catalogo';

const json = (s: string | null): unknown => {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
};

export async function leerPlanFunnel(): Promise<PlanFunnel | null> {
  return sanearPlan(json(await getSetting(CLAVE_PLAN_FUNNEL)));
}

export async function guardarPlanFunnel(plan: PlanFunnel): Promise<void> {
  await setSetting(CLAVE_PLAN_FUNNEL, JSON.stringify(plan));
}

export async function leerReferentes(): Promise<ReferentesElegidos> {
  return sanearReferentes(json(await getSetting(CLAVE_REFERENTES)));
}

export async function guardarReferentes(r: ReferentesElegidos): Promise<void> {
  await setSetting(CLAVE_REFERENTES, JSON.stringify(r));
}
