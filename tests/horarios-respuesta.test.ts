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
import { leerRespuestaHorarios, motivoLegible, AVISO_SIN_AGENDA } from '../app/crm/horarios-respuesta';

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

test('fallo de Google: la grilla NO se da por verificada, y el aviso lo explica', () => {
  // Antes esto devolvía los slots del server tal cual. Parecía inofensivo —"perder
  // la ayuda no puede impedir reagendar"— pero esos slots vienen TODOS en
  // `libre: true`, así que la pantalla los pintaba como agenda verificada y el sub
  // prometía "los ocupados se ven tachados" sobre una agenda que nunca se leyó.
  // Con null se sigue pudiendo elegir la hora (SelectorHora arma su propia grilla),
  // pero sin afirmar nada sobre la disponibilidad.
  const r = leerRespuestaHorarios({
    ok: true, codigo: 'api', tz: 'America/Tijuana', slots: [slot('09:00')],
    motivo: 'No pude leer tu agenda (notFound): los horarios de abajo no están verificados.',
  });
  assert.equal(r.slots, null, 'sin verificar no se presenta como grilla real');
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

// La captura de producción: la API de Calendar no estaba habilitada en el proyecto
// de Google Cloud y el párrafo en inglés de Google, con el id del proyecto y un link
// a la consola de desarrolladores, se imprimió arriba de la grilla de horarios.
test('el parrafo crudo de Google no llega nunca a la pantalla', () => {
  const crudo = 'Google Calendar API has not been used in project 118392241323 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=118392241323 then retry.';
  const m = motivoLegible(403, crudo);
  assert.ok(!m.includes('118392241323'), 'no puede filtrar el id del proyecto');
  assert.ok(!m.includes('console.developers.google.com'), 'no puede filtrar la URL de la consola');
  assert.ok(m.includes('habilitar la API de Google Calendar'), 'tiene que decir qué falta hacer');
});

test('con un codigo de error la grilla NO se da por verificada', () => {
  // El server manda la grilla igual (todos libre:true) para que el paso sea usable.
  // Leerla como verificada es lo que prometía "los ocupados se ven tachados" sobre
  // una agenda que nunca se pudo leer.
  const r = leerRespuestaHorarios({
    ok: true, codigo: 'api', motivo: 'No pude leer tu agenda.', tz: 'America/Tijuana',
    slots: [{ hora: '09:00', inicioIso: '2026-08-07T16:00:00.000Z', libre: true }],
  });
  assert.equal(r.slots, null, 'sin verificar = null, no una grilla de libres');
  assert.equal(r.nota, 'No pude leer tu agenda.');
});

test('sin conexion con Google tampoco se dan slots verificados', () => {
  const r = leerRespuestaHorarios({
    ok: true, codigo: 'sin-conexion', motivo: 'No hay una agenda de Google conectada a este espacio.',
    slots: [{ hora: '09:00', inicioIso: '2026-08-07T16:00:00.000Z', libre: true }],
  });
  assert.equal(r.slots, null);
});
