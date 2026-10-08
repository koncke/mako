'use client';

// =============================================================================
// La TAB compartida de Conocimientos, cargada APARTE (`next/dynamic`)
// =============================================================================
// No agrega nada a `PortalCompartido`: lo carga en su propio chunk, y eso no es organización — es
// lo que hace verdad que «en el link de UN curso, lo que el super admin ocultó no viaja».
//
// ⚠️ EL PORQUÉ, MEDIDO. `PortalCompartido` importa el CATÁLOGO ENTERO (app/conocimientos/catalogo.ts:
// los 132 cursos con todas sus clases), y Turbopack arma UN solo juego de chunks para todos los
// componentes cliente de una página: en el build del 08/10/2026, `CursoCompartido`, `Galeria`,
// `AnalisisCompartido` y `PortalCompartido` colgaban de los MISMOS 8 chunks, uno de 3,9 MB con el
// catálogo adentro (`.next/server/app/compartido/[token]/page_client-reference-manifest.js`). O sea
// que quien abría el link de UN curso —o la galería de marca de un cliente— bajaba los 132 cursos,
// incluidos los módulos y las clases que el super admin ocultó y la sección propia de la casa, que
// no se comparte. El curso suelto se ajustaba en el server (lib/conocimiento-ajustes.ts) y el
// catálogo crudo viajaba igual al lado: filtrar al PINTAR no sirve si el dato ya viajó (AGENTS.md,
// «'use client' es una frontera de DATOS»).
//
// Con `next/dynamic` ADENTRO de un componente cliente el chunk se separa y se baja sólo cuando se
// dibuja la tab (los docs de Next 16: desde un server component no hay división automática; por
// eso existe este archivo y la página no llama a `dynamic` directo). Sigue pintándose en el server
// (`ssr` por default), así que el link de la tab no se ve vacío mientras baja.
//
// ⚠️ NO ES EL GUARD: qué se oculta lo decide el server y el link de un curso ya llega ajustado. Esto
// es la capa de abajo, no entregar lo que no hace falta. El molde es app/integraciones/GithubRepoPicker.tsx.
// Lo fija tests/conocimiento-ajustes.test.ts («nada del catálogo en el grafo de la página»).

import dynamic from 'next/dynamic';
import type { FilaAjuste } from '@/lib/conocimiento-ajustes';

const PortalCompartido = dynamic(() => import('./PortalCompartido'));

export default function PortalCompartidoPerezoso(props: { invitado: string | null; ajustes: FilaAjuste[] }) {
  return <PortalCompartido {...props} />;
}
