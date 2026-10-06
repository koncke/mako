// =============================================================================
// El mapa de calor (Landing Analyst, 06/10/2026): ubicar toques y armar la foto
// =============================================================================
// Se EJECUTAN las funciones puras (lib/landing-mapa.ts y lib/landing-mapa-foto.ts):
// son las decisiones que se pueden equivocar sin que nada falle — un toque en el
// lugar equivocado se ve igual de plausible que uno en el correcto.
//
// Probado rompiéndolo el 06/10/2026 (con todo puesto: 9 pasan / 0 fallan):
//   · el corte de celular pasa a <= 768                         -> 8 / 1
//   · en computadora x se ESCALA en vez de correrse del centro  -> 8 / 1
//   · un elemento fijo sin ancla se dibuja por su punto         -> 8 / 1
//   · el ranking agrupa por etiqueta aunque haya selector       -> 8 / 1
//   · htmlDeFoto deja pasar los <script>                        -> 8 / 1
//   · htmlDeFoto deja los atributos on…                         -> 8 / 1
//   · congelarVh no convierte el vh                             -> 7 / 2 (cae también
//     el de la foto, que pide la hoja con el alto congelado)
//   · fotoDeEventos acepta una foto sin el tamaño de la ventana -> 8 / 1
//   · la rampa del calor pasa a un azul                         -> 8 / 1
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORTE_MOVIL, colorDeCalor, dispositivoDe, rankingDe, ubicarPorAncla, ubicarPorPunto, type ToqueMapa } from '../lib/landing-mapa';
import { congelarVh, fotoDeEventos, htmlDeFoto, type NodoFoto } from '../lib/landing-mapa-foto';

const toque = (p: Partial<ToqueMapa>): ToqueMapa => ({
  tipo: 'clic_vacio', x: 0, y: 0, vw: 400, dh: 4000, sel: null, rx: null, ry: null, vh: null, fijo: null, etiqueta: 'vacio: DIV', p: 0, ...p,
});

test('celular y computadora se cortan en 768, y sin ancho no hay cubo', () => {
  assert.equal(CORTE_MOVIL, 768);
  assert.equal(dispositivoDe(393), 'movil');
  assert.equal(dispositivoDe(767), 'movil');
  assert.equal(dispositivoDe(768), 'escritorio');
  assert.equal(dispositivoDe(1920), 'escritorio');
  assert.equal(dispositivoDe(null), null);
  assert.equal(dispositivoDe(0), null);
});

test('sin ancla: el celular escala, la computadora se corre desde el centro', () => {
  // Celular: un toque a la mitad de una ventana de 400 cae a la mitad de una foto de 390.
  assert.deepEqual(ubicarPorPunto(toque({ x: 200, y: 2000, vw: 400, dh: 4000 }), 390, 3900, 'movil'), { x: 195, y: 1950 });
  // Computadora: el contenido va centrado con ancho máximo, así que se corre, no se estira.
  // Un toque 100 px a la derecha del centro en una ventana de 1920 cae 100 px a la derecha
  // del centro de una foto de 1536.
  assert.deepEqual(ubicarPorPunto(toque({ x: 1060, y: 500, vw: 1920, dh: 3000 }), 1536, 3000, 'escritorio'), { x: 868, y: 500 });
  // Fuera de la foto no se dibuja (un punto inventado en el borde es peor que ninguno).
  assert.equal(ubicarPorPunto(toque({ x: 1900, y: 10, vw: 1920, dh: 3000 }), 400, 3000, 'escritorio'), null);
});

test('un elemento FIJO sin ancla no se dibuja: su punto de página es dónde estaba el scroll', () => {
  assert.equal(ubicarPorPunto(toque({ x: 200, y: 2000, fijo: true }), 390, 3900, 'movil'), null);
  // Con su ancla sí: va sobre su caja.
  assert.deepEqual(ubicarPorAncla({ rx: 500, ry: 250 }, { left: 100, top: 1000, width: 200, height: 40 }), { x: 200, y: 1010 });
  assert.equal(ubicarPorAncla({ rx: null, ry: 250 }, { left: 0, top: 0, width: 10, height: 10 }), null);
});

test('el ranking agrupa por ELEMENTO cuando hay ancla, y ordena por personas', () => {
  const ts = [
    toque({ sel: 'body > a:nth-of-type(1)', etiqueta: 'boton: Comprar', tipo: 'click', p: 1 }),
    toque({ sel: 'body > a:nth-of-type(1)', etiqueta: 'boton: Comprar', tipo: 'click', p: 1 }),
    toque({ sel: 'body > a:nth-of-type(2)', etiqueta: 'boton: Comprar', tipo: 'click', p: 2 }),
    toque({ sel: 'body > a:nth-of-type(2)', etiqueta: 'boton: Comprar', tipo: 'click', p: 3 }),
  ];
  const r = rankingDe(ts);
  // Dos botones que dicen lo mismo son dos lugares distintos.
  assert.equal(r.filas.length, 2);
  // El de dos personas va primero aunque el otro tenga los mismos toques.
  assert.equal(r.filas[0].sel, 'body > a:nth-of-type(2)');
  assert.equal(r.filas[0].personas, 2);
  assert.equal(r.filas[1].toques, 2);
  assert.equal(r.filas[1].personas, 1);
});

const FOTO: NodoFoto = {
  type: 0, childNodes: [
    { type: 1, name: 'html' },
    { type: 2, tagName: 'html', attributes: {}, childNodes: [
      { type: 2, tagName: 'head', attributes: {}, childNodes: [
        { type: 2, tagName: 'link', attributes: { rel: 'stylesheet', href: 'https://x.com/a.css', _cssText: '.hero{min-height:100vh}' } },
        { type: 2, tagName: 'script', attributes: { src: 'https://x.com/app.js' }, childNodes: [{ type: 3, textContent: 'alert(1)' }] },
      ] },
      { type: 2, tagName: 'body', attributes: { onload: 'alert(2)' }, childNodes: [
        { type: 2, tagName: 'section', attributes: { class: 'hero', style: 'height:50vh' }, childNodes: [{ type: 3, textContent: 'Hola <b>' }] },
        { type: 2, tagName: 'img', attributes: { src: 'https://x.com/i.png', onerror: 'alert(3)' } },
        { type: 2, tagName: 'iframe', attributes: { src: 'https://player.x.com/v', width: '560' } },
        { type: 2, tagName: 'a', attributes: { href: 'javascript:alert(4)' }, childNodes: [{ type: 3, textContent: 'link' }] },
      ] },
    ] },
  ],
};

test('la foto sale SIN código: ni <script>, ni on…, ni javascript:, ni iframes que carguen', () => {
  const html = htmlDeFoto({ ancho: 400, alto: 800, nodo: FOTO });
  assert.doesNotMatch(html, /<script/i, 'un <script> en la foto correría en el iframe si el sandbox se cayera');
  assert.doesNotMatch(html, /alert\(/, 'ni un atributo on… ni un javascript: puede sobrevivir');
  assert.doesNotMatch(html, /player\.x\.com/, 'el iframe de un tercero queda vacío: no se carga nada de afuera');
  assert.match(html, /<iframe width="560" srcdoc="">/);
  // La hoja guardada adentro va como <style>, y el texto se escapa.
  assert.match(html, /<style>\.hero\{min-height:800px\}<\/style>/);
  assert.match(html, /Hola &lt;b&gt;/);
  assert.match(html, /^<!DOCTYPE html>/);
});

test('las unidades de ventana se congelan al alto de quien grabó', () => {
  // En un iframe tan alto como la página entera, 100vh valdría TODA la página.
  assert.equal(congelarVh('min-height:100vh;height:50dvh;top:-10vh', 800), 'min-height:800px;height:400px;top:-80px');
  assert.match(htmlDeFoto({ ancho: 400, alto: 800, nodo: FOTO }), /style="height:400px"/);
  // Sin alto conocido no se toca nada.
  assert.equal(congelarVh('height:100vh', 0), 'height:100vh');
});

test('sin el tamaño de la ventana no hay foto: no se dibuja un mapa sobre nada', () => {
  const nodo = JSON.stringify({ type: 2, data: { node: { type: 0, childNodes: [] } } });
  const meta = JSON.stringify({ type: 4, data: { width: 393, height: 852, href: 'https://x.com/' } });
  assert.equal(fotoDeEventos(nodo), null, 'una foto sin el evento del tamaño no se puede escalar');
  assert.equal(fotoDeEventos(JSON.stringify({ type: 3, data: {} })), null, 'una grabación sin foto (pasa en 3 de 13) devuelve null');
  const f = fotoDeEventos([meta, nodo, 'línea rota {'].join('\n'));
  assert.deepEqual(f && { ancho: f.ancho, alto: f.alto }, { ancho: 393, alto: 852 });
  // ⚠️ Y CADA RENGLÓN DEL CUERPO SELLADO ES UN LOTE (un array de eventos), que es la
  // forma real: leyendo renglones como eventos sueltos no aparecía nunca la foto.
  const lote = JSON.stringify([JSON.parse(meta), JSON.parse(nodo), { type: 3, data: {} }]);
  const g = fotoDeEventos(lote + '\n' + JSON.stringify([{ type: 3, data: {} }]));
  assert.deepEqual(g && { ancho: g.ancho, alto: g.alto }, { ancho: 393, alto: 852 });
});

test('la rampa del calor es de tonos cálidos vecinos, de transparente a opaco', () => {
  const [r0, g0, b0, a0] = colorDeCalor(0);
  const [r1, , b1, a1] = colorDeCalor(1);
  // Cálido de punta a punta: el rojo manda siempre sobre el azul (no es un arcoíris).
  assert.ok(r0 > b0 && r1 > b1 && g0 > b0, 'la rampa dejó de ser cálida');
  // Lo poco casi no tapa la página; lo mucho se ve.
  assert.ok(a0 < a1, 'la opacidad tiene que crecer con la densidad');
  assert.ok(a1 <= 255 && a0 > 0);
});

test('un toque sin ancla y sin alto de documento usa su y tal cual (no inventa una escala)', () => {
  assert.deepEqual(ubicarPorPunto(toque({ x: 100, y: 300, vw: 400, dh: null }), 400, 4000, 'movil'), { x: 100, y: 300 });
});
