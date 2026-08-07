// El contrato cliente↔server de /api/crm/horarios (app/crm/horarios-respuesta.ts).
//
// El server hacía bien su parte y la pantalla rompía las dos mitades de la
// respuesta: descartaba el `motivo` cuando el `codigo` era 'ok' y leía
// `slots: []` como "no se sabe". Resultado: a las 19:40 el paso "¿A qué hora?"
// ofrecía la jornada entera de HOY como disponible, sin un solo aviso, y el
// reagendado quedaba en el pasado — el lead volvía al worklist al instante y con
// la asistencia recién borrada. Estos tests son el candado de eso.
// Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerRespuestaHorarios, AVISO_SIN_AGENDA } from '../app/crm/horarios-respuesta';

const slot = (hora: string) => ({ hora, inicioIso: `2026-08-10T${hora}:00.000Z`, libre: true });

test('ok con horarios: la grilla es la del server y no hay nada que aclarar', () => {
  const r = leerRespuestaHorarios({ ok: true, codigo: 'ok', motivo: '', tz: 'America/Tijuana', slots: [slot('09:00'), slot('09:30')] });
  assert.equal(r.slots?.length, 2);
  assert.equal(r.tz, 'America/Tijuana');
  assert.equal(r.nota, '');
  assert.equal(r.errorTecnico, null);
});

test('ok con AVISO: el motivo se muestra igual (no es un error)', () => {
  // El caso caro: hoy ya pasaron todos los horarios.
  const r = leerRespuestaHorarios({
    ok: true, codigo: 'ok', tz: 'America/Tijuana', slots: [],
    motivo: 'Ya pasaron todos los horarios de hoy: elegí otro día o cargá la hora a mano.',
  });
  assert.match(r.nota, /Ya pasaron todos los horarios/);
});

test('slots vacío NO es "no se sabe": se devuelve la lista vacía, no null', () => {
  // Si esto vuelve a ser null, SelectorHora dibuja 9:00–19:00 completo y todo
  // elegible: la jornada de un día que ya pasó, pintada como disponible.
  const r = leerRespuestaHorarios({ ok: true, codigo: 'ok', tz: 'America/Tijuana', slots: [], motivo: 'x' });
  assert.deepEqual(r.slots, []);
  assert.notEqual(r.slots, null);
});

test('fallo de Google: la grilla llega igual y el aviso lo explica', () => {
  const r = leerRespuestaHorarios({
    ok: true, codigo: 'api', tz: 'America/Tijuana', slots: [slot('09:00')],
    motivo: 'No pude leer tu agenda (notFound): los horarios de abajo no están verificados.',
  });
  assert.equal(r.slots?.length, 1, 'perder la ayuda no puede impedir reagendar');
  assert.match(r.nota, /no están verificados/);
});

test('codigo distinto de ok y sin motivo: igual se avisa algo', () => {
  const r = leerRespuestaHorarios({ ok: true, codigo: 'sin-conexion', slots: [slot('09:00')] });
  assert.equal(r.nota, AVISO_SIN_AGENDA);
});

test('el error crudo del server va a la consola, nunca a la pantalla', () => {
  // 401 con el modal abierto: mostrar "No autorizado" es el mensaje más
  // alarmante y menos accionable de todo el camino.
  const r = leerRespuestaHorarios({ ok: false, error: 'No autorizado' });
  assert.equal(r.slots, null, 'sin datos = no se sabe = grilla de siempre');
  assert.equal(r.nota, AVISO_SIN_AGENDA);
  assert.equal(r.errorTecnico, 'No autorizado');
  assert.ok(!r.nota.includes('No autorizado'));
});

test('respuesta rota o vacía no explota', () => {
  for (const j of [null, undefined, {}, { ok: true }, { ok: true, slots: 'nope' } as never]) {
    const r = leerRespuestaHorarios(j as never);
    assert.equal(r.slots, null);
    assert.equal(r.nota, AVISO_SIN_AGENDA);
  }
});
