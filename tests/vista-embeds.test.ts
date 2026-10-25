// =============================================================================
// El editor no muestra cajas vacías ni franjas grises en las páginas de MaKo (25/10/2026)
// =============================================================================
// Martín (25/10, sobre la #36): «en muchas secciones hay como una separación» y «toda esta sección en blanco, realmente
// copiaste muy mal a las landing de MaKo... no funciona bien el editor web». Medido en las 23 landings (las 9 publicadas
// y las 14 nuevas), con Chrome sin ventana y la publicada en hola-mako.site:
//   · franjas: el alto salía del `scrollHeight` del documento, que nunca baja de su ventana → 255 px de gris debajo del
//     encabezado en TODAS, 64–230 px al final, 19–90 px en otras. En la publicada no hay franjas;
//   · la caja blanca: la agenda (`[data-calendly]`, 700 px), que la publicada llena con Calendly; y el VSL de Panda, una
//     caja negra: adentro del editor (un iframe sin scripts) no corren.
// Lo que fija:
//   1. la ficha de cada embed (qué es y su enlace), la de la agenda, y el enlace de Calendly que se guarda;
//   2. la vista: el alto por el CONTENIDO, las fichas al cargar, y guardar SIN ellas.
// Correr: node --import tsx --test tests/vista-embeds.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { enlaceDeCalendly, fichaDeAgenda, fichaDeEmbed, srcdocDeFicha } from '../lib/editor-landing/vista-embeds';

const leer = (rel: string) => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('la ficha de cada embed dice qué es y su enlace', () => {
  assert.deepEqual(fichaDeEmbed('https://player-vz-dd4ad08b-375.tv.pandavideo.com/embed/?v=25c0684d'), { tipo: 'video', nombre: 'Video de Panda', enlace: 'player-vz-dd4ad08b-375.tv.pandavideo.com/embed/' });
  assert.deepEqual(fichaDeEmbed('https://calendly.com/koncke/asesoria'), { tipo: 'agenda', nombre: 'Agenda de Calendly', enlace: 'calendly.com/koncke/asesoria' });
  assert.equal(fichaDeEmbed('https://www.youtube.com/embed/abc').nombre, 'Video de YouTube');
  assert.equal(fichaDeEmbed('https://otro.com/x').tipo, 'embed');
  const doc = srcdocDeFicha({ tipo: 'agenda', nombre: 'Agenda de Calendly', enlace: 'calendly.com/a"><script>' });
  assert.match(doc, /<b style="font-size:16px">Agenda de Calendly<\/b>/);
  assert.doesNotMatch(doc, /<script>/, 'el enlace se escapa');
  // La de la agenda va ADENTRO del diseño: marcada para no guardarse, y sin que se pueda escribir en ella.
  assert.match(fichaDeAgenda('https://calendly.com/koncke/asesoria'), /^<div data-gmx-ui="agenda" contenteditable="false"/);
});

test('el enlace de Calendly que se guarda es el de la página de la agenda, sin la query del embed', () => {
  assert.equal(enlaceDeCalendly('https://calendly.com/koncke/asesoria?embed_domain=x&embed_type=Inline'), 'https://calendly.com/koncke/asesoria');
  assert.equal(enlaceDeCalendly('https://otro.com/koncke'), null);
  assert.equal(enlaceDeCalendly('no es un enlace'), null);
});

test('la vista: el alto por el CONTENIDO, las fichas al cargar, y guardar sin ellas', () => {
  const v = leer('app/web-generator/editor/nodos/HtmlEditableVista.tsx');
  // El alto: la raíz (flow-root, los márgenes adentro), nunca el scrollHeight del documento (no baja de su ventana).
  assert.match(v, /const CSS_DENTRO = '[^']*\.gm-libre\{display:flow-root\}';/);
  assert.match(v, /const h = Math\.max\(40, Math\.ceil\(Math\.max\(caja\.bottom, caja\.top \+ r\.scrollHeight\)\)\);/);
  assert.doesNotMatch(v.replace(/^\s*\/\/.*$/gm, ''), /documentElement\.scrollHeight/, 'el scrollHeight del documento deja franjas grises');
  // Las fichas: al cargar y al cambiar un video o la agenda.
  assert.match(v, /if \(editable\) d\.body\.setAttribute\('contenteditable', 'true'\);\n\s*ponerFichas\(d\);/);
  assert.match(v, /f\.setAttribute\('srcdoc', srcdocDeFicha\(fichaDeEmbed\(f\.getAttribute\('src'\) \?\? ''\)\)\);/);
  assert.match(v, /if \(!el\.children\.length\) el\.insertAdjacentHTML\('beforeend', fichaDeAgenda\(el\.getAttribute\('data-calendly'\) \?\? ''\)\);/);
  // Guardar: sin la ficha de la agenda ni el srcdoc de un reproductor.
  assert.match(v, /copia\.querySelectorAll\('\[data-gmx-ui\]'\)\.forEach\(\(el\) => el\.remove\(\)\);/);
  assert.match(v, /copia\.querySelectorAll\('\[data-gmx-vista\]'\)\.forEach\(\(el\) => \{ el\.removeAttribute\('srcdoc'\); el\.removeAttribute\('data-gmx-vista'\); \}\);/);
  // La agenda se cambia con el control de video (pegando el enlace) y se guarda la página de Calendly.
  assert.match(v, /const url = enlaceDeCalendly\(e\.src\);\n\s*if \(!url\) \{ ctx\.avisar\('Pega un enlace de Calendly'\); return; \}\n\s*el\.setAttribute\('data-calendly', url\);/);
  // Y el saneo del server igual borra un srcdoc que se escape.
  assert.match(leer('lib/editor-landing/html-editable-seguro.ts'), /srcdoc/);
});
