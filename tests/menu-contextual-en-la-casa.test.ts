// =============================================================================
// El menú contextual, en la casa: barrel, catálogo y ui.css (9/11/2026)
// =============================================================================
// La pieza existía y andaba, pero vivía afuera de las reglas de app/_ui/LEEME.md: sus `:hover`/`:focus`
// estaban en un `<style>` adentro del componente, no estaba en el barrel y no se podía mirar en
// /admin/ui. El propio archivo lo decía: «ui.css no era de este cambio… está anotado como pendiente».
//
// Por qué importa, y no es orden por el orden:
//   · Un `<style>` adentro de la pieza se RE-INSERTA cada vez que el menú se abre, y es justo lo que la
//     regla 3 vino a terminar: la app llegó a 1.158 botones que se veían distinto porque sus estados
//     vivían en `style={{}}`.
//   · Una pieza fuera del catálogo es una pieza que nadie sabe que existe: la siguiente pantalla que
//     necesita un «⋯» se dibuja uno propio. Ya pasó con las flechas ← →, que cada pantalla dibujaba a
//     mano porque el set de la casa no las tenía.
//
// Correr: node --import tsx --test tests/menu-contextual-en-la-casa.test.ts
// ROTURAS (9/11/2026, una por vez y restaurada; base 5 / 0):
//   · devolver los :hover a un <style> adentro de la pieza        → 4 / 1
//   · sacar la línea del barrel                                   → 4 / 1
//   · importar la pieza por su ruta en vez del barrel             → 4 / 1
//   · sacar 'flecha-derecha' del set                              → 4 / 1
//   · dejar la demo del catálogo sin `enLinea`                    → 4 / 1
// ⚠️ La primera rotura NO mordió al primer intento y el test parecía bueno igual: mi mutante no se
//    aplicó porque el ancla no existía, y «pass 5 / fail 0» se leía como «la aserción no sirve». Una
//    rotura que no se aplica no prueba nada — hay que ver el mutante PUESTO antes de creerle al número.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8');

test('⚠️ los :hover/:focus de la pieza viven en ui.css, y NO en un <style> adentro', () => {
  const css = leer('app/_ui/ui.css');
  assert.match(css, /\.mk-mctx__item:hover:not\(:disabled\)/, 'el hover tiene que estar en ui.css');
  assert.match(css, /\.mk-mctx__item\[aria-expanded="true"\]/, 'y el estado de submenú abierto también');
  // ⚠️ Se mira el CÓDIGO, no el archivo entero: la cabecera CUENTA la mudanza y nombra `:hover` y
  // `<style>` a propósito. Un assert sobre el texto crudo daba rojo contra su propia explicación —
  // que es la forma más tonta de que un test te haga borrar la documentación para ponerlo en verde.
  const sinComentarios = (s: string) => s.split(/\r?\n/).filter((l) => !l.trimStart().startsWith('//')).join('\n');
  const pieza = sinComentarios(leer('app/_ui/MenuContextual.tsx'));
  // Un <style> adentro se re-inserta en cada apertura, y es lo que la regla 3 vino a terminar.
  assert.doesNotMatch(pieza, /<style>/, 'la pieza no vuelve a traer su propio <style>');
  assert.doesNotMatch(pieza, /\.mk-mctx__item/, 'ni sus selectores en una constante de CSS');
});

test('⚠️ la pieza está en el barrel: es como el resto de la casa la encuentra', () => {
  const barrel = leer('app/_ui/index.ts');
  assert.match(barrel, /export \{[^}]*MenuContextual[^}]*\} from '\.\/MenuContextual';/);
  assert.match(barrel, /ListaMenuContextual/, 'la lista también: el catálogo dibuja ésa');
  assert.match(barrel, /type ItemMenuContextual/, 'y el tipo, o cada pantalla se escribe el suyo');
});

test('⚠️ el catálogo /admin/ui la dibuja, y la trae DEL BARREL', () => {
  const cat = leer('app/admin/ui/CatalogoUI.tsx');
  assert.match(cat, /<ListaMenuContextual/, 'si no se dibuja, la pieza sigue siendo invisible');
  // Del barrel y no por ruta directa: importarla de '@/app/_ui/MenuContextual' acá dejaría el barrel sin
  // uso y la próxima pieza volvería a saltearlo.
  const deLaCasa = cat.slice(0, cat.indexOf("} from '@/app/_ui';"));
  assert.ok(deLaCasa.includes('ListaMenuContextual'), 'entra por @/app/_ui, no por su ruta');
  assert.doesNotMatch(cat, /from '@\/app\/_ui\/MenuContextual'/);
});

test('⚠️ las flechas ← → son del SET de la casa, no un dibujo por pantalla', () => {
  const iconos = leer('app/_ui/iconos-menu.tsx');
  assert.match(iconos, /'flecha-izquierda':/, 'sin esto cada columna se dibuja la suya');
  assert.match(iconos, /'flecha-derecha':/);
  // Y el catálogo las usa POR NOMBRE: así se ve que están, y el tipo `NombreIconoMenu` las cubre.
  const cat = leer('app/admin/ui/CatalogoUI.tsx');
  assert.match(cat, /icono: 'flecha-izquierda'/);
  assert.match(cat, /icono: 'flecha-derecha'/);
});

test('la demo del catálogo cubre lo que NO se ve leyendo el código', () => {
  // Un catálogo que dibuja un renglón feliz no sirve: lo que hay que poder mirar es lo raro.
  const cat = leer('app/admin/ui/CatalogoUI.tsx');
  const demo = cat.slice(cat.indexOf('const MENU_DEMO'), cat.indexOf('export function CatalogoUI'));
  for (const campo of ['hijos:', 'enLinea:', 'deshabilitado: true', 'peligro: true', 'null,']) {
    assert.ok(demo.includes(campo), `la demo tiene que mostrar ${campo}`);
  }
});
