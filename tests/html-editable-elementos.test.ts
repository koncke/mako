// =============================================================================
// Los botones, imágenes y videos de un «Diseño editable», leídos y cambiados sobre el HTML (25/10/2026)
// =============================================================================
// Lo que usa la API (configurar_boton_landing, poner_enlace_landing, cambiar_imagen_landing, ver_secciones_landing) para
// que las páginas de MaKo se usen enteras por la API, como en la pantalla. Lo que fija:
//   1. lee cada elemento con lo suyo: el botón con su texto y a dónde lleva; la imagen con su dirección; el video, si es un
//      reproductor o un archivo (con el src de su <source> si no tiene propio);
//   2. cambia UNO y el resto vuelve byte por byte; lo nuevo se escapa (un destino nunca abre otro atributo);
//   3. un botón con dos textos no se cambia de un golpe, y un reproductor no se cambia por un archivo.
// Correr: node --import tsx --test tests/html-editable-elementos.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atributoDe, conAtributo, conEnlaceDeDiseno, conImagenDeDiseno, conVideoDeDiseno, elementosDeHtmlEditable } from '../lib/editor-landing/html-editable-elementos';

const HTML = [
  '<section class="hero">',
  '<a class="btn" href="#beta"><svg class="i"><path d="M0 0"/></svg>Agenda tu llamada</a>',
  '<iframe src="https://player-vz-1.tv.pandavideo.com/embed/?v=abc" allow="autoplay"></iframe>',
  '<img src="https://hola-mako.com/a.png" alt="Caso" srcset="https://hola-mako.com/a@2x.png 2x">',
  '<a href=\'https://hola-mako.com/vsl/crm\' class="card"><h3>CRM</h3><p>Llena solo</p></a>',
  '<video controls muted><source src="https://hola-mako.com/v.mp4" type="video/mp4"></video>',
  '<img src="https://hola-mako.com/b.jpg">',
  '</section>',
].join('');

const resto = (a: string, b: string) => {
  // Lo que NO es la etiqueta tocada vuelve igual: se compara el HTML sin la etiqueta n-ésima de cada lado.
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  let j = 0;
  while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
  return { cambiado: [a.slice(i, a.length - j), b.slice(i, b.length - j)] };
};

test('lee cada elemento con lo suyo, en el orden del HTML', () => {
  assert.deepEqual(elementosDeHtmlEditable(HTML), [
    { tipo: 'enlace', n: 1, texto: 'Agenda tu llamada', destino: '#beta', nuevaPestana: false },
    { tipo: 'video', n: 1, src: 'https://player-vz-1.tv.pandavideo.com/embed/?v=abc', reproductor: true },
    { tipo: 'imagen', n: 1, src: 'https://hola-mako.com/a.png', alt: 'Caso' },
    { tipo: 'enlace', n: 2, texto: 'CRM Llena solo', destino: 'https://hola-mako.com/vsl/crm', nuevaPestana: false },
    { tipo: 'video', n: 2, src: 'https://hola-mako.com/v.mp4', reproductor: false },
    { tipo: 'imagen', n: 2, src: 'https://hola-mako.com/b.jpg', alt: null },
  ]);
});

test('el botón: a dónde lleva, la pestaña nueva y el texto; el resto, igual', () => {
  const r = conEnlaceDeDiseno(HTML, 1, { destino: 'https://wa.me/549110000', nuevaPestana: true, texto: 'Escríbenos' });
  assert.equal(typeof r, 'string');
  const b = elementosDeHtmlEditable(r as string)[0];
  assert.deepEqual(b, { tipo: 'enlace', n: 1, texto: 'Escríbenos', destino: 'https://wa.me/549110000', nuevaPestana: true });
  assert.match(r as string, /<a class="btn" href="https:\/\/wa\.me\/549110000" target="_blank" rel="noopener noreferrer"><svg class="i"><path d="M0 0"\/><\/svg>Escríbenos<\/a>/, 'el ícono de adentro queda');
  // Lo demás, byte por byte.
  assert.ok((r as string).endsWith(HTML.slice(HTML.indexOf('<iframe'))));
  // Volver a la misma pestaña saca target y rel; sin destino, sin href.
  const sin = conEnlaceDeDiseno(r as string, 1, { destino: null, nuevaPestana: false }) as string;
  assert.match(sin, /<a class="btn"><svg/);
  // Un destino con comillas no abre otro atributo.
  const raro = conEnlaceDeDiseno(HTML, 1, { destino: 'https://x.com/?a="><script>' }) as string;
  assert.match(raro, /href="https:\/\/x\.com\/\?a=&quot;&gt;&lt;script&gt;"/);
  assert.doesNotMatch(raro, /<script>/);
});

test('un botón con dos textos no se cambia de un golpe', () => {
  const r = conEnlaceDeDiseno(HTML, 2, { texto: 'Otro' });
  assert.ok(typeof r !== 'string' && /2 textos/.test(r.error));
  // Su destino sí.
  assert.equal(typeof conEnlaceDeDiseno(HTML, 2, { destino: 'https://hola-mako.com/vsl/otro' }), 'string');
  assert.ok(typeof conEnlaceDeDiseno(HTML, 9, { destino: '#x' }) !== 'string', 'uno que no está');
});

test('la imagen y el video: sólo su dirección cambia', () => {
  const img = conImagenDeDiseno(HTML, 1, 'https://cdn.x.com/n.jpg') as string;
  assert.match(img, /<img src="https:\/\/cdn\.x\.com\/n\.jpg" alt="Caso">/, 'sin el srcset viejo, que mostraría la otra');
  assert.deepEqual(resto(HTML, img).cambiado[1].includes('cdn.x.com'), true);
  const rep = conVideoDeDiseno(HTML, 1, 'https://www.youtube.com/embed/z', true) as string;
  assert.match(rep, /<iframe src="https:\/\/www\.youtube\.com\/embed\/z" allow="autoplay"><\/iframe>/);
  const arch = conVideoDeDiseno(HTML, 2, 'https://cdn.x.com/n.mp4', false) as string;
  assert.match(arch, /<video controls muted src="https:\/\/cdn\.x\.com\/n\.mp4"><\/video>/, 'sus <source> se van: ganarían sobre el src');
  // Un reproductor no se cambia por un archivo (cambia la forma de la sección).
  assert.ok(typeof conVideoDeDiseno(HTML, 1, 'https://cdn.x.com/n.mp4', false) !== 'string');
  assert.ok(typeof conVideoDeDiseno(HTML, 2, 'https://www.youtube.com/embed/z', true) !== 'string');
});

test('los atributos: comillas dobles, simples o ninguna, y la etiqueta que se cierra sola', () => {
  assert.equal(atributoDe('<a href=\'#x\' data-a=b>', 'href'), '#x');
  assert.equal(atributoDe('<a data-a=b>', 'data-a'), 'b');
  assert.equal(atributoDe('<a>', 'href'), null);
  assert.equal(conAtributo('<img src="a">', 'alt', 'Hola'), '<img src="a" alt="Hola">');
  assert.equal(conAtributo('<img src="a" />', 'alt', 'Hola'), '<img src="a" alt="Hola" />');
  assert.equal(conAtributo('<a href=\'#x\' class="b">', 'href', null), '<a class="b">');
});
