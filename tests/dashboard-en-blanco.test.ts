// =============================================================================
// Dashboard: quien nunca guardó un informe arranca EN BLANCO (12/10/2026)
// =============================================================================
// Martín: «si es un usuario que nunca creó una página en dashboard, que no le salga ninguna página, que le salga
// todo en blanco abajo con la opción de crear una». El informe inicial viaja por dentro (la pantalla lee
// `hojas[0]`), pero no se muestra, no se guarda, y la primera página que se crea es la ÚNICA.
//
// Verificado volviendo a `[...tt.hojas, nueva]` en crearHoja: 2 pasan, 1 falla.
//
// Correr: npx tsx --test tests/dashboard-en-blanco.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const leer = (f: string) => readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

test('page.tsx: sin informe guardado y sin pedir una hoja, la pantalla va en blanco y no lee datos', () => {
  const src = leer('app/dashboard/page.tsx');
  assert.match(src, /if \(lectura\.estado === 'inicial'\) \{/);
  assert.match(src, /else sinPaginas = true;/);
  assert.match(src, /const graficos = sinPaginas \? \[\] : pedidos0\.graficos;/);
  assert.match(src, /sinPaginas=\{sinPaginas\}/);
});

test('EditorInforme: en blanco no hay guía, y se dibuja sólo «Crear una página»', () => {
  const src = leer('app/dashboard/EditorInforme.tsx');
  assert.match(src, /autoabrir: conGuia && !enBlanco && !editando/);
  assert.match(src, /if \(enBlanco\) \{\s*return \(/);
  assert.match(src, /Crear una página/);
});

test('EditorInforme: la primera página que se crea en blanco es la ÚNICA (el inicial no se guarda)', () => {
  const src = leer('app/dashboard/EditorInforme.tsx');
  assert.match(src, /hojas: enBlanco \? \[nueva\] : \[\.\.\.tt\.hojas, nueva\]/);
});
