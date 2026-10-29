// =============================================================================
// Zernio sin pegar una clave: la cuenta de la PLATAFORMA con un perfil por negocio (28/10/2026)
// =============================================================================
// Martín a Teo (28/10, 00:27:36): «te logueás con Instagram y Facebook y ya tiene acceso a todo». El Cerebro: conectar Instagram
// y Facebook SIN pegar una clave de Zernio, con la cuenta de la plataforma y un perfil por negocio. El 23/10 se había decidido lo
// contrario (cada negocio con SU key: tests/zernio-sin-respaldo.test.ts); vuelve detrás de un interruptor del negocio de la
// plataforma, APAGADO por defecto, porque cada cuenta conectada de cada cliente la paga MaKo. Lo de abajo corre `cfg`,
// `ensureProfile` y `conexionesViaZernio` REALES (tests/_zernio-plataforma-hijo.ts). Lo que tiene que pasar:
//
//   1. APAGADO NO CAMBIA NADA: un negocio sin key no tiene Zernio.
//   2. PRENDIDO, CADA NEGOCIO EN SU PERFIL: `mako_ws_<ws>`, acuñado con la key de la plataforma, con su ruteo; las cuentas que ve
//      un negocio son las de SU perfil.
//   3. LA KEY PROPIA GANA, y el negocio de la plataforma nunca toma la «prestada».
//   4. «NO PUDE LEER» EL INTERRUPTOR TIRA: no es «apagado» ni «prendido».
//
// Probado ROMPIÉNDOLO (28/10/2026), una rotura por vez y restaurando, con este test y tests/zernio-sin-respaldo.test.ts (10 pases
// y 0 fallos con el código como está). Rota:
//   · el negocio de la plataforma toma la key prestada                     → 8 / 2
//   · sin el interruptor (siempre presta)                                  → 6 / 4
//   · la key de la plataforma sin perfil por negocio (byok: true)          → 8 / 2
//   · el interruptor se traga la base caída                                → 8 / 2
//   · «¿te sigue?» sin la key prestada                                     → 9 / 1
//
// Correr: node --import tsx --test tests/zernio-plataforma.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_zernio-plataforma-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 120_000,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

test('el hijo corrió entero y no salió a la red', () => {
  assert.equal(R.tiro, undefined, String(R.tiro));
  assert.deepEqual(R.red, []);
});

test('apagado no cambia nada: un negocio sin key no tiene Zernio', () => {
  assert.deepEqual(R.a, { cfg: { tira: 'Zernio no está configurado' }, configurado: false, conexiones: 'sin-clave' });
});

test('prendido, cada negocio habla con la key de la plataforma en SU perfil', () => {
  const b = R.b;
  assert.deepEqual(b.cfg, { key: 'sk_zernio_de_la_plataforma', byok: false });
  assert.deepEqual(b.perfiles, ['13:prof_mako_ws_13', '3:prof_mako_ws_3']);
  assert.deepEqual(b.ruteo, ['zernio/prof_mako_ws_13→13', 'zernio/prof_mako_ws_3→3'], 'el webhook rutea cada perfil a su negocio');
  assert.deepEqual(b.pedidos, [
    'PLATAFORMA POST /profiles', 'PLATAFORMA GET /accounts?profileId=prof_mako_ws_3',
    'PLATAFORMA POST /profiles', 'PLATAFORMA GET /accounts?profileId=prof_mako_ws_13',
  ], 'las cuentas de un negocio se piden por SU perfil, nunca las de la cuenta entera');
});

test('la key propia gana, y el negocio de la plataforma no toma la prestada', () => {
  assert.deepEqual(R.c, { key: 'sk_propia_3', byok: true });
  assert.deepEqual(R.d, { tira: 'Zernio no está configurado' });
});

test('«no pude leer» el interruptor tira: ni apagado ni prendido', () => {
  assert.match(R.e.cfg.tira, /app_settings \(zernio\.cuenta_de_la_plataforma\)/);
  assert.match(String(R.e.configurado), /^tira /, 'zernioConfigurado no puede contestar «no tiene» con la base caída');
});
