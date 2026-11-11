// «Traer tu outlier»: lo que un negocio trae por su link lo ve SÓLO ese negocio (11/11/2026, mig 0413).
//
// Martín, 11/11/2026: «en los outliers haya una opción para traer tu propio [outlier], pegar el link de Instagram… para poder
// sumarlo entre los outliers». Lo traído vive en la tabla de la biblioteca con `workspace_id` (lib/carruseles/traer-servidor.ts).
// La tabla es global (la lee el server con service_role), así que quién ve qué lo decide una regla pura, `seMuestraA`, que usan
// la lista de la grilla y el «Editar» (lib/carruseles/biblioteca-servidor.ts). Esto la corre y fija:
//   1. lo de la plataforma lo ven todos, y sólo lo revisado (la 0411, cuando se aplique);
//   2. lo traído lo ve SÓLO su negocio, sin esperar la revisión (lo eligió él), y nunca otro negocio ni un script sin negocio;
//   3. `traidaPor` lee el negocio venga como número o como texto (bigint de la base), y nada raro cuenta como negocio;
//   4. `linkDeInstagram` se mudó a ./link.ts y la biblioteca lo sigue exportando igual.
//
// Verificado rompiéndolo (11/11/2026, base 4/0): `seMuestraA` mostrando lo traído a cualquier negocio → cae 2; sin saltear la
// revisión para lo traído → cae 2; `traidaPor` aceptando el 0 → cae 3.
//
// Correr: node --import tsx --test tests/carruseles-traidos.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkDeInstagram as desdeLaBiblioteca, seMuestraA, traidaPor } from '../lib/carruseles/biblioteca';
import { linkDeInstagram } from '../lib/carruseles/link';

const REVISADA = '2026-11-10T10:00:00Z';

test('1 · lo de la plataforma lo ven todos, y sólo lo revisado', () => {
  assert.equal(seMuestraA({ id: 1 }, 3), true, 'sin la columna de la 0411, se ve como siempre');
  assert.equal(seMuestraA({ id: 1, workspace_id: null, revisada_en: REVISADA }, 3), true);
  assert.equal(seMuestraA({ id: 1, workspace_id: null, revisada_en: REVISADA }, null), true, 'un script ve lo de la plataforma');
  assert.equal(seMuestraA({ id: 1, workspace_id: null, revisada_en: null }, 3), false, 'lo que nadie miró, no (0411)');
});

test('2 · lo traído lo ve SÓLO su negocio, sin esperar la revisión, y nunca otro', () => {
  const suya = { id: 2, workspace_id: 3, revisada_en: null };
  assert.equal(seMuestraA(suya, 3), true, 'el negocio que la trajo la ve, aunque nadie la haya revisado');
  assert.equal(seMuestraA(suya, 5), false, 'otro negocio NO la ve');
  assert.equal(seMuestraA(suya, null), false, 'sin saber quién mira, no se muestra');
  assert.equal(seMuestraA({ id: 2, workspace_id: '3' }, 3), true, 'el bigint de la base llega como texto');
  assert.equal(seMuestraA({ id: 2, workspace_id: '3' }, 30), false);
});

test('3 · `traidaPor` lee el negocio, y nada raro cuenta como negocio', () => {
  assert.equal(traidaPor({ workspace_id: 3 }), 3);
  assert.equal(traidaPor({ workspace_id: '12' }), 12);
  for (const raro of [null, undefined, '', 0, -1, 'abc', 1.5]) assert.equal(traidaPor({ workspace_id: raro as never }), null, `«${String(raro)}» no es un negocio`);
  assert.equal(traidaPor({}), null, 'sin la columna (la 0413 sin aplicar): de la plataforma');
});

test('4 · `linkDeInstagram` vive en ./link.ts y la biblioteca lo sigue exportando igual', () => {
  assert.equal(desdeLaBiblioteca, linkDeInstagram);
  assert.deepEqual(linkDeInstagram('https://www.instagram.com/p/DaZFc_kkttt/?igsh=abc'), { ref: 'DaZFc_kkttt', url: 'https://www.instagram.com/p/DaZFc_kkttt/' });
  assert.deepEqual(linkDeInstagram('instagram.com/reel/C97VsS3u6_P'), { ref: 'C97VsS3u6_P', url: 'https://www.instagram.com/p/C97VsS3u6_P/' });
  assert.equal(linkDeInstagram('nature'), null);
  assert.equal(linkDeInstagram('https://www.instagram.com/lifeofarjav/'), null, 'un perfil no es una publicación');
});
