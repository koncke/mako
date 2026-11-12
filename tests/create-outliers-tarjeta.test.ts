// Los outliers de Create en UNA tarjeta, con la forma de su red, y la portada sin el chat (12/11/2026, chat «Create: outliers en
// tarjeta y portada sin chat»). Martín: «Si es en YouTube, que sea más horizontal, si es en Reels, que sea más vertical, si es en
// Carrusel, que sea más cuadrado… que englobes a la casilla… si yo le paso el cursor, que veo el carrusel original… Si yo estoy en
// la tab principal donde digo encuentra tu siguiente outlier, no debería salir el chat de MaKo». Y del Video Editor: «grabé un
// audio y fíjate que se corta porque el chat más angosto y no se ve el botón para enviar el audio».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { columnasPara, repartirEnColumnas } from '../lib/grilla-mixta';
import { ASPECTO_FORMATO, PROPORCION_FORMATO, idDeYouTube, imagenDelOriginal } from '../lib/copywriter/outliers';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('cada red con su forma: YouTube apaisado, reel vertical, carrusel casi cuadrado, anuncio cuadrado', () => {
  assert.ok(PROPORCION_FORMATO.youtube > 1.7 && PROPORCION_FORMATO.youtube < 1.8);
  assert.ok(PROPORCION_FORMATO.reel < 0.6);
  assert.equal(PROPORCION_FORMATO.carrusel, 4 / 5);
  assert.equal(PROPORCION_FORMATO.anuncio, 1);
  assert.equal(ASPECTO_FORMATO.reel, '9 / 16');
  assert.equal(ASPECTO_FORMATO.youtube, '16 / 9');
});

test('el original al pasar el cursor: la imagen guardada, o la miniatura pública de YouTube', () => {
  assert.equal(imagenDelOriginal({ formato: 'reel', url: 'https://www.instagram.com/reel/abc/', miniatura: '/spy/x.jpg' }), '/spy/x.jpg');
  assert.equal(imagenDelOriginal({ formato: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3', miniatura: null }),
    'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(imagenDelOriginal({ formato: 'reel', url: 'https://www.instagram.com/reel/abc/', miniatura: null }), null, 'sin imagen, se queda el texto');
  assert.equal(idDeYouTube('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(idDeYouTube('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(idDeYouTube('https://www.instagram.com/p/xyz/'), null);
});

test('la grilla mixta: cuántas columnas entran y cada tarjeta a la más baja, en orden', () => {
  assert.equal(columnasPara(0, 250, 20, 4), 4, 'sin medir, las de por defecto');
  assert.equal(columnasPara(1100, 250, 20), 4);
  assert.equal(columnasPara(347, 150, 10), 2, 'el teléfono a 375');
  assert.equal(columnasPara(100, 250, 20), 1);
  // Un reel (alto 3) y tres de YouTube (alto 1): los de YouTube se apilan al lado del reel, sin hueco.
  const cols = repartirEnColumnas(['reel', 'yt1', 'yt2', 'yt3', 'yt4'], 2, (x) => (x === 'reel' ? 3 : 1));
  assert.deepEqual(cols, [['reel', 'yt4'], ['yt1', 'yt2', 'yt3']]);
  // Sumar una tanda abajo no mueve las de arriba.
  const antes = repartirEnColumnas([1, 2, 3, 4], 3, (x) => x);
  const despues = repartirEnColumnas([1, 2, 3, 4, 5, 6], 3, (x) => x);
  antes.forEach((c, i) => assert.deepEqual(despues[i].slice(0, c.length), c));
});

test('UNA caja por outlier: la tarjeta de todas las portadas tiene su borde, y el pie va adentro', () => {
  const css = leer('app/image-editor/carruseles/explorar.module.css');
  assert.match(css, /\.tarjeta \{\s*min-width: 0; display: flex; flex-direction: column; gap: 0; overflow: hidden; border-radius: 16px;\s*background: var\(--surface\); border: 1px solid var\(--border\);/);
  assert.match(css, /animation: entra 280ms cubic-bezier\(\.2, \.7, \.2, 1\) backwards;/, 'con `both`, la entrada le ganaba al hover');
  assert.match(css, /\.pie \{ flex: 1; display: flex; flex-direction: column; gap: 7px; min-width: 0; padding: 12px 14px 14px; \}/);
  assert.doesNotMatch(css, /\.mini \{[^}]*border-radius: 16px/, 'la imagen ya no es una caja suelta');
});

test('Copywriting: el marco con la forma de su red, el texto adentro y el original encima al pasar el cursor', () => {
  const t = leer('app/copywriter/OutliersCopy.tsx');
  assert.match(t, /<div className=\{`\$\{s\.mini\} \$\{oc\.marco\}`\} style=\{\{ aspectRatio: ASPECTO_FORMATO\[o\.formato\] \}\}/);
  assert.match(t, /const original = rota \? null : imagenDelOriginal\(o\);/);
  assert.match(t, /<GrillaMixta items=\{enGrilla\}/, 'formatos mezclados, en columnas');
  assert.match(t, /className=\{s\.nuevo\}><span aria-hidden>＋<\/span> Nuevo copy<\/Link>/);
  const css = leer('app/copywriter/outliers.module.css');
  assert.match(css, /\.tarjeta:hover \.original, \.tarjeta\[data-original='si'\] \.original \{ opacity: 1; \}/);
  assert.match(css, /@media \(hover: none\) \{ \.verOriginal \{ display: inline-flex; \}/, 'sin mouse, el botón del original');
});

test('la portada de outliers va SIN el chat; «Mis guiones / diseños / landings» abren la lista', () => {
  const p = leer('app/_crear/PantallaCrear.tsx');
  assert.match(p, /const enPortada = !!p\.portada \|\| \(centro === 'nueva' && p\.nueva != null\);/);
  assert.match(p, /<div className="cr" data-portada="si" data-movil=\{listaEnPortada \? 'mako' : 'pieza'\}>/);
  assert.match(leer('app/web-generator/PortadaWeb.tsx'), /\n\s+portada\r?\n\s+>/);
  assert.match(leer('app/copywriter/OutliersCopy.tsx'), /onClick=\{pantalla\.verProyectos\}>Mis guiones<\/button>/);
  assert.match(leer('app/image-editor/carruseles/ExplorarCarruseles.tsx'), /onClick=\{pantalla\.verProyectos\}>Mis diseños<\/button>/);
  assert.match(leer('app/web-generator/OutliersLandings.tsx'), /onClick=\{pantalla\.verProyectos\}>Mis landings<\/button>/);
});

test('sin los textos que explican el chat', () => {
  assert.doesNotMatch(leer('app/copywriter/PanelMaKo.tsx'), /Elige un outlier y tócale|Pídeme que escriba o edite esta página|Con @ citas otra página/);
  assert.doesNotMatch(leer('app/image-editor/mako/chat/PanelMakoIA.tsx'), /Pídeme lo que quieras del diseño/);
  assert.doesNotMatch(leer('app/web-generator/editor/paneles/PanelAgente.tsx'), /Pídeme que edite, cree o diseñe/);
  assert.doesNotMatch(leer('app/video-editor/_opencut/chat/PanelChat.tsx'), /Pídeme que edite lo que quieras del video/);
});

test('el audio grabado entra en el chat más angosto: el ➤ no queda afuera', () => {
  // El `range` del reproductor pedía 129 px de mínimo (su ancho propio en Chrome) y el pie del chat del Video Editor es una grilla.
  assert.match(leer('app/whatsapp/_shared/AudioPlay.tsx'), /style=\{\{ flex: 1, width: 0, minWidth: 40, margin: 0,/);
  assert.match(leer('app/video-editor/_opencut/chat/PanelChat.tsx'), /<footer className="grid shrink-0 grid-cols-\[minmax\(0,1fr\)\] gap-2 px-3 pt-2 pb-3">/);
  const css = leer('app/admin/operaciones/centro.css');
  assert.match(css, /\.co-caja__fila \{ --caja-toque: 40px; display: flex; align-items: flex-end; gap: 4px; min-width: 0; \}/);
  // Y a todo el ancho: con `margin-inline: auto`, en una grilla la caja se ajustaba a lo que pedía su fila (medido: 286 de 316).
  assert.match(css, /\.co-caja \{ min-width: 0; width: 100%; \}/);
});
