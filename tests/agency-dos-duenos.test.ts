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

/**
 * Cada llamada a `esClienteDeAgencia` del fuente, y si su «no sé» quedó RESUELTO.
 *
 * ⚠️ Se cierra el paréntesis CONTANDO (el argumento puede traer otra llamada adentro:
 * `esClienteDeAgencia(await getWorkspaceActual())`), que es lo que una regex `[^)]*` no
 * puede hacer — ésa paraba en el `)` de adentro y daba un falso rojo.
 *
 * Resuelto = o lo sigue un `!== false`, o se guarda en una variable que el archivo
 * compara así. Las dos formas están en uso a propósito y las dos son correctas.
 */
function usosEnElFuente(src: string): { resuelto: boolean; contexto: string }[] {
  const out: { resuelto: boolean; contexto: string }[] = [];
  const marca = 'esClienteDeAgencia(';
  for (let i = src.indexOf(marca); i >= 0; i = src.indexOf(marca, i + 1)) {
    // Saltea la declaración y el import: los usos son LLAMADAS.
    const antes = src.slice(Math.max(0, i - 40), i);
    if (/export const\s*$|import \{[^}]*$/.test(antes)) continue;
    let hondo = 0, j = i + marca.length - 1;
    for (; j < src.length; j++) {
      if (src[j] === '(') hondo++;
      else if (src[j] === ')' && --hondo === 0) break;
    }
    const despues = src.slice(j + 1, j + 24).replace(/\s+/g, '');
    let resuelto = despues.startsWith(')!==false') || despues.startsWith('!==false');
    if (!resuelto) {
      // ¿Se guarda en una variable que después se compara contra false?
      const nombre = /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;]*$/.exec(src.slice(0, i))?.[1];
      if (nombre && new RegExp(`\\b${nombre}\\s*!==\\s*false`).test(src)) resuelto = true;
    }
    out.push({ resuelto, contexto: src.slice(Math.max(0, i - 60), j + 24).replace(/\s+/g, ' ').trim() });
  }
  return out;
}

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

// ── 3. UNA sola función, y cada uso resuelve el «no sé» por el lado seguro ────────

test('`esClienteDeAgencia` se declara UNA sola vez (el merge del 30/10 no compilaba por esto)', () => {
  // ⚠️ ESTE GUARD EXISTE POR UN MERGE QUE SE VIO LIMPIO Y NO COMPILABA. La función nació DOS veces el mismo día: acá con el
  //    tri-estado y en la rama de Agency devolviendo `boolean` (con «no se pudo leer» = `false`). Los dos bloques viven en
  //    lugares distintos del archivo, así que git los unió SIN conflicto y lo que quedó fue
  //    «Multiple exports with the same name "esClienteDeAgencia"»: un archivo que no compila, con un merge en verde.
  const crudo = readFileSync(join(RAIZ, 'lib/agencia.ts'), 'utf8');
  const cuantas = (sinComentarios(crudo).match(/export const esClienteDeAgencia\b/g) ?? []).length;
  assert.equal(cuantas, 1, 'dos declaraciones = el archivo no compila, y el merge no lo avisa');
  // Y el tipo es el tri-estado: `Promise<boolean>` pelado es la versión que colapsa el «no sé» en «no».
  assert.match(crudo, /esClienteDeAgencia = cache\(async \([^)]*\): Promise<boolean \| null> =>/,
    'el tri-estado está en el tipo; un `Promise<boolean>` acá vuelve a leer el «no sé» como «no»');
  assert.match(crudo, /NO VUELVAS A COLAPSARLA EN UN `boolean`/, 'y queda escrito al lado de la función');
});

test('LOS NUEVE USOS de `esClienteDeAgencia` resuelven el «no sé» por el lado seguro', () => {
  // ⚠️ `false` NO ES EL LADO SEGURO EN NINGUNO DE LOS NUEVE: en una puerta deja entrar, y en un upsell se lo ofrece al
  //    cliente de una agencia (Thiago, 29/10/2026: «yo no me meto con ese cliente»). Por eso todos comparan contra `false`
  //    en vez de usar el valor por verdad. Lo que cambia entre ellos es la CONSECUENCIA, no la lectura del `null`.
  const usos: [string, string][] = [
    // Puertas: con «no sé», no entra.
    ['app/agency/page.tsx', 'la puerta del Agency Dashboard'],
    ['app/m/agency/page.tsx', 'la misma puerta en el teléfono'],
    ['app/partners/page.tsx', 'la puerta de MaKo Partners'],
    ['app/m/partners/page.tsx', 'MaKo Partners en el teléfono'],
    ['lib/partners-programa.ts', 'hacerse partner por la API'],
    // Upsells: con «no sé», no se ofrece.
    ['app/configuraciones/plan/page.tsx', '«Pasar a Pro» en «Tu plan»'],
    ['app/no-esta-en-tu-plan/page.tsx', '«Pasar a Pro» en el cartel del candado'],
    // La frontera que alimenta a la barra: resuelve el «no sé» y devuelve boolean.
    ['lib/vista-de-otro.ts', 'lo que la barra le esconde, vía /api/auth/me'],
  ];
  for (const [rel, que] of usos) {
    const src = leer(rel);
    assert.match(src, /esClienteDeAgencia\(/, `${rel} tiene que llamarla (${que})`);
    for (const uso of usosEnElFuente(src)) {
      assert.equal(uso.resuelto, true,
        `${rel}: este uso lee el «no sé» como «no» (${que}). Va \`!== false\`, o guardalo y comparalo así.\n    ${uso.contexto}`);
    }
  }
  // Y la lista está CERRADA: un uso nuevo rompe el test y ahí se elige de qué lado cae su «no sé».
  const llaman = execFileSync('git', ['grep', '-l', 'esClienteDeAgencia', '--', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean)
    .filter((rel) => /\besClienteDeAgencia\(/.test(leer(rel)));
  assert.deepEqual(llaman.sort(), usos.map(([r]) => r).sort(),
    'un uso nuevo: decidí si su «no sé» BLOQUEA o NO OFRECE, y sumalo acá');
});

test('el escáner de usos CAZA la lectura por verdad (probado con las dos formas del bug)', () => {
  // ⚠️ El escáner es el que sostiene el test de arriba, así que se prueba con las roturas escritas a mano: sin esto,
  //    un escáner que no caza nada deja ese test en verde sobre los nueve usos rotos.
  const malas = [
    'if (!esSuper && (await esClienteDeAgencia(ws))) redirect(x);',          // por verdad, directo
    'const deAgencia = await esClienteDeAgencia(ws);\nif (deAgencia) irse();', // guardado y leído por verdad
    'const d = esencial && (await esClienteDeAgencia(ctx.ws));',              // el de m/mas, sin resolver
    'return esClienteDeAgencia(await getWorkspaceActual());',                 // devuelto crudo
  ];
  for (const mala of malas) {
    const usos = usosEnElFuente(mala);
    assert.equal(usos.length, 1, `el escáner tiene que ver el uso: ${mala}`);
    assert.equal(usos[0].resuelto, false, `el escáner tiene que marcarlo SIN resolver: ${mala}`);
  }
  const buenas = [
    'const deAgencia = await esClienteDeAgencia(ws);\nif (!esSuper && deAgencia !== false) redirect(x);',
    'const deAgencia = (await esClienteDeAgencia(ws)) !== false;',
    'const deAgencia = esencial && (await esClienteDeAgencia(ctx.ws)) !== false;',
    'return (await esClienteDeAgencia(await getWorkspaceActual())) !== false;',
    'if ((await esClienteDeAgencia(ws)) !== false) redirect(x);',
  ];
  for (const buena of buenas) {
    const usos = usosEnElFuente(buena);
    assert.equal(usos.length, 1, `el escáner tiene que ver el uso: ${buena}`);
    assert.equal(usos[0].resuelto, true, `el escáner tiene que aceptarlo: ${buena}`);
  }
});

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
