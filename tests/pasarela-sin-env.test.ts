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

// `CREEM_` desde el 31/10/2026: el guardia estaba ciego a las tres claves de la tercera pasarela, y no rojo.
// `DLOCAL_` desde el 06/11/2026, por lo MISMO y con la cuarta. ⚠️ DOS VECES SEGUIDAS ES UN PATRÓN, NO UN DESCUIDO: un
// barrido por prefijo es tan ancho como su lista, la lista no crece sola, y un guardia que no mira NO DA ROJO — da un
// cero perfectamente correcto sobre la pregunta equivocada. Por eso ya no se audita a ojo: el test «la lista de
// prefijos cubre TODAS las pasarelas» (abajo) la deriva de `CLAVES_DE_PASARELA` y falla nombrando la que falta.
const PREFIJO = String.raw`(?:STRIPE_|MERCADOPAGO_|MP_|CREEM_|DLOCAL_)`;
// La clave de la segunda cuenta (`STRIPE_SECRET_KEY__C2`, 22/10/2026) se ARMA con `claveDeCuenta(`: sin mirar eso, un
// `credWs(claveDeCuenta('STRIPE_SECRET_KEY', c), ws)` pasaba el barrido (no lleva comilla después del paréntesis).
const ARMADA = String.raw`claveDeCuenta\(\s*(?:['"\x60]${PREFIJO}|CLAVE_PASARELA|CLAVES_BASE)`;
const PROHIBIDO: Array<[RegExp, string]> = [
  [new RegExp(String.raw`process\.env(?:(?:\.|\[\s*['"\x60])${PREFIJO}|\[\s*${ARMADA})`), 'process.env: para el ws1 es la clave de Mauricio'],
  [new RegExp(String.raw`\benvCred\(\s*(?:['"\x60]${PREFIJO}|CLAVE_PASARELA|${ARMADA})`), 'envCred resuelve contra OWNER_WS (Mauricio)'],
  [new RegExp(String.raw`\bcredWs\(\s*(?:['"\x60]${PREFIJO}|CLAVE_PASARELA|${ARMADA})`), 'credWs cae a process.env para el ws1'],
];

test('el barrido ve el repo: un guard que no encuentra nada no cubre nada', () => {
  const todos = archivos();
  assert.ok(todos.length > 500, `git ls-files devolvió ${todos.length} archivos`);
  // Y la lectura BUENA existe donde se cobra: si esto cae, se renombraron las claves y los
  // prefijos de arriba ya no miran nada.
  // Desde las varias cuentas por proveedor (22/10/2026) la lectura vive en lib/cuentas-pago-server.ts, con el nombre de
  // la clave de LA cuenta (`claveDeCuenta(base, cuenta)`); las bases, en lib/cuentas-integracion.ts.
  assert.match(codigo('lib/cuentas-pago-server.ts'), /credDelCliente\(claveDeCuenta\(b\.clave, cuenta\), ws\)/);
  assert.match(codigo('lib/cuentas-integracion.ts'), /stripe: \{ clave: 'STRIPE_SECRET_KEY',/);
  assert.match(codigo('lib/cuentas-integracion.ts'), /mercadopago: \{ clave: 'MERCADOPAGO_ACCESS_TOKEN',/);
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

/** Las claves que `lib/credenciales.ts` declara como «de pasarela», leídas del fuente. */
function clavesDePasarela(): string[] {
  const cred = codigo('lib/credenciales.ts');
  const i = cred.indexOf('const CLAVES_DE_PASARELA');
  assert.ok(i > 0, 'desapareció CLAVES_DE_PASARELA: si se renombró, este guard hay que reescribirlo');
  return [...cred.slice(i, cred.indexOf(']);', i)).matchAll(/'([A-Z0-9_]+)'/g)].map((m) => m[1]);
}

test('las claves de cobro no se migran del entorno ni las copia «Datos de Mau»', () => {
  // El otro lado de la misma trampa: si una STRIPE_SECRET_KEY de Vercel se migrara a la fila del
  // ws1, Mauricio cobraría con la cuenta de MaKo con cara de conexión propia.
  const cred = codigo('lib/credenciales.ts');
  const lista = cred.slice(cred.indexOf('const NO_MIGRAR_A_WS'), cred.indexOf(']);', cred.indexOf('const NO_MIGRAR_A_WS')));
  // ⚠️ DERIVADO de CLAVES_DE_PASARELA y no de una lista a mano (06/11/2026): la versión escrita a mano enumeraba sólo
  // las seis de Stripe y Mercado Pago, así que las tres de Creem llevaban una semana en `NO_MIGRAR_A_WS` sin que nada
  // lo comprobara — y la cuarta pasarela habría entrado igual de muda. Así, una pasarela nueva queda cubierta sola.
  const claves = clavesDePasarela();
  assert.ok(claves.length >= 12, `esperaba las claves de las cuatro pasarelas y encontré ${claves.length}`);
  for (const k of claves) {
    assert.ok(lista.includes(`'${k}'`), `${k} es clave de pasarela y no está en NO_MIGRAR_A_WS`);
  }
});

test('la lista de prefijos cubre TODAS las pasarelas', () => {
  // ⚠️ EL GUARD NO ESTABA ROTO: NO MIRABA — y ya pasó DOS VECES. Con Creem (31/10/2026) y con dLocal Go
  // (06/11/2026): en los dos casos un `credWs('<PREFIJO>_API_KEY')` pasaba el barrido en VERDE y le cobraba a la
  // cuenta del ws1 (Mauricio, un cliente). Las dos veces se arregló a mano agregando el prefijo, y las dos veces el
  // arreglo dependió de que alguien se acordara. Esto lo deriva del fuente para que la quinta no dependa de eso.
  const sinCubrir = clavesDePasarela().filter((k) => !new RegExp(`^${PREFIJO}`).test(k));
  assert.deepEqual(sinCubrir, [],
    `estas claves de cobro NO las mira el barrido de arriba:\n${sinCubrir.join('\n')}\n` +
    `Agregá su prefijo a PREFIJO (hoy: ${PREFIJO}).`);
});
