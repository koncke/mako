// =============================================================================
// La casilla de las tarjetas del PLAN se anima como la del CRM
// =============================================================================
// «Copiá la animación de aparición del checkbox para la selección de múltiples
// tarjetas que hizo el CRM. Es una animación que aparece detrás del título y que se
// desplaza el título cuando paso el cursor» (05/10/2026).
//
// Es la MISMA regla del CRM (`.mk-sel-tarjeta` en app/globals.css), no una copia. Lo
// que se fija acá es lo que hace que funcione en el Plan, y cada cosa falla en silencio:
//  · la casilla tiene que estar SIEMPRE montada: con `hover && <input>` aparece de golpe
//    y el título salta, sin transición posible porque el nodo no existía;
//  · sin `width` ni `margin` lateral en su style INLINE: un inline le gana a la clase y la
//    deja siempre ancha (el título corrido por defecto) o le borra el `-8` que cancela el gap;
//  · la fila lleva `gap: 8`, que es lo que ese `-8` cancela;
//  · la hoja abre la casilla con el hover de `.mk-tarjeta-sel` y con `data-seleccionando`
//    (en el Plan, con algo elegido se ven todas).
//
// Medido en la app REAL (dev local, sin escribir nada), Chromium y WebKit idénticos:
// tarea, reposo 0 px de casilla y el chip a 15 px del borde, hover 15 px y el chip a 38
// (+23); proyecto, título a 17 en reposo y a 40 con hover.
//
// PROBADOS ROMPIÉNDOLOS (05-06/10/2026), cada rotura cazada por el guard que le toca
// (6 pass / 1 fail en cada caso, sobre 7):
//   1. `{onElegir && (hover || haySeleccion) && (` devuelto a la tarjeta de tarea.
//   2. `width: 14,` devuelto al style de la casilla de la tarea.
//   3. `margin: '3px 0 0'` devuelto a la casilla del proyecto.
//   4. `gap: 7` devuelto a la cabecera de la tarea.
//   5. `className="mk-tarjeta-sel"` sacado de la tarjeta de proyecto.
//   6. el selector `.mk-tarjeta-sel:hover .mk-sel-tarjeta` sacado de la hoja.
//   7. el selector `[data-seleccionando='1']` sacado de la hoja.
//   8. `data-seleccionando` sacado de la casilla de la tarea.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const SHELL = sinComentarios(leer('app/plan/board/BoardShell.tsx'));
const CSS = leer('app/globals.css').replace(/\/\*[\s\S]*?\*\//g, '');

/** El bloque de un componente: desde su `function` hasta la PRIMERA declaración que sigue. */
const bloque = (inicio: string) => {
  const a = SHELL.indexOf(inicio);
  const sig = ['\nfunction ', '\nexport function ', '\nconst ', '\nexport const ']
    .map((m) => SHELL.indexOf(m, a + 1)).filter((i) => i > a);
  const b = Math.min(...sig);
  assert.ok(a > 0 && Number.isFinite(b) && b > a, `no encontré el bloque ${inicio}`);
  return SHELL.slice(a, b);
};
const TAREA = bloque('function CardTile(');
const PROYECTO = bloque('export function ProyectoCardTile(');

/** El `<input type="checkbox" className="mk-sel-tarjeta" …/>` de un bloque, entero. */
const casilla = (src: string) => {
  const a = src.indexOf('className="mk-sel-tarjeta"');
  assert.ok(a > 0, 'la tarjeta no tiene la casilla con .mk-sel-tarjeta');
  const ini = src.lastIndexOf('<input', a);
  const fin = src.indexOf('/>', a);
  const el = src.slice(ini, fin);
  assert.ok(el.length < 1200, `el recorte de la casilla mide ${el.length}: está mirando otra cosa`);
  return el;
};

test('las dos tarjetas montan la casilla siempre, no sólo con el hover de React', () => {
  for (const [nombre, src] of [['tarea', TAREA], ['proyecto', PROYECTO]] as const) {
    assert.doesNotMatch(src, /\{onElegir && \([a-zA-Z]+ \|\| haySeleccion\) && \(/, `la casilla de ${nombre} volvió a montarse con el hover`);
    assert.match(src, /\{onElegir && \(\s*<input type="checkbox" className="mk-sel-tarjeta"/, `la casilla de ${nombre} no está montada siempre`);
  }
});

test('la casilla no lleva ancho ni margen lateral en su style inline', () => {
  for (const [nombre, src] of [['tarea', TAREA], ['proyecto', PROYECTO]] as const) {
    const el = casilla(src);
    const ini = el.indexOf('style={{');
    const estilo = el.slice(ini);
    assert.doesNotMatch(estilo, /\bwidth\s*:/, `un width inline en ${nombre} le gana a .mk-sel-tarjeta`);
    assert.doesNotMatch(estilo, /\bmargin\s*:/, `un margin inline en ${nombre} le borra el -8 que cancela el gap`);
    assert.doesNotMatch(estilo, /\bmargin(Left|Right)\s*:/, `un margen lateral inline en ${nombre} le gana a la clase`);
  }
});

test('la casilla dice si está marcada y si hay una selección en curso', () => {
  for (const [nombre, src] of [['tarea', TAREA], ['proyecto', PROYECTO]] as const) {
    const el = casilla(src);
    assert.match(el, /data-marcada=\{/, `${nombre}: sin data-marcada, una tildada se esconde al sacar el cursor`);
    assert.match(el, /data-seleccionando=\{haySeleccion/, `${nombre}: sin data-seleccionando, con algo elegido no se ven las demás`);
  }
});

test('la fila de la casilla lleva gap 8, que es lo que cancela el -8', () => {
  const a = TAREA.lastIndexOf('<div style={{', TAREA.indexOf('className="mk-sel-tarjeta"'));
  assert.match(TAREA.slice(a, a + 160), /gap: 8\b/, 'la cabecera de la tarea no tiene gap 8');
  const b = PROYECTO.lastIndexOf('<div style={{', PROYECTO.indexOf('className="mk-sel-tarjeta"'));
  assert.match(PROYECTO.slice(b, b + 160), /gap: 8\b/, 'la fila del título del proyecto no tiene gap 8');
});

test('las dos tarjetas son .mk-tarjeta-sel: es lo que abre la casilla al pasar el cursor', () => {
  assert.match(TAREA, /<div className="mk-tarjeta-sel"/, 'la tarjeta de tarea no es .mk-tarjeta-sel');
  assert.match(PROYECTO, /<div className="mk-tarjeta-sel"/, 'la tarjeta de proyecto no es .mk-tarjeta-sel');
});

test('la hoja abre la casilla con el hover de la tarjeta y con una selección en curso', () => {
  const regla = CSS.match(/([^{}]+)\{\s*width:\s*15px;[^}]*\}/);
  assert.ok(regla, 'no encontré la regla que abre .mk-sel-tarjeta');
  const selectores = regla[1].split(',').map((x) => x.trim().replace(/"/g, "'"));
  assert.ok(selectores.includes('.mk-tarjeta-sel:hover .mk-sel-tarjeta'), 'falta el hover de .mk-tarjeta-sel');
  assert.ok(selectores.includes(".mk-sel-tarjeta[data-seleccionando='1']"), 'falta data-seleccionando');
});

test('nadie más en el Plan dibuja la casilla de una tarjeta a mano', () => {
  // Si aparece otra casilla con `hover &&` en estas tarjetas, se volvió a montar a mano.
  assert.doesNotMatch(TAREA, /\bsetHover\(/, 'volvió un estado de hover de React en la tarjeta de tarea');
  assert.doesNotMatch(PROYECTO, /\bhoverSel\b/, 'volvió hoverSel en la tarjeta de proyecto');
});
