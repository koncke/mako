// Reusar el escenario ya generado, en vez de volver a pagarlo.
//
// Cada imagen de escenario es una generación que se cobra y una espera que la
// persona mira. En Car Talks hay UNA por anuncio; en The Office hay CUATRO.
// Alguien que hace su segundo anuncio del mismo formato volvía a pasar por todo
// eso para llegar al mismo lugar.
//
// Lo que estos tests cuidan es lo OTRO: que no se le ofrezca a nadie una imagen
// de un lugar que su guion no menciona. Eso no da error — da un anuncio donde lo
// que se ve no tiene nada que ver con lo que se dice.

import test from 'node:test';
import assert from 'node:assert/strict';
import { escenariosReusables, cuantosSeReusan, claveDeLugar } from '../app/video-generator/escenario-reuso';
import type { PlanGuardado } from '../app/video-generator/video-datos';

const plan = (id: string, puestaId: string, escenas: { n: number; lugar: string }[], imagenes: Record<string, unknown> = {}): PlanGuardado => ({
  id,
  plan: { puestaId, titulo: `Anuncio ${id}`, duracionTotalSeg: 0, ritmo: '', deCorrido: '', clips: [] },
  escenas: escenas.map((e) => ({ ...e, desde: 1, hasta: 1, prompt: '' })),
  imagenes,
} as unknown as PlanGuardado);

/** Una imagen que SÍ sirve para filmar: confirmada, con url y con mediaId. */
const buena = (n: string) => ({ elegida: `https://x/${n}.jpg`, elegidaId: `media-${n}`, confirmada: true });

test('reusa la imagen de un anuncio anterior con el MISMO lugar y formato', () => {
  const viejo = plan('v', 'plano-secuencia', [{ n: 1, lugar: 'El open space' }], { '1': buena('a') });
  const nuevo = plan('n', 'plano-secuencia', [{ n: 1, lugar: 'El open space' }]);
  const r = escenariosReusables(nuevo, [viejo]);
  assert.equal(r.length, 1);
  assert.equal(r[0].escena, 1);
  assert.equal(r[0].mediaId, 'media-a');
});

test('⚠️ NO reusa entre lugares distintos, aunque el formato sea el mismo', () => {
  // Un escenario no es del FORMATO: es del LUGAR. Reusar por formato pondría a la
  // persona en un sitio que su guion no menciona, y eso no da error: da un
  // anuncio donde lo que se ve no tiene nada que ver con lo que se dice.
  const viejo = plan('v', 'plano-secuencia', [{ n: 1, lugar: 'La cocina de la oficina' }], { '1': buena('a') });
  const nuevo = plan('n', 'plano-secuencia', [{ n: 1, lugar: 'La sala de juntas' }]);
  assert.deepEqual(escenariosReusables(nuevo, [viejo]), []);
});

test('⚠️ NO reusa entre FORMATOS distintos, aunque el lugar se llame igual', () => {
  // «La oficina» en Car Talks es un selfie de brazo estirado; en The Office es un
  // plano de seguimiento. El lugar coincide y la foto no sirve.
  const viejo = plan('v', 'selfie-movimiento', [{ n: 1, lugar: 'La oficina' }], { '1': buena('a') });
  const nuevo = plan('n', 'plano-secuencia', [{ n: 1, lugar: 'La oficina' }]);
  assert.deepEqual(escenariosReusables(nuevo, [viejo]), []);
});

test('el lugar se compara como CLAVE: acentos, mayúsculas y puntuación no cuentan', () => {
  // Es la lección ya pagada en este repo: dos nombres que difieren en un acento se
  // ven idénticos en cualquier listado y en cualquier log.
  assert.equal(claveDeLugar('La Oficina.'), claveDeLugar('la oficina'));
  assert.equal(claveDeLugar('El  open   space'), claveDeLugar('El open space'));
  const viejo = plan('v', 'plano-secuencia', [{ n: 1, lugar: 'La Recepción.' }], { '1': buena('a') });
  const nuevo = plan('n', 'plano-secuencia', [{ n: 1, lugar: 'la recepcion' }]);
  assert.equal(escenariosReusables(nuevo, [viejo]).length, 1);
});

test('⚠️ NO ofrece una imagen SIN mediaId, aunque se vea bien', () => {
  // La url vence a las ~6 h; el mediaId no, y es con lo que el clip se anima. Una
  // reutilización sin él se vería perfecta en la pantalla y no se podría filmar.
  const viejo = plan('v', 'plano-secuencia', [{ n: 1, lugar: 'X' }], { '1': { elegida: 'https://x/a.jpg', confirmada: true } });
  assert.deepEqual(escenariosReusables(plan('n', 'plano-secuencia', [{ n: 1, lugar: 'X' }]), [viejo]), []);
});

test('⚠️ NO ofrece una imagen que la persona no CONFIRMÓ', () => {
  // Elegir no es confirmar: preseleccionada por la llegada de una variante no es
  // lo mismo que mirada y aprobada. Reusar una no confirmada propaga una decisión
  // que nadie tomó.
  const viejo = plan('v', 'plano-secuencia', [{ n: 1, lugar: 'X' }], { '1': { elegida: 'https://x/a.jpg', elegidaId: 'm', confirmada: false } });
  assert.deepEqual(escenariosReusables(plan('n', 'plano-secuencia', [{ n: 1, lugar: 'X' }]), [viejo]), []);
});

test('⚠️ NO se ofrece sobre un escenario que ESTE plan ya tiene', () => {
  // Sería proponerle a alguien deshacer su propio trabajo, con un clic que no
  // dice qué se lleva puesto.
  const viejo = plan('v', 'plano-secuencia', [{ n: 1, lugar: 'X' }], { '1': buena('a') });
  const nuevo = plan('n', 'plano-secuencia', [{ n: 1, lugar: 'X' }], { '1': buena('propia') });
  assert.deepEqual(escenariosReusables(nuevo, [viejo]), []);
});

test('gana el anuncio MÁS RECIENTE: el historial viene del más nuevo al más viejo', () => {
  const nuevoViejo = plan('v2', 'plano-secuencia', [{ n: 1, lugar: 'X' }], { '1': buena('reciente') });
  const antiguo = plan('v1', 'plano-secuencia', [{ n: 1, lugar: 'X' }], { '1': buena('antiguo') });
  const r = escenariosReusables(plan('n', 'plano-secuencia', [{ n: 1, lugar: 'X' }]), [nuevoViejo, antiguo]);
  assert.equal(r[0].mediaId, 'media-reciente');
});

test('no se reusa a sí mismo', () => {
  const p = plan('n', 'plano-secuencia', [{ n: 1, lugar: 'X' }, { n: 2, lugar: 'X' }], { '1': buena('a') });
  // La escena 2 tiene el mismo lugar que la 1, pero la 1 es de ESTE plan.
  assert.deepEqual(escenariosReusables(p, [p]), []);
});

test('cuenta cuántos se llenarían sin generar nada', () => {
  // Es el número que va en la pantalla. Sin él, la oferta es una casilla más que
  // nadie sabe si le conviene.
  const viejo = plan('v', 'plano-secuencia', [
    { n: 1, lugar: 'Recepción' }, { n: 2, lugar: 'Open space' }, { n: 3, lugar: 'Cocina' },
  ], { '1': buena('a'), '2': buena('b'), '3': buena('c') });
  const nuevo = plan('n', 'plano-secuencia', [
    { n: 1, lugar: 'Recepción' }, { n: 2, lugar: 'Open space' }, { n: 3, lugar: 'La terraza' },
  ]);
  assert.equal(cuantosSeReusan(nuevo, [viejo]), 2);
});

test('sin escenas o sin historial, no ofrece nada y no rompe', () => {
  assert.deepEqual(escenariosReusables(plan('n', 'x', []), []), []);
  assert.deepEqual(escenariosReusables(plan('n', 'x', [{ n: 1, lugar: 'X' }]), []), []);
  assert.deepEqual(escenariosReusables(plan('n', 'x', [{ n: 1, lugar: '' }]), []), []);
});
