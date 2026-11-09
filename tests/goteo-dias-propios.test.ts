// =============================================================================
// Los días del goteo son APARTE del horario (9/11/2026)
// =============================================================================
// Del §Sin hacer de docs/relevo/automations.md: los días en que goteaba una automatización eran los
// de su horario, y no había forma de elegir otros. Quien quería gotear sólo de lunes a jueves tenía
// que **achicar el horario entero** — y con eso dejaba de contestar los viernes, que no es lo que
// pidió. Son dos cosas distintas: el horario es CUÁNDO está abierta; los días del goteo son en qué
// días SALE a buscar.
//
// Correr: node --import tsx --test tests/goteo-dias-propios.test.ts
// ROTURAS (9/11/2026, una por vez y restaurada; base 6 / 0):
//   · sacar el chequeo del motor                                  → 4 / 2
//   · mirarlo DESPUÉS del horario (y del `continue` sin horario)   → 5 / 1
//   · sin zona del negocio, mandar igual                           → 5 / 1
//   · guardar la lista vacía (= «nunca goteés»)                    → 4 / 2
//   · no guardar el goteo cuando SÓLO trae días                    → 5 / 1
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { cerradasAhora, sanearConfigAutomatizacion, diasDeGoteo, hoyGotea, type ConfigAutomatizacion } from '../lib/config-automatizacion';
import type { HorarioEnvio } from '../lib/horario-envio';

const TZ = 'America/Montevideo';
// Lunes 9 de noviembre de 2026, 15:00 en Montevideo (UTC-3).
const LUNES = Date.parse('2026-11-09T18:00:00.000Z');
// Viernes 13, misma hora.
const VIERNES = Date.parse('2026-11-13T18:00:00.000Z');
const ABIERTO: HorarioEnvio = { activo: true, desde: 9, hasta: 21, dias: [0, 1, 2, 3, 4, 5, 6] };

const cerradas = (c: ConfigAutomatizacion, ahora: number, tz: string | null = TZ, delNegocio: HorarioEnvio | null = ABIERTO) =>
  cerradasAhora([1], new Map([[1, c]]), delNegocio, ahora, tz);

test('sin días propios no cambia nada: manda el horario, como siempre', () => {
  assert.equal(cerradas({ goteo: { minutos: 5 } }, VIERNES).has(1), false);
  assert.equal(cerradas({}, VIERNES).has(1), false);
});

test('⚠️ con días propios, un viernes queda cerrada aunque el horario esté abierto', () => {
  // Éste es el pedido entero: gotear de lunes a jueves SIN tener que achicar el horario.
  const c: ConfigAutomatizacion = { goteo: { minutos: 5, dias: [1, 2, 3, 4] } };
  assert.equal(cerradas(c, LUNES).has(1), false, 'el lunes sale');
  assert.equal(cerradas(c, VIERNES).has(1), true, 'el viernes no, y el horario sigue abierto');
});

test('⚠️ una automatización SIN horario propio TAMBIÉN respeta sus días de goteo', () => {
  // Es el caso más común, y el que se perdía si esto se miraba después del horario: sin horario la
  // función hace `continue` y nunca llegaría a mirar los días.
  const c: ConfigAutomatizacion = { horario: null, goteo: { dias: [1, 2, 3, 4] } };
  assert.equal(cerradas(c, VIERNES, TZ, null).has(1), true, 'sin horario, los días del goteo igual mandan');
  assert.equal(cerradas(c, LUNES, TZ, null).has(1), false);
});

test('⚠️ el día se lee en la zona del NEGOCIO, no en la del servidor', () => {
  // Un cron a las 23:30 UTC ya es el día siguiente para medio mundo: ahí «de lunes a jueves»
  // empezaría los domingos a la noche.
  const c: ConfigAutomatizacion = { goteo: { dias: [1] } };
  const domingoTardeUy = Date.parse('2026-11-09T02:00:00.000Z'); // domingo 23:00 en Montevideo, lunes en UTC
  assert.equal(hoyGotea(c, domingoTardeUy, TZ), false, 'en Montevideo todavía es domingo');
  assert.equal(hoyGotea(c, domingoTardeUy, 'UTC'), true, 'en UTC ya es lunes');
  // Sin zona el motor no manda: «no sé qué hora es ahí» no es «mandá igual».
  assert.equal(hoyGotea(c, LUNES, null), false);
});

test('⚠️ una lista vacía NO se guarda: es «los del horario», no «nunca»', () => {
  // Igual que en el horario. Una lista vacía guardada sería un motor apagado que nadie eligió apagar.
  assert.equal(sanearConfigAutomatizacion({ goteo: { dias: [] } }).goteo, undefined);
  assert.equal(diasDeGoteo([]), undefined);
  assert.equal(diasDeGoteo('lunes'), undefined);
  // Y con días SOLOS, sin minutos ni tope, el goteo igual se guarda: elegir días es configurar.
  assert.deepEqual(sanearConfigAutomatizacion({ goteo: { dias: [4, 1, 1, 2] } }).goteo, { dias: [1, 2, 4] });
});

test('el saneo descarta lo que no se entiende, deduplica y ordena', () => {
  // Media lista es peor que ninguna: manda los días equivocados sin que nada lo diga.
  assert.deepEqual(diasDeGoteo([3, 1, 'x', 9, -1, 1, 6.5, 6]), [1, 3, 6]);
  assert.equal(diasDeGoteo(['a', 12]), undefined, 'si no queda ninguno válido, ausente');
});
