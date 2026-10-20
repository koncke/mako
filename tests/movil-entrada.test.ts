// =============================================================================
// Al abrir la app en el teléfono sale la MISMA entrada de MaKo que en el onboarding (20/10/2026)
// =============================================================================
// Martín (pedido del 18/10, punto 2): «Que esa misma animación sea la que sale al iniciar la app en Mobile». Se reusa
// EntradaMako (no una copia), una vez por sesión del navegador, y como es carga termina sola; tocarla la adelanta.
//
// Se monta en app/m/layout.tsx, NO en ShellM: el índice de app/m/_ui reexporta ShellM, los tests lo cargan en node, y
// la entrada trae criatura.css (node no lee .css: tests/m-offer.test.ts cayó con «Unexpected token '.'», 20/10/2026).
//
// ROTURAS (20/10/2026, arnés romper-movil-entrada.js del scratchpad; base 3/0): el layout sin la entrada → 2/1 · la
// entrada de vuelta en ShellM → 2/1 · una entrada propia en vez de EntradaMako → 2/1 · sin el «una vez por sesión» → 2/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('el layout del teléfono monta la entrada, y el shell no', () => {
  const layout = sinComentarios(leer('app/m/layout.tsx'));
  assert.match(layout, /import \{ EntradaMobile \} from '\.\/_ui\/EntradaMobile';/);
  assert.match(layout, /<\/ShellM>\s*<EntradaMobile \/>/, 'la entrada no se monta al abrir la app');
  assert.doesNotMatch(sinComentarios(leer('app/m/_ui/ShellM.tsx')), /EntradaMobile|EntradaMako/,
    'ShellM sale del índice de app/m/_ui, que los tests cargan en node: la entrada trae un .css y los rompe');
});

test('es la MISMA EntradaMako del onboarding, no una copia', () => {
  const e = sinComentarios(leer('app/m/_ui/EntradaMobile.tsx'));
  assert.match(e, /import \{ EntradaMako \} from '@\/app\/onboarding\/EntradaMako';/);
  assert.match(e, /return <EntradaMako onFin=\{\(\) => setMostrar\(false\)\} \/>;/);
  assert.doesNotMatch(e, /<svg|@keyframes|<CriaturaMako/, 'una animación propia se queda vieja el día que cambie la del onboarding');
});

test('una vez por sesión, y termina sola (es carga)', () => {
  const e = sinComentarios(leer('app/m/_ui/EntradaMobile.tsx'));
  assert.match(e, /sessionStorage\.getItem\(CLAVE_ENTRADA_MOVIL\) === '1'/);
  assert.match(e, /sessionStorage\.setItem\(CLAVE_ENTRADA_MOVIL, '1'\)/);
  assert.match(e, /window\.setTimeout\(\(\) => setMostrar\(false\), vista \? 0 : MS_ENTRADA_MOVIL\)/, 'sin el corte, la app pediría un toque cada vez que se abre');
});
