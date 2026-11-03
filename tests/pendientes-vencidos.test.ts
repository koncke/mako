// =============================================================================
// Un pendiente que nombra un test VERDE (o un test que ya no existe) es un pendiente VENCIDO
// =============================================================================
// EL 30/10/2026: `docs/pendientes.md` tenía una sección «Rojos en `main` sin dueño» con tres tests y LOS TRES ESTABAN VERDES. Se
// escribió el 24/10 a las 19:23, los arreglos entraron a las 20:58 y 20:59 del mismo día (95 minutos después), el documento se
// editó seis veces más hasta el 29/10 y nadie borró la sección. Seis días más tarde el Cerebro repartió esos tres rojos a dos chats.
//
// ⚠️ LA REGLA YA ESTABA ESCRITA («Al cerrar uno, borralo de acá en el mismo commit», en el encabezado del propio documento). No
// faltaba la regla: faltó cumplirla. Así que la cura es una herramienta, no otro párrafo — igual que cuando «corré los tests de tu
// área» no alcanzó y la cura fue que antes-de-subir los elija solo.
//
// LAS DOS DECISIONES QUE ESTE ARCHIVO FIJA:
//   1. AVISA, NO BLOQUEA. Un test puede estar verde por el ENTORNO (un clon atrasado fabrica verdes y rojos falsos), y frenar un
//      push por el estado de un documento sería peor que el problema. Por eso acá NO hay ningún test que mire el documento de
//      verdad: un test así bloquearía, que es justo lo que se decidió no hacer.
//   2. ES GRATIS. No corre tests en el push: la mitad textual (el test que no existe) es mirar el disco, y la del verde usa los
//      tests que `antes-de-subir` ACABA de correr. Correrlos es un modo aparte y explícito (`--correr`).
//
// ⚠️ PROBADO ROMPIÉNDOLO (30/10/2026): ver el final del archivo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { correrLosNombrados, leerPendientes, lineasDelAviso, pendientesVencidos, vencidos } from '../scripts/pendientes-vencidos.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url));

/** El documento del 24/10, con su sección de rojos, una mención que NO es un rojo y una sección de cerrados. */
const DOC = [
  '# Lo que quedó pendiente — capa del 24/10/2026',
  '',
  '**Es una foto con fecha**: al cerrar uno, borralo de acá en el mismo commit.',
  '',
  '## Sin hacer, con dueño',
  '',
  '| P9 | **El aviso de la cuenta frenada** | `lib/avisos.ts`. Lo fija tests/avisos-motor.test.ts | Avisos |',
  '',
  '## Rojos en `main` sin dueño',
  '',
  '- `tests/vuelo-mako.test.ts` — `app/automations/ChatMako.tsx` perdió la criatura al unificar los chats (`d85c86611`)',
  '- `tests/dashboard-pedidos-chat.test.ts:129` — `PanelEditarMako`',
  '- `tests/paso-ia.test.ts:135` — `lib/nutricion.ts`, la guarda `if (!lead?.telefono)`',
  '',
  '## Sin verificar en pantalla',
  '',
  '- El cartel de los mensajes sin entregar, cuando se despliegue',
  '- `tests/zona-negocio.test.ts` FALLA con el huso de Montevideo',
  '',
  '## Se cerraron hoy (100): para que los revises',
  '',
  '- `tests/progreso.test.ts` estaba rojo y se arregló en `ab12cd34e`',
].join('\n');

// ---------------------------------------------------------------------------
// Qué cuenta como «un pendiente que nombra un test rojo»
// ---------------------------------------------------------------------------

test('lee los tests de las secciones de rojos y de las líneas que dicen que falla, con su número de línea', () => {
  const e = leerPendientes(DOC);
  assert.deepEqual(e.map((x) => `${x.test}@${x.linea}`), [
    'tests/vuelo-mako.test.ts@11',
    'tests/dashboard-pedidos-chat.test.ts@12',
    'tests/paso-ia.test.ts@13',
    'tests/zona-negocio.test.ts@18',
  ]);
  assert.equal(e[0].seccion, 'Rojos en `main` sin dueño', 'la sección viaja: el aviso tiene que decir de dónde salió');
  assert.equal(e[1].lineaDelTest, '129', 'y la línea del test, si el documento la anotó');
  assert.equal(e[3].seccion, 'Sin verificar en pantalla', 'una línea que dice FALLA cuenta aunque la sección no hable de rojos');
});

test('NO cuenta el test nombrado como la red que CUBRE algo («Lo fija tests/…»): está verde a propósito, y una guarda ruidosa se apaga', () => {
  const e = leerPendientes(DOC);
  assert.ok(!e.some((x) => x.test === 'tests/avisos-motor.test.ts'), 'P9 lo nombra como la red del arreglo, no como un rojo');
});

test('NO cuenta lo que está en una sección de CERRADOS: ahí los tests verdes son la noticia, no el problema', () => {
  const e = leerPendientes(DOC);
  assert.ok(!e.some((x) => x.test === 'tests/progreso.test.ts'));
  // Y la línea dice «estaba rojo»: lo que lo salva es el encabezado de la sección, no la línea.
  assert.match(DOC.split('\n').find((l) => l.includes('progreso.test.ts'))!, /estaba rojo/);
});

// ---------------------------------------------------------------------------
// Los dos casos de «vencido»
// ---------------------------------------------------------------------------

const EXISTEN = ['tests/vuelo-mako.test.ts', 'tests/dashboard-pedidos-chat.test.ts', 'tests/paso-ia.test.ts', 'tests/zona-negocio.test.ts'];

test('VENCIDO 1 — el test que nombra está VERDE: avisa con archivo y línea del documento, y no toca a los que siguen rojos', () => {
  const v = vencidos(leerPendientes(DOC), { existe: (f) => EXISTEN.includes(f), verdes: ['tests/vuelo-mako.test.ts', 'tests/paso-ia.test.ts'] });
  assert.deepEqual(v.porVerde.map((e) => e.test), ['tests/vuelo-mako.test.ts', 'tests/paso-ia.test.ts']);
  assert.deepEqual(v.porFalta, []);
  assert.deepEqual(v.vivos.map((e) => e.test), ['tests/dashboard-pedidos-chat.test.ts', 'tests/zona-negocio.test.ts'], 'los que siguen rojos no se tocan');
  const aviso = lineasDelAviso(v).join('\n');
  assert.match(aviso, /2 pendiente\(s\) VENCIDO\(s\)/);
  assert.match(aviso, /docs\/pendientes\.md:11 → tests\/vuelo-mako\.test\.ts {3}\(«Rojos en `main` sin dueño»\)/, 'nombra archivo Y línea del documento, que es lo que hay que ir a borrar');
  assert.match(aviso, /Cerralos en el mismo commit, o escribí por qué siguen abiertos/);
  assert.match(aviso, /AVISA, no bloquea/, 'el aviso dice que no bloquea: si no, el que lo lee cree que tiene el push trabado');
});

test('VENCIDO 2 — el test que nombra YA NO EXISTE (se renombró o se borró): el pendiente apunta a la nada, y también se avisa', () => {
  const v = vencidos(leerPendientes(DOC), { existe: (f) => f !== 'tests/paso-ia.test.ts', verdes: [] });
  assert.deepEqual(v.porFalta.map((e) => e.test), ['tests/paso-ia.test.ts']);
  assert.match(lineasDelAviso(v).join('\n'), /YA NO EXISTE/);
  // Un archivo que no existe no puede estar además «verde»: se cuenta una sola vez, y como falta.
  const v2 = vencidos(leerPendientes(DOC), { existe: () => false, verdes: EXISTEN });
  assert.equal(v2.porFalta.length, 4);
  assert.equal(v2.porVerde.length, 0);
});

test('los verdes se comparan por nombre de archivo: antes-de-subir los corre con ruta absoluta y con la barra de Windows', () => {
  const v = vencidos(leerPendientes(DOC), { existe: () => true, verdes: ['C:\\dev\\wt-x\\tests\\vuelo-mako.test.ts'] });
  assert.deepEqual(v.porVerde.map((e) => e.test), ['tests/vuelo-mako.test.ts']);
});

test('sin pendientes vencidos no hay aviso: una guarda que habla cuando no pasa nada se apaga sola', () => {
  const v = vencidos(leerPendientes(DOC), { existe: () => true, verdes: [] });
  assert.deepEqual(lineasDelAviso(v), []);
  assert.deepEqual(lineasDelAviso({}), []);
});

test('un documento que no está no es un problema: devuelve vacío y sigue (un árbol viejo sin docs/pendientes.md pushea igual)', () => {
  const v = pendientesVencidos({ leer: () => { throw new Error('ENOENT'); } });
  assert.deepEqual([v.porFalta, v.porVerde, v.vivos], [[], [], []]);
  assert.equal(v.sinDoc, true);
});

// ---------------------------------------------------------------------------
// El modo caro: correr los tests nombrados
// ---------------------------------------------------------------------------

test('⚠️ los corre con `node --import tsx --test`, NUNCA con `node --test` pelado (sin tsx, un import sin extensión da ERR_MODULE_NOT_FOUND falso: 0/1 contra 6/0)', () => {
  const src = readFileSync(join(REPO, 'scripts', 'pendientes-vencidos.mjs'), 'utf8');
  assert.match(src, /\['--import', 'tsx', '--test'/, 'una guarda con el runner equivocado diría «sigue rojo» para siempre');
  let visto: string[] = [];
  correrLosNombrados(['tests/a.test.ts'], { correr: (args: string[]) => { visto = args; return { salida: 'ℹ tests 1\nℹ fail 0\n', codigo: 0 }; } } as never);
  assert.deepEqual(visto, ['tests/a.test.ts']);
});

test('el que no aparece nombrado en el pie de rojos está verde; el nombrado, no', () => {
  const salida = 'ℹ tests 2\nℹ pass 1\nℹ fail 1\n\n✖ failing tests:\n\ntest at tests/b.test.ts:3:1\n✖ falla (1ms)\n';
  const r = correrLosNombrados(['tests/a.test.ts', 'tests/b.test.ts'], { correr: () => ({ salida, codigo: 1 }) } as never);
  assert.deepEqual(r.verdes, ['tests/a.test.ts']);
  assert.deepEqual(r.rojos, ['b.test.ts']);
  assert.equal(r.juzgo, true);
});

test('⚠️ un proceso que MURIÓ sin juzgar nada no deja a nadie verde: si no, la guarda le dice «cerralo» a un test que no corrió', () => {
  const r = correrLosNombrados(['tests/a.test.ts'], { correr: () => ({ salida: '', codigo: 7 }) } as never);
  assert.deepEqual(r.verdes, [], 'sin RAM la salida viene vacía, y de una salida vacía no sale ningún veredicto');
  assert.equal(r.juzgo, false);
});

// ---------------------------------------------------------------------------
// Cómo queda cableado: gratis en el push, y sin bloquear
// ---------------------------------------------------------------------------

test('la guarda del push AVISA y no bloquea: su llamada no tiene ningún exit 1 (es la única de guardas-push.sh que no frena)', () => {
  const sh = readFileSync(join(REPO, 'scripts', 'guardas-push.sh'), 'utf8').replace(/\r\n/g, '\n');
  const bloque = /pendientes-vencidos\.mjs[\s\S]*?\nfi\n/.exec(sh)?.[0] ?? '';
  assert.ok(bloque.length > 20, 'guardas-push.sh llama a la guarda');
  assert.doesNotMatch(bloque, /exit 1/, 'ni un exit 1: frenar un push por el estado de un DOCUMENTO sería peor que el problema');
  assert.match(bloque, /\|\| true/, 'y ni un error inesperado del script puede tirar el push');
  const src = readFileSync(join(REPO, 'scripts', 'pendientes-vencidos.mjs'), 'utf8');
  assert.match(src, /return 0;\s*\/\/ ⚠️ SIEMPRE 0: avisa, no bloquea\./);
  assert.doesNotMatch(src, /process\.exit\(1\)/, 'el script tampoco sale con 1 por su cuenta');
});

test('es GRATIS en el push: la guarda no corre tests, y antes-de-subir le pasa los que ACABÓ de correr verdes', () => {
  const sh = readFileSync(join(REPO, 'scripts', 'guardas-push.sh'), 'utf8');
  assert.doesNotMatch(/pendientes-vencidos\.mjs[\s\S]*?\nfi\n/.exec(sh)?.[0] ?? '', /--correr/, 'el push nunca paga por correr los tests nombrados');
  const adsub = readFileSync(join(REPO, 'scripts', 'antes-de-subir.mjs'), 'utf8');
  assert.match(adsub, /pendientesVencidos\(\{ raiz: RAIZ, verdes: r\.verdes \}\)/, 'usa el resultado que ya está en la mano');
  assert.match(adsub, /armarVeredicto\(\{[^}]*\baviso\b[^}]*\}\)/, 'y el aviso va EN la línea del veredicto: es lo único que se lee de un push');
  const afectados = readFileSync(join(REPO, 'scripts', 'tests-afectados.mjs'), 'utf8');
  assert.match(afectados, /return \{ sinRam, total, rojos, sinCorrer, verdes,/, 'correrTests devuelve los que corrieron y pasaron');
  assert.match(afectados, /if \(!roja && PIE_DEL_RUNNER\.test\(r\.salida\)\) for \(const f of tandas\[n\]\) verdes\.add\(f\);/, 'y sólo cuenta como verde el proceso que llegó a su pie');
});

// =============================================================================
// ⚠️ PROBADO ROMPIÉNDOLO (30/10/2026; se rompe UNA pieza, se corren estas pruebas, se restaura):
//   1. `DICE_ROJO` que acepta cualquier línea → la mención «Lo fija tests/avisos-motor.test.ts» entra como rojo (test 2).
//   2. `SECCION_CERRADA` que no mira nada → «Se cerraron hoy» vuelve a avisar por los 100 cerrados (test 3).
//   3. `ES_LA_RED` sin «lo fija» → test 2.
//   4. el número de línea tomado del índice del array (0-based) → los tres `@11/@12/@13` del primer test.
//   5. `vencidos` que compara la ruta entera en vez del nombre → el test de la ruta absoluta de Windows.
//   6. un archivo inexistente que además se cuenta como verde → VENCIDO 2 (salía dos veces, y «cerralo» de algo que no está).
//   7. `lineasDelAviso` sin el archivo o sin la línea del documento → VENCIDO 1 (hay que poder ir a borrarlo).
//   8. `lineasDelAviso` sin la frase «AVISA, no bloquea» → VENCIDO 1.
//   9. `correrLosNombrados` con `node --test` pelado → el test del runner (y en la realidad: «sigue rojo» para siempre).
//  10. `correrLosNombrados` que da por verdes a los que no nombró aunque el proceso muriera → el test del proceso muerto.
//  11. un `exit 1` en el bloque de guardas-push.sh, o el `|| true` sacado → el test de «avisa y no bloquea».
//  12. `--correr` puesto en guardas-push.sh → el test de «es gratis» (el push pagaría los tests dos veces).
//  13. `correrTests` sin devolver `verdes`, o contando como verde un proceso sin pie → el último test.
// NO hay (a propósito) ningún test que mire el `docs/pendientes.md` de verdad: ése BLOQUEARÍA el push, que es exactamente lo que
// se decidió no hacer. El documento de verdad se mira con la guarda, que avisa.
// =============================================================================
