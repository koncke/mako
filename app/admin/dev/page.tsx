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

// El propósito y el ícono de cada familia. Los cuatro primeros son los MISMOS que
// usa `nav.ts` para su familia homónima: si acá dijeran otra cosa, esta pantalla
// enseñaría una barra que no existe.
const FAM_UI: Record<string, { proposito: string; icono: string }> = {
  Operate: { proposito: 'El día a día del cliente', icono: 'rayo' },
  Analyze: { proposito: 'Mirar y entender', icono: 'analytics' },
  'Sales Machine': { proposito: 'Convertir', icono: 'sales' },
  'Content Machine': { proposito: 'Producir', icono: 'creativos' },
  MaKo: { proposito: 'La IA, de punta a punta', icono: 'mako' },
  // Las tres que NO existen en `nav.ts` y hay que elegirles ícono. `tag` es el
  // precio, `admin` el shell de la agencia y `tools` la caja de herramientas.
  Business: { proposito: 'El negocio de MaKo', icono: 'tag' },
  Platform: { proposito: 'Administrar la plataforma', icono: 'admin' },
  Infra: { proposito: 'Lo que sostiene la app', icono: 'tools' },
};

export default async function DevPage() {
  // El mismo guard que el resto de /admin: rol de AGENCIA, re-chequeado contra la
  // base en cada request.
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');

  const conteo = await conteoPorArea();
  const familias = FAMILIAS.map((familia) => ({
    familia,
    proposito: FAM_UI[familia]?.proposito ?? '',
    icono: FAM_UI[familia]?.icono ?? 'config',
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
