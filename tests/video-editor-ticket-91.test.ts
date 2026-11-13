// =============================================================================
// Ticket #91: «La pantalla Video se rompió» — React #310 en el Router de Next (12/11/2026)
// =============================================================================
// MaKo lo detectó solo (errores_app, huella 84301bc4ac03cb14): en `/video-editor/:token`, ws 9, 17:36 y 17:37 UTC, con el
// deploy de las 11:05, «Minified React error #310» (más hooks que en el render anterior). La traza NO pasa por el editor: es
// el `Router` de Next (`app-router`, su `useMemo` sobre la URL), y las dos veces seguidas son la recarga automática del
// centinela volviendo a la MISMA URL. Lo que hace eso al cargar es una navegación SOLA: `/video-editor/nuevo`, un id que
// no está en este navegador, `?plantilla=` o `?desde=` crean el proyecto y cambiaban la URL con `router.replace`. Es el bug
// de vercel/next.js#63121 (una navegación que se resuelve por promesa deja al Router con otra cuenta de hooks), arreglado en
// React (react#36911) y en Next después de la 16.2 que usa MaKo.
//
// El arreglo: esas tres abren el proyecto ya guardado con una carga entera (app/video-editor/ruta.ts → abrirProyectoCreado).
// El bug de Next no corre en node: se fija el fuente. Con el código de antes, T1 cae en los tres archivos.
//
// Correr: node --import tsx --test tests/video-editor-ticket-91.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Lo que crea el proyecto al cargar la página y después cambia la URL, sin que la persona toque nada. */
const SOLOS = [
  'app/video-editor/_opencut/components/providers/editor-provider.tsx',
  'app/video-editor/plantilla/ArmarPlantilla.tsx',
  'app/video-editor/desde/ImportarDesde.tsx',
];

test('T1: lo que navega SOLO al cargar el editor no usa router.replace (el Router de Next se rompía con #310)', () => {
  for (const archivo of SOLOS) {
    const src = sinComentarios(leer(archivo));
    assert.doesNotMatch(src, /router\.replace\(/, `${archivo}: router.replace al cargar rompe el Router de Next (ticket #91)`);
    assert.match(src, /abrirProyectoCreado\((newProjectId|proyecto|id)\)/, `${archivo}: abre el proyecto con una carga entera`);
  }
});

test('T2: abrirProyectoCreado carga la página entera, con el ?ws= de la pestaña, y reemplaza (no apila) la entrada', () => {
  const ruta = sinComentarios(leer('app/video-editor/ruta.ts'));
  const f = ruta.slice(ruta.indexOf('export function abrirProyectoCreado'));
  assert.match(f, /window\.location\.replace\(rutaEditor\(`\/video-editor\/\$\{id\}`\)\);/);
});

test('T3: el proyecto está guardado ANTES de la carga nueva (si no, la página nueva no lo encuentra)', () => {
  const plantilla = sinComentarios(leer('app/video-editor/plantilla/ArmarPlantilla.tsx'));
  assert.ok(plantilla.indexOf('saveCurrentProject()') > 0 && plantilla.indexOf('saveCurrentProject()') < plantilla.indexOf('abrirProyectoCreado(proyecto)'));
  const desde = sinComentarios(leer('app/video-editor/desde/ImportarDesde.tsx'));
  assert.ok(desde.indexOf('saveCurrentProject()') > 0 && desde.indexOf('saveCurrentProject()') < desde.indexOf('abrirProyectoCreado(id)'));
  // createNewProject guarda el proyecto en el almacenamiento local antes de devolver el id.
  const manager = sinComentarios(leer('app/video-editor/_opencut/core/managers/project-manager.ts'));
  const crear = manager.slice(manager.indexOf('async createNewProject'), manager.indexOf('async createNewProject') + 3000);
  assert.match(crear, /await storageService\.saveProject\(\{ project: newProject \}\);/);
  const proveedor = sinComentarios(leer('app/video-editor/_opencut/components/providers/editor-provider.tsx'));
  assert.ok(proveedor.indexOf('createNewProject(') < proveedor.indexOf('abrirProyectoCreado(newProjectId)'));
});
