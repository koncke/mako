// =============================================================================
// Las reuniones de la línea de tiempo salen del EMBUDO de ese lead
// =============================================================================
// `buildJourney` (lib/journey.ts) hablaba de «Reunión 1» y «Reunión 2» cableadas,
// mientras el Kanban de al lado mostraba los nombres que el negocio le puso a sus
// etapas `kind: 'reunion'`. Acá se fija que:
//   · el rótulo es el del embudo, y el ORDEN también;
//   · sin embudo se conserva EXACTAMENTE lo de antes (un chequeo que no puede
//     mirar se abstiene);
//   · una reunión sin slot (la 3ª: `leads` sólo tiene fecha_junta_1/_2) se dibuja
//     cuando el lead está parado ahí, declarando que su fecha no se registra;
//   · un slot CON DATO que el embudo de hoy ya no reclama no se esconde.
//
// PROBADO ROMPIÉNDOLO (04/10/2026), una rotura por aserción:
//   1. `label: et.label` → `ROTULO_FIJO[slot.cual]`     → 4 fallos, 10 pases
//   2. `reunionesDelRecorrido` ignorando `etapas`        → 5 fallos,  9 pases
//   3. el `if (i.etapaActual === …)` de la 3ª → `if (false)` → 1 fallo, 13 pases
//   4. borrando el barrido de slots huérfanos (`vistos`) → 1 fallo, 13 pases
// (14 tests en total: este archivo + tests/journey.test.ts, que son los dos que
//  tocan buildJourney).
// Correr: npx tsx --test tests/journey-reuniones-embudo.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildJourney, type EtapaReunion, type JourneyInput, type JourneyStep } from '../lib/journey';
import { DEFAULT_PIPELINE } from '../lib/pipeline';

const base = (p: Partial<JourneyInput> = {}): JourneyInput => ({
  createdISO: '2026-01-15', fechaAgenda: null, fechaJ1: null, asistioJ1: null,
  fechaJ2: null, asistioJ2: null, fechaConfirmacion: null, fechaPrimerPago: null,
  fechaCierre: null, estadoLead: 'abierto', monto: 0, hoyISO: '2026-02-01', ...p,
});
const byKey = (steps: JourneyStep[], k: string) => steps.find((s) => s.key === k);
const labels = (steps: JourneyStep[]) => steps.map((s) => s.label);

// Un embudo de tres reuniones con nombres propios, como el de un negocio que
// configuró su funnel. Las etapas que no son reunión están a propósito: el filtro
// mira `kind`, no el nombre ni la posición.
const EMBUDO_3: EtapaReunion[] = [
  { key: 'entra', label: 'Entró', kind: 'entrada' },
  { key: 'diagnostico', label: 'Diagnóstico', kind: 'reunion' },
  { key: 'propuesta', label: 'Propuesta', kind: 'reunion' },
  { key: 'cierrecall', label: 'Llamada de cierre', kind: 'reunion' },
  { key: 'factura', label: 'Facturando', kind: 'pago' },
];

test('el rótulo de cada reunión es el del embudo, y en su orden', () => {
  const s = buildJourney(base({
    etapas: EMBUDO_3,
    fechaJ1: '2026-01-20', asistioJ1: true,
    fechaJ2: '2026-01-28', asistioJ2: false,
  }));
  // Slot 0 = la PRIMERA reunión del embudo, slot 1 = la segunda. El orden lo
  // decide el pipeline, no el nombre del campo.
  assert.equal(byKey(s, 'r1')!.label, 'Diagnóstico');
  assert.equal(byKey(s, 'r2')!.label, 'Propuesta');
  // Y el estado de cada una sigue saliendo de su asistencia.
  assert.equal(byKey(s, 'r1')!.state, 'done');
  assert.equal(byKey(s, 'r2')!.state, 'failed');
  assert.deepEqual(labels(s), ['Entró como lead', 'Diagnóstico', 'Propuesta', 'En proceso']);
});

test('sin embudo, los rótulos son los de siempre (nada se inventa)', () => {
  const sinNada = buildJourney(base({ fechaJ1: '2026-01-20', fechaJ2: '2026-01-28' }));
  assert.equal(byKey(sinNada, 'r1')!.label, 'Reunión 1');
  assert.equal(byKey(sinNada, 'r2')!.label, 'Reunión 2');
  // Un embudo SIN ninguna etapa `kind: 'reunion'` es el mismo caso: no se puede
  // saber cómo las llama, así que se usan los fijos — y la fecha no se esconde.
  const sinReuniones = buildJourney(base({
    etapas: [{ key: 'entra', label: 'Entró', kind: 'entrada' }],
    fechaJ1: '2026-01-20',
  }));
  assert.equal(byKey(sinReuniones, 'r1')!.label, 'Reunión 1');
});

test('el embudo por defecto nombra sus reuniones como el Kanban', () => {
  // DEFAULT_PIPELINE marca 'agenda' y 'agendaj2' como reunión (PIPELINE_KIND), y
  // sus rótulos de catálogo son los que el dueño ve en las columnas.
  const s = buildJourney(base({ etapas: DEFAULT_PIPELINE, fechaJ1: '2026-01-20', fechaJ2: '2026-01-28' }));
  assert.equal(byKey(s, 'r1')!.label, 'Agenda R1');
  assert.equal(byKey(s, 'r2')!.label, 'Agenda R2');
});

test('la 3ª reunión no tiene slot: sólo se dibuja si el lead está parado ahí', () => {
  // Sin estar ahí no hay nada que decir, y un renglón permanente que no informa
  // nada se lee como ruido.
  const lejos = buildJourney(base({ etapas: EMBUDO_3, fechaJ1: '2026-01-20', etapaActual: 'diagnostico' }));
  assert.equal(byKey(lejos, 'reu-cierrecall'), undefined);
  // Parado ahí, aparece y DICE que su fecha no se registra: omitirla dejaría la
  // línea de tiempo terminando antes de donde el lead está.
  const ahi = buildJourney(base({ etapas: EMBUDO_3, fechaJ1: '2026-01-20', asistioJ1: true, etapaActual: 'cierrecall' }));
  const tercera = byKey(ahi, 'reu-cierrecall')!;
  assert.equal(tercera.label, 'Llamada de cierre');
  assert.equal(tercera.sub, 'Sin fecha registrada');
  assert.equal(tercera.date, null);
  assert.equal(tercera.state, 'pending');
  // Y va DESPUÉS de las dos que sí tienen columnas.
  assert.ok(ahi.indexOf(tercera) > ahi.findIndex((p) => p.key === 'r1'));
});

test('un slot con dato que el embudo ya no reclama se dibuja igual', () => {
  // Embudo reconfigurado a UNA sola reunión, con un lead que ya tenía la segunda
  // hecha. La fecha es un hecho que pasó: esconderla sería perder una medición
  // por un cambio de configuración.
  const unaSola: EtapaReunion[] = [{ key: 'diagnostico', label: 'Diagnóstico', kind: 'reunion' }];
  const s = buildJourney(base({ etapas: unaSola, fechaJ1: '2026-01-20', asistioJ1: true, fechaJ2: '2026-01-28', asistioJ2: true }));
  assert.equal(byKey(s, 'r1')!.label, 'Diagnóstico');
  const r2 = byKey(s, 'r2')!;
  assert.equal(r2.label, 'Reunión 2');
  assert.equal(r2.date, '28/01/2026');
});

test('R1 sigue cayendo a fecha_agenda, con el rótulo del embudo', () => {
  const s = buildJourney(base({ etapas: EMBUDO_3, fechaAgenda: '2026-03-05' }));
  const r1 = byKey(s, 'r1')!;
  assert.equal(r1.label, 'Diagnóstico');
  assert.equal(r1.date, '05/03/2026');
  assert.equal(r1.sub, 'Agendada'); // futura respecto de hoyISO
});
