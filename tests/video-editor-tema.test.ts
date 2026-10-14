// =============================================================================
// Los tokens de `.ce` son hex: `hsl(var(--x))` es CSS inválido y sale transparente
// =============================================================================
// Documentado en docs/hallazgos-video-editor.md («El tema vive en .ce»): los tokens
// de OpenCut eran tripletes HSL y en el port son hex, así que `hsl(#262626)` no vale
// y lo que lo usa se dibuja SIN color, sin error. Los marcadores salieron sin fondo
// por esto, y quedaba uno más —el anillo de selección— que este test terminó de sacar.
//
// Un grep que se corre en cada suite vale más que la nota «se buscan con grep».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..', 'app', 'video-editor');

function archivos(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) archivos(p, out);
    else if (/\.(tsx?|css)$/.test(n)) out.push(p);
  }
  return out;
}

test('ningún archivo del editor usa hsl(var(--…))', () => {
  const culpables: string[] = [];
  for (const p of archivos(RAIZ)) {
    const src = readFileSync(p, 'utf8');
    const sinComentarios = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
    for (const m of sinComentarios.matchAll(/hsl\(var\(/g)) {
      const linea = sinComentarios.slice(0, m.index).split('\n').length;
      culpables.push(`${relative(RAIZ, p).replace(/\\/g, '/')}:${linea}`);
    }
  }
  assert.deepEqual(
    culpables, [],
    'Estos usan `hsl(var(--…))`, que con tokens hex es inválido y se dibuja transparente:\n  '
    + culpables.join('\n  ') + '\n\nUsá `var(--token)` directo, o la clase de Tailwind (`ring-primary`).',
  );
});
