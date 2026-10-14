// =============================================================================
// Una reunión con FECHA y sin hora no pasó hasta que termina su día (bug 5 del feedback del 13/10/2026)
// =============================================================================
// «No salió el mensaje» de «Un Lead Agendó Llamada» (#213, ws1). El lead de prueba (2660, borrado después; lo
// que quedó es su `lead_audit`, que no está atada al lead): Mauricio lo pasó a «Agenda R1» con la R1 «2026-10-12»,
// sin hora, el 13/10 a las 01:57 UTC (19:57 del 12/10 en México). El motor lee una fecha sola como el mediodía de
// México: para él la reunión «ya pasó» y cerró la inscripción sin mandar. A las 02:05 MaKo lo volvió a pasar a la
// etapa y el reuso tampoco arrancó (`reunionQuePreparaMs` = null).
//
// PROBADO ROMPIÉNDOLO (13/10/2026), cada rotura de a una y restaurada. Pasan / fallan:
//   R1 `finDeLaReunionMs` con el mediodía (`T12:00:00`) en vez del final del día        → 2 / 2
//   R2 `laReunionYaPaso` usando siempre `reunionFuturaMs` (sin mirar `anclada`)         → 3 / 1
//   R3 `reunionEnPie` contando una reunión cancelada                                    → 3 / 1
//
// Correr: node --import tsx --test tests/reunion-fecha-sola-del-dia.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reunionEnPie, reunionQuePreparaMs, laReunionYaPaso, reunionFuturaMs } from '../lib/nutricion-reinscripcion';

// Lo que tenía el lead de prueba, y la hora del segundo paso por la etapa.
const LEAD_DE_PRUEBA = { fecha_junta_1: '2026-10-12', junta_1_at: null };
const A_LAS_20_05_MX = Date.parse('2026-10-13T02:05:09Z');

test('el caso de Mauricio: la R1 de HOY sin hora, cargada a la noche, sigue en pie y la bienvenida sale', () => {
  assert.equal(reunionEnPie(LEAD_DE_PRUEBA, A_LAS_20_05_MX), true);
  assert.equal(laReunionYaPaso(LEAD_DE_PRUEBA, { anclada: false }, A_LAS_20_05_MX), false, 'la bienvenida se cerró por «la reunión ya pasó»');
  // El reuso (la segunda vuelta por la etapa) también la ve: devuelve el mediodía, que es la identidad del día.
  assert.equal(reunionQuePreparaMs(LEAD_DE_PRUEBA, A_LAS_20_05_MX), Date.parse('2026-10-12T18:00:00Z'));
});

test('al día siguiente sí pasó', () => {
  const otroDia = Date.parse('2026-10-13T06:00:01Z'); // 00:00:01 del 13/10 en México
  assert.equal(reunionEnPie(LEAD_DE_PRUEBA, otroDia), false);
  assert.equal(laReunionYaPaso(LEAD_DE_PRUEBA, { anclada: false }, otroDia), true);
  assert.equal(reunionQuePreparaMs(LEAD_DE_PRUEBA, otroDia), null);
});

test('un paso ANCLADO («1 h antes») sigue necesitando una hora: pasado el mediodía de una fecha sola, no sale', () => {
  assert.equal(laReunionYaPaso(LEAD_DE_PRUEBA, { anclada: true }, A_LAS_20_05_MX), true);
  assert.equal(reunionFuturaMs(LEAD_DE_PRUEBA, A_LAS_20_05_MX), null, 'la regla del ancla no cambió');
  // Con la hora puesta, manda la hora para los dos.
  const conHora = { fecha_junta_1: '2026-10-12', junta_1_at: '2026-10-13T03:00:00Z' };
  assert.equal(laReunionYaPaso(conHora, { anclada: true }, A_LAS_20_05_MX), false);
  assert.equal(laReunionYaPaso(conHora, { anclada: false }, Date.parse('2026-10-13T03:00:01Z')), true);
});

test('una reunión cancelada (la hora quedó, la fecha no) no está en pie; la R2 sí cuenta', () => {
  assert.equal(reunionEnPie({ junta_1_at: '2026-10-14T17:00:00Z', fecha_junta_1: null }, A_LAS_20_05_MX), false);
  assert.equal(reunionEnPie({ fecha_junta_2: '2026-10-12' }, A_LAS_20_05_MX), true);
  assert.equal(reunionEnPie(null, A_LAS_20_05_MX), false);
});
