// =============================================================================
// /customer-success/programa — Program: qué se graba y qué se le pide al cliente
// =============================================================================
// Dos preguntas distintas y por eso dos sub-tabs, no una pantalla que las mezcla:
//
//   · CLASES  → «¿qué tengo que grabar?». La lee Mauricio antes de sentarse a
//     grabar. Es la lista de videos, y un video puede cubrir varias clases.
//   · TAREAS  → «¿qué le estamos pidiendo a cada cliente?». Las 118 preguntas de
//     los dos Cuestionarios Maestros, con sus tablas y sus tipos.
//
// La primera es Clases porque grabar es lo que está bloqueando el programa: el
// curso está cargado en Whop y OCULTO hasta que haya videos.

import { PROGRAMA, GRABACIONES, TOTAL_CLASES, TOTAL_GRABACIONES, CLASES_QUE_DESTRABAN } from '@/lib/programa-catalogo';
import { CAMPOS, TOTAL_CAMPOS } from '@/lib/programa-campos';
import { getMapaLecciones } from '@/lib/cs-avance';
import { whopConfigurado } from '@/lib/whop';
import { esWorkspaceDueno } from '@/lib/workspace';
import { ComingSoon } from '@/app/_components/ComingSoon';
import { ProgramaApp } from './ProgramaApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Program · Customer Success' };

export default async function ProgramaPage({ searchParams }: { searchParams: Promise<{ tab?: string; m?: string; c?: string }> }) {
  // Mismo guard que la cartera, y por el mismo motivo: acá se ve el temario
  // COMPLETO de Mauricio. Ver el comentario largo en ../page.tsx.
  if (!(await esWorkspaceDueno())) return <ComingSoon title="Customer Success" icon="cs" />;

  // La sub-tab se lee ACÁ y no con useSearchParams: ese hook hace que el
  // boundary se saltee el render del servidor y la primera pintura salga vacía.
  const [{ tab, m: moduloEnUrl, c: claseEnUrl }, mapa, whop] = await Promise.all([
    searchParams,
    getMapaLecciones().catch(() => ({})),
    whopConfigurado().catch(() => false),
  ]);

  // Qué clases están cargadas en Whop. Se manda el CONJUNTO de claseIds, no el
  // mapa entero: los ids de lección de Whop no le sirven a la pantalla y son
  // ruido en el payload que viaja al cliente.
  const enWhop = new Set(Object.values(mapa));

  return (
    <ProgramaApp
      tabInicial={tab}
      moduloEnUrl={moduloEnUrl}
      claseEnUrl={claseEnUrl}
      modulos={PROGRAMA.map(m => ({
        id: m.id, numero: m.numero, titulo: m.titulo, fase: m.fase,
        quien: m.quien, porArea: Boolean(m.porArea),
        clases: m.clases.map((c, i) => ({
          id: c.id,
          rotulo: `${m.numero}.${i + 1}`,
          titulo: c.titulo,
          pregunta: c.pregunta,
          graba: c.graba,
          atoro: c.atoro ?? null,
          campos: CAMPOS[c.id] ?? [],
          enWhop: enWhop.has(c.id),
          destraba: (CLASES_QUE_DESTRABAN as readonly string[]).includes(c.id),
        })),
        // El reparto en videos se DERIVA del catálogo (ver GRABACIONES). Acá
        // viaja solo la agrupación por ids: las clases ya van completas arriba.
        videos: GRABACIONES.filter(g => g.modulo.id === m.id).map(g => g.clases.map(c => c.id)),
      }))}
      totales={{
        clases: TOTAL_CLASES, campos: TOTAL_CAMPOS,
        enWhop: enWhop.size, videos: TOTAL_GRABACIONES,
      }}
      whopConectado={whop}
    />
  );
}
