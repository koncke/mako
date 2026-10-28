'use client';

// =============================================================================
// El Video Editor del lado del navegador
// =============================================================================
// Monta el motor portado de OpenCut sin SSR: usa `window`, IndexedDB, OPFS,
// WebGPU y un .wasm, y nada de eso existe en el server. El `dynamic(..., { ssr:
// false })` tiene que vivir en un client component (Next lo prohíbe en uno de
// server), por eso este archivo existe.
//
// Adentro de MaKo, con su barra lateral (Martín, 12/10: «que la barra lateral no
// desaparezca del todo mientras se edita»), y desde el 27/10/2026 con el chat de
// MaKo FIJO a la izquierda y los proyectos en la misma tarjeta, como el Web
// Generator (Martín: «que este al costado, que los "proyectos" se vean en la barra
// del costado, y que no cambie de ruta»): todo eso es el marco
// (_opencut/marco.tsx). Las dos rutas montan lo mismo: `/video-editor/<id>` abre
// ese proyecto y `/video-editor` abre el último que se tocó (o «Crear proyecto»).
// Cambiar de proyecto NO navega: el marco lo cambia en el lugar y acompaña la URL.
//
// La raíz lleva la clase `.ce`: ahí viven los tokens del editor (capcut-theme.css),
// que desde el 27/10 salen de los de MaKo y siguen su claro u oscuro (ya no se
// fuerza el oscuro de CapCut con `<TemaOscuro />`). Y adentro, `#ce-portal`, donde
// se montan los menús y diálogos de radix para que hereden esos tokens (portal.ts).

import dynamic from 'next/dynamic';
import { TooltipProvider } from './_opencut/components/ui/tooltip';
import { Toaster } from './_opencut/components/ui/sonner';
import { ID_PORTAL_CE } from './portal';
import { fijarEspacio } from './espacio';
import { useRef } from 'react';
import type { DesdeEditor } from './desde/desde';
import type { SenalesNegocio } from '@/lib/plantillas-sugeridas';
import { SenalesNegocioProvider } from './sugeridas';

const MarcoEditor = dynamic(() => import('./_opencut/marco').then((m) => m.MarcoEditor), { ssr: false });
// «Editar en el editor» de Video Generator (`?desde=`): baja el anuncio, arma el
// proyecto y recién ahí reemplaza la URL por la del proyecto (desde/ImportarDesde.tsx).
const ImportarDesde = dynamic(() => import('./desde/ImportarDesde').then((m) => m.ImportarDesde), { ssr: false });
// «Utilizar plantilla» con la línea de tiempo ocupada (`?plantilla=`): proyecto nuevo,
// la plantilla armada, y recién ahí la URL del proyecto (plantilla/ArmarPlantilla.tsx).
const ArmarPlantilla = dynamic(() => import('./plantilla/ArmarPlantilla').then((m) => m.ArmarPlantilla), { ssr: false });

export function VideoEditorCliente({ vista, proyectoId, ws, desde, plantilla, propuesta = null, senales = null }: {
  vista: 'inicio' | 'editor';
  proyectoId?: string;
  ws: number | null;
  desde?: DesdeEditor;
  /** El id de `?plantilla=` ya validado; `null` si vino uno que no existe. */
  plantilla?: string | null;
  /** El `?propuesta=` del link (un uuid ya validado): el chat abre en ÉSA (chat/propuestas.ts). */
  propuesta?: string | null;
  /** Lo que se sabe del negocio: la pestaña Plantillas pone primero las sugeridas (./sugeridas.tsx). */
  senales?: SenalesNegocio | null;
}) {
  // El proyecto de la ruta; `null` es `/video-editor`, y el marco abre el último que se tocó.
  const proyectoDeRuta = vista === 'editor' && proyectoId ? proyectoId : null;
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
      // `.ce` (los tokens del motor) + `.ce-mako`: con los colores de MaKo (capcut-theme.css, al final).
      className="ce ce-mako"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <TooltipProvider>
        <Toaster />
        <SenalesNegocioProvider senales={senales}>
          {proyectoDeRuta && desde ? <ImportarDesde desde={desde} />
            : proyectoDeRuta && plantilla !== undefined ? <ArmarPlantilla id={plantilla} />
              : <MarcoEditor proyectoId={proyectoDeRuta} propuesta={propuesta} />}
        </SenalesNegocioProvider>
      </TooltipProvider>
      <div id={ID_PORTAL_CE} />
    </div>
  );
}
