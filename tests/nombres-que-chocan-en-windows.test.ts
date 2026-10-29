// =============================================================================
// Dos archivos que sólo difieren en mayúsculas son UNO en Windows (29/10/2026)
// =============================================================================
// El Image Editor tenía `editor/Estudio.tsx` (la pantalla) y `editor/estudio.ts` (su estado). En Linux son dos
// archivos; en Windows el disco no distingue mayúsculas y `import('./editor/Estudio')` prueba `.ts` antes que `.tsx`:
// cargaba el ESTADO en vez de la pantalla. El tsc lo marcaba en Windows (TS1149/TS1261), el build de Vercel (Linux)
// no, y una PC con Windows (un build parcial local, MaKo Desktop) habría abierto el editor en blanco. El estado pasó a
// `editor/estudio-estado.ts`; esto frena el próximo par.
//
// Se comparan las rutas sin la extensión que resuelve un import (`./x` busca x.ts, x.tsx, x.js…): `Estudio.tsx` y
// `estudio.ts` chocan aunque la extensión sea otra. Dos con la MISMA ruta y otra extensión (x.ts y x.tsx) no son
// de este test: chocan igual en todos lados.
//
// Probado rompiéndolo (29/10/2026), una rotura por vez y restaurando de memoria, sobre los 2 tests de este archivo:
//   · sin pasar a minúsculas (compara tal cual):                     1 fallo, 1 pase
//   · sin sacar la extensión (Estudio.tsx ≠ estudio.ts):             1 fallo, 1 pase
//   · `estudio-estado.ts` vuelto a `estudio.ts` en el índice de git:  1 fallo, 1 pase
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** La ruta como la ve un import en Windows: sin la extensión que se prueba sola y sin mayúsculas. */
const comoLaVeWindows = (ruta: string) => ruta.replace(/\.(d\.ts|tsx?|mts|cts|jsx?|mjs|cjs)$/, '').toLowerCase();

/** Los pares de rutas distintas que en Windows son la misma. */
function chocanEnWindows(rutas: readonly string[]): [string, string][] {
  const vistas = new Map<string, string>();
  const choques: [string, string][] = [];
  for (const ruta of rutas) {
    const clave = comoLaVeWindows(ruta);
    const otra = vistas.get(clave);
    if (otra === undefined) vistas.set(clave, ruta);
    else if (otra.replace(/\.[^./]+$/, '') !== ruta.replace(/\.[^./]+$/, '')) choques.push([otra, ruta]);
  }
  return choques;
}

test('el caso del Image Editor choca; los nombres parecidos y la misma ruta con otra extensión, no', () => {
  assert.deepEqual(chocanEnWindows(['app/editor/Estudio.tsx', 'app/editor/estudio.ts']), [['app/editor/Estudio.tsx', 'app/editor/estudio.ts']]);
  assert.deepEqual(chocanEnWindows(['app/editor/Estudio.tsx', 'app/editor/estudio-estado.ts', 'app/editor/estudio.module.css']), []);
  assert.deepEqual(chocanEnWindows(['lib/x.ts', 'lib/x.tsx']), []);
});

test('ningún par de archivos del repo es el mismo en Windows', () => {
  const rutas = execFileSync('git', ['ls-files'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);
  assert.ok(rutas.length > 1000, `git ls-files devolvió ${rutas.length} rutas: no se leyó el repo`);
  const choques = chocanEnWindows(rutas);
  assert.deepEqual(choques, [], `en Windows son el mismo archivo: ${choques.map(([a, b]) => `${a} y ${b}`).join(' · ')}`);
});
