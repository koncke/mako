'use client';

// =============================================================================
// Los paneles que MaKo le suma al editor de Doory
// =============================================================================
// Doory se extiende sin tocar su núcleo: `registerPanel` de `_doory/editor/extensions`
// (docs/diseno-editor-imagen.md §2). Acá vive «Proyectos», la pestaña 7 del riel de
// Canva (entre «Herramientas» y «Apps»): los diseños de ESTE workspace con su
// miniatura; un clic abre ese diseño. Y el chat «MaKo IA» (mako/chat/PanelMakoIA.tsx): no es una pestaña, lo
// abre el botón redondo del pie del riel (`PANEL_IA`).
//
// Se registra al importar este módulo (lo importa la pantalla del editor). La lista
// sale de la base (/api/image-editor/disenos) con el workspace de la pestaña: el
// `ws` que pasa la pantalla ya no decide nada y queda por si un panel lo necesita.

import { createElement } from 'react';
import { FolderOpen, Sparkles } from 'lucide-react';
import { PANEL_IA, registerPanel, strings } from '../_doory/editor/extensions';
import { ProyectosPanel } from './ProyectosPanel';
import { PanelMakoIA } from './chat/PanelMakoIA';

/** Entre «Herramientas» (60) y «Apps» (80) de builtins/panels.tsx, como en Canva. */
const ORDEN_PROYECTOS = 70;

/**
 * Registra (o vuelve a registrar: el id pisa al anterior) la pestaña «Proyectos».
 * `ws` = el workspace del server; `undefined` = averiguarlo por el diseño abierto.
 */
export function registrarProyectos(ws?: number | null): void {
  registerPanel({
    id: 'projects',
    label: strings.rail.projects,
    icon: createElement(FolderOpen, { size: 18, 'aria-hidden': true }),
    order: ORDEN_PROYECTOS,
    rail: true,
    placement: 'sidebar',
    component: (props) => createElement(ProyectosPanel, { ...props, ws }),
    requires: ({ state }) => !state.readOnly,
  });
}

registrarProyectos();

/** El orden sólo cuenta en la lista de herramientas («Apps» y los comandos): va después de las de Doory. */
const ORDEN_IA = 200;

registerPanel({
  id: PANEL_IA,
  label: strings.rail.ai,
  icon: createElement(Sparkles, { size: 18, 'aria-hidden': true }),
  order: ORDEN_IA,
  placement: 'sidebar',
  component: PanelMakoIA,
  // Proponer cambios es editar: con un enlace para ver o comentar, no hay chat.
  requires: ({ state }) => !state.readOnly,
});
