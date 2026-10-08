// =============================================================================
// comunidad-niveles — los 9 niveles de Skool: umbrales EXACTOS y sus bordes
// =============================================================================
// El nivel abre clases del curso (bloqueo por nivel, otra pista): un umbral corrido un punto le cierra
// a alguien una clase que ya tenía. Por eso los bordes se prueban de los dos lados (umbral - 1 y umbral).
//
// Verificado ROMPIÉNDOLO (08/10/2026, arnés en el scratchpad de la corrida, restaurando de memoria):
//   · umbral del nivel 7 a 2000 (en vez de 2015)        → 2 fallos, 6 pases.
//   · `>=` por `>` en `nivelDe` (umbral exclusivo)       → 3 fallos, 5 pases.
//   · `puntosParaSubir` sin el `null` del nivel 9         → 1 fallo, 7 pases.
//   · `distribucionDeNiveles` sin el `total ? … : 0`      → 1 fallo, 7 pases.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  UMBRALES_NIVEL, NIVEL_MAX, nivelDe, puntosParaSubir, sanearNombresNivel, nombreDeNivel, distribucionDeNiveles, rotuloNivel,
} from '../lib/comunidad-niveles';

test('los umbrales son los de Skool, exactos', () => {
  assert.deepEqual([...UMBRALES_NIVEL], [0, 5, 20, 65, 155, 515, 2015, 8015, 33015]);
  assert.equal(NIVEL_MAX, 9);
});

test('cada umbral es inclusivo: con el umbral justo se sube, con uno menos no', () => {
  UMBRALES_NIVEL.forEach((u, i) => {
    assert.equal(nivelDe(u), i + 1, `con ${u} puntos es nivel ${i + 1}`);
    if (u > 0) assert.equal(nivelDe(u - 1), i, `con ${u - 1} puntos sigue en el ${i}`);
  });
  assert.equal(nivelDe(1_000_000), 9, 'no hay nivel 10');
});

test('lo que no es un conteo cuenta como cero (nivel 1), nunca como NaN', () => {
  for (const x of [-3, NaN, undefined, null, 'abc', Infinity]) assert.equal(nivelDe(x), 1, String(x));
  assert.equal(nivelDe('7'), 2, 'un número en texto se lee');
  assert.equal(nivelDe(4.9), 1, 'los puntos son enteros: 4,9 no llega a 5');
});

test('puntos para subir: lo que falta al umbral siguiente, y null en el nivel 9', () => {
  assert.equal(puntosParaSubir(0), 5);
  assert.equal(puntosParaSubir(4), 1);
  assert.equal(puntosParaSubir(5), 15, 'recién llegado al 2, faltan 15 para el 3');
  assert.equal(puntosParaSubir(2014), 1);
  assert.equal(puntosParaSubir(33014), 1);
  assert.equal(puntosParaSubir(33015), null, 'en el nivel máximo no hay «X puntos para subir»');
  assert.equal(puntosParaSubir(99999), null);
});

test('nombres de nivel: 9 exactos, recortados, sin saltos, y vacío = «Nivel N»', () => {
  const n = sanearNombresNivel(['  Recluta  ', 'Sargento\nprimero', '', 'x'.repeat(50), 7, null, 'a', 'b', 'c', 'sobra']);
  assert.equal(n.length, 9);
  assert.equal(n[0], 'Recluta');
  assert.equal(n[1], 'Sargento primero');
  assert.equal(n[2], '');
  assert.equal(n[3].length, 30);
  assert.equal(n[4], '', 'lo que no es texto queda vacío');
  assert.deepEqual(sanearNombresNivel('no es lista'), new Array(9).fill(''));
  assert.equal(nombreDeNivel(n, 1), 'Recluta');
  assert.equal(nombreDeNivel(n, 3), 'Nivel 3');
  assert.equal(nombreDeNivel(null, 9), 'Nivel 9');
  assert.equal(nombreDeNivel(n, 0), 'Recluta', 'un nivel fuera de rango se acota a 1-9');
});

test('el rótulo: el número siempre, el nombre sólo si lo eligieron (nunca «Nivel 3 · Nivel 3»)', () => {
  const n = sanearNombresNivel(['Recluta']);
  assert.equal(rotuloNivel(1, n), 'Nivel 1 · Recluta');
  assert.equal(rotuloNivel(3, n), 'Nivel 3');
  assert.equal(rotuloNivel(3, null), 'Nivel 3');
});

test('el % de miembros en cada nivel cuenta a todos (los de 0 puntos en el 1)', () => {
  const d = distribucionDeNiveles([0, 0, 3, 5, 20, 33015]);
  assert.equal(d.length, 9);
  assert.deepEqual(d.map((x) => x.cantidad), [3, 1, 1, 0, 0, 0, 0, 0, 1]);
  assert.equal(d[0].pct, 50);
  assert.equal(d[8].pct, 17);
});

test('sin miembros, todos los niveles dicen 0 % (no NaN)', () => {
  assert.ok(distribucionDeNiveles([]).every((x) => x.pct === 0 && x.cantidad === 0));
});
