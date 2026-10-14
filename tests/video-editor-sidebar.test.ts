// =============================================================================
// El editor de video se dibuja ADENTRO de MaKo: la barra lateral no desaparece
// =============================================================================
// Pedido de Martín (reunión 858545195 @96:17, validado el 13/10): «que la barra
// lateral no desaparezca del todo mientras se edita». Hasta entonces el editor iba a
// pantalla completa como CapCut (diseño §9): la ruta estaba en `esVistaSinChrome` y la
// raíz `.ce` iba `fixed` encima de todo. Las dos cosas se sacaron, y este test cuida que
// no vuelva ninguna: cualquiera de las dos sola alcanza para tapar la barra otra vez.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const leer = (...p: string[]) => readFileSync(resolve(raiz, ...p), 'utf8');
const vivo = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('la ruta del editor NO está en esVistaSinChrome', () => {
  const src = vivo(leer('app', '_components', 'PublicRouteGate.tsx'));
  const fn = src.slice(src.indexOf('export function esVistaSinChrome'), src.indexOf('}', src.indexOf('export function esVistaSinChrome') + 400) + 1);
  assert.ok(fn.length > 50, 'no encontré esVistaSinChrome');
  assert.ok(!/video-editor/.test(fn), 'El editor volvió a `esVistaSinChrome`: sin chrome no hay barra lateral.');
});

test('la raíz del editor no va `fixed` encima de la app', () => {
  const src = vivo(leer('app', 'video-editor', 'VideoEditorCliente.tsx'));
  assert.ok(!/position:\s*'fixed'/.test(src), 'La raíz `.ce` volvió a `position: fixed`: tapa la barra lateral aunque el chrome se dibuje.');
  assert.ok(!/zIndex:\s*60/.test(src), 'Volvió el z-index que la ponía encima de todo.');
});

test('la page del proyecto usa el mismo marco que el inicio', () => {
  const page = leer('app', 'video-editor', '[proyecto]', 'page.tsx');
  assert.match(page, /<Pagina ancho="completo" densidad="compacta"/, 'El editor ya no se dibuja adentro de `Pagina`.');
  assert.match(page, /calc\(100vh - var\(--alto-secciones, 0px\)\)/, 'El editor no resta el alto de la barra de secciones: el pie queda tapado.');
});
