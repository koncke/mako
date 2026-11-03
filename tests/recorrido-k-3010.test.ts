// =============================================================================
// El recorrido visual de producción (30/10/2026): el botón de MaKo que tapaba, y tres del Calendario
// =============================================================================
// Lo encontró el recorrido en el Chrome de Martín (K2, P1, C3, D4, K3, K5). Lo que fija este archivo:
//   1. K2 (y P1, C3, D4): el botón de la estrella se monta en la RANURA del pie de la barra de la app; flota sólo sin barra o
//      encima de un modal de la tab. Medido en el navegador a 1536, 1280 y 1024: adentro de la barra y el rincón libre.
//   2. K3: el título y la hora de un evento cortan con «…», también en los de una sola línea.
//   3. K5: el subtítulo de «Tareas con fecha» dice la ventana que se lee de verdad.
//
// PROBADO ROMPIÉNDOLO (30/10/2026), cada rotura sola contra este archivo:
//   · MakoEnLaTab sin el portal (vuelve a flotar siempre)        → 1 fallo (1)
//   · el portal también encima de un modal (CR4)                 → 1 fallo (1)
//   · `.gc-ev--uno b{display:inline}` sin el corte de la línea   → 1 fallo (2)
//   · la ventana de las tareas pasa a 21 días sin cambiar el texto → 1 fallo (3)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const crudo = (rel: string) => readFileSync(resolve(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const leer = (rel: string) => crudo(rel).replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. el botón de MaKo flota otra vez: la ranura de la barra se fue (Martín, 1/11/2026)', () => {
  assert.doesNotMatch(leer('app/_components/Sidebar.tsx'), /data-ranura-mako/);
  const mako = leer('app/_chat/MakoEnLaTab.tsx');
  assert.doesNotMatch(mako, /createPortal|enBarra/);
  assert.match(mako, /className="ch-tab-mako" style=\{\{ left: bordeVisible \+ 16,/);
  assert.match(mako, /const leftGlobo = bordeVisible \+ 16;/, 'el globo queda suelto en el medio de la tab');
  assert.doesNotMatch(crudo('app/_chat/chat.css'), /ch-tab-mako--en-barra/);
});

test('2. un evento de la grilla corta su título y su hora con «…»', () => {
  const css = crudo('app/calendario/gc-css.ts');
  assert.match(css, /\.gc-ev i\{[^}]*text-overflow:ellipsis/, 'la hora se cortaba sin «…»');
  assert.match(css, /\.gc-ev--uno\{white-space:nowrap;text-overflow:ellipsis\}/, 'un evento de una línea se cortaba sin «…»');
});

test('3. «Tareas con fecha» dice la ventana que lee la página', () => {
  const pagina = leer('app/calendario/page.tsx');
  const m = /leerTareasConFecha\(sumarDias\(hoy, -(\d+)\), sumarDias\(hoy, (\d+)\), tz\)/.exec(pagina);
  assert.ok(m, 'cambió cómo se leen las tareas: revisá el subtítulo');
  assert.deepEqual([m[1], m[2]], ['14', '31'], 'cambió la ventana: el subtítulo dice «dos semanas» y «el próximo mes»');
  assert.match(leer('app/calendario/ListaLlamadas.tsx'), /<p className="gl-sub">Del Plan: las vencidas en las últimas dos semanas y las del próximo mes\.<\/p>/);
});
