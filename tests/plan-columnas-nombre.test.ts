// =============================================================================
// Plan: «columnas editables como en el CRM» — el NOMBRE de cada columna, por negocio (20/10/2026)
// =============================================================================
// Martín, 18/10 pt 9 (docs/pedidos-crm.md B1). Las columnas del Plan son el ESTADO de la tarea, con un CHECK en la base
// y ~10 lectores: se edita el nombre, nunca la clave (lib/plan-columnas.ts). Acá se fija:
//   1. la regla: vacío o el de siempre vuelve al de siempre; no puede llamarse como otra columna (sin importar
//      mayúsculas ni acentos); hasta 30 letras; lo guardado se sanea;
//   2. las columnas del tablero (computadora y teléfono) salen con el nombre del negocio;
//   3. la puerta: sólo el admin, y la escritura es estricta y con compare-and-set;
//   4. el tablero: la cabecera se edita sólo si `board.columnas.editables`; el toast, el selector y MaKo dicen el mismo
//      nombre que la columna.
//
// PROBADO ROMPIÉNDOLO (20/10/2026), con el archivo en 4 / 0, una rotura por vez y restaurada:
//   · `conNombreDeColumna` sin mirar si otra columna ya se llama así                  → 3 / 1
//   · comparar los nombres SIN quitar los acentos («Completáda» pasaba)                → 3 / 1
//   · `columnasPorEstado` con la etiqueta de siempre (ignorando los nombres)           → 3 / 1
//   · el teléfono sin pasarle los nombres a `tareasDelTablero`                         → 3 / 1
//   · la acción sin pedir admin                                                         → 3 / 1
//   · la escritura con `getSetting` (caída = borra los demás nombres)                  → 3 / 1
//   · la cabecera editable aunque `editables` sea false                                → 3 / 1
//   · MaKo moviendo con `etiquetaEstado` (decía «Atorada» con la columna renombrada)   → 3 / 1
// Correr: node --import tsx --test tests/plan-columnas-nombre.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conNombreDeColumna, etiquetaDeColumna, parsearNombresColumnas } from '../lib/plan-columnas';
import { columnasPorEstado } from '../app/plan/board/kanban';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('la regla: el nombre del negocio, el de siempre de respaldo, y nunca dos columnas con el mismo nombre', () => {
  const r = conNombreDeColumna({}, 'en_seguimiento', '  Bloqueada  ');
  assert.ok(r.ok);
  assert.deepEqual(r.nombres, { en_seguimiento: 'Bloqueada' });
  assert.equal(etiquetaDeColumna(r.nombres, 'en_seguimiento'), 'Bloqueada');
  assert.equal(etiquetaDeColumna(r.nombres, 'por_hacer'), 'Por iniciar', 'lo que no se renombró sale con el de siempre');
  const vuelta = conNombreDeColumna({ en_seguimiento: 'Bloqueada' }, 'en_seguimiento', '');
  assert.ok(vuelta.ok && !('en_seguimiento' in vuelta.nombres), 'vacío la vuelve al de siempre');
  const igual = conNombreDeColumna({ en_seguimiento: 'Bloqueada' }, 'en_seguimiento', 'Atorada');
  assert.ok(igual.ok && !('en_seguimiento' in igual.nombres), 'el de siempre no se guarda como nombre propio');
  const choca = conNombreDeColumna({}, 'en_curso', 'COMPLETÁDA');
  assert.ok(!choca.ok && /Ya hay una columna que se llama «Completada»/.test(choca.error), 'ni con otras mayúsculas ni con acentos');
  const chocaPropio = conNombreDeColumna({ hecho: 'Listo' }, 'en_curso', 'listo');
  assert.ok(!chocaPropio.ok, 'tampoco con el nombre propio de otra');
  assert.ok(!conNombreDeColumna({}, 'hecho', 'x'.repeat(31)).ok, 'hasta 30 letras');
  assert.deepEqual(parsearNombresColumnas(JSON.stringify({ hecho: ' Listo ', inventada: 'X', por_hacer: 'Por iniciar', en_curso: 7 })), { hecho: 'Listo' },
    'lo guardado se sanea: claves que existen, con texto, y que no son el de siempre');
  assert.deepEqual(parsearNombresColumnas('{roto'), {});
});

test('las columnas del tablero salen con el nombre del negocio, en la computadora y en el teléfono', () => {
  const t = (estado: 'por_hacer' | 'en_seguimiento', num: number) => ({ estado, progress: 0, num });
  const tareas = [t('por_hacer', 1), t('en_seguimiento', 2)];
  const cols = columnasPorEstado(tareas, tareas, undefined, { en_seguimiento: 'Bloqueada' });
  assert.deepEqual(cols.map((c) => c.label), ['Por iniciar', 'En proceso', 'Bloqueada', 'Completada']);
  assert.deepEqual(columnasPorEstado(tareas, tareas).map((c) => c.label)[2], 'Atorada', 'sin nombres, los de siempre');
  assert.match(leer('app/m/plan/tableros.ts'), /columnasPorEstado\(conFin, conFin, undefined, nombres\)/);
  assert.match(leer('app/m/plan/page.tsx'), /nombres: await leerNombresColumnasPlan\(\)/);
  assert.match(leer('app/m/plan/ListaPlan.tsx'), /<FilaDatoM k="Columna" v=\{nombreColumna\(k\.estado\)\} \/>/);
});

test('la puerta: sólo el admin, y la escritura estricta con compare-and-set', () => {
  const accion = leer('app/plan/board/columnas-actions.ts');
  assert.match(accion, /await exigirSesion\(\);\n\s+if \(\(await getRolWsEfectivo\(\)\) !== 'admin'\) return \{ ok: false/);
  const server = leer('lib/plan-columnas-server.ts');
  const escribir = server.slice(server.indexOf('export async function renombrarColumnaPlan'));
  assert.match(escribir, /const crudo = await getSettingEstricto\(CLAVE_COLUMNAS_PLAN\);/, 'una lectura caída no puede leerse como «sin nombres»');
  assert.match(escribir, /cambiarSettingSi\(CLAVE_COLUMNAS_PLAN, crudo, JSON\.stringify\(r\.nombres\)\)/);
  for (const [rel, editable] of [['app/plan/page.tsx', /columnas=\{demo \? null : \{ nombres: nombresColumnas, editables: rol === 'admin' \}\}/], ['app/plan/agencia/page.tsx', /columnas=\{\{ nombres: nombresColumnas, editables: rol === 'admin' \}\}/]] as const) {
    assert.match(leer(rel), editable, `${rel}: los nombres del negocio y si se pueden cambiar`);
  }
});

test('el tablero: la cabecera se edita sólo con `editables`, y el toast, el selector y MaKo dicen el mismo nombre', () => {
  const b = leer('app/plan/board/BoardShell.tsx');
  assert.match(b, /renombrar=\{board\.columnas\?\.editables \? \(nombre\) => board\.renombrarColumna\(e, nombre\) : undefined\}/);
  assert.match(b, /<option key=\{x\.key\} value=\{x\.key\}>\{board\.etiqueta\(x\.key\)\}<\/option>/);
  assert.match(b, /board\.columnas\?\.nombres\);/);
  const u = leer('app/plan/board/useBoard.ts');
  assert.match(u, /columnas, etiqueta, renombrarColumna,/, 'si no está en el `return`, no existe para ninguna pantalla');
  assert.match(u, /show\(cambiaCol \? `Movió a \$\{etiqueta\(estado\)\}`/);
  assert.doesNotMatch(u, /etiquetaEstado\(/);
  const run = leer('lib/api-mako/areas/plan.run.ts');
  assert.doesNotMatch(run, /etiquetaEstado\(/, 'MaKo dice el nombre que la persona ve');
  const def = leer('lib/api-mako/areas/plan.def.ts');
  const op = def.slice(def.indexOf("id: 'renombrar_columna_plan'"), def.indexOf("id: 'renombrar_columna_plan'") + 1400);
  assert.match(op, /canales: \['app'\], costo: 'gratis', gating: TAB_ADMIN/);
});
