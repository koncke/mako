// =============================================================================
// Dos trampas chicas del editor de imágenes (18/11/2026, F46 de docs/pendientes-verificados-17-11.md)
// =============================================================================
//   (a) `ui/Menu`: no tenía `overModal` (abierto desde un diálogo quedaba detrás del velo) y no se daba vuelta: abierto desde
//       abajo, se encajaba en la ventana encima de su propio botón. Ahora `posicionMenu` (ui/menuPosicion.ts) lo pone arriba
//       cuando abajo no entra y arriba sí, como `Popover`.
//   (b) `workspace/PageSlot`: por debajo de 440 px el encabezado esconde el tamaño para hacerle lugar a los íconos; en sólo
//       lectura no hay íconos, así que el tamaño no tiene por qué irse (`data-readonly` en el encabezado).
// Correr: node --import tsx --test tests/image-editor-menu-y-pagina.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0):
//   · `posicionMenu` sin darse vuelta (sólo encaja)                       → 2/1 (1)
//   · la regla de sólo lectura con la MISMA especificidad que la que esconde → 2/1 (2)
//   · el encabezado sin `data-readonly`                                    → 2/1 (3)
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss, { type Rule } from 'postcss';
import { posicionMenu } from '../app/image-editor/_doory/editor/ui/menuPosicion';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const crudo = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

test('1. el menú se da vuelta hacia arriba cuando abajo no entra y arriba sí; si no, se encaja como antes', () => {
  const panel = { width: 240, height: 300 };
  const vh = 800;
  const vw = 1200;
  // Con lugar abajo: debajo del ancla, a 6 px.
  assert.deepEqual(posicionMenu({ panel, anchor: { left: 100, top: 100, bottom: 130 }, vw, vh }), { left: 100, top: 136 });
  // Abierto desde la barra de abajo: arriba del botón, a 6 px (antes quedaba encajado ENCIMA de él, en 492).
  assert.deepEqual(posicionMenu({ panel, anchor: { left: 100, top: 740, bottom: 772 }, vw, vh }), { left: 100, top: 434 });
  // Sin lugar ni abajo ni arriba: se encaja en la ventana, como siempre.
  assert.deepEqual(posicionMenu({ panel: { width: 240, height: 700 }, anchor: { left: 100, top: 300, bottom: 330 }, vw, vh }), { left: 100, top: 92 });
  // Sin ancla (un clic derecho): en el punto, encajado.
  assert.deepEqual(posicionMenu({ panel, at: { x: 1150, y: 780 }, vw, vh }), { left: 952, top: 492 });
  // Menu.tsx usa esta función, y el `overModal` existe en su CSS.
  const menu = crudo('app/image-editor/_doory/editor/ui/Menu.tsx');
  assert.match(menu, /setPos\(posicionMenu\(\{ panel: r, at, anchor, vw: window\.innerWidth, vh: window\.innerHeight \}\)\)/);
  assert.match(menu, /\$\{overModal \? styles\.overModal : ''\}/);
  assert.match(crudo('app/image-editor/_doory/editor/ui/Menu.module.css'), /\.overModal \{\s*z-index: calc\(var\(--cv-z-modal\) \+ 2\);/);
});

/** Especificidad (a, b, c) de un selector simple de este CSS: clases y atributos cuentan en b, etiquetas en c. */
function especificidad(sel: string): [number, number, number] {
  const ids = (sel.match(/#[\w-]+/g) ?? []).length;
  const clases = (sel.match(/\.[\w-]+/g) ?? []).length + (sel.match(/\[[^\]]+\]/g) ?? []).length + (sel.match(/:(?!:)[\w-]+/g) ?? []).length;
  const etiquetas = (sel.replace(/\[[^\]]+\]|\.[\w-]+|#[\w-]+|:[\w-]+/g, ' ').match(/[a-z][\w-]*/gi) ?? []).length;
  return [ids, clases, etiquetas];
}
const mayor = (x: [number, number, number], y: [number, number, number]) => x[0] !== y[0] ? x[0] > y[0] : x[1] !== y[1] ? x[1] > y[1] : x[2] > y[2];

test('2. en sólo lectura el tamaño de la página no se esconde: su regla le gana a la que lo esconde, por especificidad', () => {
  const css = postcss.parse(crudo('app/image-editor/_doory/editor/workspace/PageSlot.module.css'));
  const reglas: Array<{ sel: string; display: string; enContainer: boolean }> = [];
  css.walkRules((r: Rule) => {
    const d = r.nodes.find((n) => n.type === 'decl' && n.prop === 'display');
    if (!d || d.type !== 'decl' || !/\.meta\b/.test(r.selector)) return;
    reglas.push({ sel: r.selector, display: d.value, enContainer: r.parent?.type === 'atrule' && (r.parent as { name?: string }).name === 'container' });
  });
  const esconde = reglas.find((r) => r.enContainer && r.display === 'none');
  const muestra = reglas.find((r) => /\[data-readonly\]/.test(r.sel) && r.display !== 'none');
  assert.ok(esconde, `la regla que esconde el tamaño en una página angosta: ${JSON.stringify(reglas)}`);
  assert.ok(muestra, 'la regla de sólo lectura que lo vuelve a mostrar');
  assert.ok(mayor(especificidad(muestra.sel), especificidad(esconde.sel)), `${muestra.sel} tiene que ganarle a ${esconde.sel} sin depender del orden`);
  // Y nada más le gana a la de sólo lectura dentro del mismo `@container`.
  for (const r of reglas.filter((x) => x.enContainer && x.display === 'none')) assert.ok(mayor(especificidad(muestra.sel), especificidad(r.sel)), r.sel);
});

test('3. el encabezado de la página dice cuándo es de sólo lectura', () => {
  const slot = crudo('app/image-editor/_doory/editor/workspace/PageSlot.tsx');
  assert.match(slot, /<header className=\{styles\.header\}[^>]*data-readonly=\{readOnly \|\| undefined\}>/);
});
