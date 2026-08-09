// =============================================================================
// /admin/dev — el índice de las 121 áreas del producto
// =============================================================================
// Hasta acá las áreas solo se alcanzaban por el sidebar, y ahí entraban seis. Con
// 121 hace falta una puerta: esta pantalla es el mapa del producto entero, con el
// estado real de cada pedazo y cuánto trabajo abierto arrastra.
//
// El ESTADO no sale del catálogo sino del plan: una pieza con tareas abiertas no
// está cerrada, por más que `areas.ts` diga `listo`. Ver `roadmap.ts`.
//
// Solo super-admin: es herramienta de construcción, no producto.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { Pagina, PageHeader } from '@/app/_ui';
import { AREAS, FAMILIAS, porGrupo } from './areas';
import { conteoPorArea, estadoEfectivo } from './roadmap';
import { MapaAreas, type AreaVista } from './MapaAreas';

export const dynamic = 'force-dynamic';

const PROPOSITO: Record<string, string> = {
  Operate: 'El día a día del cliente',
  Analyze: 'Mirar y entender',
  'Sales Machine': 'Convertir',
  'Content Machine': 'Producir',
  MaKo: 'La IA, de punta a punta',
  Business: 'El negocio de MaKo',
  Platform: 'Administrar la plataforma',
  Infra: 'Lo que sostiene la app',
};

export default async function DevPage() {
  // El mismo guard que el resto de /admin: rol de AGENCIA, re-chequeado contra la
  // base en cada request.
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');

  const conteo = await conteoPorArea();
  const familias = FAMILIAS.map((familia) => ({
    familia,
    proposito: PROPOSITO[familia] ?? '',
    grupos: porGrupo(familia).map((g) => ({
      grupo: g.grupo,
      areas: g.areas.map((a): AreaVista => ({
        slug: a.slug,
        titulo: a.titulo,
        alcance: a.alcance,
        agente: !!a.agente,
        abiertas: conteo.get(a.slug) ?? 0,
        estado: estadoEfectivo(a, conteo.get(a.slug) ?? 0),
        nota: a.nota ?? '',
      })),
    })),
  }));

  const total = AREAS.length;
  const abiertas = [...conteo.values()].reduce((n, x) => n + x, 0);

  return (
    <Pagina ancho="completo">
      <PageHeader
        titulo="Áreas del producto"
        proposito={`${total} áreas con su Roadmap y su Change History. El Roadmap sale del plan y el historial de git: ninguno se escribe a mano.`}
      />
      <MapaAreas familias={familias} total={total} abiertas={abiertas} />
    </Pagina>
  );
}
