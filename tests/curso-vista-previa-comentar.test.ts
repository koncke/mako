// =============================================================================
// La vista previa del curso muestra QUÉ post se comenta en un «Comentar» sin post elegido (17/10/2026)
// =============================================================================
// docs/hallazgos-customer-success.md («Lo que quedó SIN hacer» del 13/10): la vista previa del equipo no tiene el token
// del alumno para preguntar el post, y un «Comentar» sin post elegido (= el último fijado) decía «Todavía no hay un
// post para comentar». El server de la vista previa le pone el último fijado (`conPostDeComentar`, lib/curso.ts).
//
// Verificado rompiéndolo (el archivo da 2 / 0): `conPostDeComentar` pisando también al que ya tiene post → 1 / 1;
// la vista previa sin llamarla → 1 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conPostDeComentar } from '../lib/curso';

test('conPostDeComentar: sólo el «Comentar» sin post, y sin post fijado no se toca nada', () => {
  const campos = [
    { tipo: 'comentar' as const, id: 'a' },
    { tipo: 'comentar' as const, id: 'b', postId: 9, postTitulo: 'El elegido' },
    { tipo: 'texto' as const, id: 'c' },
  ];
  const r = conPostDeComentar(campos, { id: 4, titulo: 'Bienvenida' });
  assert.deepEqual(r.map((c) => [c.id, c.postId ?? null, c.postTitulo ?? null]), [['a', 4, 'Bienvenida'], ['b', 9, 'El elegido'], ['c', null, null]]);
  assert.deepEqual(conPostDeComentar(campos, null), campos);
});

test('la vista previa le pone el último fijado (y sólo si hay algún «Comentar» sin post)', () => {
  const src = readFileSync(join(import.meta.dirname, '..', 'app/customer-success/curso/vista/pantalla.tsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /const fijado = ws != null \? await ultimoPostFijado\(ws, productoId\)\.catch\(\(\) => null\) : null;/);
  assert.match(src, /campos: conPostDeComentar\(c\.campos, fijado\)/);
});
