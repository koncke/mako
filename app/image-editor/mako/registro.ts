'use client';

// =============================================================================
// Los paneles que MaKo le suma al editor de Doory
// =============================================================================
// Doory se extiende sin tocar su núcleo: `registerPanel` de `_doory/editor/extensions`
// (docs/diseno-editor-imagen.md §2). Acá vive «Proyectos», la pestaña 7 del riel de
// Canva (entre «Herramientas» y «Apps»): los diseños de ESTE workspace con su
// miniatura; un clic abre ese diseño.
//
// Se registra al importar este módulo (lo importa la pantalla del editor). Quien
// conoce el workspace es el server (`getWorkspaceActual`, prop de la página): la
// pantalla llama `registrarProyectos(ws)` con ese número y el panel lee la base de
// ese workspace. Sin esa llamada, el panel busca solo en qué base del navegador está
// el diseño abierto (ProyectosPanel.tsx → `repoDelDiseno`). El `?ws=` de la URL NO
// alcanza: en tu propia cuenta no está y la base sería la del workspace 0.

import { createElement } from 'react';
import { FolderOpen } from 'lucide-react';
import { registerPanel, strings } from '../_doory/editor/extensions';
import { ProyectosPanel } from './ProyectosPanel';

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
