// =============================================================================
// El ranking de la comunidad y quién ve una plantilla privada (6/11/2026)
// =============================================================================
// lib/creaciones-reglas.ts: `rankear` (las estrellas del período mandan; los empates comparten el puesto; sin estrellas en
// el período no se entra), `desdeDelPeriodo`, `puedeVer`, `puedeUsar` y `porQueNoEstrella` con una privada; y la tarjeta
// de «Nuevo …» (app/creaciones/plantillas-tarjeta.ts).
//
// Probado rompiéndolo (base: 7 verdes, 0 rojos; 6/11/2026):
//   · `rankear` sin el filtro de `delPeriodo > 0` → 5/2;
//   · los empates con puesto propio (`puesto: i + 1` siempre) → 6/1;
//   · `puedeUsar` dejando usar una privada ajena → 6/1;
//   · `idDeTarjeta` sin exigir el prefijo → 6/1 (con «nueva:1234» de Offer; sin ese caso daba 7/0).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { desdeDelPeriodo, porQueNoEstrella, puedeUsar, puedeVer, rankear } from '../lib/creaciones-reglas';
import { GRUPO_COMUNIDAD, GRUPO_MIAS, idDeTarjeta, tarjetaDeCreacion } from '../app/creaciones/plantillas-tarjeta';

const fila = (id: number, estrellas: number, usos = 0) => ({ id, estrellas, usos, titulo: `T${id}` });

test('en la semana manda lo recibido en la semana, no lo de siempre', () => {
  const filas = [fila(1, 100), fila(2, 3), fila(3, 9)];
  const r = rankear(filas, new Map([[2, 3], [3, 1]]));
  assert.deepEqual(r.map((x) => x.id), [2, 3]);
  assert.deepEqual(r.map((x) => x.delPeriodo), [3, 1]);
  assert.ok(!r.some((x) => x.id === 1), 'sin estrellas en la semana no entra al ranking de la semana');
});

test('los empates comparten el puesto (1, 2, 2, 4)', () => {
  const filas = [fila(1, 5, 1), fila(2, 4, 0), fila(3, 4, 0), fila(4, 1, 0)];
  const r = rankear(filas, null);
  assert.deepEqual(r.map((x) => x.puesto), [1, 2, 2, 4]);
});

test('de siempre: por estrellas y después usos; lo que nadie tocó no entra', () => {
  const r = rankear([fila(1, 0, 0), fila(2, 2, 0), fila(3, 2, 5)], null);
  assert.deepEqual(r.map((x) => x.id), [3, 2]);
  assert.equal(rankear([fila(1, 5)], null, 0).length, 0, 'el tope se respeta');
});

test('el período arranca 7 o 30 días antes; «siempre» no tiene desde', () => {
  const ahora = new Date('2026-11-06T12:00:00Z');
  assert.equal(desdeDelPeriodo('semana', ahora)?.toISOString(), '2026-10-30T12:00:00.000Z');
  assert.equal(desdeDelPeriodo('mes', ahora)?.toISOString(), '2026-10-07T12:00:00.000Z');
  assert.equal(desdeDelPeriodo('siempre', ahora), null);
});

test('una privada la ve y la usa sólo su negocio, y no recibe estrellas', () => {
  const privada = { workspaceOrigen: 7, estado: 'privada' };
  assert.equal(puedeVer(privada, 7), true);
  assert.equal(puedeVer(privada, 8), false);
  assert.equal(puedeUsar(privada, 7), true);
  assert.equal(puedeUsar(privada, 8), false);
  assert.match(porQueNoEstrella(privada, 8) ?? '', /sólo de su negocio/);
  assert.equal(puedeUsar({ workspaceOrigen: 7, estado: 'retirada' }, 7), false, 'una retirada no se usa más');
  assert.equal(puedeUsar({ workspaceOrigen: 7, estado: 'publicada' }, 8), true);
});

test('la tarjeta de «Nuevo …»: su grupo, su insignia y un id que no choca con las de MaKo', () => {
  const c = { id: 41, titulo: 'Mi anuncio', descripcion: 'Para tráfico frío', autor: 'Un negocio', estado: 'privada', estrellas: 0, usos: 0 };
  const mia = tarjetaDeCreacion(c, 'mia', '3 / 4');
  assert.equal(mia.id, 'creacion:41');
  assert.equal(mia.grupo, GRUPO_MIAS);
  assert.match(mia.insignia ?? '', /Sólo tu negocio/);
  assert.equal(mia.formato, '3 / 4');
  const otra = tarjetaDeCreacion({ ...c, estado: 'publicada', estrellas: 1200, autor: 'Clínica X' }, 'comunidad');
  assert.equal(otra.grupo, GRUPO_COMUNIDAD);
  assert.equal(otra.insignia, '★ 1,2 mil · Clínica X');
});

test('el id de la tarjeta se lee sólo con su prefijo entero', () => {
  assert.equal(idDeTarjeta('creacion:12'), 12);
  assert.equal(idDeTarjeta('pas'), null);
  // El id de otra tarjeta de la tab (Offer: «nueva:<funnel>») no puede leerse como una creación por su largo.
  assert.equal(idDeTarjeta('nueva:1234'), null);
  assert.equal(idDeTarjeta('12'), null);
  assert.equal(idDeTarjeta('creacion:abc'), null);
  assert.equal(idDeTarjeta('creacion:0'), null);
});
