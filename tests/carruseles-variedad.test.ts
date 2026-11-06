// Que un creador no llene la pantalla (lib/carruseles/variedad.ts, 6/11/2026). Martín, mirando el explorador en producción:
// «en el filtro de CTA pusiste puros de DenBorg, no creo que ella sea la que más carruseles haga». Corre el código con listas
// donde una cuenta tiene casi todo lo de arriba, y con el explorador de verdad (`filtrarCarruseles`).
//
// Probado rompiéndolo (6/11/2026), base 6/0, restaurando desde memoria:
//   · `conVariedad` eligiendo siempre la primera (sin mirar `porVentana`) → 4 rojos;
//   · `filtrarCarruseles` repartiendo también con cuentas elegidas → 1 rojo (con UNA sola cuenta no se nota: por eso son dos);
//   · `filtrarCarruseles` sin repartir → 1 rojo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conVariedad, peorTramo, VARIEDAD_POR_DEFECTO } from '../lib/carruseles/variedad';
import { FILTROS_INICIALES, filtrarCarruseles, type Carrusel } from '../lib/carruseles/explorar';

type X = { id: number; de: string };
const lista = (des: string): X[] => [...des].map((de, i) => ({ id: i + 1, de }));
const quien = (x: X) => x.de;
const des = (xs: X[]) => xs.map((x) => x.de).join('');

test('una cuenta con todo lo de arriba: en cada tramo de 12, como mucho 2 suyas', () => {
  // 30 de «D» (la cuenta que llenaba la pantalla) arriba, y 10 de otras cinco cuentas abajo.
  const xs = lista('D'.repeat(30) + 'ABCDEABCDE'.replace(/D/g, 'F'));
  const out = conVariedad(xs, quien);
  assert.equal(out.length, xs.length, 'no se pierde ninguna');
  assert.deepEqual([...out].map((x) => x.id).sort((a, b) => a - b), xs.map((x) => x.id), 'son las mismas');
  // Mientras haya de otras cuentas, «D» no pasa de 2 en 12.
  const conOtras = out.slice(0, 12);
  assert.ok(conOtras.filter((x) => x.de === 'D').length <= VARIEDAD_POR_DEFECTO.porVentana, des(conOtras));
  assert.equal(out[0].de, 'D', 'la mejor sigue primera: el orden elegido se respeta');
});

test('lo que no entra espera unos lugares, no se tira; y se respeta el orden de cada cuenta', () => {
  const xs = lista('AAAAABBBBB');
  const out = conVariedad(xs, quien, { porVentana: 2, ventana: 4 });
  assert.equal(des(out), 'AABBAABBAB');
  const deA = out.filter((x) => x.de === 'A').map((x) => x.id);
  assert.deepEqual(deA, [1, 2, 3, 4, 5], 'las de A siguen en su orden');
  assert.ok(peorTramo(out, quien, 4, 8) <= 2, 'mientras quedan de las dos, ningún tramo de 4 tiene 3 de una');
});

test('con pocos creadores no deja huecos: si ninguna entra, va la primera', () => {
  const xs = lista('AAAAAA');
  assert.deepEqual(conVariedad(xs, quien).map((x) => x.id), [1, 2, 3, 4, 5, 6], 'una sola cuenta: queda igual');
  assert.deepEqual(conVariedad([], quien), []);
  assert.equal(conVariedad(lista('AB'), quien).length, 2);
});

test('una lista que ya está variada no se toca', () => {
  const xs = lista('ABCDEFABCDEF');
  assert.deepEqual(conVariedad(xs, quien).map((x) => x.id), xs.map((x) => x.id));
});

test('sólo reordena los primeros `hasta` lugares: de ahí en más, el orden de siempre', () => {
  const xs = lista('A'.repeat(10) + 'BC');
  const out = conVariedad(xs, quien, { hasta: 3, ventana: 4, porVentana: 2 });
  assert.equal(des(out).slice(0, 3), 'AAB');
  assert.equal(out.length, 12);
});

const AHORA = Date.parse('2026-11-06T12:00:00Z');
const c = (id: number, competidorId: number, outlier: number, usuario: string): Carrusel => ({
  id, competidorId, origen: 'biblioteca', creador: { nombre: usuario, usuario, foto: null }, url: null, miniatura: null,
  texto: `carrusel ${id}`, gancho: null, tipoGancho: null, cierre: null, formato: 'lista', medio: 'carrusel', laminas: 5,
  megusta: 100, comentarios: 10, publicada: new Date(AHORA - 5 * 86_400_000).toISOString(), traida: new Date(AHORA).toISOString(),
  outlier, clase: 'carrusel', laminasImagenes: [], cta: null,
});

test('el explorador reparte por creador, salvo que se pida ver a uno', () => {
  const den = Array.from({ length: 10 }, (_, i) => c(i + 1, -1, 50 - i, 'denborg'));
  const otros = [c(20, -2, 8, 'ana'), c(21, -3, 7, 'bruno'), c(22, -4, 6, 'clara'), c(23, -5, 5, 'dario')];
  const todos = [...den, ...otros];
  const vistos = filtrarCarruseles(todos, { ...FILTROS_INICIALES, orden: 'outlier' }, new Set(), AHORA);
  assert.equal(vistos[0].id, 1, 'el de mayor outlier sigue primero');
  assert.ok(vistos.slice(0, 6).filter((x) => x.competidorId === -1).length <= 2, 'una sola cuenta no llena la primera pantalla');
  assert.equal(vistos.length, todos.length);
  // Con la cuenta elegida (o por @), se ve a esa cuenta en su orden, sin repartir.
  // Con DOS cuentas elegidas también: el que eligió quiere ver lo de esas cuentas en su orden (con una sola, repartir no cambia nada).
  const suyas = filtrarCarruseles(todos, { ...FILTROS_INICIALES, orden: 'outlier', creadores: [-1, -2] }, new Set(), AHORA);
  assert.deepEqual(suyas.map((x) => x.id), [...den.map((x) => x.id), 20]);
  const porArroba = filtrarCarruseles(todos, { ...FILTROS_INICIALES, orden: 'outlier', q: '@denborg' }, new Set(), AHORA);
  assert.deepEqual(porArroba.map((x) => x.id), den.map((x) => x.id));
});
