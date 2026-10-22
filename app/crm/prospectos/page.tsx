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
import { nombreVisible } from '@/lib/lead-funnel-reglas';
import { ProspectosApp } from './ProspectosApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProspectosPage({ searchParams }: { searchParams: Promise<{ funnel?: string }> }) {
  await requireRolWs(['closer', 'setter'], { nav: 'crm' });
  const [funnels, rol, sp] = await Promise.all([listarFunnels(), getRolWsEfectivo(), searchParams]);
  // «Volver» vuelve al CRM del que se vino (C6, 22/10/2026): desde «Sprint 3 días», volver al principal era «me mandó a
  // otro lado». Sólo un funnel de ESTE negocio: un id ajeno o roto vuelve al CRM de siempre.
  const desde = funnels.find((f) => String(f.id) === sp.funnel && !f.esDefault);
  const volver = desde ? { href: `/crm?funnel=${desde.id}`, nombre: nombreVisible(desde) } : null;
  return (
    <Pagina ancho="completo">
      <ProspectosApp
        funnels={funnels.map((f) => ({ id: f.id, nombre: nombreVisible(f), esDefault: f.esDefault }))}
        esAdmin={rol === 'admin'}
        volver={volver}
      />
    </Pagina>
  );
}
