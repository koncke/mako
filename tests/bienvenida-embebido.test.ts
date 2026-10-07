// =============================================================================
// EMBEBIDO, LA BIENVENIDA «MaKo CARGÓ N TAREAS» NO EXISTE: ni el botón ✨ ni el modal
// =============================================================================
// El 27/09/2026 se apagó el AUTO-open de `TareasCreadasModal` cuando el tablero vive adentro
// de una ficha (`embebido`), y quedó anotado como sin hacer que el botón ✨ del header la
// seguía abriendo a mano (docs/hallazgos-customer-success.md, «Lo que `embebido` apaga»).
//
// Dónde se veía: la ficha de clientes comunes pasa `soloVista` + `accionEnLugarDelMenu`, así
// que su barra de acciones no se dibuja; pero la ficha del SUPER ADMIN (`TableroDelCliente`
// en app/admin/AdminView.tsx) monta el tablero `embebido` SIN `soloVista`, y ahí la barra —con
// el ✨— sí está. Un clic abría la bienvenida por portal encima de la ficha, fuera de la pila
// de modales: el Escape y el cierre de la ficha no la ven.
//
// Lo que se fija: UNA condición calculada (`bienvenidaPosible = hayWelcome && !embebido`) y
// las DOS puntas que la miran — la entrada `welcome` de la barra y el render del modal. Con el
// render atado a la misma condición, un camino nuevo que haga `setWelcomeVisible(true)` igual
// no puede pintarla embebido.
//
// ⚠️ PROBADO ROMPIÉNDOLO, una rotura por vez, sobre app/plan/board/BoardShell.tsx (06/10/2026,
// arnés en el scratchpad que restaura de memoria). Base: 3 pasan, 0 fallan.
//   1. `bienvenidaPosible = hayWelcome` (sin `&& !embebido`)        → 2 / 1  «la condición es…»
//   2. la entrada de la barra vuelve a `...(hayWelcome ? [{ key: 'welcome'` → 2 / 1  «el ✨ de la barra…»
//   3. el render sin `bienvenidaPosible &&`                           → 2 / 1  «el modal se pinta…»
// Restaurado: 3 / 0.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const SRC = sinComentarios(
  readFileSync(resolve(import.meta.dirname, '..', 'app/plan/board/BoardShell.tsx'), 'utf8').replace(/\r\n/g, '\n'),
);

test('la condición es UNA y se calcula con `embebido` adentro', () => {
  assert.match(SRC, /const\s+bienvenidaPosible\s*=\s*hayWelcome\s*&&\s*!embebido\s*;/,
    'la bienvenida tiene que apagarse embebida en la condición que miran la barra y el render');
});

test('el ✨ de la barra se dibuja sólo si la bienvenida es posible', () => {
  const entradas = [...SRC.matchAll(/\.\.\.\(\s*([^?]+?)\s*\?\s*\[\{\s*key:\s*'welcome'/g)].map((m) => m[1].trim());
  assert.ok(entradas.length >= 1, 'no encontré la entrada `welcome` de la barra: ¿se movió?');
  for (const cond of entradas) {
    assert.equal(cond, 'bienvenidaPosible', `la entrada \`welcome\` cuelga de «${cond}», que no mira \`embebido\``);
  }
});

test('el modal se pinta sólo si la bienvenida es posible', () => {
  const renders = SRC.split('\n').filter((l) => l.includes('<TareasCreadasModal'));
  assert.ok(renders.length >= 1, 'no encontré el render de TareasCreadasModal: ¿se movió?');
  for (const l of renders) {
    assert.match(l, /\bbienvenidaPosible\s*&&/,
      'TareasCreadasModal se monta sin mirar `bienvenidaPosible`: embebido se abriría encima de la ficha');
  }
});
