// =============================================================================
// Un PROYECTO también se repite (mig 0164): la cadena entera y la exclusión
// =============================================================================
// «Un proyecto también se puede repetir» (Martín, 25/09/2026). La 0163 le dio la columna a
// las tareas y el caso quedó a medias: el trabajo recurrente de verdad casi nunca es una
// tarea suelta, es el CONTENEDOR —Customer Success, las reuniones de marketing— del que
// cuelgan las tareas de cada semana.
//
// ── QUÉ FIJA ESTE TEST, Y POR QUÉ NO ES EL MISMO QUE EL DE LA 0163 ───────────────────
//
// Lo que rompió dos veces en este repo no fue el predicado: fue que UN eslabón de la
// cadena de escritura no nombrara el campo. `BoardShell` es UNO y lo montan los dos
// tableros —el del dueño (`plan_proyectos`) y el del CLIENTE (`tarea_categorias`, que es
// el de Mauricio)—, así que un `upd` armado campo por campo al que le falta una línea
// dibuja el interruptor, contesta 200 y no guarda nada. No hay error, no hay 403, no hay
// síntoma: se prende, se recarga, y volvió a estar apagado.
//
// Por eso la mitad de este archivo lee el FUENTE. Las funciones que hacen el trabajo viven
// en módulos con `import 'server-only'` (`lib/plan-board.ts`, `lib/todo.ts`,
// `lib/plan-reprio.ts`) y ningún test las puede importar; lo que sí se puede es cruzar los
// eslabones, que es exactamente lo que nadie hace a mano. Todo se lee con los comentarios
// BORRADOS (`vivo`): sin eso, este archivo pasaría verde contra los comentarios que
// escribí yo explicando la regla, que es la forma más cara de estar seguro.
//
// ⚠️ PROBADO ROMPIÉNDOLO, UNA REGLA POR VEZ, CON LOS NÚMEROS DE CADA ROTURA.
// Base: **11 pasan, 0 fallan**. Cada línea es un cambio hecho a propósito en el código de
// producción, corrido con `npx tsx --test tests/plan-proyecto-recurrente.test.ts`, y
// revertido:
//
//  #  Qué se rompió (en el código de producción)                        Resultado  Qué test cayó
//  1  `labelToRow` con `deadline: l.deadline || ''`, sin `llevaDeadline`  10 / 1   «le borra la fecha y el trimestre»
//  2  ídem pero sólo el `quarter`                                        10 / 1   el mismo
//  3  `labelToRow` sin la línea `recurrente: esRecurrente(l)`            10 / 1   «escribe la columna, y el round-trip no la borra»
//  4  `rowToLabel` sin `recurrente: !!r.recurrente`                      10 / 1   el mismo
//  5  `editarCategoria` sin el bloque `if (patch.recurrente !== …)`       9 / 2   «el cliente GUARDA» + «al marcarlo pierde fecha»
//  6  ese bloque sin el `upd.deadline = null`                            10 / 1   «al marcarlo pierde fecha y trimestre»
//  7  el tipo del `patch` de `categoria-editar` sin `recurrente`         10 / 1   «la ruta del cliente deja pasar el campo»
//  8  `toLabel` de TodoBoard sin `recurrente: c.recurrente`              10 / 1   «el tablero del cliente lo LEE y lo MANDA»
//  9  `saveLabel` de TodoBoard sin `recurrente` en el patch              10 / 1   el mismo
// 10  `priorizarProyectosOwner` con `const proyectos = todosLosProyectos` 10 / 1   «el ranking no puntúa lo que se repite»
// 11  el `select` de `plan_proyectos` sin la columna `recurrente`        10 / 1   el mismo
// 12  `esRecurrente` con `!!t.recurrente` en vez de `=== true`           10 / 1   «un Label sirve sin tocar el contrato»
// 13  la rama de `recurrente` movida ARRIBA de la del `deadline`         10 / 1   «al marcarlo pierde fecha y trimestre»
//
// ⚠️ LO PRIMERO QUE ENSEÑÓ LA ROTURA: las aserciones de fuente leían el archivo CRUDO y
// daban **11/0 con las roturas 3, 5 y 9 puestas** — los comentarios que explican cada regla
// contienen la palabra que la aserción buscaba, así que el test se avalaba contra su propia
// documentación. De ahí `vivo()`, que los borra.
//
// ⚠️ Y LO SEGUNDO, QUE NO SE VEÍA NI ESCRIBIENDO EL TEST NI LEYÉNDOLO: las roturas 5, 6 y
// 13 dieron **11/0 en el primer intento y el test tenía razón**. El bloque
// `if (patch.recurrente !== undefined) { … }` existe DOS VECES en `lib/todo.ts` —en
// `editarTarea` (mig 0163) y en `editarCategoria` (mig 0164), palabra por palabra— y el
// arnés estaba rompiendo el primero. O sea: estaba midiendo la mitad de las tareas creyendo
// que medía la de los proyectos. Rompiendo la ÚLTIMA ocurrencia dan 9/2, 10/1 y 10/1. Dos
// cosas quedan de ahí: que estas aserciones se anclan al CUERPO de la función y nunca al
// archivo (si no, la gemela de arriba las satisface), y que cuando una rotura «no hace
// fallar nada» la primera hipótesis es el arnés, no el test.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { esRecurrente, sinRecurrentes, soloRecurrentes, llevaDeadline } from '../lib/plan-recurrentes';
import type { Label } from '../app/plan/board/types';

const raiz = resolve(import.meta.dirname, '..');
// El CR se saca EN EL QUE LEE, no en el que escribe: el repo es CRLF en disco y
// cualquier corte anclado en un salto de linea daria -1 sin decir por que (AGENTS.md,
// «en Windows todo texto que cruza de una herramienta a otra trae CR»).
const leer = (...p: string[]) => readFileSync(resolve(raiz, ...p), 'utf8').replace(/\r\n/g, '\n');
// Los `//` ANTES que los `/* */`: al revés, un `*/` adentro de un comentario de línea abre
// un bloque que se cierra ochenta líneas después y todo eso queda invisible. Es la trampa
// que el guard de voseo ya pagó (AGENTS.md).
const vivo = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const planBoard = vivo(leer('lib', 'plan-board.ts'));
const todo = vivo(leer('lib', 'todo.ts'));
const rutaTodo = vivo(leer('app', 'api', 'todo', 'route.ts'));
const todoBoard = vivo(leer('app', 'plan', 'TodoBoard.tsx'));

/** El cuerpo de una función/const declarada en un archivo, hasta el corte que se pida. */
function cuerpo(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.notEqual(i, -1, `no encontré «${desde}» en el fuente: el test quedó viejo, no el código`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.notEqual(j, -1, `no encontré el final «${hasta}» después de «${desde}»`);
  return src.slice(i, j);
}

const proyecto = (extra: Partial<Label> = {}): Label => ({
  id: 'p1', emoji: '📁', name: 'Customer Success', color: '#2F6FED', score: 88,
  detalle: '', historial: [], ...extra,
});

// ── EL CONTRATO: un Label entra por el MISMO predicado, sin tocarlo ───────────────────
// «`esRecurrente` ya acepta `{ recurrente?: boolean }`, así que sirve para un Label sin
// tocarlo. NADIE escribe `x.recurrente` suelto en una pantalla.»

test('un Label sirve sin tocar el contrato de plan-recurrentes', () => {
  assert.equal(esRecurrente(proyecto({ recurrente: true })), true);
  assert.equal(esRecurrente(proyecto()), false, 'un proyecto sin la columna NO se repite: ante la duda, compite');
  assert.equal(esRecurrente(proyecto({ recurrente: undefined })), false);
  // `=== true`, no truthy: el estado optimista del navegador crea el proyecto antes de que
  // exista la fila, y marcarlo de más lo saca del ranking sin que nadie lo haya pedido.
  assert.equal(esRecurrente({ recurrente: 1 as unknown as boolean }), false);
});

test('sinRecurrentes / soloRecurrentes parten el MISMO universo de proyectos', () => {
  const ps = [proyecto({ id: 'p1', recurrente: true }), proyecto({ id: 'p2' }), proyecto({ id: 'p3', recurrente: true })];
  assert.deepEqual(sinRecurrentes(ps).map((p) => p.id), ['p2']);
  assert.deepEqual(soloRecurrentes(ps).map((p) => p.id), ['p1', 'p3']);
  assert.equal(sinRecurrentes(ps).length + soloRecurrentes(ps).length, ps.length, 'ninguno se pierde ni se cuenta dos veces');
});

test('un proyecto que se repite no lleva deadline', () => {
  assert.equal(llevaDeadline(proyecto({ recurrente: true })), false);
  assert.equal(llevaDeadline(proyecto({ deadline: '2026-12-31' })), true);
});

// ── LA MITAD DEL DUEÑO: el mapper es el choke point ───────────────────────────────────

test('el mapper del dueño escribe la columna, y el round-trip no la borra', () => {
  const ida = cuerpo(planBoard, 'function labelToRow(', '\n}');
  assert.match(ida, /recurrente:\s*esRecurrente\(l\)/, 'labelToRow no escribe `recurrente`: el interruptor del dueño no guarda nada');
  const vuelta = cuerpo(planBoard, 'function rowToLabel(', '\n}');
  assert.match(vuelta, /recurrente:\s*!!r\.recurrente/,
    'rowToLabel no lee `recurrente`: sale `undefined` en memoria y el próximo upsert de la fila entera BORRA la columna');
});

test('el mapper del dueño le borra la fecha y el trimestre a lo que se repite', () => {
  const ida = cuerpo(planBoard, 'function labelToRow(', '\n}');
  assert.match(ida, /deadline:\s*llevaDeadline\(l\)\s*\?/,
    'el deadline de un proyecto no pasa por `llevaDeadline`: el Perro, una reunión o un lote le ponen fecha a algo sin fin');
  assert.match(ida, /quarter:\s*llevaDeadline\(l\)\s*\?/,
    'el quarter no pasa por `llevaDeadline`: se derivaría de una fecha que no debería existir');
});

test('el ranking de proyectos no puntúa lo que se repite, y lee la columna para saberlo', () => {
  const fn = cuerpo(planBoard, 'export async function priorizarProyectosOwner(', 'function resumenDeProyecto(');
  assert.match(fn, /from\('plan_proyectos'\)\.select\('[^']*\brecurrente\b/,
    'el select enumera columnas y `recurrente` no está: `esRecurrente` contestaría false para todos y el filtro sería decorativo');
  assert.match(fn, /const\s+proyectos\s*=\s*sinRecurrentes\(/,
    'el universo del ranking no excluye lo que se repite: se lleva un escalón de la escalera contigua y puede quedar de norte');
});

// ── LA MITAD DEL CLIENTE, que es la que se olvidó la vez pasada ───────────────────────

test('el tablero del cliente GUARDA el campo: el `upd` lo nombra', () => {
  // `editarCategoria` arma su `upd` campo por campo. Lo que no se nombra NO llega, y el
  // modo de falla es un control que se dibuja y no guarda nada.
  const fn = cuerpo(todo, 'export async function editarCategoria(', 'return catRow(data)');
  assert.match(fn, /if\s*\(patch\.recurrente\s*!==\s*undefined\)/, 'editarCategoria ignora `recurrente`');
  assert.match(fn, /upd\.recurrente\s*=/, 'editarCategoria no escribe la columna');
  assert.match(cuerpo(todo, 'export async function crearCategoria(', 'return catRow(data)'), /recurrente:\s*repite/,
    'crearCategoria no escribe la columna: un proyecto no puede NACER recurrente');
  assert.match(cuerpo(todo, 'const catRow =', '\n};'), /c\.recurrente\s*=\s*!!r\.recurrente/,
    'catRow no normaliza la columna: el tipo diría boolean y llegaría undefined');
});

test('al marcarlo, el cliente pierde fecha y trimestre en la MISMA escritura', () => {
  const fn = cuerpo(todo, 'export async function editarCategoria(', 'return catRow(data)');
  const rama = cuerpo(fn, 'if (patch.recurrente !== undefined)', '\n  if (patch.detalle');
  assert.match(rama, /upd\.deadline\s*=\s*null/, 'marcarlo deja la fecha vieja viva y el aviso de vencimientos la sigue leyendo');
  assert.match(rama, /upd\.quarter\s*=\s*null/, 'marcarlo deja el trimestre derivado de una fecha que ya no debería existir');
  // Y va DESPUÉS de las líneas de deadline/quarter: si fuera antes, un patch que toca las
  // dos cosas a la vez le devolvería la fecha al proyecto que se acaba de marcar.
  assert.ok(fn.indexOf('upd.recurrente') > fn.indexOf('upd.deadline = dateOk('),
    'la rama de `recurrente` va después de la del deadline, o el mismo patch le repone la fecha');
});

test('la ruta del cliente deja pasar el campo en el alta y en el editar', () => {
  const crear = cuerpo(rutaTodo, "if (action === 'categoria-crear')", "if (action === 'categoria-editar')");
  assert.match(crear, /crearCategoria\([^)]*recurrente\s*\)/, 'categoria-crear no le pasa `recurrente` a lib/todo');
  const editar = cuerpo(rutaTodo, "if (action === 'categoria-editar')", "if (action === 'categoria-borrar')");
  assert.match(editar, /recurrente\?:\s*boolean/,
    'el tipo del patch de categoria-editar no declara `recurrente`: el navegador lo manda y el cast lo tira');
  // Y la tarea del cliente también nace pudiendo repetirse: `NuevaTarea` lo soporta desde
  // la 0163 y esta rama no lo nombraba, así que nacía compitiendo (mig 0164).
  assert.match(cuerpo(rutaTodo, "if (action === 'crear')", "if (action === 'crear-lote')"), /recurrente:\s*t\.recurrente/,
    'el alta de tarea del cliente no pasa `recurrente`');
});

test('el tablero del cliente lo LEE y lo MANDA', () => {
  assert.match(cuerpo(todoBoard, 'const toLabel =', '\n\n'), /recurrente:\s*c\.recurrente/,
    'toLabel no lee la columna: el interruptor nace apagado en cada carga aunque la fila diga true');
  assert.match(cuerpo(todoBoard, 'createLabel: async (l)', '},'), /recurrente:\s*!!l\.recurrente/,
    'createLabel no manda `recurrente`');
  assert.match(cuerpo(todoBoard, 'saveLabel: async (l)', '\n'), /recurrente:\s*!!l\.recurrente/,
    'saveLabel no manda `recurrente`: prender el interruptor no guarda nada');
});

// ── LA DECISIÓN ESPEJO, escrita para que no se revierta por descuido ──────────────────

test('un proyecto que se repite NO arrastra a sus tareas con fin', () => {
  // La pregunta que el pedido obliga a contestar: ¿sus tareas siguen compitiendo? Sí. El
  // corte es del CONTENEDOR. «Armar el documento de onboarding de Vertice» cuelga de
  // Customer Success, tiene un entregable y se cierra una sola vez: sacarla del ranking
  // por vivir adentro de algo que se repite la volvería invisible justo cuando hay que
  // hacerla. Las dos marcas son independientes, y esto lo fija: el predicado mira el
  // campo del ítem que recibe, nunca el de su padre.
  const conFin = { id: 't1', recurrente: false };
  const seRepite = { id: 't2', recurrente: true };
  assert.deepEqual(sinRecurrentes([conFin, seRepite]).map((t) => t.id), ['t1']);
  assert.equal(esRecurrente(conFin), false, 'la tarea con fin compite aunque su proyecto se repita');
  assert.equal(llevaDeadline(conFin), true, 'y sigue llevando deadline: el que no lleva es el proyecto');
});
