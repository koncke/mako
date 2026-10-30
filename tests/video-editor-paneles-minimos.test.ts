// =============================================================================
// Los paneles de arriba del Video Editor no se achican hasta no leerse (Martín, 30/10/2026)
// =============================================================================
// «Revisa bien todo… con los paneles en su mínimo». Los mínimos eran 15 % / 18 % / 15 % del ancho del editor: ~130 px con
// el chat abierto a 1280, ~103 con la barra lateral fija. Medido en el banco (los paneles reales, el motor reemplazado):
//   · biblioteca: de 240 px para abajo «Importar» y la zona para arrastrar se aplastan, de 160 se cortan;
//   · propiedades (los detalles del proyecto): de 160 para abajo no se lee nada, y la columna de rótulos (45 % del panel,
//     cortada con «…») corta «Cuadros por segundo:» aun a 300 px.
// Ahora: mínimos en PÍXELES (components/editor/minimos-paneles.ts) pasados a % con el ancho medido del grupo, y el rótulo
// de los detalles se parte en dos renglones en vez de cortarse.
//
// Probado rompiéndolo (30/10/2026): ver el final del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MINIMOS_PX, minimosDePaneles } from '../app/video-editor/_opencut/components/editor/minimos-paneles';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const px = (pct: number, ancho: number) => Math.round((pct / 100) * ancho);

test('los mínimos son en píxeles: la biblioteca y propiedades 280, el reproductor 160', () => {
  assert.deepEqual(MINIMOS_PX, { tools: 280, preview: 160, properties: 280 });
  // 1366 con el chat abierto (950) y 1280 (864): entran los tres. A 950 el reproductor queda en su 18 % de siempre (171 px).
  const casos: Array<[number, number[]]> = [[950, [280, 171, 280]], [864, [280, 160, 280]]];
  for (const [ancho, esperado] of casos) {
    const m = minimosDePaneles(ancho);
    assert.deepEqual([px(m.tools, ancho), px(m.preview, ancho), px(m.properties, ancho)], esperado, `${ancho} px`);
  }
  // Un editor ancho no deja un panel más chico que los porcentajes de antes.
  const ancho = minimosDePaneles(3000);
  assert.deepEqual([ancho.tools, ancho.preview, ancho.properties], [15, 18, 15]);
  // Sin medir todavía: los de antes.
  assert.deepEqual(minimosDePaneles(0), { tools: 15, preview: 18, properties: 15 });
});

test('si no entran (688 px: 1280 con la barra lateral fija y el chat abierto), se achican parejo y dejan lugar para mover', () => {
  const m = minimosDePaneles(688);
  const suma = m.tools + m.preview + m.properties;
  assert.ok(Math.abs(suma - 96) < 1e-9, `suman ${suma}`);
  assert.ok(px(m.tools, 688) >= 250 && px(m.properties, 688) >= 250, 'la biblioteca y propiedades siguen legibles');
  assert.ok(m.tools <= 55 && m.properties <= 55, 'un mínimo no pasa el máximo del panel');
});

test('la pantalla mide el grupo y le pasa los mínimos a los tres paneles; el rótulo de los detalles se parte', () => {
  const page = sinComentarios(leer('app/video-editor/_opencut/editor-page.tsx'));
  assert.match(page, /const minimos = minimosDePaneles\(useAncho\(zona\)\);/);
  assert.match(page, /<div ref=\{zona\} className="size-full">\s*<ResizablePanelGroup\s+ref=\{grupoVertical\}/);
  assert.match(page, /defaultSize=\{panels\.tools\} minSize=\{minimos\.tools\}/);
  assert.match(page, /defaultSize=\{panels\.preview\} minSize=\{minimos\.preview\}/);
  assert.match(page, /defaultSize=\{panels\.properties\} minSize=\{minimos\.properties\}/);
  assert.doesNotMatch(page, /minSize=\{(15|18)\} (maxSize|className)/, 'volvió un mínimo en porcentaje fijo');
  const detalles = sinComentarios(leer('app/video-editor/_opencut/components/editor/panels/properties/detalles.tsx'));
  assert.match(detalles, /<span className="w-\[168px\] max-w-\[45%\] shrink-0 text-\[12\.5px\] leading-snug text-\(--cc-text-3\)">/);
});

// Roturas (30/10/2026, base 3/0), cada una sola y restaurada con su copia, por con-turno:
// · P1 la biblioteca con mínimo de 200 px → 1/2 (los píxeles y el que no entra).
// · P2 sin achicarse cuando no suman → 2/1 · P5 sin el piso de antes → 2/1 (los píxeles).
// · P3 la biblioteca vuelve a 15 % fijo → 2/1 · P4 el rótulo vuelve a cortarse → 2/1 (la pantalla).
