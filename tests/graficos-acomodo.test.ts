// =============================================================================
// El acomodo según el ancho: se calcula al dibujar y nunca se guarda (1/11/2026)
// =============================================================================
// Correr: node --import tsx --test tests/graficos-acomodo.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GRILLA_ANGOSTA, GRILLA_MEDIANA, acomodoPorAncho } from '../lib/graficos-acomodo';
import { componentesDe, PLANTILLAS_HOJA } from '../lib/graficos-plantillas';
import { PLANTILLAS_GENERAL } from '../lib/general-plantillas';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const c = (i: string, x: number, y: number, w: number, h: number) => ({ i, x, y, w, h });
const numero = (id: string) => id.startsWith('n');
const WHARF = [c('p', 0, 0, 6, 8), c('n1', 6, 0, 3, 4), c('n2', 9, 0, 3, 4), c('n3', 6, 4, 3, 4), c('n4', 9, 4, 3, 4), c('a', 0, 8, 4, 7), c('b', 4, 8, 4, 7), c('d', 8, 8, 4, 7), c('t', 0, 15, 12, 10)];
const de = (l: readonly { i: string }[], i: string) => l.find((x) => x.i === i) as ReturnType<typeof c>;

test('con ancho de sobra, tal cual: ni una copia', () => {
  assert.equal(acomodoPorAncho(WHARF, GRILLA_MEDIANA, numero), WHARF);
  assert.equal(acomodoPorAncho(WHARF, 1400, numero), WHARF);
  assert.equal(acomodoPorAncho(WHARF, 0, numero), WHARF, 'sin medir todavía');
});

test('mediana: el principal a lo ancho, los números en fila y los paneles de a dos', () => {
  const l = acomodoPorAncho(WHARF, GRILLA_MEDIANA - 1, numero);
  assert.deepEqual([de(l, 'p').x, de(l, 'p').w], [0, 12]);
  assert.deepEqual(['n1', 'n2', 'n3', 'n4'].map((i) => de(l, i).w), [3, 3, 3, 3]);
  assert.equal(new Set(['n1', 'n2', 'n3', 'n4'].map((i) => de(l, i).y)).size, 1);
  assert.deepEqual(['a', 'b'].map((i) => de(l, i).w), [6, 6]);
  assert.equal(de(l, 'd').w, 12, 'el que queda solo se estira');
});

test('angosta: una columna, y los números de a dos', () => {
  const l = acomodoPorAncho(WHARF, GRILLA_ANGOSTA - 1, numero);
  assert.ok(['p', 'a', 'b', 'd', 't'].every((i) => de(l, i).w === 12));
  assert.deepEqual(['n1', 'n2', 'n3', 'n4'].map((i) => de(l, i).w), [6, 6, 6, 6]);
});

test('el orden es el mismo, no se pisa nada y no quedan huecos: en cada plantilla y en los dos cortes', () => {
  for (const p of [...PLANTILLAS_HOJA, ...PLANTILLAS_GENERAL]) {
    const comps = componentesDe(p);
    const base = comps.map((x) => ({ i: x.id, x: x.x, y: x.y, w: x.w, h: x.h }));
    const esNum = new Set(comps.filter((x) => String((x as { tipo?: string }).tipo).startsWith('numero')).map((x) => x.id));
    for (const ancho of [GRILLA_MEDIANA - 1, GRILLA_ANGOSTA - 1]) {
      const l = acomodoPorAncho(base, ancho, (id) => esNum.has(id));
      assert.equal(l.length, base.length, p.id);
      for (let a = 0; a < l.length; a++) for (let b = a + 1; b < l.length; b++) {
        const [u, v] = [l[a], l[b]];
        assert.ok(!(u.x < v.x + v.w && v.x < u.x + u.w && u.y < v.y + v.h && v.y < u.y + u.h), `${p.id} a ${ancho}: ${u.i} pisa a ${v.i}`);
      }
      const hasta = Math.max(...l.map((x) => x.y + x.h));
      for (let col = 0; col < 12; col++) for (let fila = 0; fila < hasta; fila++) {
        assert.ok(l.some((x) => x.x <= col && col < x.x + x.w && x.y <= fila && fila < x.y + x.h), `${p.id} a ${ancho}: hueco en ${col},${fila}`);
      }
    }
  }
});

test('nunca se guarda: mirando la grilla no escribe, y editando se ve el acomodo de verdad', () => {
  const e = leer('app/dashboard/EditorInforme.tsx');
  assert.match(e, /const alMoverGrilla = useCallback\(\(l: Layout\) => \{\n\s*if \(!editando\) return;/);
  assert.match(e, /return editando \|\| imprimiendo \? visto : acomodoPorAncho\(visto, width,/);
});
