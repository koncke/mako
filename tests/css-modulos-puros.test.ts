// =============================================================================
// Todo selector de un .module.css lleva una clase o un id propio (14/11/2026)
// =============================================================================
// El despliegue del 14/11 (06:00 UTC, dpl_GQRTqUeJTxuqzeBoRxYiUkhgfc3t) no compiló:
//   Selector "[data-origen="codigo"]" is not pure. Pure selectors must contain at least one local class or id.
// en app/video-editor/desarmar.module.css. GitHub estaba en verde porque el CI corre tsc y los tests, no `next build`: un
// selector sólo de atributo (o de etiqueta) en un CSS module recién se cae al compilar producción. Este test hace esa
// misma cuenta sobre todos los .module.css del repo.
//
// Probado rompiéndolo (14/11/2026): con `[data-origen='codigo'] { … }` de vuelta en desarmar.module.css, este test da rojo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');

/** Los selectores de nivel de regla de un CSS (sin comentarios, sin las reglas de @keyframes ni los @-bloques en sí). */
export function selectoresDe(css: string): string[] {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, (s) => s.replace(/[{}]/g, ' '));
  const fuera: string[] = [];
  // Recorre bloque por bloque, recordando si se está dentro de un @keyframes (sus «from», «to» y «50%» no son selectores).
  const pila: Array<'keyframes' | 'otro'> = [];
  let i = 0;
  let buffer = '';
  while (i < limpio.length) {
    const c = limpio[i];
    if (c === '{') {
      const cabeza = buffer.trim();
      buffer = '';
      if (cabeza.startsWith('@')) pila.push(/^@(-\w+-)?keyframes/.test(cabeza) ? 'keyframes' : 'otro');
      else {
        if (!pila.includes('keyframes')) fuera.push(...cabeza.split(',').map((s) => s.trim()).filter(Boolean));
        pila.push('otro');
      }
    } else if (c === '}') {
      buffer = '';
      pila.pop();
    } else if (c === ';') {
      buffer = '';
    } else buffer += c;
    i++;
  }
  return fuera;
}

/** Puro = tiene al menos una clase o un id propio (fuera de un :global(...)). */
export function esPuro(selector: string): boolean {
  const sinGlobal = selector.replace(/:global\([^)]*\)/g, ' ');
  return /[.#][A-Za-z_-]/.test(sinGlobal.replace(/\[[^\]]*\]/g, ' '));
}

test('selectoresDe y esPuro: los casos que importan', () => {
  assert.deepEqual(selectoresDe('.a, [data-x] { color: red } @media (x) { .b { c: d } } @keyframes k { from { a: b } 50% { a: c } }'), ['.a', '[data-x]', '.b']);
  assert.equal(esPuro("[data-origen='codigo']"), false);
  assert.equal(esPuro("[data-origen='a.b']"), false, 'el punto adentro de un atributo no es una clase');
  assert.equal(esPuro(".mezcla [data-origen='codigo']"), true);
  assert.equal(esPuro('[data-active] .lead'), true);
  assert.equal(esPuro('div > span'), false);
  assert.equal(esPuro(':global(.x) span'), false, 'una clase global no cuenta como propia');
});

test('ningún .module.css del repo tiene un selector sin clase ni id propio (Next no lo compila)', () => {
  const archivos = execFileSync('git', ['ls-files', '*.module.css'], { cwd: RAIZ, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
  assert.ok(archivos.length > 10, `se esperaban muchos .module.css y se encontraron ${archivos.length}`);
  const malos: string[] = [];
  for (const f of archivos) {
    for (const s of selectoresDe(readFileSync(join(RAIZ, f), 'utf8'))) if (!esPuro(s)) malos.push(`${f}: ${s}`);
  }
  assert.deepEqual(malos, [], 'Cuelga cada uno de una clase local (por ejemplo `.caja [data-x]`):\n' + malos.join('\n'));
});
