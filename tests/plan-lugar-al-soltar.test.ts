// =============================================================================
// Soltar una tarea en el Kanban la deja DONDE SE SOLTÓ: se corren las de abajo
// =============================================================================
// «En el plan funciona diferente, ya que la posición son PRIORIDADES, creo que el plan ya
// lo hace. Si lo hace bien, que no modifique nada» (06/10/2026). No lo hacía bien: las
// tareas empatan a propósito y el Kanban desempata por `num`, así que entre dos con el
// mismo número la soltada quedaba corrida — 472 de 618 lugares (76%) sobre el tablero real.
// El 09/10/2026 se eligió «Correr las de abajo», y otra vez con el costo medido: en la
// mitad de los lugares se corren 0 o 1, en el 10% peor hasta 29 y como máximo 52, un punto
// cada una, sin cruzarse y sin cambiar de columna.
//
// Medido con la regla de acá contra las 184 abiertas del tablero real (561 lugares, tres
// tarjetas que se mueven): 561 de 561 quedan donde se soltaron, ninguna vecina sube y
// ninguna cambia de columna.
//
// Dos mitades: la regla se EJECUTA (`hacerLugar`, `sugerirNumero`) y el cableado se lee del
// fuente — el Kanban manda el lugar, el pop-up lo pasa, y los dos tableros lo cumplen.
//
// PROBADO ROMPIÉNDOLO (09/10/2026), sobre 13 tests, restaurando de memoria:
//   1. en `vaAntes`, el desempate dado vuelta (`a.num < b.num`): 9 pass / 4 fail.
//   2. en `hacerLugar`, la vecina corrida siempre un punto (sin el empate por `num`):
//      11 pass / 2 fail. Sin la aserción del plan exacto de «a igual número…» pasaba en
//      verde: la tarjeta igual queda en su lugar, sólo que la ola baja la columna entera.
//   3. en `hacerLugar`, sin el tope de la columna (`if (despues < min) return null`):
//      12 pass / 1 fail.
//   4. el pop-up sin `{ lugar: soltada.lugar }`: 12 pass / 1 fail.
//   5. `fijarPrioridadAMano` sin el `.eq('score', c.antes)`: 12 pass / 1 fail.
//   6. el Kanban mandando el lugar con cualquier orden (`porPrioridad = true`): 12 / 1.
//   7. el botón «Cambiar» apagado con el mismo número aunque haya lugar: 12 / 1.
//   8. el pop-up montado sin `conLugar`: 12 / 1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hacerLugar, sugerirNumero, lugarEn, vaAntes, bandaDe, baseCorrida, respetarFijadas, MARGEN_CRUCE, type FilaLugar, type FilaReparto } from '../app/plan/board/lugar-al-soltar';
import { prioFromScore, type Prio } from '../app/plan/board/types';

const ordenar = (l: FilaLugar[]) => [...l].sort((a, b) => (vaAntes(a, b) ? -1 : vaAntes(b, a) ? 1 : 0));
/** Aplica un plan y devuelve el lugar donde quedó `yo` dentro de su columna. */
const lugarFinal = (col: FilaLugar[], yo: FilaLugar, plan: { id: string; despues: number }[]) => {
  const nuevo = new Map(plan.map((c) => [c.id, c.despues]));
  const p = prioFromScore(yo.score);
  return ordenar([...col.map((c) => ({ ...c, score: nuevo.get(c.id) ?? c.score })), yo].filter((t) => prioFromScore(t.score) === p))
    .findIndex((t) => t.id === yo.id);
};

test('el caso que lo motivó: soltada entre dos con el mismo número queda en el medio, corriendo la de abajo', () => {
  // Media: 62 (#90) y 62 (#80), y debajo 61 (#100). La soltada es #50: con 62 el desempate
  // la ponía DETRÁS de #80, que es exactamente el «la solté acá y quedó allá».
  const col: FilaLugar[] = [{ id: 'a', score: 62, num: 90 }, { id: 'b', score: 62, num: 80 }, { id: 'c', score: 61, num: 100 }];
  const lugar = { arriba: 'a', abajo: 'b' };
  const n = sugerirNumero(col, { id: 'yo', num: 50 }, lugar, 'media', 62);
  const plan = hacerLugar(col, { id: 'yo', score: n, num: 50 }, lugar);
  assert.ok(plan, 'tiene que haber lugar');
  assert.equal(lugarFinal(col, { id: 'yo', score: n, num: 50 }, plan!), 1, 'queda segunda, entre a y b');
  assert.ok(plan!.every((c) => c.despues < c.antes), 'sólo se corren las de ABAJO, y para abajo');
  assert.ok(plan!.every((c) => c.id !== 'a'), 'la de arriba no se toca');
});

test('sin estorbo no se corre a nadie: el número del medio alcanza', () => {
  const col: FilaLugar[] = [{ id: 'a', score: 70, num: 1 }, { id: 'b', score: 60, num: 2 }];
  const n = sugerirNumero(col, { id: 'yo', num: 3 }, { arriba: 'a', abajo: 'b' }, 'media', 65);
  assert.equal(n, 65);
  assert.deepEqual(hacerLugar(col, { id: 'yo', score: n, num: 3 }, { arriba: 'a', abajo: 'b' }), []);
});

test('a igual número alcanza con que el desempate la deje detrás: no se le resta un punto de más', () => {
  // La de abajo tiene `num` MENOR que la soltada: ya queda detrás sin tocarla.
  const col: FilaLugar[] = [{ id: 'a', score: 63, num: 1 }, { id: 'b', score: 62, num: 5 }, { id: 'c', score: 62, num: 2 }];
  const plan = hacerLugar(col, { id: 'yo', score: 62, num: 10 }, { arriba: 'a', abajo: 'b' });
  assert.deepEqual(plan, []);
  // Y cuando sí estorba: #50 baja a 61; #5, que ya queda detrás de #50 por desempate, baja
  // a 61 también — NO a 60. Restar siempre un punto corre la ola por toda la columna.
  const col2: FilaLugar[] = [{ id: 'a', score: 63, num: 1 }, { id: 'b', score: 62, num: 50 }, { id: 'c', score: 62, num: 5 }];
  assert.deepEqual(hacerLugar(col2, { id: 'yo', score: 62, num: 10 }, { arriba: 'a', abajo: 'b' }), [
    { id: 'b', antes: 62, despues: 61 },
    { id: 'c', antes: 62, despues: 61 },
  ]);
});

test('el número que contradice el lugar gana: no se corre a nadie', () => {
  const col: FilaLugar[] = [{ id: 'a', score: 62, num: 9 }, { id: 'b', score: 60, num: 8 }];
  assert.equal(hacerLugar(col, { id: 'yo', score: 70, num: 1 }, { arriba: 'a', abajo: 'b' }), null, 'más alto que la de arriba');
  assert.equal(hacerLugar(col, { id: 'yo', score: 55, num: 1 }, { arriba: 'a', abajo: 'b' }), null, 'muy por debajo de la de abajo');
});

test('una vecina que ya no está, o que cambió de lado: el lugar no existe más', () => {
  const col: FilaLugar[] = [{ id: 'a', score: 62, num: 9 }, { id: 'b', score: 60, num: 8 }];
  assert.equal(hacerLugar(col, { id: 'yo', score: 61, num: 1 }, { arriba: 'a', abajo: 'zz' }), null);
  assert.equal(hacerLugar(col, { id: 'yo', score: 61, num: 1 }, { arriba: 'b', abajo: 'a' }), null);
});

test('correr a alguien fuera de su columna NO se hace: se escribe el número solo', () => {
  // Media empieza en 50. La de abajo está en 50 con num más alto: tendría que bajar a 49 (Baja).
  const col: FilaLugar[] = [{ id: 'a', score: 51, num: 200 }, { id: 'b', score: 50, num: 300 }];
  assert.equal(bandaDe('media').min, 50);
  assert.equal(hacerLugar(col, { id: 'yo', score: 50, num: 1 }, { arriba: 'a', abajo: 'b' }), null);
});

test('las vecinas que no compiten no cuentan para el lugar', () => {
  const lista = [{ id: 'x', ok: true }, { id: 'hecha', ok: false }, { id: 'y', ok: true }, { id: 'rep', ok: false }];
  assert.deepEqual(lugarEn(lista, 2, (t) => t.ok), { arriba: 'x', abajo: 'y' });
  assert.deepEqual(lugarEn(lista, 4, (t) => t.ok), { arriba: 'y', abajo: null });
});

test('la base se corre lo mismo que el número', () => {
  assert.equal(baseCorrida(58, { id: 'b', antes: 62, despues: 61 }), 57);
  assert.equal(baseCorrida(undefined, { id: 'b', antes: 62, despues: 61 }), 61);
});

test('en columnas llenas de empates, CADA lugar queda exacto, sin subir a nadie ni cambiar de columna', () => {
  // Pseudo-azar con semilla: columnas densas como las del tablero real (más tareas que números).
  let s = 42;
  const azar = (n: number) => { s = (s * 1103515245 + 12345) % 2147483648; return s % n; };
  let lugares = 0;
  for (let ronda = 0; ronda < 40; ronda++) {
    const destino: Prio = (['alta', 'media', 'baja', 'futuro'] as Prio[])[ronda % 4];
    const { min, max } = bandaDe(destino);
    const col: FilaLugar[] = Array.from({ length: 12 + azar(30) }, (_, i) => ({ id: `t${ronda}-${i}`, score: min + 2 + azar(max - min - 3), num: 1 + azar(500) }));
    const yo = { id: 'yo', num: 1 + azar(500) };
    const orden = ordenar(col);
    for (let idx = 0; idx <= orden.length; idx++) {
      const lugar = { arriba: orden[idx - 1]?.id ?? null, abajo: orden[idx]?.id ?? null };
      const base = Math.round(((orden[idx - 1]?.score ?? max) + (orden[idx]?.score ?? min)) / 2);
      const n = sugerirNumero(col, yo, lugar, destino, base);
      const plan = hacerLugar(col, { ...yo, score: n }, lugar);
      assert.ok(plan, `ronda ${ronda}, lugar ${idx}: sin plan`);
      assert.equal(lugarFinal(col, { ...yo, score: n }, plan!), idx, `ronda ${ronda}: soltada en ${idx}`);
      assert.ok(plan!.every((c) => prioFromScore(c.despues) === prioFromScore(c.antes)), 'ninguna cambia de columna');
      assert.ok(plan!.every((c) => c.despues < c.antes), 'sólo se corren las de abajo');
      // Y entre las que se corren, nadie se cruza: el orden de las otras es el de antes.
      const nuevo = new Map(plan!.map((c) => [c.id, c.despues]));
      const despues = ordenar(col.map((c) => ({ ...c, score: nuevo.get(c.id) ?? c.score }))).map((c) => c.id);
      assert.deepEqual(despues, orden.map((c) => c.id), 'el orden de las demás no cambia');
      lugares++;
    }
  }
  assert.ok(lugares > 500, `se probaron ${lugares} lugares`);
});

// ── el cableado ──────────────────────────────────────────────────────────────

const leer = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const SHELL = sinComentarios(leer('app/plan/board/BoardShell.tsx'));
const REPRIO = sinComentarios(leer('lib/plan-reprio.ts'));

test('el Kanban manda el lugar SÓLO ordenado por prioridad de mayor a menor', () => {
  const a = SHELL.indexOf('function Kanban(');
  const kanban = SHELL.slice(a, SHELL.indexOf('\nfunction ', a + 1));
  assert.ok(kanban.length > 1000 && kanban.length < 40000, `el recorte del Kanban mide ${kanban.length}`);
  assert.match(kanban, /const porPrioridad = sortMode === 'score' && sortDir === 'desc';/);
  assert.match(kanban, /if \(!porPrioridad \|\| !yo\) \{ onSoltar\(id, p, base\); return; \}/);
  assert.match(kanban, /onSoltar\(id, p, sugerirNumero\(col, \{ id, num: yo\.num \}, lugar, p, base\), lugar\);/);
});

test('el pop-up le pasa el lugar a quien escribe, y deja aplicar el mismo número', () => {
  assert.match(SHELL, /board\.repo\.prioridadManual!\(soltada\.entidad, soltada\.id, n, soltada\.lugar \? \{ lugar: soltada\.lugar \} : undefined\)/);
  // Soltar una tarjeta de 62 entre dos de 62 no cambia el número y SÍ el lugar: con el botón
  // apagado por «no cambiaste nada», el lugar no se podía aplicar nunca.
  assert.match(SHELL, /conLugar=\{!!soltada\.lugar\}/);
  assert.match(sinComentarios(leer('app/plan/board/PrioridadAMano.tsx')), /const sinCambio = v === score && !conLugar;/);
});

test('el tablero del dueño corre a las de abajo con el tablero recién leído y con compare-and-set', () => {
  const a = REPRIO.indexOf('if (!esProy) {');
  const rama = REPRIO.slice(a, REPRIO.indexOf('const universo', a));
  assert.ok(rama.length > 500, 'no encontré la rama de tareas');
  assert.match(rama, /hacerLugar\(compiten\.map/);
  assert.match(rama, /\.eq\('id', c\.id\)\.eq\('score', c\.antes\)/);
  assert.match(rama, /score_base: baseCorrida\(/);
  assert.match(rama, /!p\.lugar && !p\.deshacer\?\.length|const movidos = vecinas\.filter\(\(c\) => escritas\.has\(c\.id\)\)/);
  assert.match(sinComentarios(leer('app/api/plan-board/route.ts')), /fijarPrioridadAMano\(\{ entidad, itemId: id, score, lugar, deshacer \}\)/);
  assert.match(sinComentarios(leer('app/plan/board/repo-plan.ts')), /lugar: opts\?\.lugar, deshacer: opts\?\.deshacer/);
});

test('el tablero del cliente corre a las de abajo con la MISMA regla, y el deshacer las devuelve', () => {
  assert.match(sinComentarios(leer('app/plan/TodoBoard.tsx')), /hacerLugar\(compiten\.map/);
  const board = sinComentarios(leer('app/plan/board/useBoard.ts'));
  assert.match(board, /repo\.prioridadManual\?\.\(entidad, fijado\.id, scorePrevio, corridas\.length \? \{ deshacer: corridas \} : undefined\)/);
  assert.match(board, /scoreBase: baseCorrida\(x\.scoreBase, \{ id: x\.id, antes: x\.score, despues: n \}\)/);
});

// ── la tabla de tareas, el mismo gesto (14/10/2026) ─────────────────────────────────
// Hasta el 14/10 la tabla mandaba sólo el punto medio: el mismo arrastre dejaba la tarjeta
// en su lugar en el Kanban y corrida en la tabla. Es la tabla de la vista Tareas y la de
// adentro de un proyecto (las dos montan `TablaTareas`).
//
// PROBADO ROMPIÉNDOLO (14/10/2026), sobre los 16 del archivo, restaurando de memoria; cada
// rotura dio 15 pass / 1 fail:
//   1. el hook sin `resto, pos` en el `onSoltar` del drop.
//   2. la tabla mandando el lugar con cualquier orden (sin `dir !== 'desc'`).
//   3. la tabla sin el lugar en su `onSoltar` final.
//   4. el orden por prioridad sin el desempate por `num`.
//   5. la tabla de la vista Tareas montada sin pasar el lugar al pop-up.
//   6. uno de los dos montajes del detalle de proyecto sin el lugar.

const TABLAS = sinComentarios(leer('app/plan/board/Tablas.tsx'));

test('el arrastre de filas entrega DÓNDE cayó, no sólo el número', () => {
  const a = TABLAS.indexOf('function useArrastreFilas<');
  const hook = TABLAS.slice(a, TABLAS.indexOf('\nfunction Th(', a));
  assert.ok(hook.length > 1000 && hook.length < 20000, `el recorte del hook mide ${hook.length}`);
  assert.match(hook, /onSoltar\(id, scoreEntreFilas\(resto, pos, dir, filas\[j\]\?\.score \?\? 50, porPrioridad\), resto, pos\);/);
});

test('la tabla de tareas manda el lugar SÓLO por prioridad de mayor a menor, y desempata como el Kanban', () => {
  const a = TABLAS.indexOf('export function TablaTareas(');
  const tabla = TABLAS.slice(a);
  assert.ok(tabla.length > 2000, 'no encontré TablaTareas');
  assert.match(tabla, /if \(orden !== 'score' \|\| dir !== 'desc' \|\| !yo\) \{ onSoltar\(id, base\); return; \}/);
  assert.match(tabla, /const lugar = lugarEn\(resto, pos, compite\);/);
  assert.match(tabla, /onSoltar\(id, sugerirNumero\(col, \{ id, num: yo\.num \}, lugar, prioFromScore\(base\), base\), lugar\);/);
  assert.match(tabla, /useArrastreFilas\(vivas, dir, orden === 'score', soltarFila\)/);
  // Sin el desempate, entre dos empatadas la tabla dibuja la soltada donde la dejó el orden
  // de llegada, que no es donde el server le hizo lugar.
  assert.match(tabla, /if \(orden === 'score'\) return s \* \(\(a\.score \|\| 0\) - \(b\.score \|\| 0\)\) \|\| s \* \(a\.num - b\.num\);/);
});

test('las tres tablas de tareas que se arrastran le pasan el lugar al pop-up', () => {
  // La de la vista Tareas y los dos montajes del detalle de un proyecto (el peek y el modal).
  const n = SHELL.split("(id, sugerido, lugar) => setSoltada({ entidad: 'tarea', id, sugerido, lugar })").length - 1;
  assert.equal(n, 3, `se encontraron ${n}`);
  assert.match(SHELL, /onSoltarTask\?: \(id: string, sugerido: number, lugar\?: Lugar\) => void;/);
});

// ── y la corrida del Perro no lo deshace (14/10/2026) ───────────────────────────────
// El reparto diario (`recurvarPlanOwner`) da los números por RANKING y no sabía dónde estaba
// la fijada: la vecina que el arrastre corrió volvía al número de su puesto y quedaba encima.
// Medido sobre el tablero real (174 abiertas, 513 lugares, simulando la corrida con las mismas
// funciones): se deshacían 240; con `respetarFijadas`, 0. Con margen 1 se deshacían 169 y con
// 2, cuatro: el 3 está medido. El tablero sin arrastres sale idéntico.
//
// PROBADO ROMPIÉNDOLO (14/10/2026), restaurando de memoria, sobre los 22 del archivo:
//   1. sin el recorte (`respetarFijadas` devuelve la curva tal cual): 19 pass / 3 fail.
//   2. sin el margen (recorta siempre, el Perro no puede cruzar): 21 / 1.
//   3. el desempate por `num` dado vuelta en el recorte de abajo: 19 / 3.
//   4. el margen con `<=` (cruza un punto antes): 21 / 1.
//   5. `recurvarPlanOwner` sin `respetarFijadas`: 21 / 1.

const fr = (id: string, mostrado: number, num: number, manual = false): FilaReparto => ({ id, num, mostrado, manual });

test('el reparto sin fijadas queda tal cual', () => {
  const filas = [fr('a', 92, 1), fr('b', 90, 2), fr('c', 80, 3)];
  const curva = { a: 93, b: 88, c: 79 };
  assert.deepEqual(respetarFijadas(filas, curva), curva);
});

test('la vecina que el arrastre corrió NO vuelve a pasar a la soltada', () => {
  // El caso medido: #806 soltada en 91 entre #805 (92) y #804, que se corrió de 92 a 91 (su
  // num es menor, así que en 91 queda detrás). El reparto le devuelve a #804 el 92 de su puesto.
  const filas = [fr('805', 92, 805), fr('806', 91, 806, true), fr('804', 91, 804), fr('803', 90, 803)];
  const curva = { 805: 92, 804: 92, 803: 90 };
  const out = respetarFijadas(filas, curva);
  assert.equal(out['804'], 91, 'queda en 91: a igual número su num la deja detrás de la soltada');
  assert.equal(out['805'], 92, 'la de arriba no se toca');
  assert.equal(out['803'], 90, 'la que ya quedaba debajo no se toca');
  assert.ok(!('806' in out), 'a la fijada no se le escribe nada');
});

test('el desempate del recorte es el del Kanban: con num más alto, un punto menos', () => {
  const filas = [fr('m', 70, 50, true), fr('u', 69, 60)];
  // u tiene num MÁS ALTO que la fijada: en 70 se vería arriba, así que baja a 69.
  assert.equal(respetarFijadas(filas, { u: 71 }).u, 69);
  // Y la de arriba con num más bajo: en 70 se vería abajo, así que sube a 71.
  const filas2 = [fr('u', 72, 10), fr('m', 70, 50, true)];
  assert.equal(respetarFijadas(filas2, { u: 69 }).u, 71);
});

test('un juicio nuevo del Perro SÍ cruza a la fijada: el candado es de ella, no de las vecinas', () => {
  // Una que se veía debajo y a la que se le acercó el deadline: el reparto la pone 5 arriba.
  const debajo = [fr('m', 70, 50, true), fr('u', 68, 60)];
  assert.equal(respetarFijadas(debajo, { u: 75 }).u, 75);
  // Y una que se veía arriba y se fue quedando quieta: 5 debajo.
  const arriba = [fr('u', 72, 60), fr('m', 70, 50, true)];
  assert.equal(respetarFijadas(arriba, { u: 65 }).u, 65);
});

test('el margen: hasta MARGEN_CRUCE − 1 puntos del otro lado es ruido del reparto; desde ahí, cruza', () => {
  const filas = [fr('m', 70, 50, true), fr('u', 68, 60)];
  assert.equal(respetarFijadas(filas, { u: 70 + MARGEN_CRUCE - 1 }).u, 69, 'ruido: se queda debajo');
  assert.equal(respetarFijadas(filas, { u: 70 + MARGEN_CRUCE }).u, 70 + MARGEN_CRUCE, 'juicio: cruza');
});

test('la corrida del Perro corrige el reparto alrededor de lo fijado', () => {
  const PB = sinComentarios(leer('lib/plan-board.ts'));
  const a = PB.indexOf('export async function recurvarPlanOwner(');
  const corrida = PB.slice(a, PB.indexOf('\nexport ', a + 1));
  assert.ok(corrida.length > 1000 && corrida.length < 20000, `el recorte de la corrida mide ${corrida.length}`);
  assert.match(corrida, /const curva = respetarFijadas\(\s*filas\.map\(\(t\) => \(\{ id: t\.id, num: t\.num, mostrado: t\.mostrado, manual: t\.manual \}\)\),\s*curveTaskScores\(/);
  // Y a la fijada sigue sin escribírsele nada.
  assert.match(corrida, /const cambian = filas\.filter\(\(t\) => !t\.manual && curva\[t\.id\] != null && curva\[t\.id\] !== t\.mostrado\);/);
});
