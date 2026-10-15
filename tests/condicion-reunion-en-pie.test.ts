// =============================================================================
// «Su reunión sigue en pie / ya pasó o se canceló»: la condición VISIBLE de lo que el motor hacía por detrás (14/10/2026)
// =============================================================================
// Martín, 14/10/2026: «Debería justamente existir una CONDITION en el flujo que pueda pausar en el envio si se canceló o
// ya pasó la reunión... jamás que "mako" haga cosas que no están en el flujo». La guarda escondida de `procesarEnvios`
// («la reunión ya pasó», `laReunionYaPaso`) se borra cuando los flujos vivos tengan esta condición
// (docs/diseno-mako-nada-por-detras.md §2.3). Y «Cancelada = no agendó» (decisión de Martín del 14/10): una reunión
// cancelada (la hora quedó, la fecha no) ya no cuenta como agendada en ninguna condición.
//
// PROBADO ROMPIÉNDOLO (14/10/2026), cada rotura de a una y restaurada. Pasan / fallan:
//   R1 `lugarDeFicha` sin mirar la cancelada (lee la hora de una cancelada)               → 4 / 1
//   R2 `finMs` con el mediodía (`msJunta`) en vez del final del día                       → 4 / 1
//   R3 `enPieEntre` sin mirar la asistencia marcada                                        → 4 / 1
//   R4 el lead de «Probar» sin reunión al entrar por «Agenda R1»                           → 4 / 1
//
// Correr: node --import tsx --test tests/condicion-reunion-en-pie.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cumpleCatalogo, condicionPorId, type HechosCatalogo } from '../lib/condiciones-catalogo';
import { catalogoDeLead } from '../lib/nutricion-grafo-motor';
import { hechosDeLeadNuevo } from '../lib/simulador-grafo';
import { PLANTILLAS } from '../lib/plantillas-automatizaciones';
import type { HechosLead } from '../lib/flujo-grafo';

const A_LAS_20_05_MX = Date.parse('2026-10-13T02:05:09Z'); // 12/10 20:05 en México (el bug 5)
const H = (lead: NonNullable<HechosCatalogo['lead']>, ahoraMs = A_LAS_20_05_MX): HechosLead => ({
  etiquetas: new Set(), etapa: null, agendo: false, pago: false, yaContactado: false, respondio: false,
  creadoMs: null, tieneTelefono: true, tieneEmail: false, ahoraMs, catalogo: { lead },
});
const EN_PIE = { campo: 'reunion_en_pie' };
const NO_EN_PIE = { campo: 'reunion_en_pie', no: true };
const enPie = (fila: Record<string, unknown>, ahoraMs = A_LAS_20_05_MX) => cumpleCatalogo(EN_PIE, H(catalogoDeLead(fila, ahoraMs), ahoraMs));

test('la condición existe, se ofrece en «Agenda y llamadas» y se puede negar', () => {
  const c = condicionPorId('reunion_en_pie');
  assert.ok(c);
  assert.equal(c!.seccion, 'Agenda y llamadas');
  assert.deepEqual(c!.rotulo, ['Su reunión sigue en pie', 'Su reunión ya pasó o se canceló']);
  assert.equal(c!.negable, true);
});

test('en pie: con hora por delante, y una fecha SIN hora todo su día; pasada, no', () => {
  assert.equal(enPie({ junta_1_at: '2026-10-14T06:00:00Z', fecha_junta_1: '2026-10-13' }), true);
  assert.equal(enPie({ fecha_junta_1: '2026-10-12' }), true, 'la R1 de hoy sin hora, cargada a la noche (bug 5)');
  assert.equal(enPie({ fecha_junta_1: '2026-10-11' }), false);
  assert.equal(enPie({ junta_1_at: '2026-10-13T01:00:00Z', fecha_junta_1: '2026-10-12' }), false, 'con hora ya pasada');
  // La negada, para cortar: «Su reunión ya pasó o se canceló».
  assert.equal(cumpleCatalogo(NO_EN_PIE, H(catalogoDeLead({ fecha_junta_1: '2026-10-11' }, A_LAS_20_05_MX))), true);
});

test('CANCELADA = no agendó: ni en pie, ni «Tiene reunión agendada»', () => {
  const cancelada = { junta_1_at: '2026-10-14T06:00:00Z', fecha_junta_1: null };
  assert.equal(enPie(cancelada), false);
  const l = catalogoDeLead(cancelada, A_LAS_20_05_MX);
  assert.equal(l.r1.fechaMs, null, 'se leía la hora de una cancelada');
  assert.equal(cumpleCatalogo({ campo: 'reunion_agendada' }, H(l)), false);
  // Sin la fecha en el objeto (`undefined`) no afirma que se canceló.
  assert.equal(enPie({ junta_1_at: '2026-10-14T06:00:00Z' }), true);
});

test('con la asistencia marcada ya no está en pie (la reunión ocurrió)', () => {
  assert.equal(enPie({ junta_1_at: '2026-10-14T06:00:00Z', fecha_junta_1: '2026-10-13', asistio_j1: true }), false);
  assert.equal(enPie({ junta_1_at: '2026-10-14T06:00:00Z', fecha_junta_1: '2026-10-13', asistio_j1: false }), false);
});

test('«Probar»: quien entra por «Agenda R1» tiene reunión; por «Lead entrante», no. Y la plantilla la usa', () => {
  assert.equal(cumpleCatalogo(EN_PIE, hechosDeLeadNuevo({ etapa: 'agenda', ahoraMs: A_LAS_20_05_MX })), true);
  assert.equal(cumpleCatalogo(EN_PIE, hechosDeLeadNuevo({ etapa: 'lead', ahoraMs: A_LAS_20_05_MX })), false);
  const agendo = JSON.stringify(PLANTILLAS.find((p) => p.id === 'lead-agendo')!.pasos);
  assert.ok(agendo.includes('"reunion_en_pie"'));
  assert.ok(!agendo.includes('"reunion_en"'), 'quedó la condición vieja (mediodía, sin canceladas)');
});
