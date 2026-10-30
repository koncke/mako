// =============================================================================
// La barra de herramientas de la línea de tiempo: ninguna queda fuera de la vista (Martín, 30/10/2026)
// =============================================================================
// «Revisa bien todo», después de la barra del reproductor. Esta iba en un ScrollArea con la barra de scroll OCULTA: lo
// que no entraba quedaba fuera de la vista, sin aviso. Medido en el banco (la barra real con las herramientas que
// registran los paquetes, el motor reemplazado por datos inventados, Chrome sin ventana), al ancho del centro del editor:
//   · antes: las herramientas ocupan 983 px. A 1366 con el chat abierto (950 px) «Acercar» queda afuera; a 1280 (864) el
//     deslizador y «Acercar»; a 1280 con la barra lateral fija (688), siete. Con el chat plegado o a 1440, entra.
//   · después: en los siete casos nada afuera. A 950 una fila sin el deslizador (38 px); a 864 y 688, dos filas (67 px).
// El umbral vive en _opencut/timeline/barra-ancho.ts; el corte en dos filas es CSS, así que una herramienta nueva tampoco
// puede volver a quedar afuera.
//
// Probado rompiéndolo (30/10/2026): ver el final del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ANCHO_CON_PRESCINDIBLES, conPrescindibles } from '../app/video-editor/_opencut/timeline/barra-ancho';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('lo prescindible entra desde 1000 px de barra (las herramientas miden 983)', () => {
  assert.equal(ANCHO_CON_PRESCINDIBLES, 1000);
  assert.equal(conPrescindibles(0), true, 'sin medir todavía: lo de siempre');
  assert.equal(conPrescindibles(1312), true);
  assert.equal(conPrescindibles(1000), true);
  assert.equal(conPrescindibles(999), false);
  assert.equal(conPrescindibles(950), false, '1366 con el chat abierto');
});

test('la barra se parte en vez de cortarse: sin ScrollArea, con flex-wrap y alto mínimo', () => {
  const src = sinComentarios(leer('app/video-editor/_opencut/timeline/components/timeline-toolbar.tsx'));
  // El ScrollArea de Radix mete el contenido en una tabla que crece con lo que tiene: nunca dejaba partir la fila.
  assert.doesNotMatch(src, /<ScrollArea\b/, 'volvió el ScrollArea: lo que no entra queda fuera de la vista');
  assert.match(src, /className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b/);
  assert.match(src, /style=\{\{ minHeight: TIMELINE_TOOLBAR_HEIGHT_PX \}\}/);
  assert.doesNotMatch(src, /style=\{\{ height: TIMELINE_TOOLBAR_HEIGHT_PX \}\}/, 'con alto fijo, la segunda fila se sale por abajo');
  // La derecha, partida, queda a la derecha; cada lado también se parte, y el separador va con su bloque.
  assert.match(src, /<Lado filas=\{derecha\} ctx=\{ctx\} estados=\{estadoPorId\} className="ml-auto" \/>/);
  assert.match(src, /<div className=\{cn\("flex flex-wrap items-center gap-1", className\)\}>/);
  assert.match(src, /<div key=\{i\} className="flex items-center gap-1">\s*\{i > 0 && <span className="mx-1\.5 h-4 w-px/);
  // Lo prescindible se esconde por el ancho medido de la barra.
  assert.match(src, /const prescindibles = conPrescindibles\(useAncho\(ref\)\);/);
  assert.match(src, /estadoPorId\.get\(h\.id\)\?\.visible && \(prescindibles \|\| !h\.prescindible\)/);
  assert.match(src, /<div\s+ref=\{ref\}\s+data-barra-linea=""/);
});

test('lo único prescindible es el deslizador del zoom: − y + hacen lo mismo', () => {
  const ce = sinComentarios(leer('app/video-editor/_opencut/timeline/components/herramientas-ce.tsx'));
  assert.match(ce, /id: "linea-zoom",[\s\S]*?Control: ControlDeslizadorZoom,\s*prescindible: true,/);
  assert.match(ce, /id: "linea-alejar"/);
  assert.match(ce, /id: "linea-acercar"/);
  let total = 0;
  for (const archivo of [
    'app/video-editor/_opencut/timeline/components/herramientas-ce.tsx',
    'app/video-editor/_opencut/commands/timeline/element/operaciones-clip.tsx',
    'app/video-editor/_opencut/audio/registro.ts',
    'app/video-editor/_opencut/fondo/registro.tsx',
    'app/video-editor/_opencut/subtitles/registro.ts',
    'app/video-editor/_opencut/transcripcion/registro.ts',
  ]) total += (sinComentarios(leer(archivo)).match(/prescindible: true/g) ?? []).length;
  assert.equal(total, 1, 'una herramienta prescindible nueva se esconde sin aviso: decidirlo a propósito');
  assert.match(leer('app/video-editor/ce/ranuras.ts'), /prescindible\?: boolean;/);
});

// Roturas (30/10/2026, base 3/0): corriendo por con-turno; los resultados van en el commit siguiente.
