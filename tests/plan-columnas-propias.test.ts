// =============================================================================
// Plan: columnas PROPIAS — agregar, quitar y mover a una, como las etapas del CRM (20/10/2026)
// =============================================================================
// Martín, 18/10 pt 9: «columnas editables como en el CRM» (docs/pedidos-crm.md B1, segunda parte). Una columna propia
// es un paso DENTRO de un estado (lib/plan-columnas.ts): la tarea guarda en cuál está (`columna`, mig 0317) y su estado
// sigue siendo el de esa columna. Acá se fija:
//   1. la regla: agregar va a la derecha de su ancla con el estado del ancla; no después de «No cumplen»; hasta 8; sin
//      nombres repetidos; quitar no toca las tareas;
//   2. dónde se dibuja una tarea: su columna propia si existe y es de SU estado; si no, la de su estado;
//   3. la base, EJECUTANDO (tests/_plan-columnas-hijo.ts, un PostgREST de mentira): mover escribe `columna`; sin la mig
//      0317 (PGRST204) mueve igual sin ella; el teléfono mueve a una propia, la deshace y rechaza la que no existe;
//   4. el tablero: soltar pasa SIEMPRE la columna; `useBoard.mover` sin columna se queda en la suya si el estado no
//      cambia (el motivo de Atorada no la saca de su columna); el «⋯» sólo ofrece quitar en las propias.
//
// PROBADO ROMPIÉNDOLO (20/10/2026), con el archivo en 4 / 0, una rotura por vez y restaurada:
//   · `claveDeTarea` sin mirar que la columna sea de SU estado                        → 3 / 1
//   · agregar después de «No cumplen tu criterio»                                     → 3 / 1
//   · `moverTarea` sin el reintento sin `columna` (la base sin la 0317 lo tumbaba)     → 3 / 1
//   · `moverPlanTarea` escribiendo `columna` sólo si viene (volver a la de siempre no la borraba) → 3 / 1
//   · el teléfono leyendo la fila con una lista que nombra `columna` (sin la 0317, 42703) → 3 / 1
//   · soltar sin pasar la columna (de «En revisión» a «En proceso» no pasaba nada)    → 3 / 1
//   · `useBoard.mover` sin columna mandándola a la de su estado (el motivo la sacaba)  → 3 / 1
//   · «Quitar columna» también en las de siempre                                       → 3 / 1
// Y lo que encontró la revisión del 21/10/2026 (archivo en 5 / 0, una rotura por vez):
//   · el «＋» de una propia moviendo desde el `onDone` del modal (el `board` del clic no tiene la tarea) → 4 / 1
//   · soltar en un tablero embebido mandando `columna: null` (le borraba la propia al reordenar)        → 4 / 1
//   · MaKo diciendo «desde» por el estado y no por la columna donde se ve la tarea                       → 4 / 1
// Correr: node --import tsx --test tests/plan-columnas-propias.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  claveDeTarea, columnasEnOrden, conColumnaPropia, destinoDeClave, parsearColumnasPlan, sinColumnaPropia, TOPE_COLUMNAS_PROPIAS,
  type ConfigColumnasPlan,
} from '../lib/plan-columnas';
import { columnasPorEstado } from '../app/plan/board/kanban';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const vacia = (): ConfigColumnasPlan => ({ nombres: {}, propias: [] });

test('la regla: agregar a la derecha con el estado del ancla, sin repetir nombres, y quitar no toca las tareas', () => {
  const a = conColumnaPropia(vacia(), 'en_curso', 'En revisión', 'c_revision1');
  assert.ok(a.ok);
  assert.deepEqual(a.config.propias, [{ id: 'c_revision1', nombre: 'En revisión', estado: 'en_curso' }]);
  const b = conColumnaPropia(a.config, 'c_revision1', 'Con el cliente', 'c_cliente01');
  assert.ok(b.ok && b.config.propias[1].estado === 'en_curso', 'después de una propia: el MISMO estado');
  assert.deepEqual(columnasEnOrden(b.config, false).map((c) => c.label), ['Por iniciar', 'En proceso', 'En revisión', 'Con el cliente', 'Atorada', 'Completada']);
  const c = conColumnaPropia(b.config, 'en_curso', 'Primero', 'c_primero01');
  assert.ok(c.ok);
  assert.deepEqual(columnasEnOrden(c.config, false).map((x) => x.label).slice(1, 5), ['En proceso', 'Primero', 'En revisión', 'Con el cliente'], 'desde la de siempre: pegada a ella');
  assert.ok(!conColumnaPropia(a.config, 'no_cumple', 'Otra', 'c_otra00001').ok, 'después de «No cumplen» no va otra');
  assert.ok(!conColumnaPropia(a.config, 'hecho', 'en REVISION', 'c_otra00001').ok, 'sin repetir nombres (mayúsculas y acentos)');
  assert.ok(!conColumnaPropia(a.config, 'hecho', '  ', 'c_otra00001').ok, 'necesita un nombre');
  let llena = vacia();
  for (let i = 0; i < TOPE_COLUMNAS_PROPIAS; i++) { const r = conColumnaPropia(llena, 'por_hacer', `Paso ${i}`, `c_paso0000${i}`); assert.ok(r.ok); llena = r.config; }
  assert.ok(!conColumnaPropia(llena, 'por_hacer', 'Una más', 'c_unamas001').ok, `hasta ${TOPE_COLUMNAS_PROPIAS}`);
  const q = sinColumnaPropia(b.config, 'c_revision1');
  assert.ok(q.ok && q.config.propias.length === 1);
  assert.deepEqual(parsearColumnasPlan(JSON.stringify({ v: 2, nombres: {}, propias: [{ id: 'c_x1234567', nombre: 'X', estado: 'no_cumple' }, { id: 'malo', nombre: 'Y', estado: 'en_curso' }, { id: 'c_ok123456', nombre: 'Ok', estado: 'hecho' }] })).propias,
    [{ id: 'c_ok123456', nombre: 'Ok', estado: 'hecho' }], 'lo guardado se sanea');
});

test('dónde se dibuja una tarea: su columna propia si es de SU estado; si no, la de su estado', () => {
  const cfg: ConfigColumnasPlan = { nombres: {}, propias: [{ id: 'c_revision1', nombre: 'En revisión', estado: 'en_curso' }] };
  assert.equal(claveDeTarea({ estado: 'en_curso', columna: 'c_revision1' }, cfg), 'c_revision1');
  assert.equal(claveDeTarea({ estado: 'hecho', columna: 'c_revision1' }, cfg), 'hecho', 'se completó por el avance: va a Completada');
  assert.equal(claveDeTarea({ estado: 'en_curso', columna: 'c_borrada99' }, cfg), 'en_curso', 'la columna se quitó: vuelve a la de su estado');
  assert.deepEqual(destinoDeClave(cfg, 'c_revision1'), { estado: 'en_curso', columna: 'c_revision1' });
  assert.deepEqual(destinoDeClave(cfg, 'en_seguimiento'), { estado: 'en_seguimiento', columna: null });
  assert.equal(destinoDeClave(cfg, 'c_borrada99'), null);
  const t = (num: number, columna: string | null) => ({ estado: 'en_curso' as const, progress: 10, num, columna });
  const tareas = [t(1, null), t(2, 'c_revision1'), t(3, 'c_borrada99')];
  const cols = columnasPorEstado(tareas, tareas, undefined, cfg);
  assert.deepEqual(cols.find((c) => c.clave === 'c_revision1')?.items.map((x) => x.num), [2]);
  assert.deepEqual(cols.find((c) => c.clave === 'en_curso')?.items.map((x) => x.num).sort(), [1, 3]);
});

test('la base, ejecutando: mover escribe la columna, anda sin la mig 0317, y el teléfono mueve, deshace y rechaza', () => {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_plan-columnas-hijo.ts')], { cwd: RAIZ, encoding: 'utf8', timeout: 90_000 });
  const r = JSON.parse(salida);
  assert.equal(r.error, undefined, r.error);
  assert.deepEqual(r.conColumna.cliente, { ok: true, columna: 'c_revision1', devuelta: 'c_revision1', vuelta: null, okVuelta: true }, 'a la propia, y de vuelta a la de siempre');
  assert.deepEqual(r.conColumna.dueno, { ok: true, columna: 'c_revision1', devuelta: 'c_revision1', vuelta: null }, 'mover sin columna la borra: vuelve a la de siempre');
  assert.deepEqual(r.sinColumna.cliente, { ok: true, estado: 'en_seguimiento', tieneColumna: false }, 'sin la 0317 mueve igual');
  assert.deepEqual(r.sinColumna.dueno, { ok: true, estado: 'en_seguimiento', tieneColumna: false });
  assert.deepEqual(r.sinColumna.telefono, { ok: true, estado: 'hecho' }, 'el teléfono lee con `*`: sin la 0317 mueve igual');
  assert.ok(r.sinColumna.escrituras.some((w: string) => /^PATCH experimento_tareas estado,/.test(w)), 'el reintento va sin `columna`');
  assert.equal(r.telefono.mover.ok, true);
  assert.equal(r.telefono.mover.antes, 'en_curso');
  assert.deepEqual(r.telefono.trasMover, { columna: 'c_revision1', estado: 'en_curso', historial: 'Movió a En revisión' }, 'el historial dice el nombre del negocio');
  assert.equal(r.telefono.deshacer, true);
  assert.deepEqual(r.telefono.trasDeshacer, { columna: null, estado: 'en_curso' });
  assert.deepEqual(r.telefono.inexistente, { ok: false, error: 'Esa columna ya no existe' });
});

test('el tablero: soltar pasa la columna, el motivo no saca de la propia, y sólo las propias se quitan', () => {
  const b = leer('app/plan/board/BoardShell.tsx');
  assert.match(b, /void board\.mover\(id, d\.estado, ordenNuevo, undefined, board\.columnas \? d\.columna : undefined\);/,
    'de «En revisión» a «En proceso» sólo cambia la columna; un tablero que no conoce las columnas no la borra (revisión 21/10)');
  assert.match(b, /board\.mover\(t\.id, d\.estado, undefined, undefined, board\.columnas \? d\.columna : undefined\)/, 'el selector de la ficha, igual');
  // El «＋» de una propia: se mueve cuando el tablero YA trae la tarea (el `board` del clic no la tiene: revisión 21/10).
  assert.match(b, /if \(!aColumnaPropia \|\| !board\.tasks\.some\(\(t\) => t\.id === aColumnaPropia\.id\)\) return;/);
  assert.match(b, /if \(nuevaTareaColumna && nuevaTareaEstado\) setAColumnaPropia\(\{ id, estado: nuevaTareaEstado, columna: nuevaTareaColumna \}\);/);
  assert.doesNotMatch(b, /if \(nuevaTareaColumna && nuevaTareaEstado\) void board\.mover\(/, 'mover desde el onDone del modal no encuentra la tarea');
  assert.match(b, /quitar=\{board\.columnas\?\.editables && propia \? \(\) => quitarColumna\(clave, label, e\) : undefined\}/);
  assert.match(b, /agregar=\{board\.columnas\?\.editables && e !== 'no_cumple' \?/);
  const u = leer('app/plan/board/useBoard.ts');
  assert.match(u, /const colNueva = columna === undefined \? \(estado === desde \? colAntes : null\) : columna;/);
  assert.match(u, /repo\.mover\(id, estado, lugar, \{ motivo, historial, columna: colNueva \}\)/);
  assert.match(u, /repo\.mover\(id, antes\.estado, antes\.orden, \{ motivo: antes\.motivoAtorada, historial, progreso: antes\.progress, columna: antes\.columna \}\)/, 'el Deshacer vuelve a SU columna');
  const mig = leer('supabase/migrations/0317_plan_columna_propia.sql');
  assert.match(mig, /alter table public\.plan_tareas add column if not exists columna text;/);
  assert.match(mig, /alter table public\.experimento_tareas add column if not exists columna text;/);
  assert.match(mig, /ORDEN DE DESPLIEGUE: AGREGA algo que el código nuevo lee → se aplica ANTES o JUNTO con el deploy/);
});

test('MaKo ve la columna propia: la ficha de la tarea, el «desde» y el «ya está» (revisión 21/10)', () => {
  const run = leer('lib/api-mako/areas/plan.run.ts');
  assert.match(run, /etiquetaDeClave\(cfg, claveDeTarea\(\{ estado: t\.estado, columna: t\.columna \}, cfg\)\)/, 'ver_tarea_plan dice la columna donde la ve la persona');
  assert.match(run, /const ahora = claveDeTarea\(\{ estado: t\.estado, columna: t\.columna \}, config\);\n\s+if \(ahora === \(columna \?\? estado\)/, '«ya está» por la columna que se ve');
  assert.match(run, /const desde = etiquetaDeClave\(config, ahora\);/);
});
