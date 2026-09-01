// =============================================================================
// El costo de un clip no puede ser el costo de un LOTE
// =============================================================================
// El defecto que motiva este archivo estaba VIVO en producción y se veía como un
// precio: `video-generator.costo-clip` valía **150** en el workspace del dueño.
//
// Un clip no puede costar 150. El máximo que existe es el de 10 segundos, que
// sale 15 (`CREDITOS_POR_DURACION`, la tabla que Martín midió contra Flow). 150
// son diez clips.
//
// La causa está escrita, textual, en el código que lo medía: «Una sola toma por
// vez, así que la diferencia ES el costo de un clip». Era cierto el día que se
// escribió — y **«filmar todas» lo dejó de ser**. Con siete tomas en vuelo, el
// saldo que se lee después de que termina UNA ya tiene descontadas las que
// terminaron en el medio, y la resta mide el lote entero.
//
// Es el mismo patrón que ya mordió hoy en la cola: una aceleración destapa un
// supuesto que estaba escrito en un comentario y en ningún control.
//
// El daño no era el número solo: se muestra SIN «(estimado)» —porque el código
// lo cree medido— o sea con autoridad de hecho, y alimenta la cuenta de si al
// cliente le alcanza el saldo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { CREDITOS_POR_DURACION } from '../lib/costo-clip';

// `saldo-datos.ts` es `server-only`, así que la condición se replica acá con la
// misma fuente —la tabla— y se comprueba que sigan de acuerdo. Es el mismo
// criterio que `exigirClienteDePrueba`: lo que decide algo caro se puede testear.
const MAXIMO = Math.max(...Object.values(CREDITOS_POR_DURACION));
const plausible = (n: number) => Number.isFinite(n) && n > 0 && n <= MAXIMO;

test('el techo sale de la TABLA, no de un número a ojo', () => {
  // El guard viejo era `> 200`, y 200 no significa nada: no es el precio de nada
  // que exista. Por eso dejó pasar un 150.
  assert.equal(MAXIMO, 15, 'el clip más caro es el de 10 s');
});

test('⚠️ 150 —diez clips medidos como uno— se rechaza', () => {
  assert.equal(plausible(150), false);
});

test('un lote de dos clips de 8 s (24) también se rechaza', () => {
  // Con el techo en 200 entraba; con el techo real, no.
  assert.equal(plausible(24), false);
});

test('⚠️ LO QUE ESTE GUARD NO PUEDE VER, escrito para que nadie lo crea cubierto', () => {
  // Dos clips de 4 s son 14, y 14 ES un precio posible de un clip. O sea que un
  // lote CHICO sigue pudiendo hacerse pasar por uno solo, y ningún techo por
  // magnitud lo va a distinguir: 14 es 14.
  //
  // Se deja explícito en vez de fingir que está resuelto. El error queda acotado
  // —a lo sumo se cree que un clip sale 14 en vez de 7— contra el 150 de antes,
  // que era un factor de diez. La cura de verdad es no medir cuando hay más de
  // una toma en vuelo, y esa vive en el llamador, no acá.
  assert.equal(plausible(CREDITOS_POR_DURACION[4] * 2), true);
});

test('los cuatro precios reales entran, que es lo que el guard NO puede romper', () => {
  // Un guard que además rechaza lo bueno es peor que no tenerlo: deja al cliente
  // con la estimación para siempre y nadie se entera.
  for (const c of Object.values(CREDITOS_POR_DURACION)) {
    assert.equal(plausible(c), true, `${c} créditos es un precio real de la tabla`);
  }
});

test('cero, negativos y basura se rechazan', () => {
  assert.equal(plausible(0), false);
  assert.equal(plausible(-12), false);
  assert.equal(plausible(Number.NaN), false);
  assert.equal(plausible(Number.POSITIVE_INFINITY), false);
});

// ── Y la advertencia de saldo, que se escribió y no la leía nadie ───────────
// `alcanzaParaAnuncio()` y `alcanzaTodo` existían los dos, completos, con CERO
// call sites. O sea que «Filmar las 6 que faltan» cobraba ~72 créditos sin mirar
// si había 72. El dueño lo había pedido textual y está citado en la cabecera de
// `saldo-datos.ts`.

import { notaSaldo } from '../lib/costo-clip';

test('si no alcanza, lo dice CON el número que hay', () => {
  // «No alcanza» a secas obliga a ir a buscar cuánto falta a otra pantalla.
  assert.equal(notaSaldo(30, 72), 'No alcanza: tienes 30.');
});

test('si alcanza, no dice nada: un aviso que sale siempre deja de leerse', () => {
  assert.equal(notaSaldo(100, 72), undefined);
  assert.equal(notaSaldo(72, 72), undefined, 'justo lo que hace falta SÍ alcanza');
});

test('⚠️ y si el saldo NO SE SABE tampoco dice nada', () => {
  // «No se sabe» no es «no alcanza». Decirle a alguien que no puede pagar algo
  // que sí puede es el mismo error con el signo cambiado, y se paga peor: lo
  // manda a recargar créditos que ya tiene.
  assert.equal(notaSaldo(null, 72), undefined);
});

test('sin nada que cobrar no hay advertencia', () => {
  assert.equal(notaSaldo(0, 0), undefined);
});
