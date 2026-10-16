// El tsc ACOTADO (scripts/tsc-acotado.mjs) arma el tsconfig temporal con las trampas de la
// receta ya resueltas: cada una, olvidada, da rojos que no son del código o chequea otra cosa.
//
// Medido el 16/10/2026 con app/web-generator/editor/insertar.ts (ya importando por tipos los
// comandos de TipTap): sin `typeRoots`/`types`, 1 error (TS2580 «Cannot find name 'process'»);
// con ellos, 0. Y sin `"include": []`, `extends` hereda el include del repo y se chequea todo.
//
// Verificado rompiéndolo: sacar `include: []` da 1 fallo; sacar `types: ['node']` da 1 fallo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armarTsconfig } from '../scripts/tsc-acotado.mjs';

const REPO = 'C:\\repo\\dashboard-marketing';

test('el tsconfig acotado chequea SÓLO la lista: files con rutas absolutas e include vacío', () => {
  const c = armarTsconfig(REPO, ['app/x/a.ts', 'lib/b.tsx']);
  assert.deepEqual(c.include, [], 'sin include vacío, extends hereda el del repo y se chequea todo');
  assert.deepEqual(c.files, ['C:/repo/dashboard-marketing/app/x/a.ts', 'C:/repo/dashboard-marketing/lib/b.tsx']);
  assert.equal(c.extends, 'C:/repo/dashboard-marketing/tsconfig.json', 'mismas reglas que el completo; absoluto porque el json vive fuera del repo');
});

test('trae los tipos de Node (en el completo entran por next-env.d.ts, que un archivo suelto no ve)', () => {
  const c = armarTsconfig(REPO, ['app/x/a.ts']);
  assert.deepEqual(c.compilerOptions.typeRoots, ['C:/repo/dashboard-marketing/node_modules/@types']);
  assert.deepEqual(c.compilerOptions.types, ['node']);
});

test('no escribe nada', () => {
  const c = armarTsconfig(REPO, ['app/x/a.ts']);
  assert.equal(c.compilerOptions.noEmit, true);
  assert.equal(c.compilerOptions.incremental, false, 'sin .tsbuildinfo en el repo');
});
