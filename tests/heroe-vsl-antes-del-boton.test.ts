// En el héroe con VSL, el botón va DEBAJO del video en el teléfono, y la portada lleva UN botón (18/11/2026).
//
// Martín (por el Cerebro), textual: «no debería estar el botón de ver planes debajo del primer CTA de prueba gratis que está debajo
// del título "El mejor software para vender high ticket". Y también cuando se hace versión mobile, jamás debería salir el botón
// previo al VSL. O sea, siempre es el VSL y debajo del VSL el botón».
//
// Medido en el navegador a 375 sobre TODAS las landings de /vsl (las 25 de LANDINGS_COMPETENCIA), la portada, /vsl/semaforo y el
// Accelerator: el botón salía antes del VSL sólo en la portada y en /vsl/semaforo (la única página de detalle con video que
// sigue viva: /vsl/crm y /vsl/funnel ya son landings, y arriba llevan una grabación de la app, no el VSL). El Accelerator ya
// iba título → video → botón. El orden lo pone el CSS: la caja del texto se abre (display:contents) y el video pasa antes del
// botón, así el botón sigue siendo UNO en la página.
//
// Verificado rompiéndolo: volver a poner «Ver planes», sacar el display:contents o el order de la portada, sacar la caja del
// botón en el detalle, o su display:contents, su order o el `flex: none` del video → cada uno, rojo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CSS_PORTADA } from '../app/vsl/_sitio/estilos';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

/** Los bloques `@media (...){…}` con esa cabeza, enteros (contando llaves) y juntos: sólo lo que vale en el teléfono. */
function bloqueMedia(css: string, cabeza: string): string {
  const bloques: string[] = [];
  for (let i = css.indexOf(cabeza); i >= 0; i = css.indexOf(cabeza, i + 1)) {
    let prof = 0, fin = -1;
    for (let j = css.indexOf('{', i); j < css.length && fin < 0; j++) {
      if (css[j] === '{') prof++;
      else if (css[j] === '}' && --prof === 0) fin = j;
    }
    if (fin < 0) throw new Error(`«${cabeza}» no cierra`);
    bloques.push(css.slice(i, fin + 1));
  }
  assert.ok(bloques.length, `no está «${cabeza}»`);
  return bloques.join(' ');
}
const sinEspacios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, '');

test('portada: el héroe lleva UN botón (la prueba gratis) y ningún «Ver planes»', () => {
  const portada = leer('app/vsl/_sitio/Portada.tsx');
  const heroe = portada.slice(portada.indexOf('function HeroSitio()'), portada.indexOf('\n}\n', portada.indexOf('function HeroSitio()')));
  assert.ok(heroe.length > 200, 'no encontré HeroSitio');
  const codigo = heroe.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  assert.doesNotMatch(codigo, /Ver planes/, 'volvió «Ver planes» debajo de la llamada');
  assert.equal((codigo.match(/<Boton\b/g) ?? []).length, 1, 'el héroe tiene que tener un solo botón');
  // El botón dentro de la caja del texto, y el VSL después: el orden del teléfono lo pone el CSS de abajo.
  assert.ok(codigo.indexOf('s-hero-btns') > codigo.indexOf('s-hero-tx') && codigo.indexOf('s-hero-vsl') > codigo.indexOf('s-hero-btns'));
});

test('portada en una columna: título → bajada → VSL → botón (el video antes del botón)', () => {
  const tel = sinEspacios(bloqueMedia(CSS_PORTADA, '@media (max-width:889px)'));
  assert.ok(tel.includes('.s-hero-tx{display:contents}'), 'la caja del texto no se abre: el botón queda pegado a la bajada, antes del video');
  assert.match(tel, /\.s-hero-in\{display:flex;flex-direction:column;align-items:stretch;gap:0;container-type:inline-size\}/,
    'la fila tiene que ser una columna que estira (con align-items:center los botones se achican) y ser el contenedor de la letra del título');
  assert.ok(tel.includes('.s-hero-vsl{order:1}') && tel.includes('.s-hero-btns{order:2}'), 'el video tiene que ir ANTES del botón');
});

test('detalle con video (/vsl/semaforo): el botón en su caja, y en el teléfono debajo del video', () => {
  const fd = leer('app/vsl/_detalle/FeatureDetail.tsx');
  const i = fd.indexOf('<div className="mk-hero-row mk-hero-v">');
  const heroe = fd.slice(i, fd.indexOf('<div className="mk-hero-media">', i));
  assert.ok(i >= 0 && heroe.length > 100, 'no encontré el héroe con video');
  const dice = heroe.indexOf('mk-hero-dice'), cta = heroe.indexOf('mk-hero-cta');
  assert.ok(dice > 0 && cta > dice, 'el texto y el botón tienen que ir en dos cajas, primero lo que dice');
  assert.ok(heroe.indexOf('mk-h1') > dice && heroe.indexOf('mk-h1') < cta, 'el título va en la primera caja');
  assert.ok(heroe.indexOf('mk-btn-hero') > cta, 'el botón va en la caja del botón');

  const css = fd.slice(fd.indexOf('export const CSS_DETALLE'));
  const tel = sinEspacios(bloqueMedia(css, '@media (max-width: 860px)'));
  assert.ok(tel.includes('.mk-hero-v.mk-hero-text{display:contents;}'), 'la caja del texto no se abre en el teléfono');
  assert.ok(tel.includes('.mk-hero-v.mk-hero-media{order:1;flex:none;min-width:0;}'),
    'el video tiene que ir antes del botón y medir su alto (con la base de 540 px, en columna, dejaba ~300 px vacíos)');
  assert.ok(tel.includes('.mk-hero-v.mk-hero-cta{order:2;}'), 'el botón tiene que ir después del video');
});
