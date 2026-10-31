// =============================================================================
// El cliente con DOS agencias entraba al Agency Dashboard (P15, 30/10/2026)
// =============================================================================
// El síntoma: las dos pantallas de Agency preguntaban `if (!esSuper && (await agenciaDeCliente(ws))) redirect(...)`.
// `agenciaDeCliente` contesta **QUIÉN** es el dueño, y para eso necesita que haya exactamente uno: con dos dueños
// devuelve `null` a propósito («elegir el primero sería inventar un padre», lib/agencia.ts). Arriba ese `null` se leía
// como «no es cliente de ninguna agencia», así que el cliente con DOS agencias era justo el que entraba.
//
// ⚠️ EL `null` DE `agenciaDeCliente` SIGNIFICA TRES COSAS, y las tres se leían como «no». MEDIDO acá, no supuesto
//    (tests/_agency-dos-duenos-hijo.ts, funciones reales contra un PostgREST de mentira):
//      · no tiene ningún dueño            → null   (el único caso que el guard quería dejar pasar)
//      · tiene DOS dueños aprobados       → null   ← entraba
//      · tiene DOS dueños pendientes      → null   ← entraba (pendiente también es dueña, `esCarteraVigente`)
//      · no se pudo leer la cartera       → null   ← entraba (la base caída abría la puerta)
//    La pregunta correcta es de sí/no y no depende de que el dueño sea uno: `esClienteDeAgencia`.
//
// ⚠️ ES UN RIESGO LATENTE, NO UN DAÑO: hoy ningún cliente tiene dos agencias, así que no hay nadie perjudicado. Lo que
//    se abría tampoco era una fuga de datos entre clientes —la pantalla dibuja la cartera DEL QUE MIRA, que para un
//    cliente está vacía—: era que el cliente de una agencia veía el programa y podía sumarse como Agency, que es la
//    regla de producto («MaKo no les va a enviar promociones»). La relación es N:N a propósito, así que el caso no es
//    imposible: es que todavía no pasó.
//
// ⚠️ EL CASO NO EXISTE EN LOS DATOS Y POR ESO SE ARMA. Esperar a que un cliente real tenga dos dueños es esperar a que
//    el bug cobre. Las filas las pone el hijo, con DOS agencias (la real, ws 13, y una de mentira): con una sola, un
//    guard que ignore `agencia_ws` pasa todas las pruebas que se le hagan.
//
// Probado ROMPIÉNDOLO, cada rotura sola, contra este archivo + tests/agency.test.ts (25/25 con todo puesto):
//   · la puerta vuelve a `agenciaDeCliente` en app/agency/page.tsx        → 3 FALLOS (1 acá, 2 en agency.test.ts)
//   · la puerta vuelve a `agenciaDeCliente` en app/m/agency/page.tsx      → 3 FALLOS (1 acá, 2 en agency.test.ts)
//   · `if (deAgencia)` en vez de `!== false` (el «no sé» como «no»)       → 4 FALLOS (2 acá, 2 en agency.test.ts)
//   · `esClienteDeAgencia` devuelve `false` cuando no pudo leer           → 1 FALLO
//   · `esClienteDeAgencia` pide `=== 1` dueño (le copia el bug)           → 2 FALLOS (los dos dueños y los dos pendientes)
//   · `esCarteraVigente` cuenta una revocada como dueña                   → 1 FALLO
//   · `agenciasDeCliente` deja de devolver `[]` y propaga el null         → 5 FALLOS (el hijo se cae entero)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8'));

type Salida = {
  esCliente: Record<string, boolean | null>;
  quien: Record<string, number | null>;
  cuantasFilas: Record<string, number>;
  wsInvalido: { cero: boolean | null; nulo: boolean | null; indefinido: boolean | null };
  red: string[];
  sinMock: string[];
};

let cache: Salida | null = null;
const correr = (): Salida => {
  if (cache) return cache;
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_agency-dos-duenos-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  cache = JSON.parse(salida) as Salida;
  return cache;
};

// ── 1. La medición: qué contesta cada una, contra una base de mentira ──────────────

test('EL CASO DE P15: con DOS dueños, «quién es» no contesta y «es cliente» SÍ', () => {
  const r = correr();
  assert.deepEqual(r.red, [], 'nada sale a la red');
  // El bug, medido: la que contestaba la puerta dice `null` con dos dueños, igual que sin ninguno.
  assert.equal(r.quien.dosDuenos, null, 'con dos dueños no se afirma de quién es (y eso está bien: es su contrato)');
  assert.equal(r.quien.sinDueno, null, 'sin dueño, lo mismo — y ése era el problema: no se distinguen');
  // La pregunta nueva sí los distingue, que es todo el arreglo.
  assert.equal(r.esCliente.dosDuenos, true, 'con dos dueños ES cliente de una agencia');
  assert.equal(r.esCliente.sinDueno, false, 'sin ningún dueño, no lo es');
  assert.equal(r.esCliente.unDueno, true, 'con uno, lo de siempre');
});

test('«pendiente» también es dueña, y con dos pendientes pasaba lo mismo', () => {
  const r = correr();
  // `esCarteraVigente`: pendiente o aprobado. Dos pendientes dan `null` en «quién es» por la misma razón.
  assert.equal(r.quien.dosPendientes, null);
  assert.equal(r.esCliente.dosPendientes, true, 'un pedido sin firmar ya lo hace cliente de esa agencia');
});

test('una REVOCADA no es dueña: es historia (la del ws 3, 17/10/2026)', () => {
  const r = correr();
  assert.equal(r.esCliente.dosUnaRevocada, true, 'una vigente + una revocada: sigue siendo cliente de la vigente');
  assert.equal(r.quien.dosUnaRevocada, 13, 'y ahí sí hay un dueño único que nombrar');
  assert.equal(r.esCliente.dosRevocadas, false, 'sólo historia: ya no es cliente de nadie');
  assert.equal(r.cuantasFilas.dosRevocadas, 2, 'las filas revocadas se quedan para poder auditarlas');
});

test('SI NO SE PUDO LEER, la respuesta es «no sé» (null) y NUNCA «no» (false)', () => {
  const r = correr();
  // Éste es el otro `null` que el guard leía como «no»: con la base caída, la puerta se abría.
  assert.equal(r.esCliente.noSePudo, null, '«no pude leer» es su propio valor');
  assert.notEqual(r.esCliente.noSePudo, false, 'un store que falla sólo tiene permitido ser MÁS restrictivo');
  // Y el contrato viejo de `agenciasDeCliente` (`[]` para dibujar) no se tocó: ahí el `[]` sigue siendo el default.
  assert.equal(r.cuantasFilas.noSePudo, 0, '`agenciasDeCliente` sigue devolviendo [] cuando falla (es para dibujar)');
  assert.equal(r.cuantasFilas.dosDuenos, 2, 'y sigue trayendo las filas cuando se puede leer');
});

test('un ws que no es un ws tampoco es un «no»', () => {
  const r = correr();
  assert.deepEqual(r.wsInvalido, { cero: null, nulo: null, indefinido: null },
    'sin un workspace válido no hay nada que contestar: «no sé», y el guard no deja entrar');
});

// ── 2. Las dos pantallas preguntan lo que hay que preguntar ───────────────────────

for (const [cual, pagina, destino] of [
  ['la computadora', 'app/agency/page.tsx', "'/inicio'"],
  ['el teléfono', 'app/m/agency/page.tsx', "'/m'"],
] as const) {
  test(`la puerta de Agency en ${cual}: pregunta «es cliente» y el «no sé» no entra`, () => {
    const src = leer(pagina);
    assert.match(src, /import \{ esClienteDeAgencia \} from '@\/lib\/agencia';/, 'la pregunta de sí/no');
    assert.doesNotMatch(src, /agenciaDeCliente/, 'la que contesta QUIÉN no decide una pantalla');
    assert.match(src, /const deAgencia = await esClienteDeAgencia\(ws\);/);
    // ⚠️ `!== false` y no `if (deAgencia)`: con la verdad a secas, el `null` del «no sé» vuelve a dejar entrar.
    assert.match(src, new RegExp(`if \\(!esSuper && deAgencia !== false\\) redirect\\(await rutaConWs\\(${destino}\\)\\);`),
      'se compara contra false: el «no pude leer» no entra');
    // Y la puerta sigue ANTES de leer la cartera.
    assert.ok(src.indexOf('const deAgencia') < src.indexOf('cuentasDePartner(ws)'), 'la puerta, antes de los datos');
  });
}

test('`esClienteDeAgencia` es la única que decide, y `agenciaDeCliente` lo dice en su propio comentario', () => {
  const crudo = readFileSync(join(RAIZ, 'lib/agencia.ts'), 'utf8');
  // El comentario es parte del arreglo: el bug se repite si el próximo que pase no sabe por qué hay dos funciones.
  assert.match(crudo, /NO DECIDE UN PERMISO NI UNA PANTALLA/, 'queda escrito dónde NO se usa `agenciaDeCliente`');
  const src = sinComentarios(crudo);
  assert.match(src, /export const esClienteDeAgencia = cache\(async \(clienteWs: number \| null \| undefined\): Promise<boolean \| null> =>/,
    'el tri-estado está en el tipo: boolean | null');
  // ⚠️ LA LISTA CERRADA DE QUIÉN LA LLAMA, y es la parte que cuida que el molde no vuelva. `agenciaDeCliente` no está
  //    mal: está bien para DECIR (la cadena de la barra, el escalón de «Salir», el nombre en el cartel de pago). Lo que
  //    no puede es DECIDIR. Si mañana aparece un llamador nuevo, este test falla y hay que elegir cuál de las dos es.
  //    Se mira el código SIN comentarios: los de acá la nombran a propósito, para explicar por qué no se usa.
  const llaman = execFileSync('git', ['grep', '-l', 'agenciaDeCliente', '--', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean)
    .filter((rel) => /\bagenciaDeCliente\(/.test(leer(rel)));
  assert.deepEqual(llaman.sort(), ['lib/agency.ts', 'lib/movil-guard.ts', 'lib/vista-de-otro.ts'],
    'las TRES que la usan para DECIR; ninguna pantalla decide con ella');
  // Y ninguna de esas tres es una puerta: arman un texto o una URL de salida.
  assert.match(leer('lib/vista-de-otro.ts'), /salida: agencia \?/, 'la URL de «Salir», no un permiso');
  assert.match(leer('lib/movil-guard.ts'), /salida: agencia \?/, 'lo mismo en el teléfono');
  assert.match(leer('lib/agency.ts'), /agencia: agencia\.nombre/, 'el NOMBRE en el cartel de pago del cliente');
});
