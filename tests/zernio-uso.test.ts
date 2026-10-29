// =============================================================================
// Cuántos mensajes mandó un negocio por Zernio en su ciclo (29/10/2026)
// =============================================================================
// El audio de Leandro (28/10): «que no se pare la automatización… y que Maco no me avise nada». Zernio da 10.000 mensajes
// ENVIADOS gratis por ciclo. El aviso lo arma Automations (`avisarTopesSociales`); el conteo y el ciclo, el canal
// (lib/zernio-uso.ts, `usoZernioDelCiclo`), y el ciclo se lee de `GET /v1/billing` (`cicloDeZernio`, lib/zernio-redes.ts). Lo que
// tiene que pasar:
//
//   1. EL CICLO ES EL DE ZERNIO (del día del alta, con `+00:00`), en ISO con Z; si no viene o no se entiende, null: nunca un mes
//      inventado.
//   2. CUENTA LO QUE MaKo MANDÓ EN EL CICLO: el motor (`nutricion_envios`, instagram o messenger, 'enviado') y Chats (`ig_mensajes`
//      saliente 'enviado'). No cuenta un fallo, una acción, WhatsApp, lo entrante, lo de afuera del ciclo ni a otro negocio.
//   3. «NO PUDE LEER» ES null, NUNCA 0: sin Zernio, sin el ciclo o con la base caída no se avisa.
//   4. CON LA CLAVE DE LA CUENTA DE MaKo (el ws1) LO DICE (`deLaCasa`): el tope es de MaKo, no del negocio.
//
// Probado ROMPIÉNDOLO (29/10/2026), una rotura por vez y restaurando (5 pases y 0 fallos como está):
//   · sin lo del motor                                  → 4 / 1
//   · sin lo de Chats                                   → 4 / 1
//   · el motor cuenta también los fallos y las acciones → 4 / 1
//   · sin el comienzo del ciclo                         → 4 / 1
//   · el fin del ciclo incluido                         → 4 / 1
//   · la base caída cuenta 0                            → 4 / 1
//   · sin el ciclo, el mes calendario                   → 3 / 2
//   · la clave de MaKo no se dice                       → 4 / 1
//   · lib/zernio-uso.ts fuera de la lista del canal     → tests/sin-instagram.test.ts 8 / 0 → 7 / 1 (con el archivo en git:
//     el guard lee `git ls-files`; sin `git add -N` no lo ve y queda verde)
// No muerde, y está bien: sacar `direccion = saliente` de Chats. Una fila entrante nunca está 'enviado' (es 'recibido',
// lib/zernio-entrante.ts), así que el filtro de `estado` ya la deja afuera.
//
// Correr: node --import tsx --test tests/zernio-uso.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { cicloDeZernio, MENSAJES_GRATIS_ZERNIO } from '../lib/zernio-redes';

const RAIZ = join(__dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_zernio-uso-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

test('el hijo corrió entero y no salió a la red', () => {
  assert.equal(R.tiro, undefined, String(R.tiro));
  assert.deepEqual(R.red, []);
});

test('el ciclo es el de Zernio, en ISO con Z; si no viene o no se entiende, null', () => {
  assert.deepEqual(cicloDeZernio({ period: { start: '2026-10-12T03:00:00+00:00', end: '2026-11-01T00:00:00+00:00', anchorDay: 12 } }),
    { desde: '2026-10-12T03:00:00.000Z', hasta: '2026-11-01T00:00:00.000Z' });
  for (const malo of [null, {}, { period: {} }, { period: { start: '2026-10-12' } }, { period: { start: 'ayer', end: 'hoy' } },
    { period: { start: '2026-11-01T00:00:00Z', end: '2026-10-12T00:00:00Z' } }, { period: { start: 1, end: 2 } }]) {
    assert.equal(cicloDeZernio(malo), null, JSON.stringify(malo));
  }
});

test('cuenta lo que MaKo mandó por Zernio en el ciclo: el motor y Chats, y nada más', () => {
  assert.deepEqual(R.a.r, { enviados: 5, gratis: MENSAJES_GRATIS_ZERNIO, desde: '2026-10-12T03:00:00.000Z', hasta: '2026-11-01T00:00:00.000Z', deLaCasa: false });
  assert.deepEqual(R.a.pedidos, ['GET /billing'], 'a Zernio sólo se le pide el ciclo');
});

test('«no pude leer» es null, nunca 0: sin Zernio, sin el ciclo, o con la base caída', () => {
  assert.equal(R.b.r, null);
  assert.deepEqual(R.b.pedidos, [], 'sin clave no se le pide nada a Zernio');
  assert.deepEqual(R.c, { c500: null, sinPeriodo: null, alReves: null });
  assert.deepEqual(R.d, { sinChats: null, sinMotor: null });
});

test('con la clave de la cuenta de MaKo (el ws1) lo dice: el tope es de MaKo', () => {
  assert.equal(R.e.ws1?.deLaCasa, true);
  assert.equal(R.e.ws3?.deLaCasa, false);
});
