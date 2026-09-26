// =============================================================================
// La FRECUENCIA de lo que se repite: el contrato, la invariante y la CADENA (mig 0165)
// =============================================================================
// «Una tarea o proyecto recurrente se le debe eliminar el quarter y deadline, pero se debe
// dejar una casilla de "Frecuencia", algo similar a Google Calendar con una reunión que se
// puede repetir diariamente, 1 vez a la semana, 1 vez al mes, etc.» (26/09/2026).
//
// Lo que este test fija son TRES cosas, y la tercera es la que más costó en este repo:
//
//  1. EL CONTRATO. Una lista sola (`FRECUENCIAS`), un saneo solo (`frecuenciaOk`) y un
//     rótulo solo (`ROTULO_FRECUENCIA`). La columna de la 0165 NO tiene `check` a
//     propósito, así que el saneo del código es la única guarda que existe.
//  2. LA INVARIANTE. `frecuenciaDe`: una frecuencia sin `recurrente` no existe. Se aplica
//     en los MAPPERS —por donde pasan todas las escrituras, incluidas las del Perro, las de
//     una reunión y las de un lote— y no en el handler del formulario.
//  3. LA CADENA, ENTERA Y EN LAS DOS MITADES. Es la parte que no se ve compilando: cada
//     `upd` que se arma campo por campo, cada payload que enumera claves y cada mapper que
//     castea una fila son una puerta donde el campo se cae en SILENCIO. `editarTarea`,
//     `editarCategoria` y las cuatro ramas de `/api/todo` son exactamente eso — y la mitad
//     del CLIENTE ya se olvidó DOS veces con `recurrente` (migs 0163 y 0164).
//     Y el final de la cadena: que las dos acciones nuevas del board TENGAN CALL SITE. Una
//     acción que nadie llama compila, pasa los tests y no existe en pantalla.
//
// ⚠️ PROBADO ROMPIÉNDOLO, UNA ROTURA POR VEZ, CON LOS NÚMEROS DE CADA UNA. Base: **18
// pasan, 0 fallan** (`node --import tsx --test tests/plan-frecuencia.test.ts`). Cada línea
// es un cambio hecho a propósito en el código de producción, corrido, y revertido:
//
//  #  Qué se rompió                                                         Result.  Qué cayó
//  1  `frecuenciaOk` con `v ? (v as Frecuencia) : null` (sin mirar la lista)  13 / 5  los 3 del saneo + «no se puede escribir como una fecha» + «sin `recurrente` no existe»
//  2  `frecuenciaDe` devolviendo `frecuenciaOk(t.frecuencia)` a secas         17 / 1  «una frecuencia sin `recurrente` no existe»
//  3  quitar `frecuencia: frecuenciaDe(t)` de `taskToRow`                     16 / 2  «los cuatro mappers del DUEÑO» + «la invariante se aplica en los MAPPERS»
//  4  quitar `upd.frecuencia = frecuenciaDe(…)` de `editarTarea`              16 / 2  «el `upd` del CLIENTE» + «la invariante se aplica en los MAPPERS»
//  5  lo mismo en `editarCategoria` (la otra rama de 4)                       16 / 2  los MISMOS dos tests que 4
//  6  quitar `frecuencia: frecuenciaOk(t.frecuencia)` del alta de /api/todo   17 / 1  «las CUATRO ramas de /api/todo»
//  7  quitar `frecuencia` de `editPatch` en TodoBoard.tsx                     17 / 1  «el board del CLIENTE la manda en los dos sentidos»
//  8  sacar `setFrecuencia` del `return` de `useBoard`                        17 / 1  «las dos acciones están en el `return`»
//  9  TODOS los `board.setFrecuencia(` de BoardShell → `board.setRecurrente(` 17 / 1  «las dos acciones TIENEN call site»
// 10  `else upd.frecuencia = null` → `else {}` en `editarTarea`               17 / 1  «al dejar de repetirse se BORRA»
// 11  `label: 'Se repite una vez por semana'` en `FRECUENCIAS`                16 / 2  «las etiquetas no repiten "Se repite"» + «cada etiqueta entra en un toast»
// 12  `ROTULO_FRECUENCIA = '¿Cada cuánto se repite?'`                         17 / 1  «el rótulo es el NOMBRE de la cosa»
// 13  quitar `frecuencia: textoFrecuencia(t.frecuencia)` de `leerTablero`     17 / 1  «la frecuencia viaja en la API de MaKo»
//
// ⚠️ CUATRO COSAS QUE LA ROTURA ENSEÑÓ Y NO SE VEÍAN ESCRIBIENDO EL TEST:
//
//  · **La rotura 1 tumbó CINCO tests, no los tres del saneo que esperaba.** Los dos extra
//    dicen algo que no se ve leyendo el código: sin la lista, `frecuenciaOk` acepta
//    `'2026-07-05'`, o sea que **el enum cerrado es lo único que impide que la frecuencia se
//    vuelva una fecha** — el modo de falla que el pedido nombra con todas las letras. No es
//    prolijidad de tipos: es la guarda.
//  · **Las roturas 3, 4 y 5 encontraron dos aserciones FLOJAS, y las flojas pasaban.**
//    `cuerpo(...).includes('frecuenciaDe')` se cumplía con el COMENTARIO que explica la
//    regla, e `includes('upd.frecuencia =')` con la línea que la BORRA al desmarcar. Las dos
//    daban verde sobre la línea borrada. Las dos se apretaron a buscar la expresión exacta;
//    queda escrito porque es el modo de falla de cualquier test de texto: **la prosa que
//    explica una regla es justo lo que sobrevive a que alguien borre la regla.**
//  · **La rotura 9, al primer intento, dio 18/0 — y el test tenía razón.** Se había cambiado
//    UN call site de `board.setFrecuencia` y quedaba otro vivo: el otro paquete agregó un
//    segundo camino (el atajo de la vista Recurrentes), así que el control seguía guardando.
//    Para medir este test hay que reemplazarlos TODOS. El que venga a comprobarlo va a
//    romper uno y concluir que no sirve; no es eso.
//  · **4 y 5 comparten test a propósito**: son las dos ramas del mismo caso —la tarea y la
//    categoría del cliente— y no hay un default correcto entre ellas. Es la mitad que ya se
//    olvidó dos veces con `recurrente`.
//
// ⚠️ `lib/plan-board.ts`, `lib/todo.ts` y `app/api/todo/route.ts` son `server-only` y
// `useBoard`/`BoardShell`/`TodoBoard` son `'use client'` con React adentro: los seis se leen
// como TEXTO, igual que hace `tests/plan-recurrente-nace.test.ts`. `lib/plan-recurrentes.ts`
// sí se importa — no lleva `server-only` a propósito, justamente para esto.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FRECUENCIAS, ROTULO_FRECUENCIA, frecuenciaOk, frecuenciaDe, textoFrecuencia, type Frecuencia,
} from '../lib/plan-recurrentes';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// ⚠️ SIN LOS `\r`. En Windows el árbol de trabajo es CRLF y el repo guarda LF, así que
// cualquier búsqueda de una frase que cruce de renglón pasa en un clon y falla en el otro.
const leer = (...p: string[]): string => readFileSync(resolve(RAIZ, ...p), 'utf8').replace(/\r/g, '');
const cuenta = (src: string, aguja: string): number => src.split(aguja).length - 1;

const PLAN_BOARD = leer('lib', 'plan-board.ts');
const TODO = leer('lib', 'todo.ts');
const RUTA_TODO = leer('app', 'api', 'todo', 'route.ts');
const TODO_BOARD = leer('app', 'plan', 'TodoBoard.tsx');
const USE_BOARD = leer('app', 'plan', 'board', 'useBoard.ts');
const SHELL = leer('app', 'plan', 'board', 'BoardShell.tsx');
const HELPERS = leer('lib', 'api-mako', 'areas', 'plan.helpers.ts');

/** El cuerpo de una función del fuente, desde su firma hasta la siguiente declaración de
 *  primer nivel. Alcanza para preguntar «¿esta función nombra el campo?», que es lo único
 *  que la capa de texto puede contestar y justo lo que se cae en silencio. */
function cuerpo(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const resto = src.slice(i + firma.length);
  const fin = resto.search(/\n(export |function |async function )/);
  return fin >= 0 ? resto.slice(0, fin) : resto;
}

// ── 1. EL CONTRATO ───────────────────────────────────────────────────────────────────

test('frecuenciaOk sanea CONTRA LA LISTA: lo que no esté entra como null', () => {
  // La columna de la 0165 no tiene `check` a propósito, así que esto es la única guarda.
  // Un string libre guardado ahí no da error: deja una recurrente que dice «cada 15 días
  // más o menos», que ninguna pantalla sabe pintar y que un agente repite como un dato.
  for (const f of FRECUENCIAS) assert.equal(frecuenciaOk(f.id), f.id);
  for (const basura of ['', 'quincenalmente', 'cada semana', 'weekly', '2026-07-05', 7, true, null, undefined, {}, []]) {
    assert.equal(frecuenciaOk(basura), null, `«${JSON.stringify(basura)}» no puede entrar como frecuencia`);
  }
});

test('la ETIQUETA no es un id: guardar «Cada semana» en la columna da null', () => {
  // Es el error de tipeo caro, y el que un cast no ve: el `<select>` muestra el label, así
  // que quien escriba un payload a mano —el Doer, un script, un lote— va a copiar lo que
  // leyó en pantalla. Con un cast quedaría guardado y `textoFrecuencia` devolvería null
  // para siempre: la tarjeta diría «Indefinida» sobre una fila que tiene el dato adentro.
  for (const f of FRECUENCIAS) assert.equal(frecuenciaOk(f.label), null, `«${f.label}» es la etiqueta, no el id`);
});

test('el saneo y la lista no pueden divergir: `frecuenciaOk` se DERIVA de `FRECUENCIAS`', () => {
  const ids = FRECUENCIAS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length, 'ids repetidos en FRECUENCIAS');
  assert.equal(new Set(FRECUENCIAS.map((f) => f.label)).size, ids.length, 'dos frecuencias con la misma etiqueta');
  // El día que alguien agregue una frecuencia, el saneo Y el texto tienen que aceptarla sin
  // tocar nada más. Si esto se puede romper agregando una fila, hay una segunda lista.
  const inventada = 'bimestral' as Frecuencia;
  assert.equal(frecuenciaOk(inventada), null, 'sin estar en la lista, no pasa');
  FRECUENCIAS.push({ id: inventada, label: 'Cada dos meses' });
  try {
    assert.equal(frecuenciaOk(inventada), inventada, 'agregarla a la lista alcanza: el saneo la deriva');
    assert.equal(textoFrecuencia(inventada), 'Cada dos meses', 'y el texto también');
  } finally { FRECUENCIAS.pop(); }
  assert.equal(frecuenciaOk(inventada), null, 'y al sacarla, vuelve a no existir');
});

test('textoFrecuencia sale de la MISMA lista, y null no es una ausencia', () => {
  for (const f of FRECUENCIAS) assert.equal(textoFrecuencia(f.id), f.label);
  assert.equal(textoFrecuencia(null), null, '«se repite y no se dijo cada cuánto» es un estado real');
  assert.equal(textoFrecuencia('cada tanto'), null);
});

test('el rótulo es el NOMBRE de la cosa, no una pregunta', () => {
  // «Un campo de una columna de campos se nombra, no se interroga» — es el mismo corte que
  // Martín pidió el 26/09 para «¿Se repite para siempre?» → «Tarea recurrente».
  assert.equal(ROTULO_FRECUENCIA, 'Frecuencia');
  assert.ok(!ROTULO_FRECUENCIA.includes('?') && !ROTULO_FRECUENCIA.includes('¿'), 'un rótulo no pregunta');
  assert.ok(ROTULO_FRECUENCIA.split(/\s+/).length <= 3, 'el techo de un rótulo son 3 palabras');
});

test('las etiquetas no repiten «Se repite», ni dicen BAU, ni son rioplatenses', () => {
  for (const f of FRECUENCIAS) {
    assert.ok(!/se repite/i.test(f.label), `«${f.label}»: el rótulo del campo ya dice que se repite`);
    assert.ok(!/\bbau\b/i.test(f.label), 'en el producto NUNCA se escribe BAU');
    // El producto se usa en México: «aquí», nunca «acá». Se fija sobre el catálogo que se
    // DIBUJA, que es lo que lee un cliente.
    assert.ok(!/ac[áa]\b/i.test(f.label), `«${f.label}»: en México se dice «aquí»`);
  }
});

test('cada etiqueta entra en un toast: el techo son 4 palabras', () => {
  // La etiqueta ES el texto del cambio que sale en la barra de deshacer de 5 segundos
  // (`useBoard.setFrecuencia`), y la regla de la casa para esa superficie son 3-4 palabras:
  // «el mensaje del botón de deshacer es MUY largo, por dios deja de escribir textos así de
  // largos, que sea una regla» (26/09/2026).
  for (const f of FRECUENCIAS) {
    const n = f.label.trim().split(/\s+/).length;
    assert.ok(n <= 4, `«${f.label}» son ${n} palabras; el techo del toast son 4`);
  }
});

test('una frecuencia NO se puede escribir como una fecha', () => {
  // De esto depende todo el diseño: un deadline LLEGA y vence, una frecuencia es un ritmo
  // que no vence nunca. El enum cerrado es lo que impide que alguien «reuse» el campo para
  // guardar la fecha del próximo ciclo y le devuelva al motor de vencimientos algo que
  // leer — o sea, que vuelva el «la junta semanal está atrasada» que las 0163/0164 sacaron.
  for (const fecha of ['2026-07-05', '05/07/2026', '2026-Q3']) {
    assert.equal(frecuenciaOk(fecha), null, `«${fecha}» es una fecha, no un ritmo`);
  }
  for (const f of FRECUENCIAS) assert.ok(!/\d/.test(f.label), `«${f.label}» no puede parecer una fecha`);
});

// ── 2. LA INVARIANTE ─────────────────────────────────────────────────────────────────

test('una frecuencia sin `recurrente` no existe', () => {
  assert.equal(frecuenciaDe({ recurrente: true, frecuencia: 'semanal' }), 'semanal');
  assert.equal(frecuenciaDe({ recurrente: false, frecuencia: 'semanal' }), null, 'lo que no se repite no tiene ritmo');
  assert.equal(frecuenciaDe({ frecuencia: 'semanal' }), null, 'sin el flag (tarjeta optimista, fila vieja) = null');
  assert.equal(frecuenciaDe({ recurrente: true }), null, 'se repite y no se dijo cada cuánto');
  assert.equal(frecuenciaDe({}), null);
  // El saneo se aplica DESPUÉS del flag, no en vez de él: son dos capas, no una.
  assert.equal(frecuenciaDe({ recurrente: true, frecuencia: 'cada tanto' }), null);
  // Y hereda el `=== true` de `esRecurrente`: un 1 del JSON de un modelo no marca nada.
  assert.equal(frecuenciaDe({ recurrente: 1 as unknown as boolean, frecuencia: 'semanal' }), null);
});

test('la invariante se aplica en los MAPPERS, no en el formulario', () => {
  // Es la lección que ya pagaron el Quarter y el deadline: la regla vivía en el único
  // camino que pasa por el navegador y todo lo que escribe el SERVER —el Perro, una
  // reunión, un lote— pasaba de largo. Acá se exige en la LECTURA y en la ESCRITURA de las
  // dos mitades: si sólo se aplicara al escribir, una fila desalineada de antes seguiría
  // llegando al navegador y el próximo guardado la devolvería tal cual.
  // ⚠️ `frecuencia: frecuenciaDe(` Y NO `frecuenciaDe` A SECAS. La primera versión de este
  // test buscaba el nombre suelto, y sacarle la línea a `taskToRow` la dejó en VERDE: el
  // comentario de arriba de esa línea NOMBRA la función, así que la aserción se cumplía con
  // la explicación de la regla en vez de con la regla. Un test de texto tiene que buscar
  // código, no prosa — la prosa es justo lo que sobrevive a que alguien borre la línea.
  for (const fn of ['rowToTask', 'taskToRow', 'rowToLabel', 'labelToRow']) {
    assert.ok(/frecuencia: frecuenciaDe\(/.test(cuerpo(PLAN_BOARD, `function ${fn}(`)), `${fn} no pasa por frecuenciaDe`);
  }
  assert.ok(/t\.frecuencia = frecuenciaDe\(/.test(TODO), 'rowTo (tarea del cliente) no sanea la frecuencia');
  assert.ok(/c\.frecuencia = frecuenciaDe\(/.test(TODO), 'catRow (proyecto del cliente) no sanea la frecuencia');
  assert.equal(cuenta(TODO, 'frecuenciaDe('), 6, 'los seis puntos del cliente: 2 lecturas, 2 altas, 2 ediciones');
});

test('al dejar de repetirse se BORRA la frecuencia, en las dos mitades', () => {
  // La simétrica de «al marcarla se le va la fecha». Sin esto queda una fila con
  // `recurrente: false` y `frecuencia: 'semanal'`: un valor que ninguna pantalla dibuja
  // (el campo sólo existe al lado de «Se repite») y que la API de MaKo sí publica.
  assert.equal(cuenta(TODO, 'else upd.frecuencia = null'), 2, 'el editar de la tarea Y el de la categoría');
  // En el navegador: en su propia entrada del historial (tarea) y en la misma (proyecto).
  assert.ok(/patchLogExplicit\(id, 'frecuencia', null, t\.frecuencia/.test(USE_BOARD), 'la tarea no la suelta al desmarcarse');
  assert.ok(/recurrente: false, frecuencia: null/.test(USE_BOARD), 'el proyecto no la suelta al desmarcarse');
});

// ── 3. LA CADENA ─────────────────────────────────────────────────────────────────────

test('los cuatro mappers del DUEÑO nombran el campo', () => {
  assert.equal(cuenta(PLAN_BOARD, 'frecuencia: frecuenciaDe('), 4, 'rowToTask, taskToRow, rowToLabel y labelToRow');
});

test('el `upd` del CLIENTE se arma campo por campo: lo que no se nombra no llega', () => {
  // `editarTarea` y `editarCategoria` son la mitad que ya se olvidó dos veces con
  // `recurrente`. Un campo que no está en su `upd` deja el control dibujado en el tablero
  // de Mauricio contestando 200 y sin guardar nada.
  // ⚠️ `upd.frecuencia = frecuenciaDe(`, NO `upd.frecuencia =` A SECAS. Cada uno de estos
  // dos `upd` escribe el campo DOS veces —una al desmarcar («borrala») y otra al guardar el
  // valor elegido—, así que buscar el nombre suelto deja la aserción en verde cuando falta
  // la segunda: medido sacándole la línea a `editarTarea`, este test pasaba igual.
  for (const fn of ['export async function editarTarea(', 'export async function editarCategoria(']) {
    const src = cuerpo(TODO, fn);
    assert.ok(src.includes('patch.frecuencia !== undefined'), `${fn} no mira patch.frecuencia`);
    assert.ok(/upd\.frecuencia = frecuenciaDe\(/.test(src), `${fn} no guarda la frecuencia elegida`);
  }
  // Y las dos ALTAS: si sólo el editar la guardara, una recurrente nacería sin ritmo.
  assert.ok(cuerpo(TODO, 'export async function crearTarea(').includes('frecuencia: frecuenciaDe(input)'), 'el alta de una tarea del cliente');
  assert.ok(TODO.includes('recurrente: repite, frecuencia: frecuenciaDe('), 'el alta de un proyecto del cliente');
});

test('las CUATRO ramas de /api/todo la dejan pasar, saneada', () => {
  // La ruta es la PUERTA: arma cada payload enumerando claves, así que una rama que no la
  // nombre la tira en silencio — y el saneo va acá porque este body lo escribe cualquiera.
  assert.ok(RUTA_TODO.includes('import { frecuenciaOk'), 'la ruta no importa el saneo');
  assert.ok(/frecuencia: frecuenciaOk\(t\.frecuencia\)/.test(RUTA_TODO), 'la rama «crear»');
  assert.ok(/frecuencia: patch\.frecuencia === undefined \? undefined : frecuenciaOk\(patch\.frecuencia\)/.test(RUTA_TODO), 'la rama «editar»: undefined ≠ null');
  assert.ok(/quarter, recurrente, frecuencia\)/.test(RUTA_TODO), 'la rama «categoria-crear»');
  assert.ok(/frecuenciaOk\(frecCruda\)/.test(RUTA_TODO), 'la rama «categoria-editar»');
});

test('el board del CLIENTE la manda en los dos sentidos', () => {
  // `toBoard`/`toLabel` son la puerta de ENTRADA: sin ellas el selector nace vacío en cada
  // carga aunque la fila tenga el dato — o sea que elegir un ritmo «no hace nada» al
  // recargar, que es exactamente cómo se reportó el bug hermano de `recurrente`.
  assert.ok(/recurrente: t\.recurrente, frecuencia: t\.frecuencia/.test(TODO_BOARD), 'toBoard');
  assert.ok(/recurrente: c\.recurrente, frecuencia: c\.frecuencia/.test(TODO_BOARD), 'toLabel');
  // Y los cuatro payloads de SALIDA (editar y alta de tarea, alta y editar de proyecto).
  assert.equal(cuenta(TODO_BOARD, 'frecuencia: d.frecuencia ?? null'), 2, 'los dos payloads de una tarea');
  assert.equal(cuenta(TODO_BOARD, 'frecuencia: l.frecuencia ?? null'), 2, 'los dos payloads de un proyecto');
});

test('las dos acciones están en el `return` de useBoard: si no, no existen', () => {
  // El modo de falla que este repo pagó dos veces el 25/09/2026: la capacidad queda
  // escrita, el typecheck pasa, los tests pasan, y en pantalla no hay nada que tocar
  // porque el board nunca la recibió.
  const ret = USE_BOARD.slice(USE_BOARD.lastIndexOf('\n  return {'));
  for (const accion of ['setFrecuencia', 'setLabelFrecuencia']) {
    assert.ok(new RegExp(`[,{\\s]${accion}[,\\s]`).test(ret), `${accion} no está en el objeto que devuelve useBoard`);
  }
});

test('las dos acciones TIENEN call site, y es el suyo', () => {
  // Contar los call sites es lo único que separa «lo escribí» de «se puede usar». Y el
  // error barato es apuntar el control a la acción de al lado: las dos existen, el
  // typecheck queda en verde, el selector se dibuja y el valor no se guarda.
  assert.ok(cuenta(SHELL, 'board.setFrecuencia(') >= 1, 'nadie llama a board.setFrecuencia: el selector de una TAREA no guarda');
  assert.ok(cuenta(SHELL, 'board.setLabelFrecuencia(') >= 1, 'nadie llama a board.setLabelFrecuencia: el de un PROYECTO no guarda');
});

test('la frecuencia viaja en la API de MaKo, pegada a `se_repite`', () => {
  // Un agente que ve «se repite» y no ve cada cuánto no puede decidir nada con eso: «la
  // junta de los miércoles» y «el seguimiento diario» se le ven idénticas. Va en TEXTO
  // —«Cada semana»— y no como id: lo que el modelo va a hacer con el dato es decírselo a
  // una persona, y traducir es donde inventa.
  assert.ok(/se_repite: true, frecuencia: t\.frecuencia/.test(HELPERS), 'tareaCompacta no manda el ritmo');
  assert.equal(cuenta(HELPERS, 'textoFrecuencia('), 4, 'las dos mitades del tablero, tareas y proyectos');
});
