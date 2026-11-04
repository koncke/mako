// Los valores medidos sobre una landing publicada (scripts/landing-valores-tilvo.mjs): cambia cómo se ve y NADA de lo que dice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { conValores, HOJA, VALORES } from '../scripts/landing-valores-tilvo.mjs';

const DOC = {
  html: `<div class="gm-libre"><section id="a" style="margin-top:40px;background:#FFFFFF;border-top:1px solid #EEF0F3"><h2 style="font-size:38px;font-weight:700;color:#12151B">Título</h2>
<div style="background:#FFFFFF;border-radius:16px;box-shadow:0 1px 2px rgba(16,19,25,.04)"><p style="color:#fff;background:#2F6FED">Blanco sobre azul</p></div>
<a href="https://hola-mako.com/planes?x=#F5F7FA" style="color:#5B6472">Enlace</a><img src="https://ejemplo.com/foto-2F6FED.png" alt="Foto">
<div style="background:#FEF2F2;border:1.5px solid #FECACA;border-radius:10px;padding:11px 18px"><span style="font-size:16px;font-weight:900;color:#DC2626;flex:none;animation:mkLive 1.5s ease-in-out infinite;line-height:1">!</span><span style="font-size:15px;font-weight:700;color:#DC2626">Solo 5 cupos en la Beta</span></div></section></div>`,
  css: `@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400&display=swap');\n.gm-libre a { color: #2F6FED; }`,
};
const textos = (h: string) => h.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
const atributo = (h: string, a: string) => [...h.matchAll(new RegExp(`\\b${a}="([^"]*)"`, 'g'))].map((m) => m[1]);

test('no toca lo que la landing DICE ni a dónde lleva', () => {
  const { html } = conValores(DOC);
  assert.equal(textos(html), textos(DOC.html));
  assert.deepEqual(atributo(html, 'href'), atributo(DOC.html, 'href'));
  assert.deepEqual(atributo(html, 'src'), atributo(DOC.html, 'src'));
});

test('el fondo de la página no es blanco: la sección se vuelve transparente y la tarjeta queda un tono arriba', () => {
  const { html } = conValores(DOC);
  assert.match(html, /<section id="a" style="margin-top:40px;background:transparent;"/);
  assert.match(html, new RegExp(`background:${VALORES.card};border-radius:18px`));
  assert.match(HOJA, new RegExp(`\\.gm-libre \\{ background: ${VALORES.bg}`));
});

test('el texto blanco sobre el acento sigue blanco; sólo el fondo se vuelve el azul medido', () => {
  assert.match(conValores(DOC).html, new RegExp(`color:#fff;background:${VALORES.accent}`));
});

test('«--now» es sólo el signo de los cupos: la letra queda en tinta, que es la que llega al contraste', () => {
  const { html } = conValores(DOC);
  assert.match(html, new RegExp(`color:${VALORES.now};flex:none;animation:mkLive 2\\.2s`));
  assert.match(html, new RegExp(`color:${VALORES.ink}">Solo 5 cupos`));
  assert.doesNotMatch(html, /#DC2626|#FEF2F2|#FECACA/i);
});

test('la tarjeta oscura del Acelerador no se aclara: su letra es blanca y sobre un fondo claro no se lee', () => {
  assert.match(HOJA, /\.mkpl-card:not\(\.mkpl-programa\) \{ background:/);
  assert.doesNotMatch(HOJA, /\.mkpl-card \{[^}]*background:/);
});

test('la letra: Urbanist en la hoja y en cada style, y Geist ya no se pide', () => {
  const r = conValores({
    html: `<p style="font-family:'Geist',sans-serif">a</p><p style="font-family:'Geist Mono',monospace">b</p>`,
    css: DOC.css,
  });
  assert.doesNotMatch(r.html + r.css, /Geist/);
  assert.match(r.css, /family=Urbanist/);
});

test('la escala es la medida: nada de lo que había queda entre los tamaños de la referencia', () => {
  const { html } = conValores({ html: '<a style="font-size:16.5px"></a><a style="font-size:13px"></a><a style="font-size:44px"></a>', css: '' });
  assert.deepEqual([...html.matchAll(/font-size:([\d.]+px)/g)].map((m) => m[1]), ['15px', '12.5px', '37.44px']);
});
