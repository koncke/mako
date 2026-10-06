// =============================================================================
// El desplegable que elige VARIOS (app/components/dropdown-varios.ts)
// =============================================================================
// Nació con el paso 2 del Pixel el 06/10/2026: una landing puede vender varios
// productos, y Martín pidió «hazlo también dentro de un desplegable… si o si se debe
// marcar 1». Las tres decisiones viven en un módulo puro para poder EJECUTARLAS: un
// guard que lee el fuente contesta «¿está enchufado?», nunca «¿hace lo que dice?».
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { alternarValor, puedeApagar, rotuloDeVarios } from '../app/components/dropdown-varios';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

// PROBADO ROMPIENDOLO: cambiando el `return valores;` del mínimo por
// `return valores.filter((x) => x !== v);`, este archivo pasa de
// **pass 5 / fail 0** a **pass 4 / fail 1**.
test('⚠️ el ÚLTIMO marcado no se puede apagar cuando hay un mínimo', () => {
  // «si o si se debe marcar 1». Si el control deja vaciarse, lo que guarda es una lista
  // vacía — que en el Pixel significa «el CRM del negocio» y en la pantalla se ve como
  // que no eligió nada.
  assert.deepEqual(alternarValor(['7'], '7', 1), ['7'], 'con mínimo 1 el único no se apaga');
  assert.equal(puedeApagar(['7'], '7', 1), false);
  // Con dos, sí: queda uno.
  assert.deepEqual(alternarValor(['7', '9'], '7', 1), ['9']);
  assert.equal(puedeApagar(['7', '9'], '7', 1), true);
  // Sin mínimo, el último se apaga como cualquiera: el default no le cambia nada a quien
  // no pidió la regla.
  assert.deepEqual(alternarValor(['7'], '7'), []);
  // Y PRENDER siempre se puede, aunque esté en el mínimo.
  assert.equal(puedeApagar(['7'], '9', 1), true, 'un valor apagado no tiene nada que proteger');
});

test('alternar conserva el ORDEN y agrega al final', () => {
  // El primero es el que el botón nombra primero y el «principal» de quien guarda: que se
  // reordene solo al tocar otro se lee como que la elección cambió.
  assert.deepEqual(alternarValor(['9', '7'], '3'), ['9', '7', '3']);
  assert.deepEqual(alternarValor(['9', '7', '3'], '7'), ['9', '3']);
  // No muta lo que recibe: el estado de React se compara por referencia.
  const antes = ['9', '7'];
  alternarValor(antes, '3');
  assert.deepEqual(antes, ['9', '7']);
});

// PROBADO ROMPIENDOLO: cambiando el caso de 2 por `${labels.length} seleccionados`,
// este archivo pasa de **pass 5 / fail 0** a **pass 4 / fail 1**.
test('el BOTÓN dice cuáles, no cuántos', () => {
  assert.equal(rotuloDeVarios([]), null, 'sin nada marcado va el placeholder');
  assert.equal(rotuloDeVarios(['Negocio que Escala']), 'Negocio que Escala');
  assert.equal(rotuloDeVarios(['Negocio que Escala', 'Mentoría']), 'Negocio que Escala y Mentoría');
  // Con tres o más no entran todos en un renglón: los dos primeros y cuántos más.
  assert.equal(rotuloDeVarios(['A', 'B', 'C']), 'A, B y 1 más');
  assert.equal(rotuloDeVarios(['A', 'B', 'C', 'D', 'E']), 'A, B y 3 más');
});

test('CABLEADO: el desplegable usa las MISMAS funciones, y sólo con `varios`', () => {
  const src = leer('../app/components/Dropdown.tsx');
  // Una sola regla del mínimo: si el menú tuviera la suya, la primera vez que difieran
  // se guardaría un conjunto que el menú no deja ver.
  assert.ok(/import \{ puedeApagar, rotuloDeVarios \} from '\.\/dropdown-varios';/.test(src), 'el desplegable tiene que leer las funciones puras');
  assert.ok(/!puedeApagar\(varios\.valores, o\.value, varios\.minimo\)/.test(src), 'el bloqueo del renglón sale de la misma regla');
  assert.ok(/rotuloDeVarios\(marcados\.map/.test(src), 'el botón sale de la misma regla');
  // ⚠️ Con `varios` NO se cierra al tocar: marcar tres cuesta abrir el menú una vez.
  const elegir = src.slice(src.indexOf('const elegir = () => {'), src.indexOf('};', src.indexOf('const elegir = () => {')));
  assert.ok(elegir.length > 0 && elegir.length < 400, `el bloque de elegir mide ${elegir.length}`);
  assert.ok(/if \(varios\) \{ if \(!bloqueado\) onChange\(o\.value\); return; \}/.test(elegir), 'con varios se alterna y se sale SIN cerrar');
  // Y los CUATRO lugares donde se dibuja un renglón pasan la elección múltiple: con uno
  // que no la pase, la búsqueda o las secciones dibujarían renglones que cierran el menú.
  const llamadas = src.match(/renderOption\(o, value, resetAfterSelect, onChange, \(\) => setOpen\(false\),[^\n]*\)\)/g) ?? [];
  assert.equal(llamadas.length, 4, 'son cuatro lugares que dibujan renglones');
  for (const l of llamadas) assert.ok(/varios \? \{ valores: varios, minimo \} : undefined/.test(l), `un renglón sin la elección múltiple: ${l}`);
});

test('CABLEADO: el Select de la casa pasa `varios` y `minimo` al desplegable', () => {
  const sel = leer('../app/_ui/Select.tsx');
  assert.ok(/varios=\{varios\}/.test(sel) && /minimo=\{minimo\}/.test(sel), 'sin pasarlos, el Select ignora la prop y elige uno solo');
});
