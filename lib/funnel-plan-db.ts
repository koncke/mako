import 'server-only';

// La lectura y la escritura del plan del funnel y de los referentes elegidos: una fila de app_settings por negocio (lib/settings.ts,
// que ya resuelve el workspace). Lo puro está en lib/funnel-plan.ts y lib/asesores/catalogo.ts.

import { getSetting, getSettingEstricto, setSetting } from './settings';
import { CLAVE_PLAN_FUNNEL, sanearPlan, type PlanFunnel } from './funnel-plan';
import { CLAVE_REFERENTES, conReferenteElegido, referenteDelCoach, type IdAsesor } from './asesores/catalogo';

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

/** Quién aconseja en el coach (uno solo desde el 4/11/2026): lo elegido, lo de los dos coaches de antes o Hormozi (lib/asesores/catalogo.ts). */
export async function leerReferente(): Promise<IdAsesor | null> {
  return referenteDelCoach(json(await getSetting(CLAVE_REFERENTES)));
}

/**
 * Guarda lo elegido AL LADO de lo de antes (`conReferenteElegido`). ⚠️ LEE ESTRICTO: escribe la fila entera, y con la base caída una
 * lectura tolerante devuelve null y borraría lo que los dos coaches de antes tenían guardado.
 */
export async function guardarReferente(id: IdAsesor | null): Promise<IdAsesor | null> {
  const nuevo = conReferenteElegido(json(await getSettingEstricto(CLAVE_REFERENTES)), id);
  await setSetting(CLAVE_REFERENTES, JSON.stringify(nuevo));
  return referenteDelCoach(nuevo);
}
