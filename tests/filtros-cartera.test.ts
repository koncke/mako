// =============================================================================
// Las ventanas de tiempo de la cartera
// =============================================================================
// Dos cosas que este archivo cuida, y las dos se vieron en la PANTALLA antes que
// en el código:
//
//  1. El ORDEN del menú. En JavaScript un objeto ordena primero las claves que
//     parecen enteros, en orden numérico, y recién después las demás en orden de
//     escritura. Con `'30'`, `'90'` y `'365'`, `Object.keys` devolvía
//     `[30, 90, 365, siempre, viejos]` — o sea que «Siempre», que es el default y
//     lo primero que hay que poder elegir, salía TERCERO. Por eso las claves
//     llevan letra (`d30`): la letra es del orden del menú, no del dato.
//
//  2. Que una fila SIN fecha no se cuele en ninguna ventana. Un dato que falta no
//     es un dato reciente, y el modo de falla es el caro: «los últimos 30 días»
//     devolvería también todo lo que no sabemos cuándo pasó, y eso se lee como
//     una respuesta.
//
// ⚠️ Probado ROMPIÉNDOLO, y una de las dos roturas NO fallo — que es un dato:
//   · volviendo las claves a `'30' | '90' | '365'`, este archivo pasa de 8/8 a
//     **6 pases y 2 FALLOS** («Siempre va primero…» y «ninguna clave parece un
//     entero»), que es exactamente lo que se veia en pantalla.
//   · sacando el `if (!iso) return false` de `entraEnVentana`: **8/8, no fallo
//     ninguno**. No es que el test no sirva: es que ese corte esta DUPLICADO —
//     `Date.parse(null)` ya devuelve NaN y la linea de abajo lo ataja. Lo que
//     este archivo fija es el COMPORTAMIENTO («sin fecha no entra»), que es lo
//     que importa; la linea se queda porque dice la intencion en voz alta, pero
//     no es la que lo sostiene. Escribirlo al reves habria sido afirmar una
//     medicion que no hice.

import test from 'node:test';
import assert from 'node:assert/strict';
import { CUANDO_LABEL, entraEnVentana } from '../app/customer-success/BarraClientes';

const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString();

test('«Siempre» va PRIMERO en el menú, que es de donde sale el orden', () => {
  assert.equal(Object.keys(CUANDO_LABEL)[0], 'siempre');
});

test('ninguna clave parece un entero, o JavaScript la sube al principio', () => {
  for (const k of Object.keys(CUANDO_LABEL)) {
    assert.ok(!/^\d+$/.test(k), `la clave «${k}» es numérica y se va a ordenar sola`);
  }
});

test('«Siempre» deja pasar todo, incluido lo que no tiene fecha', () => {
  assert.equal(entraEnVentana(hace(5), 'siempre'), true);
  assert.equal(entraEnVentana(hace(5000), 'siempre'), true);
  assert.equal(entraEnVentana(null, 'siempre'), true);
});

test('una ventana de N días deja pasar lo de adentro y corta lo de afuera', () => {
  assert.equal(entraEnVentana(hace(10), 'd30'), true);
  assert.equal(entraEnVentana(hace(40), 'd30'), false);
  assert.equal(entraEnVentana(hace(40), 'd90'), true);
  assert.equal(entraEnVentana(hace(200), 'd90'), false);
  assert.equal(entraEnVentana(hace(200), 'd365'), true);
});

test('«hace más de un año» es la otra punta, no otra ventana', () => {
  assert.equal(entraEnVentana(hace(400), 'viejos'), true);
  assert.equal(entraEnVentana(hace(100), 'viejos'), false);
  // Y las dos puntas no se pisan: nada puede estar en «último año» y en «más de
  // un año» a la vez, que sería una lista que suma más que el total.
  for (const d of [10, 100, 364, 366, 900]) {
    const dentro = entraEnVentana(hace(d), 'd365');
    const fuera = entraEnVentana(hace(d), 'viejos');
    assert.notEqual(dentro, fuera, `${d} días cae en las dos o en ninguna`);
  }
});

test('SIN FECHA no entra en ninguna ventana que no sea «siempre»', () => {
  for (const c of ['d30', 'd90', 'd365', 'viejos']) {
    assert.equal(entraEnVentana(null, c), false, `null se coló en «${c}»`);
    assert.equal(entraEnVentana(undefined, c), false);
    assert.equal(entraEnVentana('', c), false);
  }
});

test('una fecha ilegible tampoco entra: no se adivina', () => {
  for (const c of ['d30', 'viejos']) {
    assert.equal(entraEnVentana('ayer', c), false);
    assert.equal(entraEnVentana('2026-13-45', c), false);
  }
});

test('cada ventana tiene su rótulo y ninguno está vacío', () => {
  // Un rótulo que falta deja un renglón en blanco en el menú, que se lee como una
  // opción rota y no como una que falta.
  for (const [k, v] of Object.entries(CUANDO_LABEL)) {
    assert.ok(v && v.trim().length > 0, `«${k}» no tiene rótulo`);
  }
});
