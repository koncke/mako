// =============================================================================
// Rehacer los anuncios planteados SIN borrar guiones (pendiente O19, P0-11, 18/11/2026): lib/razones-fundir.ts
// =============================================================================
// Generar la matriz en la pantalla la reemplaza entera (los guiones, los formatos y los celdaId se pierden). La API la rehace
// FUNDIENDO: lo que tiene trabajo se queda tal cual; lo que no tiene nada se reemplaza; hasta 3 por avatar, sin repetir una
// motivación que ya está. Se EJECUTA `fundirMatriz` y `queQuedaAlRegenerar` con matrices de mentira.
// Correr: node --import tsx --test tests/razones-fundir.test.ts
//
// PROBADO ROMPIÉNDOLO (18/11/2026, una por vez, restaurado; base 6 pasan / 0 fallan):
//   · `tieneTrabajo` sin mirar los guiones (sólo el formato y la imagen)          → 1 / 5 (el 1, 2, 3, 5 y 6);
//   · sin el tope por avatar (`cupo` nunca baja)                                 → 4 / 2 (el 2 y el 6);
//   · sin mirar los nombres repetidos (`nombres.has`)                            → 3 / 3 (el 2, 3 y 6);
//   · `soloAvatar` ignorado (`toca` devuelve siempre true)                       → 5 / 1 (el 4).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fundirMatriz, queQuedaAlRegenerar, tieneTrabajo, RAZONES_POR_AVATAR } from '../lib/razones-fundir';
import { CELDA_GUIONES_PROPIOS } from '../lib/angulos-data';
import type { RazonCelda } from '../lib/razones';
import type { GuionItem } from '../lib/guion-estado';

const guion: GuionItem = { id: 'g1', anguloId: 'dolor', anguloNombre: 'Dolor', texto: 'GANCHO\nHola', creadoEn: 1, estado: 'grabado', estructuraId: '', estructuraNombre: '' };
const celda = (id: string, avatarId: string, nombre: string, extra: Partial<RazonCelda> = {}): RazonCelda => ({
  id, avatarId, nombre, descripcion: `por ${nombre}`, copy: `copy ${nombre}`, guiones: [], imagenUrl: '', anguloImagen: '', anguloVideo: '', ...extra,
});

const ACTUAL: RazonCelda[] = [
  celda('c1', 'a1', 'Un mejor salario', { guiones: [guion] }),
  celda('c2', 'a1', 'Viajar tranquilo'),
  celda('c3', 'a1', 'Un ascenso', { anguloVideo: 'hook-problema' }),
  celda('c4', 'a2', 'Escalar sin perder el control'),
  celda(CELDA_GUIONES_PROPIOS, '', 'Guiones propios', { guiones: [{ ...guion, id: 'g2' }] }),
  celda('c9', 'a-borrado', 'Algo de un avatar que ya no está'),
];
const NUEVAS: RazonCelda[] = [
  celda('n1', 'a1', 'Un mejor salario'),             // repite una que ya tiene trabajo: no entra
  celda('n2', 'a1', 'Dejar de ser el cuello de botella'),
  celda('n3', 'a1', 'Tener más tiempo'),
  celda('n4', 'a2', 'Escalar sin perder el control'), // repite el nombre de una SIN trabajo: ésa se fue, ésta entra
  celda('n5', 'a2', 'Contratar a su primer vendedor'),
  celda('n6', 'a2', 'Dejar las ventas en otras manos'),
  celda('n7', 'a2', 'Una cuarta que no entra'),
];

test('1. lo que tiene trabajo se queda TAL CUAL (mismo id, mismos guiones); lo que no tiene nada se reemplaza', () => {
  const f = fundirMatriz(ACTUAL, NUEVAS, { avatares: ['a1', 'a2'] });
  const ids = f.razones.map((c) => c.id);
  for (const id of ['c1', 'c3', CELDA_GUIONES_PROPIOS]) assert.ok(ids.includes(id), `se perdió «${id}», que tenía trabajo`);
  assert.deepEqual(f.razones.find((c) => c.id === 'c1')?.guiones, [guion], 'los guiones de una celda que se quedó cambiaron');
  assert.equal(f.razones.find((c) => c.id === 'c3')?.anguloVideo, 'hook-problema');
  for (const id of ['c2', 'c4', 'c9']) assert.ok(!ids.includes(id), `«${id}» no tenía nada y no se reemplazó`);
  assert.deepEqual(f.reemplazadas.map((c) => c.id).sort(), ['c2', 'c4', 'c9']);
  assert.deepEqual(f.conservadas.map((c) => c.id).sort(), ['c1', 'c3', CELDA_GUIONES_PROPIOS].sort());
});

test('2. hasta 3 por avatar: las nuevas llenan el lugar que dejaron las que tienen trabajo', () => {
  const f = fundirMatriz(ACTUAL, NUEVAS, { avatares: ['a1', 'a2'] });
  const de = (av: string) => f.razones.filter((c) => c.avatarId === av);
  assert.equal(RAZONES_POR_AVATAR, 3);
  assert.equal(de('a1').length, 3, 'a1 tiene 2 con trabajo: entra UNA nueva');
  assert.deepEqual(de('a1').map((c) => c.id), ['c1', 'c3', 'n2']);
  assert.equal(de('a2').length, 3, 'a2 no tiene nada con trabajo: entran 3 nuevas');
  assert.ok(!f.razones.some((c) => c.id === 'n7'), 'entró una cuarta en a2');
  // Un avatar con 3 celdas con trabajo no recibe ninguna.
  const lleno = ['x1', 'x2', 'x3'].map((id) => celda(id, 'a1', `Motivo ${id}`, { guiones: [guion] }));
  assert.equal(fundirMatriz(lleno, NUEVAS, { avatares: ['a1'] }).agregadas.length, 0);
});

test('3. una motivación que ya está en ese avatar (con otras tildes o mayúsculas) no se repite', () => {
  const f = fundirMatriz(ACTUAL, [celda('n8', 'a1', 'UN MEJOR SALARIÓ'), ...NUEVAS], { avatares: ['a1', 'a2'] });
  assert.ok(!f.agregadas.some((c) => c.avatarId === 'a1' && /salari/i.test(c.nombre)), 'entró «Un mejor salario» otra vez');
  // La del nombre de una SIN trabajo sí entra: ésa se fue.
  assert.ok(f.agregadas.some((c) => c.id === 'n4'));
});

test('4. con `soloAvatar`, las celdas de los otros avatares no se tocan (ni las vacías)', () => {
  const f = fundirMatriz(ACTUAL, NUEVAS, { avatares: ['a1', 'a2'], soloAvatar: 'a2' });
  assert.ok(f.razones.some((c) => c.id === 'c2'), 'se reemplazó una vacía de OTRO avatar');
  assert.ok(f.razones.some((c) => c.id === 'c9'), 'se fue una celda de otro avatar');
  assert.ok(!f.agregadas.some((c) => c.avatarId === 'a1'), 'entraron motivaciones de otro avatar');
  assert.deepEqual(f.reemplazadas.map((c) => c.id), ['c4']);
  const q = queQuedaAlRegenerar(ACTUAL, 'a2');
  assert.deepEqual(q.reemplazadas.map((c) => c.id), ['c4']);
  assert.deepEqual(q.conservadas, []);
});

test('5. qué cuenta como trabajo: un guion, un formato, una imagen, o la celda de los guiones propios', () => {
  assert.equal(tieneTrabajo(celda('z', 'a', 'z')), false);
  assert.equal(tieneTrabajo(celda('z', 'a', 'z', { guiones: [guion] })), true);
  assert.equal(tieneTrabajo(celda('z', 'a', 'z', { anguloImagen: 'checklist' })), true);
  assert.equal(tieneTrabajo(celda('z', 'a', 'z', { imagenUrl: 'https://cdn.ejemplo.test/x.png' })), true);
  assert.equal(tieneTrabajo(celda(CELDA_GUIONES_PROPIOS, '', 'Guiones propios')), true, 'la de los propios se queda aunque esté vacía');
  // El resumen sin IA dice lo mismo que la fusión.
  const q = queQuedaAlRegenerar(ACTUAL);
  const f = fundirMatriz(ACTUAL, NUEVAS, { avatares: ['a1', 'a2'] });
  assert.deepEqual(q.conservadas.map((c) => c.id), f.conservadas.map((c) => c.id));
  assert.deepEqual(q.reemplazadas.map((c) => c.id), f.reemplazadas.map((c) => c.id));
});

test('6. el orden: por avatar (lo que se queda primero, las nuevas detrás), y al final lo que no es de ningún avatar de hoy', () => {
  const f = fundirMatriz(ACTUAL, NUEVAS, { avatares: ['a1', 'a2'] });
  assert.deepEqual(f.razones.map((c) => c.id), ['c1', 'c3', 'n2', 'n4', 'n5', 'n6', CELDA_GUIONES_PROPIOS]);
});
