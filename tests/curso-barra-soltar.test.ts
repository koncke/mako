// =============================================================================
// Soltar una CLASE sobre la barra de los módulos la MUDA a ese módulo (item 16)
// =============================================================================
// Pedido de Martín (08/10/2026, item 16): «Si arrastro una clase a la sidebar de la derecha de
// módulos, debería la clase moverse a ese módulo, no transformarse en un nuevo módulo. Ahora si arrastro
// un módulo ahí sí es para ordenar nada más».
//
// Lo que se encontró, en un banco con la tab real y Chrome (scratchpad/estructura/banco/repro16b.mts):
//   1. La copia que sigue al cursor de una CLASE es la misma tarjeta que la de un MÓDULO (`.ugc-modcard`,
//      con su chip de número) y mide 260×260: sobre la barra tapaba la lista entera —y el renglón que la
//      iba a recibir, marcado abajo, invisible—, y se leía como un módulo nuevo entrando a la lista.
//   2. Soltarla en el aire ENTRE dos renglones no hacía nada (el destino salía del elemento bajo el
//      cursor, y ahí es la lista), con un renglón marcado un instante antes.
// Lo que se EJECUTA: `filaEnBarra` (app/_cursos/orden.ts). Lo que se LEE: que el arrastre lo use, que la
// clase vaya a `onLlevarClase` y nunca al orden de los módulos, y que sobre la barra se vea la pastilla.
//
// PROBADO ROMPIÉNDOLO: la tabla con los números está al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { filaEnBarra } from '../app/_cursos/orden';

const RAIZ = join(__dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const ARR = sinComentarios(readFileSync(join(RAIZ, 'app/_cursos/arrastre-curso.ts'), 'utf8').replace(/\r\n/g, '\n'));

// Tres renglones de 36 px con 9 px de aire entre cada uno.
const FILAS = [{ key: 'a', y1: 200, y2: 236 }, { key: 'b', y1: 245, y2: 281 }, { key: 'c', y1: 290, y2: 326 }];

test('el renglón a la altura del cursor recibe la clase', () => {
  assert.equal(filaEnBarra(FILAS, 210), 'a');
  assert.equal(filaEnBarra(FILAS, 260), 'b');
  assert.equal(filaEnBarra(FILAS, 326), 'c');
});

test('en el AIRE entre dos renglones, el más cercano (antes: nada, con uno marcado)', () => {
  assert.equal(filaEnBarra(FILAS, 239), 'a');
  assert.equal(filaEnBarra(FILAS, 243), 'b');
  // Un poco arriba del primero o abajo del último (el borde de la lista) también cuenta.
  assert.equal(filaEnBarra(FILAS, 190), 'a');
  assert.equal(filaEnBarra(FILAS, 335), 'c');
});

test('lejos de la lista (la cabecera, el pie) no cae en ninguno, y sin renglones tampoco', () => {
  assert.equal(filaEnBarra(FILAS, 150), null);
  assert.equal(filaEnBarra(FILAS, 400), null);
  assert.equal(filaEnBarra([], 210), null);
});

test('el arrastre decide el módulo con la ALTURA, no con el elemento bajo el cursor', () => {
  const ini = ARR.indexOf("if (z === 'barra' && m.tipo === 'clase') {");
  assert.ok(ini > 0, 'desapareció la rama de una clase sobre la barra');
  const rama = ARR.slice(ini, ARR.indexOf('const med = medir(z, e.currentTarget);', ini));
  assert.ok(rama.length > 300 && rama.length < 1500, `el recorte mide ${rama.length}`);
  assert.match(rama, /const k = filaEnBarra\(filas, e\.clientY \+ desplazamiento\(sc\)\);/);
  assert.match(rama, /ponerDestino\(k && k !== m\.moduloKey \? \{ zona: 'barra-clase', key: k \} : null\);/);
  assert.doesNotMatch(rama, /closest/, 'el destino no sale del elemento bajo el cursor (entre dos renglones es la lista)');
  // Sólo los módulos que reciben clases (no «Sin módulo»).
  assert.match(rama, /\.filter\(\(n\) => datos\.current\.recibeClases\(n\.dataset\.arrModulo \?\? ''\)\)/);
});

test('soltar una CLASE en la barra la LLEVA a ese módulo: nunca toca el orden de los módulos', () => {
  const drop = ARR.slice(ARR.indexOf('onDrop: (e: ReactDragEvent<HTMLElement>) => {'), ARR.indexOf('return {\n    /** Lo que va en la mano'));
  const clase = drop.slice(drop.indexOf("if (m.tipo === 'clase' && z === 'barra') {"), drop.indexOf("if (!d || d.zona !== z || !('indice' in d)) return;"));
  assert.ok(clase.length > 60, 'desapareció la salida de una clase soltada en la barra');
  assert.match(clase, /if \(d && d\.zona === 'barra-clase'\) onLlevarClase\?\.\(m\.id, d\.key, null\);\s*return;/);
  assert.doesNotMatch(clase, /onOrdenarModulos|onNuevoModulo/);
  // Y un MÓDULO en la barra sólo reordena.
  assert.match(drop, /if \(m\.tipo === 'modulo'\) \{\s*const nueva = ordenAlSoltar\(modulos, m\.key, d\.indice\);\s*if \(nueva\) onOrdenarModulos\?\.\(nueva\);/);
});

test('sobre la barra la clase se ve como una PASTILLA, no como la tarjeta de un módulo', () => {
  assert.match(ARR, /copiaGrande\.current = raiz\.lastElementChild as HTMLElement \| null;/, 'la tarjeta que cuelga montarCopia es la que se esconde');
  const empuje = ARR.slice(ARR.indexOf('const empuje = (e: DragEvent) => {'), ARR.indexOf('const fin = () => {'));
  assert.match(empuje, /const enBarra = z === 'barra';/);
  assert.match(empuje, /p\.style\.display = enBarra \? 'block' : 'none';/);
  assert.match(empuje, /copiaGrande\.current\.style\.opacity = enBarra \? '0' : '1';/);
  // Y se va con el gesto, por las dos salidas (si el origen se desmontó, su `dragend` no llega).
  assert.match(ARR.slice(ARR.indexOf('const terminar = useCallback('), ARR.indexOf('/** ¿Esta zona recibe')), /quitarPildora\(\);/);
  assert.match(ARR.slice(ARR.indexOf('const fin = () => {'), ARR.indexOf('document.addEventListener(\'dragover\', empuje, true);')), /quitarPildora\(\);/);
});

// ── Probado ROMPIÉNDOLO (08/10/2026) ──────────────────────────────────────────
// Una rotura por vez, restaurada deshaciendo el reemplazo (scratchpad/estructura/romper.mjs). Sin
// romper: 6/0. Cada una 5 / 1, en SU test:
//   · en el aire entre dos renglones no recibe nadie · lejos de la lista igual recibe · vuelve el
//     elemento bajo el cursor (`closest`) · la clase va al ORDEN de los módulos · sin la pastilla (la
//     tarjeta grande vuelve a tapar la barra).
// Y en el navegador (Chrome con ventana, scratchpad/estructura/banco/repro16b.mts): ANTES, soltar entre
// «Diagnóstico» y «Bonus» con «Bonus» marcado → ninguna llamada; DESPUÉS → `moverClaseAAction(2, …)`.
