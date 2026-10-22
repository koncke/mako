// =============================================================================
// «Kanban · Lista» juntos en un segmento, en todos los tableros (21/10/2026)
// =============================================================================
// Martín, 20/10: «Los botones de "Tablero y lista" solo con íconos debería estar».
// Martín, 21/10: «Los íconos de "tablero y lista" deberían estar como juntos en una sección, y el placeholder del
// "tablero" debe ser "kanban"... Esto en todos lados».
// UNA pieza (app/_ui/SelectorVista.tsx) en el CRM, Clientes (y /admin, que usa su barra) y el Plan. El nombre de
// la vista va en el tooltip de la casa y en el `aria-label`, y sale del catálogo app/_ui/iconos-vista.tsx.
//
// PROBADO ROMPIÉNDOLO (21/10/2026), con el archivo en 4 / 0, una rotura por vez y restaurada:
//   · el catálogo con «Ver en Kanban» otra vez                                  → 2 / 2 (el nombre y el aria-label)
//   · el segmento con el nombre al lado del ícono (`{ICONO_VISTA[v].titulo}`)     → 2 / 2 (lo dibujado y la fuente)
//   · el Plan con su `VistaToggle` de antes («Ver en tarjetas»)                    → 3 / 1
//   · el CRM con las píldoras `.tk-ptab` de antes                                 → 3 / 1
// Correr: node --import tsx --test tests/crm-vista-iconos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SelectorVista } from '../app/_ui/SelectorVista';
import { ICONO_VISTA } from '../app/_ui/iconos-vista';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('los nombres son cortos: «Kanban» y «Lista» (nunca «Tablero» ni «Ver en…»)', () => {
  assert.equal(ICONO_VISTA.kanban.titulo, 'Kanban');
  assert.equal(ICONO_VISTA.tabla.titulo, 'Lista');
  for (const v of Object.values(ICONO_VISTA)) assert.doesNotMatch(v.titulo, /^Ver |Tablero/, `«${v.titulo}»`);
});

test('el segmento: los íconos JUNTOS en una caja, sólo el ícono, el nombre en el aria-label', () => {
  const html = renderToStaticMarkup(createElement(SelectorVista<'kanban' | 'tabla'>, {
    vistas: ['kanban', 'tabla'], vista: 'kanban', onVista: () => {}, ariaLabel: 'Cómo ver los leads',
  }));
  // Una sola caja con los dos botones adentro (no dos píldoras sueltas).
  assert.match(html, /^<div role="tablist" aria-label="Cómo ver los leads"[^>]*style="[^"]*border:1px solid var\(--border\)/);
  assert.equal((html.match(/<button /g) ?? []).length, 2);
  assert.match(html, /aria-selected="true" aria-label="Kanban"/);
  assert.match(html, /aria-selected="false" aria-label="Lista"/);
  // Sin texto visible: lo que hay entre la apertura y el cierre de cada botón es el dibujo.
  for (const m of html.matchAll(/<button [^>]*>([\s\S]*?)<\/button>/g)) assert.match(m[1], /^<svg[\s\S]*<\/svg>$/, 'el botón lleva SÓLO el ícono');
  // Con una sola vista no se dibuja (un segmento de un botón se lee trabado).
  assert.equal(renderToStaticMarkup(createElement(SelectorVista<'kanban'>, { vistas: ['kanban'], vista: 'kanban', onVista: () => {}, ariaLabel: 'x' })), '');
});

test('la MISMA pieza en el CRM, Clientes y el Plan (ninguno con un toggle propio)', () => {
  const crm = sinComentarios(leer('app/crm/CrmToolbar.tsx'));
  assert.match(crm, /<SelectorVista vistas=\{VISTAS_CRM\} vista=\{vista\} onVista=\{onVista\}/);
  assert.doesNotMatch(crm, /tk-ptab|'Tablero'/, 'el CRM con sus píldoras de antes');

  const clientes = sinComentarios(leer('app/customer-success/BarraClientes.tsx'));
  assert.match(clientes, /<SelectorVista vistas=\{ORDEN_VISTAS\.filter\(\(v\) => vistas\.includes\(v\)\)\}/);
  assert.doesNotMatch(clientes, /bc-toggle/, 'Clientes con su toggle de antes');

  const plan = sinComentarios(leer('app/plan/board/BoardShell.tsx'));
  assert.match(plan, /<SelectorVista vistas=\{VISTAS_PLAN\} vista=\{tabla \? 'tabla' : 'kanban'\}/);
  assert.doesNotMatch(plan, /Ver en tarjetas|aria-label="Ver en tabla"/, 'el Plan con su toggle de antes');
});

test('el segmento no se copia: sólo app/_ui/SelectorVista.tsx dibuja los íconos de vista', () => {
  const pieza = sinComentarios(leer('app/_ui/SelectorVista.tsx'));
  assert.match(pieza, /<Tooltip key=\{v\} text=\{ICONO_VISTA\[v\]\.titulo\}/, 'el nombre va en el tooltip');
  assert.match(pieza, />\s*\{ICONO_VISTA\[v\]\.icono\}\s*<\/button>/, 'y el botón, sólo el ícono');
  for (const f of ['app/crm/CrmToolbar.tsx', 'app/customer-success/BarraClientes.tsx', 'app/plan/board/BoardShell.tsx']) {
    assert.doesNotMatch(sinComentarios(leer(f)), /ICONO_VISTA\[/, `${f} dibuja los íconos de vista por su cuenta`);
  }
});
