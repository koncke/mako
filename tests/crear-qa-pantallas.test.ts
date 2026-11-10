// =============================================================================
// El QA de las pantallas de Create (29/10/2026, tarde): lo que se rompía a la vista y los tests no veían
// =============================================================================
// Martín, mirándolo en producción: «Revisa todas las tabs de create y la de offer, se rompen muchísimo el diseño». Medido en
// el banco (las pantallas reales a 1920, 1440, 1366 y 390; C:/dev/revisiones/create-qa-2910/):
//   1. Offer: la oferta en una columna de 342 px con el resto vacío. NO era el ancho: `DocumentoVivo` usaba `.of-doc`, que ya
//      era la tarjeta del PDF en app/offer/estilos.ts (`max-width: 340px`, `display: flex`). Dos CSS con la misma clase.
//   2. Los editores: el chat a la izquierda les comía el ancho. Se pliega a una barra fina (`plegable`) y se abre con un clic.
//   3. La barra del Video Editor cortaba «Transicio…» y «Multimed…» a CUALQUIER ancho: cada pestaña medía 58 px fijos.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as modulo from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CSS_OFFER } from '@/app/offer/estilos';

// La cabecera del chat importa su CSS: Node no lo carga. Como en tests/ops-center-caja-angosta.test.ts, los `.css` salen
// vacíos y la pieza se importa DESPUÉS, con un import dinámico (los estáticos corren antes del hook).
type Loader = (url: string, ctx: unknown, next: (url: string, ctx: unknown) => unknown) => unknown;
const { registerHooks } = modulo as unknown as { registerHooks: (h: { load: Loader }) => void };
registerHooks({ load: (url, ctx, next) => (/\.css($|\?)/.test(url) ? { format: 'commonjs', source: '', shortCircuit: true } : next(url, ctx)) });

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** Las clases que un CSS DEFINE (las que aparecen en un selector, antes de su `{`). */
const clasesDefinidas = (css: string) => new Set([...sinComentarios(css).matchAll(/([^{}]+)\{/g)]
  .flatMap((m) => [...m[1].matchAll(/\.([a-zA-Z][\w-]*)/g)].map((c) => c[1])));

test('Offer: ninguna clase del documento vivo está definida también en la hoja de Offer', () => {
  const vivo = leer('app/offer/DocumentoVivo.tsx');
  const css = /const CSS = `([\s\S]*?)`;/.exec(vivo)?.[1] ?? '';
  const propias = clasesDefinidas(css);
  assert.ok(propias.has('of-vivo') && propias.has('of-vivo__hoja'), 'no se encontró el CSS del documento vivo');
  const deOffer = clasesDefinidas(CSS_OFFER);
  assert.ok(deOffer.has('of-doc'), 'la tarjeta del PDF cambió de nombre: revisar esta prueba');
  const chocan = [...propias].filter((c) => deOffer.has(c));
  assert.deepEqual(chocan, [], 'la misma clase en dos hojas: la de estilos.ts le pisa el ancho al documento');
  // Y el documento usa la suya: con `.of-doc` volvía la columna de 340 px.
  assert.doesNotMatch(sinComentarios(vivo), /className="of-doc[\s"_]/);
});

test('la cabecera de un chat: el botón de plegar SÓLO dentro de una pantalla de Create que lo provee', async () => {
  const { CabeceraDeChat, PlegarChatCtx } = await import('@/app/admin/operaciones/PanelChat');
  const props = { clave: 'c', titulo: 'MaKo', animo: 'despierto' as const };
  const suelta = renderToStaticMarkup(createElement(CabeceraDeChat, props));
  assert.doesNotMatch(suelta, /Plegar el chat/, 'fuera de Create la cabecera no cambia');
  const enCreate = renderToStaticMarkup(createElement(PlegarChatCtx.Provider, { value: () => {} }, createElement(CabeceraDeChat, props)));
  assert.match(enCreate, /<button type="button" class="cr-plegar"[^>]*aria-label="Plegar el chat de MaKo"/);
});

test('PantallaCrear: se pliega sólo un editor con la pieza a la vista, y la barra fina la abre', () => {
  const src = sinComentarios(leer('app/_crear/PantallaCrear.tsx'));
  assert.match(src, /const sePliega = !!p\.plegable && hayPieza && centro === 'pieza';/);
  assert.match(src, /const plegada = usePlegada\(tab\) && sePliega;/);
  // El chat queda MONTADO (hidden), con el hilo y lo escrito: no se desmonta al plegar.
  assert.match(src, /<section role="complementary" className="cr-tarjeta" hidden=\{plegada\}/);
  assert.match(src, /<PlegarChatCtx\.Provider value=\{sePliega \? plegar : null\}>/);
  assert.match(src, /<button type="button" className="cr-riel" onClick=\{\(\) => guardarPlegada\(tab, false\)\}[^>]*aria-label="Abrir el chat con MaKo">/);
  // Se recuerda por tab, y el server la dibuja abierta (sin `setState` en un efecto).
  assert.match(src, /const clavePlegada = \(tab: string\) => `mk-crear-plegada:\$\{tab\}`;/);
  assert.match(src, /useSyncExternalStore\([\s\S]*?\(\) => leerPlegada\(tab\),\s*\(\) => false,\s*\)/);
  // Los dos editores la piden; Offer y el Copywriter no (su tarjeta ES la conversación de la pieza).
  assert.match(sinComentarios(leer('app/video-editor/VideoEditorCliente.tsx')), /<PantallaCrear[\s\S]*?\n\s*plegable\n\s*>/);
  // Image, sólo con un diseño abierto (9/11/2026): mientras se replica un ejemplo, la tarjeta es donde MaKo pregunta y no se pliega.
  assert.match(sinComentarios(leer('app/image-editor/ImageEditorCliente.tsx')), /<PantallaCrear[\s\S]*?\n\s*plegable=\{!!abierto\}\n\s*>/);
  assert.doesNotMatch(leer('app/offer/OfferApp.tsx'), /\bplegable\b/);
});

test('crear.css: plegada se esconde de verdad, y en el teléfono no se pliega', () => {
  const css = sinComentarios(leer('app/_crear/crear.css'));
  // `.cr-tarjeta { display: flex }` le gana al `[hidden]` del navegador: sin esta regla, «plegada» no escondía nada.
  assert.match(css, /\.cr-tarjeta\[hidden\] \{ display: none; \}/);
  const telefono = css.slice(css.indexOf('@media (max-width: 760px)'));
  assert.match(telefono, /\.cr-tarjeta\[hidden\] \{ display: flex; \}/);
  assert.match(telefono, /\.cr-riel, \.cr-plegar \{ display: none; \}/);
});

test('la caja de la tarjeta: «Escribe a MaKo», que entra en un renglón de 340 px', () => {
  // «Escríbele a MaKo» (Offer) y «Envía un mensaje al agente…» (Video) se partían en dos renglones en la tarjeta.
  assert.match(leer('app/offer/OfferApp.tsx'), /placeholder: arranque\?\.placeholder \?\? 'Escribe a MaKo',/);
  assert.match(leer('app/video-editor/_opencut/chat/PanelChat.tsx'), /placeholder="Escribe a MaKo"/);
});

test('la barra del Video Editor: el rótulo entero, sin «…»', () => {
  const barra = leer('app/video-editor/_opencut/components/editor/panels/assets/tabbar.tsx');
  assert.doesNotMatch(barra, /(?<!min-)w-\[58px\]/, 'un ancho fijo corta «Transiciones» a cualquier tamaño de pantalla');
  assert.doesNotMatch(barra, /\btruncate\b/);
  assert.match(barra, /min-w-\[58px\]/);
  assert.match(barra, /<span className="whitespace-nowrap text-\[11px\] leading-none">/);
});

test('la barra de abajo del Image Editor: cede por SU ancho, y ningún botón se encoge hasta pisarse', () => {
  // Con la tarjeta de MaKo abierta, a 1366 la barra mide ~520 px: «Páginas 1 / 1» se pisaba con la cuadrícula. La media
  // query del teléfono mira la VENTANA, que no sabe cuánto le dejan la sidebar, la tarjeta y el panel de Diseño.
  const css = sinComentarios(leer('app/image-editor/_doory/editor/workspace/BottomBar.module.css'));
  assert.match(css, /\.bar \{[^}]*container-type: inline-size;/);
  assert.match(css, /@container \(max-width: 600px\) \{\s*\.start \.text \{\s*display: none;/);
  assert.match(css, /\.textBtn,\n\.iconBtn \{[^}]*flex: none;/);
});

test('la barra del Video Editor: el borde con más pestañas se funde (la de la orilla no se lee como palabra cortada)', async () => {
  const { fundidoDeLaFila } = await import('@/app/video-editor/_opencut/components/editor/panels/assets/tabbar');
  assert.equal(fundidoDeLaFila(false, false), undefined, 'sin nada escondido, sin fundido');
  assert.equal(fundidoDeLaFila(false, true), 'linear-gradient(to right, #000 0, #000 calc(100% - 28px), transparent 100%)');
  assert.equal(fundidoDeLaFila(true, true), 'linear-gradient(to right, transparent 0, #000 28px, #000 calc(100% - 28px), transparent 100%)');
  assert.match(leer('app/video-editor/_opencut/components/editor/panels/assets/tabbar.tsx'), /maskImage: fundidoDeLaFila\(hayIzquierda, hayDerecha\),/);
});

test('la conversación de la tarjeta: márgenes de la tarjeta, no de la ventana', () => {
  // `clamp(16px, 4vw, 56px)` (centro.css) es de la VENTANA: a 1440 eran 56 px por lado y en 340 px quedaban 218 para el hilo.
  const css = sinComentarios(leer('app/_crear/crear.css'));
  assert.match(css, /\.cr-tarjeta \.co-hilo \{ padding-inline: 14px; \}/);
  assert.match(css, /\.cr-tarjeta \.co-caja-wrap \{ padding-inline: 12px; \}/);
});
