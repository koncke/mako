// =============================================================================
// La lectura de «¿la ficha del lead dibuja la pestaña Tracking?» (la regla: lib/tracking-ficha.ts)
// =============================================================================
// La llaman las DOS puertas de la ficha: la ruta /crm/[id] (app/crm/[id]/page.tsx) y la action que
// le trae los datos al pop-up del tablero (`getLeadFullAction`, app/crm/actions.ts). «Lo decide el
// server y baja como dato»: el navegador no lee el mapa de campañas.
//
// ⚠️ «NO PUDE LEER» NO ES «NO HAY CAMPAÑA». Con la lectura caída se DIBUJA la pestaña: una pestaña
// de más se ignora, una que falta esconde de dónde vino el lead justo el día que la base tose. Por
// eso la lectura es la ESTRICTA (la tolerante convierte un error en `[]`, que acá significaría
// «ninguna campaña» y escondería la pestaña en todos los leads). Es la regla de AGENTS.md: una
// lectura que cae al default sirve para dibujar, nunca para DECIDIR.
// =============================================================================

import 'server-only';
import { leerCampanasAsignadasEstricto } from './campana-funnel';
import { leerFunnels } from './funnels';
import { funnelTieneCampana } from './tracking-ficha';

export async function verTrackingDeLead(funnelDelLead: number | string | null | undefined): Promise<boolean> {
  try {
    const [asignadas, funnels] = await Promise.all([leerCampanasAsignadasEstricto(), leerFunnels()]);
    const idDelDefault = funnels?.find((f) => f.esDefault)?.id ?? null;
    return funnelTieneCampana(asignadas, funnelDelLead, idDelDefault);
  } catch {
    return true;
  }
}
