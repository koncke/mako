// El «En 30 min tienes la R1» al dueño (`mandarRecordatoriosDeReunion`) sale sólo por una reunión de verdad:
// con la fecha de su hora, sin asistencia marcada y dentro de la ventana. Lo encontró la revisión del ws9
// (10/10/2026): miraba sólo la hora, y una cancelación de Calendly borra la fecha y deja la hora.
//
// ROTURAS (10/10/2026), restaurando de memoria, base 4 / 0:
//   D1. sin mirar la fecha (`!j.fecha`)                 → 3 / 1
//   D2. sin `fechaCoincide`                             → 3 / 1
//   D3. sin mirar la asistencia                         → 3 / 1
//   D4. gana la R1 cuando caen las dos                  → 3 / 1
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reunionParaElDueno, type FilaJuntas } from '../lib/recordatorio-lead';

const AHORA = Date.parse('2026-10-10T15:00:00Z');
const EN_20 = '2026-10-10T15:20:00Z';
const base: FilaJuntas = { junta_1_at: null, junta_2_at: null, fecha_junta_1: null, fecha_junta_2: null, asistio_j1: null, asistio_j2: null };
const elegir = (l: Partial<FilaJuntas>) => reunionParaElDueno({ ...base, ...l }, AHORA, 30, 5, 'America/Argentina/Buenos_Aires');

test('una reunión en 20 min, con su fecha: se avisa', () => {
  assert.deepEqual(elegir({ junta_1_at: EN_20, fecha_junta_1: '2026-10-10' }), { cual: 'R1', inicio: EN_20 });
});

test('cancelada (la hora quedó y la fecha no) u otro día: NO se avisa', () => {
  assert.equal(elegir({ junta_1_at: EN_20, fecha_junta_1: null }), null, 'avisa de una reunión cancelada');
  assert.equal(elegir({ junta_1_at: EN_20, fecha_junta_1: '2026-10-17' }), null, 'avisa con una hora que quedó vieja');
});

test('con la asistencia ya marcada no se avisa; si caen las dos, gana la R2', () => {
  assert.equal(elegir({ junta_1_at: EN_20, fecha_junta_1: '2026-10-10', asistio_j1: true }), null);
  const r2 = '2026-10-10T15:25:00Z';
  assert.equal(elegir({ junta_1_at: EN_20, fecha_junta_1: '2026-10-10', junta_2_at: r2, fecha_junta_2: '2026-10-10' })?.cual, 'R2');
});

test('el aviso al dueño elige con esa función y lee las fechas', () => {
  const src = readFileSync(new URL('../lib/reunion-recordatorio.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /\.select\('id, nombre, junta_1_at, junta_2_at, fecha_junta_1, fecha_junta_2, asistio_j1, asistio_j2, estado_lead'\)/);
  assert.match(src, /const r = reunionParaElDueno\(lead, ahora, MINUTOS_ANTES, TOLERANCIA_MIN, tz\);/);
});
