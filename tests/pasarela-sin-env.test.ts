// =============================================================================
// Las claves de cobro se leen del WORKSPACE, nunca de process.env
// =============================================================================
// La pasarela de pagos (11/10/2026) cobra con la Stripe o la Mercado Pago de CADA negocio, y MaKo
// se vende con la del workspace de la plataforma (`wsSuperAdmin()`). Hay tres formas de leer una
// clave que compilan, pasan todos los tests y le cobran a la cuenta equivocada:
//
//   · `process.env.STRIPE_…`: el boot copia las credenciales del ws1 a process.env
//     (`hidratarCredenciales` → `aplicarAEnv`), y el ws1 es MAURICIO, un cliente. Si él pega su
//     Stripe en /integraciones, process.env.STRIPE_SECRET_KEY pasa a ser la suya en todos los
//     procesos: el código que la lea de ahí le vende MaKo a la cuenta de Mauricio.
//   · `envCred('STRIPE_…')`: resuelve SIEMPRE contra OWNER_WS (el mismo ws1). Su nombre dice
//     «de plataforma» y no lo es.
//   · `credWs('STRIPE_…')`: cae a process.env cuando el ws es el 1 — o cuando no se le pasa ws y
//     la sesión no resuelve, que termina en `?? OWNER_WS`.
//
// La única lectura es `credDelCliente(clave, ws)` (y `credWsEstricta` en el ruteo de un webhook,
// que tiene que tirar si la base no contesta). lib/cobros.ts lo dice arriba; esto lo barre.
//
// ⚠️ `git ls-files` lista el ÍNDICE: un archivo nuevo sin `git add` no se revisa (pasa en verde
// hasta que alguien lo agrega). Es la misma limitación que tests/puente-panel-copy.test.ts.
//
// Probado ROMPIÉNDOLO (11/10/2026), una rotura por vez y restaurando de memoria. Con el código como
// está: 3 pases, 0 fallos. Rota (pases / fallos):
//   · `const k = process.env.STRIPE_SECRET_KEY;` en lib/cobros-conexion.ts              → 2 / 1
//   · `await credWs('MERCADOPAGO_ACCESS_TOKEN', ws)` en lib/cobros-conexion.ts            → 2 / 1
//   · `credWs(CLAVE_PASARELA[pasarela], ctx.ws)` en la ruta de credenciales               → 2 / 1
// Correr: node --import tsx --test tests/pasarela-sin-env.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const RAIZ = join(__dirname, '..');

function archivos(): string[] {
  return execFileSync('git', ['ls-files', 'app', 'lib', 'components'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/)
    .map((f) => f.trim())
    .filter((f) => /\.(ts|tsx|mjs|js)$/.test(f) && !/\.d\.ts$/.test(f));
}

/** Sin los comentarios de bloque ni las líneas comentadas: la prosa que EXPLICA la trampa la nombra. */
const codigo = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/^\s*\/\/.*$/gm, '');

const PREFIJO = String.raw`(?:STRIPE_|MERCADOPAGO_|MP_)`;
const PROHIBIDO: Array<[RegExp, string]> = [
  [new RegExp(String.raw`process\.env(?:\.|\[\s*['"\x60])${PREFIJO}`), 'process.env: para el ws1 es la clave de Mauricio'],
  [new RegExp(String.raw`\benvCred\(\s*(?:['"\x60]${PREFIJO}|CLAVE_PASARELA)`), 'envCred resuelve contra OWNER_WS (Mauricio)'],
  [new RegExp(String.raw`\bcredWs\(\s*(?:['"\x60]${PREFIJO}|CLAVE_PASARELA)`), 'credWs cae a process.env para el ws1'],
];

test('el barrido ve el repo: un guard que no encuentra nada no cubre nada', () => {
  const todos = archivos();
  assert.ok(todos.length > 500, `git ls-files devolvió ${todos.length} archivos`);
  // Y la lectura BUENA existe donde se cobra: si esto cae, se renombraron las claves y los
  // prefijos de arriba ya no miran nada.
  assert.match(codigo('lib/cobros.ts'), /credDelCliente\('STRIPE_SECRET_KEY', ws\)/);
  assert.match(codigo('lib/cobros.ts'), /credDelCliente\('MERCADOPAGO_ACCESS_TOKEN', ws\)/);
});

test('nadie lee una clave de cobro de process.env, envCred ni credWs', () => {
  const malos: string[] = [];
  for (const f of archivos()) {
    const lineas = codigo(f).split('\n');
    lineas.forEach((l, i) => {
      for (const [re, por] of PROHIBIDO) if (re.test(l)) malos.push(`${f}:${i + 1} → ${l.trim().slice(0, 100)}  (${por})`);
    });
  }
  assert.deepEqual(malos, [],
    `estas líneas leen una clave de cobro por un camino que cae a la cuenta de otro:\n${malos.join('\n')}\n` +
    'Va credDelCliente(clave, ws) — y la de MaKo, con ws = await wsSuperAdmin().');
});

test('las claves de cobro no se migran del entorno ni las copia «Datos de Mau»', () => {
  // El otro lado de la misma trampa: si una STRIPE_SECRET_KEY de Vercel se migrara a la fila del
  // ws1, Mauricio cobraría con la cuenta de MaKo con cara de conexión propia.
  const cred = codigo('lib/credenciales.ts');
  const lista = cred.slice(cred.indexOf('const NO_MIGRAR_A_WS'), cred.indexOf(']);', cred.indexOf('const NO_MIGRAR_A_WS')));
  for (const k of ['STRIPE_SECRET_KEY', 'STRIPE_ACCOUNT_ID', 'STRIPE_WEBHOOK_SECRET', 'MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_USER_ID', 'MERCADOPAGO_WEBHOOK_SECRET']) {
    assert.ok(lista.includes(`'${k}'`), `${k} no está en NO_MIGRAR_A_WS`);
  }
});
