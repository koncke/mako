// =============================================================================
// Las iniciales del Web Generator, sin medio emoji (27/10/2026, lo que quedaba del ticket #10)
// =============================================================================
// El panel de comentarios del editor (app/web-generator/editor/paneles/PanelComentarios.tsx) sacaba la inicial del
// autor con `nombre.trim()[0]`: la primera UNIDAD UTF-16. Con un nombre que empieza con un emoji es la mitad del emoji, y
// el server y el navegador no la dibujan igual: React #418 (la hidratación no coincide). La pieza es `iniciales` de
// lib/unicode-seguro.ts. La guarda de tests/iniciales-con-emoji.test.ts no conocía esta forma (`.trim()[0]`); queda en
// otras áreas (Automations, Calendario, Classroom, Mobile), así que acá se fija SÓLO el Web Generator.
// Correr: node --import tsx --test tests/web-generator-iniciales.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = join(__dirname, '..');
function archivos(dir: string, fuera: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) archivos(p, fuera);
    else if (/\.tsx?$/.test(n)) fuera.push(p);
  }
  return fuera;
}

test('ninguna pantalla del Web Generator saca una inicial con el primer «carácter» de un nombre', () => {
  // El primer «carácter» a mano: `.trim()[0]`, `.trim().charAt(0)`, `.trim().slice(0, 1)`.
  const A_MANO = /\.trim\(\)(?:\[0\]|\.charAt\(0\)|\.slice\(0, ?1\))/;
  const malos = archivos(join(RAIZ, 'app', 'web-generator'))
    .filter((f) => A_MANO.test(readFileSync(f, 'utf8')))
    .map((f) => relative(RAIZ, f).split('\\').join('/'));
  assert.deepEqual(malos, [], 'usa `iniciales` de lib/unicode-seguro.ts: un nombre con emoji dibuja media letra y rompe la hidratación');
});

test('el panel de comentarios dibuja la inicial del autor con `iniciales`', () => {
  const src = readFileSync(join(RAIZ, 'app/web-generator/editor/paneles/PanelComentarios.tsx'), 'utf8');
  assert.match(src, /import \{ iniciales \} from '@\/lib\/unicode-seguro'/);
  assert.match(src, /\{iniciales\(c\.autor, 1\)\}/);
});
