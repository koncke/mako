// =============================================================================
// MaKo Mobile — una hoja (SheetM) que se está cerrando no recibe toques
// =============================================================================
// La hoja sigue en pantalla los 220 ms de la salida, y con «Reducir movimiento» se funde 200 ms SIN moverse: el botón
// que se acaba de tocar sigue bajo el dedo. Si el panel no va `inert` apenas `abierto` pasa a false, el segundo toque
// de un doble toque repite la acción (Calendario: «Borrar evento» dos veces — el segundo, vacío, pisaba el toast con
// Deshacer —, y «Guardar evento» creaba dos), y uno en el velo dejaba `porGesto` en true (el próximo cierre por código
// no sacaba el `?sheet=` de la URL). La capa NO va inert: sigue tapando la página y se come el toque (si fuera inert,
// el toque caería en lo de abajo: una fila de la Agenda abriría otra hoja).
//
// No hay DOM en estos tests: se lee el JSX de SheetM (sin comentarios) y la hoja de estilos.
//
// Verificado ROMPIÉNDOLO (15/10/2026; base 2 / 0), de a una y restaurando:
//   · sin `inert` en el panel: 1 / 1 («el panel…»).
//   · sin `inert` en el velo: 1 / 1 («el velo…»).
//   · `inert={cerrando}` también en la capa: 1 / 1 («la capa…»).
//   · `const cerrando = !montada` (nunca inert mientras se ve): 1 / 1 («el panel…»).
//   · `pointer-events: none` en `.m-sheet-capa`: 1 / 1 («la capa…»); y en una regla aparte
//     (`.m-sheet-capa:has(.m-sheet[inert])`): 1 / 1. La primera versión anclaba la regla al `}` de la anterior y daba
//     2 / 0 con la rotura puesta: matchAll ya había consumido ese `}` con `:root:has(.m-sheet-capa)`.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** La etiqueta de apertura entera del `<div>` con esa clase (las llaves de JSX pueden traer `=>` adentro). */
function etiquetaDe(src: string, clase: string): string {
  const i = src.indexOf(`className="${clase}"`);
  assert.ok(i >= 0, `no encontré className="${clase}" en SheetM`);
  const desde = src.lastIndexOf('<div', i);
  let llaves = 0;
  for (let j = desde; j < src.length; j += 1) {
    const c = src[j];
    if (c === '{') llaves += 1;
    else if (c === '}') llaves -= 1;
    else if (c === '>' && llaves === 0) return src.slice(desde, j + 1);
  }
  throw new Error(`la etiqueta de ${clase} no cierra`);
}

/** ¿Esta etiqueta va inert exactamente cuando la hoja NO está abierta? */
function inerteAlCerrar(src: string, etiqueta: string): boolean {
  const m = etiqueta.match(/\binert=\{\s*([^}]+?)\s*\}/);
  if (!m) return false;
  const expr = m[1];
  if (expr === '!abierto') return true;
  const def = src.match(new RegExp(`const ${expr.replace(/[$]/g, '\\$')} = ([^;\\n]+);`));
  return !!def && def[1].trim() === '!abierto';
}

test('cerrándose, el panel y el velo de SheetM van inert (el segundo toque no repite la acción)', () => {
  const sheet = leer('app/m/_ui/SheetM.tsx');
  assert.ok(inerteAlCerrar(sheet, etiquetaDe(sheet, 'm-sheet')), 'el panel tiene que ir inert={!abierto} mientras sale');
  assert.ok(inerteAlCerrar(sheet, etiquetaDe(sheet, 'm-sheet__velo')), 'el velo tiene que ir inert={!abierto} mientras sale');
});

test('la capa sigue tapando la página mientras la hoja sale: se come el toque', () => {
  const sheet = leer('app/m/_ui/SheetM.tsx');
  assert.doesNotMatch(etiquetaDe(sheet, 'm-sheet-capa'), /\binert\b/, 'la capa no va inert: el toque caería en la página');
  const css = leer('app/m/m.css');
  // Sin anclar al `}` de la regla anterior: matchAll ya lo consumió (con el ancla, la regla de la capa no se leía).
  const reglas = [...css.matchAll(/([^{}]*\.m-sheet-capa[^{}]*)\{([^}]*)\}/g)];
  assert.ok(reglas.some((r) => /^\s*\.m-sheet-capa\s*$/.test(r[1])), 'no encontré la regla de .m-sheet-capa en m.css');
  for (const r of reglas) {
    assert.doesNotMatch(r[2], /pointer-events\s*:\s*none/, `la capa no apaga los toques (${r[1].trim()})`);
  }
});
