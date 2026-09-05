// =============================================================================
// La frase de aprendizaje vive en UN lugar, y el fosil de la vieja lo respeta
// =============================================================================
// ⚠️ ESTE TEST CAMBIO DE OBJETO, Y CONVIENE SABER POR QUE.
//
// Antes comparaba la frase entre `injected.js` y `popup.js`, porque estaba escrita
// a mano en los dos. Ya no: la fuente unica es `lib/flow-operaciones.ts`, de donde
// se GENERA `extension/operaciones.js`, y el pre-push falla si quedan desfasados.
// El popup la importa de ahi.
//
// Lo que SI queda escrito a mano es la constante `SENTINELA` de `injected.js`, y a
// proposito: ese archivo corre en el mundo de la PAGINA y se queda congelado hasta
// que alguien hace F5, asi que una pestana abierta desde ayer sigue usandola. Es un
// fosil vivo — y un fosil que dice otra cosa que el catalogo hace que una generacion
// PAGADA no se reconozca.
//
// Asi que lo que se fija ahora es que ese fosil siga siendo uno de los tokens del
// catalogo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OPERACIONES } from '../lib/flow-operaciones';

const inj = readFileSync(
  resolve(import.meta.dirname, '..', 'extension', 'injected.js'), 'utf8',
);

test('el fósil `SENTINELA` de injected.js es una frase del catálogo', () => {
  const m = /const SENTINELA = '([^']+)'/.exec(inj);
  assert.ok(m, 'no encontré SENTINELA en injected.js');
  const frases = OPERACIONES.map((o) => o.frase).filter(Boolean);
  assert.ok(
    frases.includes(m[1]),
    'La frase escrita en injected.js no está en el catálogo.\n\n'
    + 'Ese archivo queda congelado en las pestañas ya abiertas hasta un F5, así que\n'
    + 'sigue siendo el que mide para mucha gente. Si dice algo que el catálogo no\n'
    + 'conoce, esa persona genera un clip, se le cobra, y el puente no lo reconoce.\n\n'
    + 'Frases del catálogo: ' + frases.join(' · '),
  );
});

test('el popup NO tiene la frase escrita a mano', () => {
  // Si vuelve a estar, volvió el desfase que el catálogo vino a cerrar.
  const pop = readFileSync(
    resolve(import.meta.dirname, '..', 'extension', 'popup.js'), 'utf8',
  );
  for (const o of OPERACIONES) {
    if (!o.frase) continue;
    assert.ok(
      !pop.includes(o.frase),
      'La frase de ' + o.op + ' está escrita a mano en popup.js. Tiene que venir del\n'
      + 'catálogo (`import { operacionDe } from \'./operaciones.js\'`), o los dos se\n'
      + 'separan y una letra de diferencia cuesta un clip pagado.',
    );
  }
  assert.ok(pop.includes("from './operaciones.js'"), 'el popup no importa el catálogo');
});
