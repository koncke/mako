// =============================================================================
// «Lo que MaKo construye se ve construyéndose» (AGENTS.md, 28/10/2026): la pieza reusable y sus reglas
// =============================================================================
// Martín: «que se vaya viendo que se va construyendo todo… tiene que haber un pequeño delay, que no sea exagerado». Lo
// que fija:
//   1. nunca se muestra una pieza que no llegó (no se inventa progreso), de a una por paso, con una cadencia corta;
//   2. muchas pendientes se achican para que el total sea de segundos, y nunca por debajo de un mínimo visible;
//   3. se puede saltear, y con «reducir movimiento» va sin cadencia;
//   4. las fases (las de la extensión): hechas, la de ahora y las pendientes, y la que falló;
//   5. la pieza: tiene «Ver todo», el conteo es un status y respeta `prefers-reduced-motion`.
// Correr: node --import tsx --test tests/armado-en-vivo.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CADENCIA_MIN_MS, CADENCIA_MS, TOPE_REVELAR_MS, cadenciaPara, fasesDesde, visiblesAhora } from '../app/_ui/armado-en-vivo';

const fuente = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('1. nunca más que lo que llegó, de a una por paso y con la cadencia', () => {
  assert.equal(visiblesAhora({ llegadas: 0, visibles: 0, desdeUltima: 99_999 }), 0, 'sin nada armado no se muestra nada');
  assert.equal(visiblesAhora({ llegadas: 3, visibles: 0, desdeUltima: 99_999 }), 1, 'de a una');
  assert.equal(visiblesAhora({ llegadas: 3, visibles: 1, desdeUltima: CADENCIA_MS - 1 }), 1, 'todavía no pasó el paso');
  assert.equal(visiblesAhora({ llegadas: 3, visibles: 1, desdeUltima: CADENCIA_MS }), 2);
  assert.equal(visiblesAhora({ llegadas: 3, visibles: 3, desdeUltima: 99_999 }), 3);
  assert.equal(visiblesAhora({ llegadas: 2, visibles: 5, desdeUltima: 0 }), 2, 'si se ven de más (otro trabajo), se recortan a las llegadas');
});

test('2. la cadencia: un pequeño delay con pocas, y el total en segundos con muchas', () => {
  assert.equal(cadenciaPara(3), CADENCIA_MS);
  assert.ok(cadenciaPara(40) * 40 <= TOPE_REVELAR_MS, '40 pendientes entran en el tope');
  assert.equal(cadenciaPara(10_000), CADENCIA_MIN_MS, 'nunca tan rápido que no se vea');
  assert.ok(CADENCIA_MS >= 100 && CADENCIA_MS <= 400, `fracciones de segundo por paso (${CADENCIA_MS} ms)`);
});

test('3. se puede saltear, y con «reducir movimiento» va sin cadencia', () => {
  assert.equal(visiblesAhora({ llegadas: 9, visibles: 2, desdeUltima: 0, salteado: true }), 9);
  assert.equal(visiblesAhora({ llegadas: 9, visibles: 0, desdeUltima: 0, sinMovimiento: true }), 9);
  assert.equal(visiblesAhora({ llegadas: 4, visibles: 0, desdeUltima: 0, salteado: true }), 4, 'tampoco salteando se muestra lo que no llegó');
});

test('4. las fases: hechas, la de ahora, las pendientes y la que falló', () => {
  const ids = [{ id: 'leer', texto: 'Leer' }, { id: 'escribir', texto: 'Escribir' }, { id: 'diseno', texto: 'Diseño' }];
  assert.deepEqual(fasesDesde(ids, 'escribir').map((f) => f.estado), ['hecha', 'ahora', 'pendiente']);
  assert.deepEqual(fasesDesde(ids, null).map((f) => f.estado), ['pendiente', 'pendiente', 'pendiente']);
  assert.deepEqual(fasesDesde(ids, 'diseno', { terminado: true }).map((f) => f.estado), ['hecha', 'hecha', 'hecha']);
  assert.deepEqual(fasesDesde(ids, 'escribir', { fallo: true }).map((f) => f.estado), ['hecha', 'fallo', 'pendiente']);
});

test('5. la pieza: «Ver todo», el conteo como status y sin animación con «reducir movimiento»', () => {
  const src = fuente('app/_ui/ArmadoEnVivo.tsx');
  assert.match(src, /<button type="button" className="ae-saltear" onClick=\{saltear\}>Ver todo<\/button>/);
  assert.match(src, /className="ae-conteo" role="status" aria-live="polite"/);
  assert.match(src, /@media \(prefers-reduced-motion: reduce\) \{\n {2}\.ae-pieza \{ animation: none; \}/);
  assert.match(src, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/, 'y sin cadencia (`sinMovimiento`)');
  assert.match(src, /const vistas = piezas\.slice\(0, visibles\);/, 'sólo se dibuja lo revelado');
});
