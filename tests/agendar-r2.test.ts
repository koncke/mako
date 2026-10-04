// =============================================================================
// Agendar la R2 desde la ficha — las dos cosas que fallan en silencio
// =============================================================================
// De todo el camino (botón → huecos → reserva), lo único que puede dar un
// resultado PLAUSIBLE Y EQUIVOCADO es lo que vive en app/crm/agendar-r2.ts:
//
//  1. a qué DÍA pertenece un hueco. Calendly manda instantes en UTC y el negocio
//     vive en otra zona: el error no es un crash, es la reunión reservada el día
//     anterior a la noche con la pantalla diciendo que es al otro día.
//  2. qué `startIso` corresponde a la hora elegida. El selector acepta texto
//     libre, y Calendly no acepta más horario que los que él devolvió.
//
// PROBADO ROMPIENDO CADA COSA (con el código como está: 5 pases, 0 fallos):
//   · agrupar por `startIso.slice(0,10)` en vez de por la zona  → 2 / 3
//     (caen los tres primeros: las 20:00 del lunes se van al martes, así que el
//      lunes pierde una hora y el `startIso` de esa hora deja de resolver)
//   · `startIsoDe` compara la hora con `startsWith` en vez de `===`  → 4 / 1
//   · `startIsoDe` cae al primer hueco del día cuando no encuentra la hora  → 4 / 1
//   · `puedeAgendarR2` devuelve sólo `calendlyConectada`  → 4 / 1
//   · `puedeAgendarR2` acepta el event type con `!!` en vez de `.trim()`  → 4 / 1
//
// ⚠️ Y DOS ROTURAS QUE NO FALLARON, que es lo que la rotura enseñó: `labelDeDia`
// tiene DOS defensas contra el corrimiento de día (formatear el MEDIODÍA, y
// formatear en UTC) y cada una alcanza sola.
//   · `new Date(dia)` en vez del mediodía, con timeZone UTC   → 5 / 0
//   · timeZone de la zona del negocio, con el mediodía puesto → 5 / 0
//   · LAS DOS A LA VEZ → 4 / 1, con `actual: 'dom 4 oct'` contra `'lun 5 oct'`
// O sea que el bug necesita las dos y el test lo caza. Romper de a una habría
// dejado concluir que la aserción no mide nada — y es al revés: mide un invariante
// que está protegido dos veces, a propósito.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agruparHuecos, labelDeDia, puedeAgendarR2, slotsDelDia, startIsoDe } from '../app/crm/agendar-r2';

const TJ = 'America/Tijuana';

// Tres huecos REALES de la forma en que los manda Calendly (ISO en UTC). Los dos
// primeros son el MISMO día en Tijuana aunque uno de ellos ya sea el día
// siguiente en UTC; el tercero es el día siguiente de verdad.
const HUECOS = [
  { startIso: '2026-10-06T03:00:00.000000Z' }, // lun 05, 20:00 en TJ  ← el que miente
  { startIso: '2026-10-05T16:30:00.000000Z' }, // lun 05, 09:30 en TJ
  { startIso: '2026-10-06T17:00:00.000000Z' }, // mar 06, 10:00 en TJ
];

test('el día de un hueco sale de la ZONA DEL NEGOCIO, no del ISO en UTC', () => {
  const dias = agruparHuecos(HUECOS, TJ);

  // Dos días, no tres: las 20:00 del lunes pertenecen al LUNES.
  assert.deepEqual(dias.map((d) => d.dia), ['2026-10-05', '2026-10-06']);
  assert.deepEqual(dias[0].horas.map((h) => h.hora), ['09:30', '20:00'], 'ordenadas, y las dos en el lunes');
  assert.deepEqual(dias[1].horas.map((h) => h.hora), ['10:00']);

  // Y el instante viaja INTACTO: es lo único que Calendly acepta.
  assert.equal(dias[0].horas[1].startIso, '2026-10-06T03:00:00.000000Z');

  // La misma lista en otra zona se agrupa distinto, que es la prueba de que la
  // zona manda de verdad: en Madrid ese hueco es el 6 a las 05:00.
  const mad = agruparHuecos(HUECOS, 'Europe/Madrid');
  assert.deepEqual(mad.map((d) => d.dia), ['2026-10-05', '2026-10-06']);
  assert.deepEqual(mad[1].horas.map((h) => h.hora), ['05:00', '19:00']);
});

test('⚠️ una hora que Calendly NO ofreció no tiene startIso: devuelve null', () => {
  const dias = agruparHuecos(HUECOS, TJ);

  // Lo que sí existe, exacto.
  assert.equal(startIsoDe(dias, '2026-10-05', '09:30'), '2026-10-05T16:30:00.000000Z');

  // Y lo que el campo de texto libre del selector deja escribir. Ninguna de estas
  // puede reservarse: Calendly rechaza cualquier `start_time` que no sea uno de
  // los suyos, no redondea ni busca el más cercano.
  assert.equal(startIsoDe(dias, '2026-10-05', '20:15'), null, '«20:15» está entre dos huecos y no es ninguno');
  assert.equal(startIsoDe(dias, '2026-10-05', '09:3'), null, 'una hora a medio tipear no es un prefijo válido');
  assert.equal(startIsoDe(dias, '2026-10-05', '10:00'), null, 'esa hora existe, pero en el OTRO día');
  assert.equal(startIsoDe(dias, '2026-10-07', '09:30'), null, 'un día sin huecos');
  assert.equal(startIsoDe([], '2026-10-05', '09:30'), null, 'sin lista no hay nada que reservar');
});

test('slotsDelDia los da todos LIBRES, y vacío es un dato (no «el día entero»)', () => {
  const dias = agruparHuecos(HUECOS, TJ);
  assert.deepEqual(slotsDelDia(dias, '2026-10-05'), [
    { hora: '09:30', libre: true },
    { hora: '20:00', libre: true },
  ]);
  // ⚠️ `[]` y no `null`: SelectorHora con `null` ofrece la jornada completa sin
  // ocultar nada —correcto cuando no se pudo verificar la agenda, mentira acá—.
  assert.deepEqual(slotsDelDia(dias, '2026-10-09'), []);
});

test('el nombre del día no se corre: el 2026-10-05 es lunes, no domingo', () => {
  // `new Date('2026-10-05')` es medianoche UTC; pintarla en Tijuana (UTC-7) da el
  // 4 de octubre. Por eso el label se formatea sobre el MEDIODÍA y en UTC.
  assert.equal(labelDeDia('2026-10-05'), 'lun 5 oct');
  assert.equal(labelDeDia('2026-10-06'), 'mar 6 oct');
  assert.equal(labelDeDia('nada'), 'nada', 'una fecha ilegible se devuelve tal cual, sin inventar un día');
});

test('el botón pide Calendly conectado Y el event type de la R2: las dos', () => {
  // La segunda mitad existe porque `CALENDLY_EVENT_TYPE_J2` es `opcional: true` en
  // el catálogo (lib/metodo-catalogo.ts): `integracionConectada('calendly')` sólo
  // mira los campos REQUERIDOS, así que da `true` sin el event type de la R2 — y
  // ahí `eventTypeDeReunion('R2')` tira y el botón contesta un error de config.
  assert.equal(puedeAgendarR2({ calendlyConectada: true, eventTypeR2: 'Segunda llamada' }), true);
  assert.equal(puedeAgendarR2({ calendlyConectada: false, eventTypeR2: 'Segunda llamada' }), false, 'sin Calendly no hay nada que reservar');
  assert.equal(puedeAgendarR2({ calendlyConectada: true, eventTypeR2: null }), false, 'conectado pero sin event type de R2');
  assert.equal(puedeAgendarR2({ calendlyConectada: true, eventTypeR2: '   ' }), false, 'un campo con espacios está vacío');
  assert.equal(puedeAgendarR2({ calendlyConectada: true, eventTypeR2: undefined }), false);
});
