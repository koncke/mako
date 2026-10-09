// =============================================================================
// El TICK del motor de nutrición: cada minuto, barato, y nunca dos corridas sobre un negocio
// =============================================================================
// Sexta tanda (09/10/2026): «las esperas se cumplen a la hora exacta, de día o de noche». Este test
// fija lo que hace barato y seguro al tick (app/api/cron/nutricion-tick):
//
//   1. el TURNO: tomado hasta un instante, libre si venció o no se entiende, y la ruta corre el
//      motor SIEMPRE con él (dos corridas a la vez sobre la misma fila mandan dos veces);
//   2. qué negocios corre: los activos con algo que acaba de vencer, y los que acaban de abrir su
//      horario (ésos, barridos enteros);
//   3. la ruta: sin nada vencido termina antes de leer los workspaces, y el motor corre sólo sobre
//      lo fresco (`vencidasDesde`), con el tope de las esperas cortas y el cupo de la hora.
//
// PROBADO ROMPIÉNDOLO (09/10/2026): ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { turnoTomado, valorDeTurno, negociosDelTick, TURNO_MS, KEY_TURNO_MOTOR } from '../lib/motor-tick';

const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const AHORA = Date.parse('2026-10-09T20:00:00Z');

test('el turno: tomado hasta su vencimiento, libre después, y lo que no se entiende es libre', () => {
  const v = valorDeTurno(AHORA);
  assert.equal(Date.parse(v), AHORA + TURNO_MS);
  assert.equal(turnoTomado(v, AHORA), true);
  assert.equal(turnoTomado(v, AHORA + TURNO_MS - 1), true);
  assert.equal(turnoTomado(v, AHORA + TURNO_MS), false, 'un turno vencido traba al negocio para siempre');
  assert.equal(turnoTomado(null, AHORA), false);
  assert.equal(turnoTomado('basura', AHORA), false);
  // Más que el `maxDuration` de las rutas (300 s): una corrida viva nunca pierde su turno a la mitad.
  assert.ok(TURNO_MS > 300_000);
  assert.equal(KEY_TURNO_MOTOR, 'mako.nutricion.turno');
});

test('qué negocios corre: los ACTIVOS con algo fresco, y los que abrieron su horario (barridos enteros)', () => {
  const activos = new Set([1, 3, 9, 13]);
  const r = negociosDelTick({ activos, conVencidoFresco: [13, 1, 7, 1], abrieronConVencido: [3, 13, 8] });
  assert.deepEqual(r, [{ ws: 1, motivo: 'vencio' }, { ws: 3, motivo: 'abrio' }, { ws: 13, motivo: 'abrio' }]);
  // Un pausado (7, 8) no corre aunque tenga filas.
  assert.ok(!r.some((x) => x.ws === 7 || x.ws === 8));
  assert.deepEqual(negociosDelTick({ activos, conVencidoFresco: [], abrieronConVencido: [] }), []);
});

test('⚠️ la ruta: barata cuando no hay nada, y el motor con el turno, sobre lo fresco y con el cupo de la hora', () => {
  const ruta = sinComentarios(leer('app/api/cron/nutricion-tick/route.ts'));
  // La primera consulta es UNA para todos los negocios, sobre la ventana fresca.
  assert.match(ruta, /\.from\('nutricion_inscripciones'\)\s*\.select\('workspace_id'\)\.eq\('estado', 'activa'\)\s*\.gte\('proximo_envio_at', desde\)\.lte\('proximo_envio_at', ahoraIso\)/);
  // Sin nada, sale ANTES de leer los workspaces (el caso de casi todos los minutos).
  const sale = ruta.indexOf("if (!conVencidoFresco.length && !abrieronConVencido.length) return Response.json({ ok: true, negocios: 0 });");
  assert.ok(sale > 0, 'sin nada vencido, el tick sigue de largo');
  assert.ok(sale < ruta.indexOf('listarWorkspaces()'), 'lee los workspaces aunque no haya nada que hacer');
  // El motor, con el turno del negocio tomado (dos corridas a la vez mandan dos veces).
  assert.match(ruta, /runWithWorkspace\(ws, \(\) => conTurnoDelMotor\(ws, async \(\) => \{/);
  assert.match(ruta, /procesarEnvios\(\{ esperarHastaMs, cupoPorHora: true, \.\.\.\(motivo === 'vencio' \? \{ vencidasDesde: desde \} : \{\}\) \}\)/);
  // El horario que acaba de abrir: con la MISMA función que lo decide, y la zona del motor.
  assert.match(ruta, /acabaDeAbrir\(ahora, zonaDelMotor\(zonaDe\.get\(ws\) \?\? null\), h, VENTANA_FRESCA_MIN\)/);
  // No inscribe por cohorte ni evalúa desenlaces: eso es de la corrida de cada hora.
  assert.doesNotMatch(ruta, /comprometerInscripciones|evaluarDesenlaces/);
  // Auth de la casa (lib/cron-auth.ts), no otra copia local.
  assert.match(ruta, /const unauth = checkCronAuth\(request\);/);
});

test('el turno lo toma también la corrida de cada hora, y lo espera un rato (es la única que barre lo viejo)', () => {
  const hora = sinComentarios(leer('app/api/cron/nutricion/route.ts'));
  assert.match(hora, /const r = await conTurnoDelMotor\(ws, fn, \{ esperarMs: Math\.max\(0, hastaMs - Date\.now\(\)\) \}\);/);
  assert.match(hora, /const turnoHastaMs = Date\.now\(\) \+ ESPERA_TURNO_MS;/, 'la espera del turno es UNA para toda la ruta');
  const turno = sinComentarios(leer('lib/motor-turno.ts'));
  // Compare-and-set contra lo leído, «no pude leer» cuenta como tomado, y se suelta sólo si es nuestro.
  assert.match(turno, /cambiarSettingSi\(KEY_TURNO_MOTOR, previo, mio\)/);
  assert.match(turno, /try \{ previo = await getSettingEstricto\(KEY_TURNO_MOTOR\); \} catch \{ return \{ ok: false as const, porque: 'ilegible' as const \} \}/);
  assert.match(turno, /cambiarSettingSi\(KEY_TURNO_MOTOR, mio, new Date\(\)\.toISOString\(\)\)/);
  assert.match(turno, /\} finally \{/, 'si el motor tira, el turno queda tomado hasta que venza');
});

// ── Roturas (09/10/2026) ─────────────────────────────────────────────────────────────────────
// Una por vez, restaurada DE MEMORIA, con este archivo solo. Base: 4 / 0.
//   T1. `turnoTomado` con `>=` (el turno vencido justo en el borde sigue tomado) → 3 / 1
//   T2. `negociosDelTick` sin filtrar los activos                                → 3 / 1
//   T3. la ruta sin el early-return (lee los workspaces cada minuto)             → 3 / 1
//   T4. la ruta corre el motor sin `conTurnoDelMotor`                            → 3 / 1
//   T5. la corrida de la hora sin esperar el turno (`esperarMs`)                 → 3 / 1
// Restaurado: 4 / 0.
