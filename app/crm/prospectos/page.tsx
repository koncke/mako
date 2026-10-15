// =============================================================================
// /crm/prospectos — la lista aparte de la prospección en frío (Leads Scraper)
// =============================================================================
// docs/diseno-leads-scraper.md §4 y §7: se busca en Google Maps o Instagram (Apify, con la key del
// negocio), los resultados se ordenan por puntaje y se pasan al CRM los elegidos. Copia las listas
// de Apollo: buscar → guardar en una lista → elegir.
//
// La lista se carga del lado del navegador (`listarProspectosAction`) y no en el render: traerla
// también trae los resultados de las búsquedas que terminaron, y eso ESCRIBE. Una escritura colgada
// de un render depende de que alguien haya mirado (AGENTS.md); acá es una acción explícita.

import { Pagina } from '@/app/_ui';
import { requireRolWs } from '@/lib/tab-access';
import { listarFunnels } from '@/lib/funnels';
import { getRolWsEfectivo } from '@/lib/workspace';
import { ProspectosApp } from './ProspectosApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProspectosPage() {
  await requireRolWs(['closer', 'setter'], { nav: 'crm' });
  const [funnels, rol] = await Promise.all([listarFunnels(), getRolWsEfectivo()]);
  return (
    <Pagina ancho="completo">
      <ProspectosApp
        funnels={funnels.map((f) => ({ id: f.id, nombre: f.producto ?? f.nombre, esDefault: f.esDefault }))}
        esAdmin={rol === 'admin'}
      />
    </Pagina>
  );
}
