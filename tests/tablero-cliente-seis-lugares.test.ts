// =============================================================================
// Un campo del tablero son SEIS lugares, y el typecheck no ve ninguno (#157)
// =============================================================================
// AGENTS.md lo tiene enumerado y con el precio pagado cuatro veces (la prioridad a
// mano, el Quarter, la recurrencia, el cliente). El modo de falla es siempre el mismo:
// el control se dibuja, la request contesta 200 y no se guarda nada — que desde afuera
// se lee como que la app está rota.
//
// LO MEDIDO el 30/09/2026 contra producción, que es de donde salió esta tarea:
//   · `notas`, `deadline_razon`, `hacelo_en`: la COLUMNA existía desde las migs 0114 y
//     0115 y **0 filas** de `experimento_tareas` tenían algo escrito. Lo único que
//     funcionaba era la lectura, y de casualidad: `rowTo` castea la fila entera, así que
//     el valor llegaba en runtime mientras el tipo no lo declaraba.
//   · `impacto` / `esfuerzo`: la columna no existía (mig 0184).
//
// Este guard lee el CÓDIGO y no el comportamiento a propósito: los seis lugares son
// cinco archivos, y el único test que los ata es uno que los abre.
//
// ⚠️ Y CADA CAPA SE BUSCA DENTRO DE SU BLOQUE, no en el archivo entero. La primera
// versión preguntaba `assert.match(TODO, /notas:/)` y dio VERDE sobre CUATRO DE LAS
// CINCO roturas: `notas:` aparece también en `Categoria`, en `toLabel`, en los
// comentarios y en la línea que pasa el valor. Un guard que lee un archivo entero
// encuentra lo que el archivo DICE de sí mismo, no lo que hace — la misma trampa que el
// `doesNotMatch(/default \d/)` de abajo, que fallaba contra su propio comentario. Es la
// razón entera por la que un test se prueba rompiéndolo.
//
// ⚠️ PROBADO ROMPIÉNDOLO, cinco veces (30/09/2026) — una por capa, y cada una cae SOLA:
//   1. `notas` fuera del tipo `Tarea`     → cae la 2
//   2. `t.hacelo_en = …` fuera de `rowTo` → cae la 3
//   3. los cinco fuera de `toBoard`       → cae la 4
//   4. los cinco fuera de `editPatch`     → cae la 5
//   5. los cinco fuera de `TareaBody`     → cae la 6
// Que caiga UNA y no todas es parte del diseño: un guard que junte las seis capas en un
// solo test dice que algo se rompió y no CUÁL, que es lo único que ahorra tiempo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const leer = (r: string) => readFileSync(resolve(import.meta.dirname, '..', r), 'utf8');

const TODO = leer('lib/todo.ts');
const DESDE = leer('app/plan/board/desde-todo.ts');
const BOARD = leer('app/plan/TodoBoard.tsx');
const RUTA = leer('app/api/todo/route.ts');
const MIG = leer('supabase/migrations/0184_impacto_esfuerzo_cliente.sql');

/** El pedazo del archivo entre `desde` y `hasta`. Sin esto, el guard busca en 700 líneas. */
function bloque(src: string, desde: string, hasta: string, quien: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}» en ${quien}: el guard perdió su ancla`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el final de ${quien}`);
  return src.slice(i, j);
}

/** Los cinco, con su nombre de columna y el que usa el board. */
const CAMPOS = [
  { col: 'notas', board: 'notas' },
  { col: 'deadline_razon', board: 'deadlineRazon' },
  { col: 'hacelo_en', board: 'haceloEn' },
  { col: 'impacto', board: 'impacto' },
  { col: 'esfuerzo', board: 'esfuerzo' },
] as const;

/** Los que son de la TAREA y no del proyecto: un `Label` no tiene fecha ni «hacelo en». */
const SOLO_TAREA: readonly string[] = ['deadline_razon', 'hacelo_en'];
const DE_LOS_DOS = CAMPOS.filter((c) => !SOLO_TAREA.includes(c.col));

test('1 · LA COLUMNA existe en las dos tablas del cliente', () => {
  for (const c of ['impacto', 'esfuerzo']) {
    assert.match(MIG, new RegExp(`alter table experimento_tareas add column if not exists ${c}`), `falta ${c} en experimento_tareas`);
    assert.match(MIG, new RegExp(`alter table tarea_categorias\\s+add column if not exists ${c}`), `falta ${c} en tarea_categorias`);
  }
  // Y el CHECK acotado, con `null` permitido: null es «nadie lo estimó», que es la
  // verdad de toda fila anterior a la migración. Un default le pondría a las 1.500 que
  // ya existen un número que nadie midió, y la pantalla no puede distinguirlo.
  assert.match(MIG, /impacto is null or \(impacto between 1 and 100\)/);
  const sentencias = MIG.split('\n').filter((l) => !l.trimStart().startsWith('--'));
  assert.ok(!sentencias.some((l) => /add column/.test(l) && /default/i.test(l)), 'un default inventa un dato que nadie estimó');
});

test('2 · EL TIPO los declara: sin esto el mapper no los puede ni nombrar', () => {
  const tipo = bloque(TODO, 'export type Tarea = {', '\n};', '`Tarea`');
  for (const { col } of CAMPOS) {
    assert.match(tipo, new RegExp(`\\n\\s+${col}:`), `\`Tarea\` no declara ${col}`);
  }
  const cat = bloque(TODO, 'export type Categoria = {', 'created_at: string };', '`Categoria`');
  for (const { col } of DE_LOS_DOS) {
    assert.match(cat, new RegExp(`\\b${col}:`), `\`Categoria\` no declara ${col}`);
  }
});

test('3 · EL SANEO al leer la fila los normaliza (rowTo)', () => {
  // `rowTo` castea la fila ENTERA, así que un campo ausente acá igual «llega» — con el
  // tipo diciendo `string` sobre un `undefined`. Es la mentira silenciosa que el propio
  // archivo ya documenta para `recurrente`.
  const r = bloque(TODO, 'export const rowTo =', '\n};', '`rowTo`');
  for (const { col } of CAMPOS) {
    assert.match(r, new RegExp(`t\\.${col} = `), `rowTo no sanea ${col}`);
  }
});

test('4 · LA LECTURA del board los trae (toBoard)', () => {
  // ⚠️ Es la capa que más caro sale olvidar. En el tablero del dueño un campo que el
  // mapper de lectura no trae vuelve como `undefined`, sale como `null` y BORRA la
  // columna en el próximo guardado de cualquier otro campo.
  const tb = bloque(DESDE, 'export const toBoard', '\n});', '`toBoard`');
  for (const { board } of CAMPOS) {
    assert.match(tb, new RegExp(`\\b${board}:`), `toBoard no trae ${board}`);
  }
  const tl = bloque(DESDE, 'export const toLabel', 'historial: c.historial });', '`toLabel`');
  for (const { board } of DE_LOS_DOS) {
    assert.match(tl, new RegExp(`\\b${board}:`), `toLabel no trae ${board}`);
  }
});

test('5 · LA ESCRITURA los manda (editPatch)', () => {
  // Este objeto es lo ÚNICO que viaja en un `editar`: un campo que falta no es «no
  // cambia», es un campo que nunca se guarda.
  const ep = bloque(BOARD, 'const editPatch =', '\n});', '`editPatch`');
  for (const { col } of CAMPOS) {
    assert.match(ep, new RegExp(`\\b${col}:`), `editPatch no manda ${col}`);
  }
});

test('6 · LA PUERTA los deja pasar (el tipo del patch en el route)', () => {
  // El único de los seis que no aparece en ningún grep del campo, y por eso es el que
  // más veces quedó afuera: el server sabe escribirlo, el board sabe mandarlo, y se
  // cae en el medio sin un error.
  const tb = bloque(RUTA, 'type TareaBody = {', '} & CamposResponsable;', '`TareaBody`');
  for (const { col } of CAMPOS) {
    assert.match(tb, new RegExp(`\\b${col}[?]:`), `el route no deja pasar ${col}`);
    assert.match(RUTA, new RegExp(`${col}: patch\\.${col}`), `el route declara ${col} y no lo pasa`);
  }
});

test('7 · EL SERVER los escribe, y con `!== undefined` para poder BORRARLOS', () => {
  // `!= null` haría imposible vaciar una nota o sacar una razón: `null` es un valor
  // real acá, y no poder borrar es media feature.
  for (const { col } of CAMPOS) {
    assert.match(TODO, new RegExp(`if \\(patch\\.${col} !== undefined\\) upd\\.${col} =`), `editarTarea no escribe ${col}`);
  }
});
