// El respaldo del pre-push a `main` cuando el tsc entero no consigue RAM: los tipos de TODO el repo en 3 tandas
// (scripts/tipos-respaldo-push.mjs). Lo que se fija acá es que NUNCA dé un OK que no es: una tanda que no terminó es un
// rechazo (99), un error de tipos frena (1), y sólo las TRES en 0 dejan pasar. Y que el hook lo llame sólo cuando el tsc
// entero salió con 99, antes de bloquear.
//
// PROBADO ROMPIÉNDOLO (22/10/2026, base 5/0; cada rotura a mano y vuelta atrás):
//   · clasificarTanda sin exigir «Total time» (un proceso cortado con código 0 pasaba como ok) → 4/1
//   · clasificarTanda que no mira el heap (un OOM con código 0 y estadísticas viejas) → 4/1
//   · veredictoRespaldo que acepta menos tandas que las pedidas → 4/1
//   · veredictoRespaldo donde «sin-chequear» gana a «errores» (escondía errores reales) → 4/1
//   · el hook llamando al respaldo DESPUÉS del bloque de 99 (nunca corría) → 4/1
// Y de punta a punta, a mano: un error de tipos plantado en un archivo de la tanda 3 hizo salir al script con 1 y el error en
// pantalla (docs/hallazgos-infra.md, «Sin minutos de Actions»).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clasificarTanda, veredictoRespaldo, TANDAS, SALIDA_SIN_CHEQUEAR } from '../scripts/tipos-respaldo-push.mjs';

const RAIZ = join(__dirname, '..');
const ESTADISTICAS = '\nFiles: 7000\nMemory used: 3900000K\nTotal time: 95.66s\n';

test('una tanda que terminó sin errores es ok; con errores, errores (y se listan)', () => {
  assert.equal(clasificarTanda({ code: 0, salida: ESTADISTICAS }).estado, 'ok');
  const r = clasificarTanda({ code: 2, salida: `lib/x.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'.${ESTADISTICAS}` });
  assert.equal(r.estado, 'errores');
  assert.equal(r.errores.length, 1);
  assert.match(r.errores[0], /lib\/x\.ts\(3,7\): error TS2322/);
});

test('una tanda que no terminó NUNCA es ok: matada, sin heap, con señal o sin el bloque de estadísticas', () => {
  assert.equal(clasificarTanda({ code: 1, salida: '' }).estado, 'sin-chequear', 'el vigía la mató: código 1 sin salida');
  assert.equal(clasificarTanda({ code: 134, salida: 'FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory' }).estado, 'sin-chequear');
  assert.equal(clasificarTanda({ code: 0, salida: `JavaScript heap out of memory${ESTADISTICAS}` }).estado, 'sin-chequear', 'un OOM no es un ok aunque haya estadísticas');
  assert.equal(clasificarTanda({ code: null, signal: 'SIGTERM', salida: '' }).estado, 'sin-chequear');
  assert.equal(clasificarTanda({ code: 0, salida: 'Files: 7000\n' }).estado, 'sin-chequear', 'código 0 sin «Total time»: no terminó el chequeo');
});

test('el veredicto: las TRES en ok → 0; un error de tipos → 1 aunque otra no haya corrido; si no, 99', () => {
  const ok = { estado: 'ok' as const, errores: [] };
  const err = { estado: 'errores' as const, errores: ['a.ts(1,1): error TS1: x'] };
  const sin = { estado: 'sin-chequear' as const, errores: [], porque: 'matada' };
  assert.equal(TANDAS, 3);
  assert.equal(veredictoRespaldo([ok, ok, ok]), 0);
  assert.equal(veredictoRespaldo([ok, err, ok]), 1);
  assert.equal(veredictoRespaldo([err, sin]), 1, 'un error real no se esconde detrás de una tanda que no corrió');
  assert.equal(veredictoRespaldo([ok, sin]), SALIDA_SIN_CHEQUEAR);
  assert.equal(veredictoRespaldo([ok, ok]), SALIDA_SIN_CHEQUEAR, 'menos tandas que las pedidas no es un ok');
  assert.equal(veredictoRespaldo([]), SALIDA_SIN_CHEQUEAR);
});

test('el pre-push llama al respaldo sólo con el 99 del tsc entero, y ANTES de bloquear', () => {
  const hook = readFileSync(join(RAIZ, 'scripts', 'claude-hooks', 'pre-push'), 'utf8');
  const main = hook.slice(hook.indexOf('if [ "$A_MAIN" -eq 1 ]; then'));
  const lock = main.indexOf('node "$LOCK_TSC"');
  const respaldo = main.indexOf('node "$RESPALDO"');
  const bloqueo = main.indexOf('✖ PUSH BLOQUEADO: no se pudo chequear los tipos');
  assert.ok(lock > 0 && respaldo > lock && bloqueo > respaldo, 'el orden: tsc entero → respaldo → bloqueo del 99');
  assert.match(main.slice(lock, respaldo), /if \[ "\$TIPOS" -eq 99 \]; then\s+RESPALDO="scripts\/tipos-respaldo-push\.mjs"/);
  assert.match(main.slice(respaldo), /^node "\$RESPALDO"\s+TIPOS=\$\?/);
});

test('el respaldo usa el programa ENTERO (sin --raices) y K = 3', () => {
  const src = readFileSync(join(RAIZ, 'scripts', 'tipos-respaldo-push.mjs'), 'utf8');
  const lanzar = src.slice(src.indexOf('function correrTanda'));
  assert.doesNotMatch(lanzar.slice(0, lanzar.indexOf('\n}\n')), /--raices/, 'con --raices faltan los tipos globales de Next: 15 errores falsos el 22/10');
  assert.match(src, /export const TANDAS = 3;/);
});
