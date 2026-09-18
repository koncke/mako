// =============================================================================
// El modal de confirmación no borra lo que no conoce
// =============================================================================
// El modal de «tareas recibidas» AUTOGUARDA el borrador cada 900 ms. Armaba cada tarea
// con una lista de campos, así que todo campo que esa lista no nombraba se borraba del
// borrador la primera vez que alguien abría la pantalla, sin error. `deadline` ya estaba
// afuera, y la primera víctima real iba a ser el veredicto del criterio de Mauricio: una
// columna «No clasificadas» que se vacía sola, que cuesta días entender.
//
// PROBADO ROMPIÉNDOLO (17/9): sacando `...f.orig` de `filaAlServer` → 2 de 4 en rojo (los
// dos de «lo que no se edita viaja»). Restaurado → 4/4.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filaAlServer } from '../app/plan/board/TareasRecibidasModal';

const base = {
  titulo: 'Mandar el video del cuadrante', detalle: 'd', prioridad: 'media' as const,
  minuto: 2461, minutos: [2461], incluir: true,
};

test('lo que la pantalla no edita viaja igual al server', () => {
  const orig = { titulo: 'Mandar el video del cuadrante', deadline: '2026-09-30' };
  const p = filaAlServer({ ...base, orig }, 'Cliente: HMO');
  assert.equal(p.deadline, '2026-09-30');
});

test('un campo que el modal NI SIQUIERA conoce también viaja (el veredicto de mañana)', () => {
  const orig = { titulo: 'x', veredicto: { cubeta: 'descartado', regla: '2' } } as unknown as Parameters<typeof filaAlServer>[0]['orig'];
  const p = filaAlServer({ ...base, orig }, undefined);
  assert.deepEqual(p.veredicto, { cubeta: 'descartado', regla: '2' });
});

test('lo que se EDITÓ acá gana sobre el original', () => {
  const orig = { titulo: 'título viejo', detalle: 'viejo', prioridad: 'baja' as const };
  const p = filaAlServer({ ...base, titulo: 'título nuevo', orig }, 'Ventas');
  assert.equal(p.titulo, 'título nuevo');
  assert.equal(p.detalle, 'd');
  assert.equal(p.prioridad, 'media');
  assert.equal(p.proyecto, 'Ventas');
});

test('reasignada a «Mías»: no llega diciendo que es de otro', () => {
  const orig = { titulo: 'x', dueno: 'Laura', duenoEmail: 'laura@x.com', esDeOtro: true };
  const p = JSON.parse(JSON.stringify(filaAlServer({ ...base, orig, esDeOtro: false, dueño: undefined, dueñoEmail: undefined }, undefined)));
  assert.equal(p.esDeOtro, false);
  assert.equal(p.dueno, undefined);
  assert.equal(p.duenoEmail, undefined);
});
