// =============================================================================
// El reparto de escenarios y la red que atrapa las caras
// =============================================================================
// Lo que se prueba acá es lo único de este paso que puede fallar EN SILENCIO:
// cuántas imágenes salen, qué tomas cubre cada una, y si un prompt se puso a
// describir una cara. Los tres se descubren tres pasos después —cuando el clip
// sale con la persona equivocada— y para entonces ya se pagaron los créditos.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  repartirEscenas, escenasDeCortes, mencionaCara, validarEscenas, armarEscenas,
} from '../lib/escenas-core';

// ── El reparto parejo ───────────────────────────────────────────────────────

test('reparte las tomas en bloques contiguos que cubren todo', () => {
  const r = repartirEscenas(9, 4);
  assert.equal(r.length, 4);
  assert.equal(r[0].desde, 1);
  assert.equal(r[r.length - 1].hasta, 9);
  // Contiguo y sin huecos: la toma que sigue arranca donde terminó la anterior.
  for (let i = 1; i < r.length; i++) assert.equal(r[i].desde, r[i - 1].hasta + 1);
});

test('los bloques de más van adelante, que es donde más pasa', () => {
  assert.deepEqual(
    repartirEscenas(9, 4).map((x) => x.hasta - x.desde + 1),
    [3, 2, 2, 2],
  );
});

test('nunca más escenarios que tomas', () => {
  // Dos imágenes para una sola toma es un escenario que el guion no tiene.
  assert.equal(repartirEscenas(2, 5).length, 2);
});

test('una sola toma da un solo escenario que la cubre', () => {
  assert.deepEqual(repartirEscenas(1, 1), [{ desde: 1, hasta: 1 }]);
});

// ── Los cortes que propone el modelo ────────────────────────────────────────

test('los cortes válidos se convierten en rangos que llegan hasta la última toma', () => {
  assert.deepEqual(escenasDeCortes(8, [1, 3, 6]), [
    { desde: 1, hasta: 2 }, { desde: 3, hasta: 5 }, { desde: 6, hasta: 8 },
  ]);
});

test('un corte que no arranca en la toma 1 se rechaza', () => {
  // Si el primer escenario empieza en la 2, la toma 1 no se filma en ningún lado.
  assert.equal(escenasDeCortes(8, [2, 5]), null);
});

test('dos escenarios que arrancan en la misma toma se rechazan', () => {
  // Uno de los dos quedaría sin ninguna toma, y su imagen no ilustraría nada.
  assert.equal(escenasDeCortes(8, [1, 3, 3]), null);
});

test('un corte fuera del guion se rechaza', () => {
  assert.equal(escenasDeCortes(5, [1, 9]), null);
  assert.equal(escenasDeCortes(5, [1, 2.5]), null);
});

// ── La red de las caras ─────────────────────────────────────────────────────

test('marca un prompt que se puso a describir la cara', () => {
  assert.ok(mencionaCara('A man with a short beard sits in a modern office').length > 0);
  assert.ok(mencionaCara('close up of the eyes, warm light').length > 0);
  assert.ok(mencionaCara('plano del rostro, luz cálida').length > 0);
});

test('un prompt de composición pura pasa limpio', () => {
  assert.deepEqual(
    mencionaCara(
      'Vertical 9:16 photo of a modern office at golden hour, the subject walking '
      + 'past glass partitions, 35mm lens, medium shot, warm window light, realistic',
    ),
    [],
  );
});

// ── La validación de la respuesta ───────────────────────────────────────────

const PROMPT_OK = 'Vertical 9:16 photograph of a sunlit modern office at golden hour, '
  + 'the subject walking past glass partitions, 35mm lens, medium shot, realistic';

const crudo = (escenas: unknown) => JSON.stringify({ escenas });

test('acepta una respuesta bien formada', () => {
  const v = validarEscenas(
    crudo([
      { desdeToma: 1, lugar: 'La recepción', prompt: PROMPT_OK },
      { desdeToma: 4, lugar: 'La sala de juntas', prompt: PROMPT_OK },
    ]),
    2, 6,
  );
  assert.ok(v);
  assert.deepEqual(v.cortes, [1, 4]);
});

test('rechaza una cantidad distinta de la que pide el formato', () => {
  // La cantidad es un dato del catálogo, no una sugerencia: una imagen de más es
  // un escenario que el guion no tiene.
  const tres = [
    { desdeToma: 1, lugar: 'A', prompt: PROMPT_OK },
    { desdeToma: 3, lugar: 'B', prompt: PROMPT_OK },
    { desdeToma: 5, lugar: 'C', prompt: PROMPT_OK },
  ];
  assert.equal(validarEscenas(crudo(tres), 2, 6), null);
  assert.equal(validarEscenas(crudo(tres.slice(0, 1)), 2, 6), null);
});

test('rechaza un prompt que describe la cara, aunque todo lo demás esté bien', () => {
  assert.equal(
    validarEscenas(
      crudo([{ desdeToma: 1, lugar: 'La oficina', prompt: `${PROMPT_OK}, a smiling man with grey hair` }]),
      1, 4,
    ),
    null,
  );
});

test('rechaza un prompt vacío o de una línea', () => {
  assert.equal(validarEscenas(crudo([{ desdeToma: 1, lugar: 'A', prompt: 'an office' }]), 1, 4), null);
  assert.equal(validarEscenas(crudo([{ desdeToma: 1, lugar: '', prompt: PROMPT_OK }]), 1, 4), null);
});

test('rechaza lo que no es JSON, sin lanzar', () => {
  assert.equal(validarEscenas('esto no es json', 1, 4), null);
  assert.equal(validarEscenas('{"otraCosa":1}', 1, 4), null);
});

// ── El armado ───────────────────────────────────────────────────────────────

test('cuando los cortes del modelo valen, se usan', () => {
  const e = armarEscenas(6, 2, {
    cortes: [1, 5], lugares: ['La calle', 'El auto'], prompts: [PROMPT_OK, PROMPT_OK],
  });
  assert.deepEqual(e.map((x) => [x.desde, x.hasta]), [[1, 4], [5, 6]]);
  assert.equal(e[1].lugar, 'El auto');
});

test('cuando los cortes no valen, cae al reparto parejo en vez de romperse', () => {
  // Un paso de imágenes que se cae porque un modelo devolvió mal una lista de
  // números deja a la persona sin anuncio por una razón que no es suya.
  const e = armarEscenas(6, 2, {
    cortes: [4, 2], lugares: ['A', 'B'], prompts: [PROMPT_OK, PROMPT_OK],
  });
  assert.deepEqual(e.map((x) => [x.desde, x.hasta]), [[1, 3], [4, 6]]);
});

test('las escenas salen numeradas desde 1, que es como las nombra la persona', () => {
  const e = armarEscenas(4, 2, { cortes: [1, 3], lugares: ['A', 'B'], prompts: [PROMPT_OK, PROMPT_OK] });
  assert.deepEqual(e.map((x) => x.n), [1, 2]);
});
