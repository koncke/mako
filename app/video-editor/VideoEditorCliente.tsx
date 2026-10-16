'use client';

// =============================================================================
// El Video Editor del lado del navegador
// =============================================================================
// Monta el motor portado de OpenCut sin SSR: usa `window`, IndexedDB, OPFS,
// WebGPU y un .wasm, y nada de eso existe en el server. El `dynamic(..., { ssr:
// false })` tiene que vivir en un client component (Next lo prohíbe en uno de
// server), por eso este archivo existe.
//
// Dos vistas, las dos adentro de MaKo, con su barra lateral:
// · el INICIO (la lista de proyectos);
// · el EDITOR, que llena el alto que queda bajo la barra de secciones. Iba a
//   pantalla completa como CapCut (`fixed` y sin chrome, diseño §9); Martín pidió
//   lo contrario el 12/10 («que la barra lateral no desaparezca del todo mientras
//   se edita»). La pantalla completa sigue, a pedido, desde el reproductor.
//
// La raíz lleva la clase `.ce`: ahí viven los tokens del tema de CapCut
// (capcut-theme.css). Y adentro, `#ce-portal`, donde se montan los menús y
// diálogos de radix para que hereden esos tokens (ver portal.ts).

import dynamic from 'next/dynamic';
import { TooltipProvider } from './_opencut/components/ui/tooltip';
import { Toaster } from './_opencut/components/ui/sonner';
import { TemaOscuro } from '@/app/_components/TemaOscuro';
import { ID_PORTAL_CE } from './portal';
import { fijarEspacio } from './espacio';
import { useRef } from 'react';
import type { DesdeEditor } from './desde/desde';
import type { SenalesNegocio } from '@/lib/plantillas-sugeridas';
import { SenalesNegocioProvider } from './sugeridas';

const EditorPage = dynamic(() => import('./_opencut/editor-page').then((m) => m.EditorPage), { ssr: false });
const ProjectsPage = dynamic(() => import('./_opencut/inicio/projects-page').then((m) => m.ProjectsPage), { ssr: false });
// «Editar en el editor» de Video Generator (`?desde=`): baja el anuncio, arma el
// proyecto y recién ahí reemplaza la URL por la del proyecto (desde/ImportarDesde.tsx).
const ImportarDesde = dynamic(() => import('./desde/ImportarDesde').then((m) => m.ImportarDesde), { ssr: false });
// «Utilizar plantilla» con la línea de tiempo ocupada (`?plantilla=`): proyecto nuevo,
// la plantilla armada, y recién ahí la URL del proyecto (plantilla/ArmarPlantilla.tsx).
const ArmarPlantilla = dynamic(() => import('./plantilla/ArmarPlantilla').then((m) => m.ArmarPlantilla), { ssr: false });

export function VideoEditorCliente({ vista, proyectoId, ws, desde, plantilla, senales = null }: {
  vista: 'inicio' | 'editor';
  proyectoId?: string;
  ws: number | null;
  desde?: DesdeEditor;
  /** El id de `?plantilla=` ya validado; `null` si vino uno que no existe. */
  plantilla?: string | null;
  /** Lo que se sabe del negocio: la pestaña Plantillas pone primero las sugeridas (./sugeridas.tsx). */
  senales?: SenalesNegocio | null;
}) {
  const editor = vista === 'editor' && !!proyectoId;
  // El espacio local se fija ANTES de que el motor abra una sola base: el render
  // de este componente corre antes que el import dinámico de abajo. Y si la
  // pestaña cambia de cliente sin recargar, el EditorCore (un singleton) se
  // reinicia: si no, seguiría con el proyecto del cliente anterior en memoria.
  const wsPrevio = useRef<number | null | undefined>(undefined);
  if (wsPrevio.current !== ws) {
    if (wsPrevio.current !== undefined) void import('./_opencut/core').then((m) => m.EditorCore.reset());
    fijarEspacio(ws);
    wsPrevio.current = ws;
  }
  return (
    <div
      key={ws ?? 0}
      className="ce"
      style={editor
        ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
        : { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}
    >
      <TemaOscuro />
      <TooltipProvider>
        <Toaster />
        <SenalesNegocioProvider senales={senales}>
          {editor ? (
            desde ? <ImportarDesde desde={desde} />
              : plantilla !== undefined ? <ArmarPlantilla id={plantilla} />
                : <EditorPage projectId={proyectoId} />
          ) : <ProjectsPage />}
        </SenalesNegocioProvider>
      </TooltipProvider>
      <div id={ID_PORTAL_CE} />
    </div>
  );
}
