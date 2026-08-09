// =============================================================================
// /admin/dev — la barra de Dev, con las 122 áreas adentro
// =============================================================================
// Hasta acá las áreas solo se alcanzaban por el sidebar, y ahí entran seis.
// Esta pantalla muestra LA BARRA con las 122: es a la vez la puerta a cada
// registro y la maqueta con la que se decide cómo va a quedar Dev en la barra
// de verdad, antes de tocar `nav.ts`.
//
// El ESTADO no sale del catálogo sino del plan: una pieza con tareas abiertas no
// está cerrada, por más que `areas.ts` diga `listo`. Ver `roadmap.ts`.
//
// Solo super-admin: es herramienta de construcción, no producto.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { Pagina, PageHeader } from '@/app/_ui';
import { AREAS } from './areas';
import { conteoPorArea, estadoEfectivo, wsDelBoard } from './roadmap';
import { MapaAreas, type AreaVista } from './MapaAreas';

export const dynamic = 'force-dynamic';

export default async function DevPage() {
  // El mismo guard que el resto de /admin: rol de AGENCIA, re-chequeado contra la
  // base en cada request.
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');

  // El workspace sale de la sesión ya validada, no de la resolución ambiente.
  const { porArea, total: enElPlan } = await conteoPorArea(wsDelBoard(admin.ws));
  const areas: AreaVista[] = AREAS.map((a) => {
    const suyas = porArea.get(a.slug) ?? 0;
    return {
      slug: a.slug, titulo: a.titulo, alcance: a.alcance,
      agente: !!a.agente, abiertas: suyas, estado: estadoEfectivo(a, suyas), nota: a.nota ?? '',
    };
  });

  return (
    <Pagina ancho="completo">
      <PageHeader
        titulo="Áreas del producto"
        proposito="La barra de Dev con las 122 áreas. Cada una lleva su Roadmap —que sale del plan— y su Change History, que sale de git."
      />
      <MapaAreas
        areas={areas}
        total={areas.length}
        abiertas={enElPlan}
      />
    </Pagina>
  );
}
