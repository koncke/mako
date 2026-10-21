// =============================================================================
// Al abrir la app en el teléfono sale la MISMA entrada de MaKo que en el onboarding (20/10/2026)
// =============================================================================
// Martín (pedido del 18/10, punto 2): «Que esa misma animación sea la que sale al iniciar la app en Mobile». Se reusa
// EntradaMako (no una copia), una vez por sesión del navegador, y como es carga termina sola; tocarla la adelanta.
//
// Se monta en app/m/layout.tsx, NO en ShellM: el índice de app/m/_ui reexporta ShellM, los tests lo cargan en node, y
// la entrada trae criatura.css (node no lee .css: tests/m-offer.test.ts cayó con «Unexpected token '.'», 20/10/2026).
// La revisión del Cerebro (20/10, tarde): arrancaba visible y la marca de «ya la vi» se leía al hidratar, así que en cada
// recarga ya vista tapaba la pantalla hasta hidratar (y sin JS, para siempre). Ahora un script de antes del primer pintado
// la marca vista en <html> y el CSS la oculta; sin JS, el CSS la esconde a los 6 s.
//
// ROTURAS (20/10/2026, arnés romper.js + roturas-movil-entrada.json del scratchpad; base 5/0): el layout sin la entrada
// → 4/1 · una entrada propia en vez de EntradaMako → 4/1 · sin el «una vez por sesión» → 4/1 · sin el script de antes de
// pintar → 4/1 · el script que no marca <html> → 4/1 · sin el respaldo de los 6 s → 4/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ATTR_ENTRADA_VISTA, CLAVE_ENTRADA_MOVIL, ENTRADA_ANTES_DE_PINTAR } from '../app/m/_ui/entrada';

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
  assert.match(e, /return <div className="m-entrada"><EntradaMako onFin=\{\(\) => setMostrar\(false\)\} \/><\/div>;/);
  assert.doesNotMatch(e, /<svg|@keyframes|<CriaturaMako/, 'una animación propia se queda vieja el día que cambie la del onboarding');
});

test('una vez por sesión, y termina sola (es carga)', () => {
  const e = sinComentarios(leer('app/m/_ui/EntradaMobile.tsx'));
  assert.match(e, /sessionStorage\.getItem\(CLAVE_ENTRADA_MOVIL\) === '1'/);
  assert.match(e, /sessionStorage\.setItem\(CLAVE_ENTRADA_MOVIL, '1'\)/);
  assert.match(e, /window\.setTimeout\(\(\) => setMostrar\(false\), vista \? 0 : MS_ENTRADA_MOVIL\)/, 'sin el corte, la app pediría un toque cada vez que se abre');
});

test('la sesión ya vista no la pinta nunca: el script de antes de pintar marca <html>', () => {
  // Se corre el script DE VERDAD, con un <html> y un sessionStorage de mentira.
  const correr = (guardado: string | null, falla = false) => {
    const attrs = new Map<string, string>();
    const documento = { documentElement: { setAttribute: (k: string, v: string) => attrs.set(k, v) } };
    const storage = { getItem: (k: string) => { if (falla) throw new Error('SecurityError'); return k === CLAVE_ENTRADA_MOVIL ? guardado : null; } };
    new Function('document', 'sessionStorage', ENTRADA_ANTES_DE_PINTAR)(documento, storage);
    return attrs.has(ATTR_ENTRADA_VISTA);
  };
  assert.equal(correr('1'), true, 'ya vista: se oculta desde el primer cuadro');
  assert.equal(correr(null), false, 'la primera vez se ve');
  assert.equal(correr(null, true), false, 'sin storage no rompe');
  const layout = leer('app/m/layout.tsx');
  assert.ok(layout.indexOf('__html: ENTRADA_ANTES_DE_PINTAR') > 0 && layout.indexOf('__html: ENTRADA_ANTES_DE_PINTAR') < layout.indexOf('<EntradaMobile />'),
    'el script tiene que correr antes de que se dibuje la capa');
  assert.match(sinComentarios(leer('app/onboarding/ChatArranque.tsx')), /sessionStorage\.setItem\(CLAVE_ENTRADA_MOVIL, '1'\)/,
    'al terminar el onboarding en el teléfono, la entrada se repetía');
});

test('el CSS la oculta con la marca, y sin JS se va sola a los 6 s', () => {
  const css = leer('app/m/m.css');
  assert.match(css, /html\[data-entrada-vista\] \.m-entrada \{ display: none; \}/);
  assert.match(css, /\.m-entrada \{ animation: m-entrada-se-va 0s linear 6s forwards; \}/);
  assert.match(css, /@keyframes m-entrada-se-va \{ to \{ visibility: hidden; \} \}/);
});
