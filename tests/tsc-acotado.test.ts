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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { armarTsconfig } from '../scripts/tsc-acotado.mjs';

// El repo de mentira se arma con `resolve` y no como un «C:\repo…» fijo: en Linux (GitHub Actions)
// una ruta de Windows es RELATIVA, y `resolve` le pega delante el cwd del runner. Pasó en el run
// 38845971505 (16/10/2026): 2 rojos sólo en Actions, verde en la notebook.
const REPO = resolve('/repo/dashboard-marketing');
const R = REPO.split('\\').join('/');

test('el tsconfig acotado chequea SÓLO la lista: files con rutas absolutas e include vacío', () => {
  const c = armarTsconfig(REPO, ['app/x/a.ts', 'lib/b.tsx']);
  assert.deepEqual(c.include, [], 'sin include vacío, extends hereda el del repo y se chequea todo');
  assert.deepEqual(c.files, [`${R}/app/x/a.ts`, `${R}/lib/b.tsx`]);
  assert.equal(c.extends, `${R}/tsconfig.json`,'mismas reglas que el completo; absoluto porque el json vive fuera del repo');
});

test('trae los tipos de Node (en el completo entran por next-env.d.ts, que un archivo suelto no ve)', () => {
  const c = armarTsconfig(REPO, ['app/x/a.ts']);
  assert.deepEqual(c.compilerOptions.typeRoots, [`${R}/node_modules/@types`]);
  assert.deepEqual(c.compilerOptions.types, ['node']);
});

test('no escribe nada', () => {
  const c = armarTsconfig(REPO, ['app/x/a.ts']);
  assert.equal(c.compilerOptions.noEmit, true);
  assert.equal(c.compilerOptions.incremental, false, 'sin .tsbuildinfo en el repo');
});

test('trae los .d.ts GLOBALES de next que el completo carga por next-env.d.ts (hacen obligatorio NODE_ENV en ProcessEnv), sólo si existen', () => {
  // Medido el 17/10/2026 (runs 100 y el siguiente de Actions): un test pasaba `{}` como ProcessEnv; el acotado dio verde y el completo, rojo dos veces.
  // Probado rompiéndolo: sin la línea de los globales en armarTsconfig, la aserción de «con next» da rojo (y con un repo sin next, siguen sin entrar).
  const repo = mkdtempSync(join(tmpdir(), 'repo-con-next-'));
  try {
    for (const rel of ['node_modules/next/types/global.d.ts', 'node_modules/next/image-types/global.d.ts']) {
      mkdirSync(dirname(join(repo, rel)), { recursive: true });
      writeFileSync(join(repo, rel), 'export {};\n');
    }
    const R2 = resolve(repo).split('\\').join('/');
    const con = armarTsconfig(repo, ['app/x/a.ts']);
    assert.deepEqual(con.files, [`${R2}/app/x/a.ts`, `${R2}/node_modules/next/types/global.d.ts`, `${R2}/node_modules/next/image-types/global.d.ts`],
      'los archivos pedidos primero, y después los globales de next');
    const sin = armarTsconfig(REPO, ['app/x/a.ts']);
    assert.deepEqual(sin.files, [`${R}/app/x/a.ts`], 'un repo sin next (o sin node_modules) no agrega archivos que no existen: tsc daría TS6053');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
