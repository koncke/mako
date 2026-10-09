// =============================================================================
// editor-rico-botones-extra — los botones de QUIEN MONTA en la barra del editor rico
// =============================================================================
// Pedido de Martín (09/10/2026, cuarta tanda del Chatbot, punto 16): «los botones de abajo del todo de
// "{}" y emoji, deberían estar en algún lugar del editable de texto arriba, donde están las negritas».
// El email de /chatbot los pone en la barra con `botonesExtra` (app/_ui/EditorRico.tsx), una prop
// OPCIONAL: las lecciones del curso no la pasan y su barra no puede cambiar.
//
// Lo que fija:
//   · sin `botonesExtra`, la barra es EXACTAMENTE la de antes (mismos botones, mismo orden);
//   · con `botonesExtra`, los botones aparecen después de las marcas (Resaltar) y antes del selector
//     de párrafo —temprano: lo que se pierde en «Más» es lo del final—, con su nombre, y un `activo`
//     se dibuja como `aria-pressed`;
//   · entran a la MISMA lista de piezas que la barra y «Más» (y la regla que mide qué entra).
//
// ── Roturas ── al final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EditorRico } from '../app/_ui/EditorRico';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const base = { valor: '<p>Hola</p>', onCambio: () => {}, urlDeAdjunto: () => null };
/** Los `title` de los botones de la barra, en orden (la barra se dibuja en el server aunque el editor no exista todavía). */
const titulos = (html: string) => {
  const barra = html.slice(html.indexOf('class="mk-er-barra"'), html.indexOf('class="mk-er-regla"'));
  return [...barra.matchAll(/<button[^>]*title="([^"]+)"/g)].map((m) => m[1]);
};

test('sin botonesExtra, la barra de las lecciones es la de siempre', () => {
  const t = titulos(renderToStaticMarkup(createElement(EditorRico, base)));
  assert.ok(t.length >= 15, `no encontré la barra (${t.length} botones)`);
  assert.deepEqual(t.slice(0, 8), ['Deshacer (Ctrl+Z)', 'Rehacer (Ctrl+Shift+Z)', 'Negrita (Ctrl+B)', 'Cursiva (Ctrl+I)', 'Subrayado (Ctrl+U)', 'Tachado (Ctrl+Shift+S)', 'Color del texto', 'Resaltar']);
  assert.ok(!t.some((x) => /dato|Emojis|HTML/.test(x)), 'aparecieron botones que nadie pidió');
});

test('con botonesExtra, van después de las marcas y antes del párrafo, con su nombre', () => {
  const html = renderToStaticMarkup(createElement(EditorRico, {
    ...base,
    botonesExtra: [
      { id: 'dato', nombre: 'Insertar un dato', icono: '{ }', accion: () => {} },
      { id: 'html', nombre: 'Editar el HTML', icono: '</>', activo: false, accion: () => {} },
    ],
  }));
  const t = titulos(html);
  const i = t.indexOf('Resaltar');
  assert.deepEqual(t.slice(i + 1, i + 3), ['Insertar un dato', 'Editar el HTML'], `orden de la barra: ${t.join(' | ')}`);
  assert.match(html, /title="Editar el HTML"[^>]*aria-pressed="false"/, 'un botón con `activo` se dibuja como un interruptor');
  assert.doesNotMatch(html, /title="Insertar un dato"[^>]*aria-pressed/, 'uno sin `activo` no es un interruptor');
  // Y antes del selector de párrafo (que es una pieza aparte, no un botón con title).
  const barra = html.slice(html.indexOf('class="mk-er-barra"'));
  assert.ok(barra.indexOf('Editar el HTML') < barra.indexOf('mk-er-bloque'), 'los extra quedaron después del párrafo: se pierden antes en «Más»');
});

test('entran a la MISMA lista de piezas (barra, «Más» y la regla que mide), con id propio', () => {
  const src = sinComentarios(leer('app/_ui/EditorRico.tsx'));
  const piezas = src.slice(src.indexOf('const piezas: Pieza[] = ['), src.indexOf('const firmaPiezas'));
  assert.ok(piezas.length > 500 && piezas.length < 9000, `el recorte mide ${piezas.length}: está mirando otra cosa`);
  assert.match(piezas, /\.\.\.\(botonesExtra\?\.length \? \[/, 'los extra no están en la lista de piezas');
  assert.match(piezas, /id: `x-\$\{b\.id\}`/, 'el id de afuera puede pisar el de una pieza propia');
  assert.ok(piezas.indexOf("id: 'resaltar'") < piezas.indexOf('botonesExtra') && piezas.indexOf('botonesExtra') < piezas.indexOf("sep('s-bloque')"),
    'los extra no van entre Resaltar y el párrafo');
  assert.match(src, /botonesExtra\?: ReadonlyArray<BotonExtraRico>;/, 'la prop tiene que ser OPCIONAL: las lecciones no la pasan');
});

// ── Roturas ──────────────────────────────────────────────────────────────────────────────────
// 09/10/2026, arnés romper-email.mjs del scratchpad (una por vez, restaurada de memoria; base 26 pass /
// 0 fail con email-remitente y editor-email-gmail):
//   R8. los botones extra fuera de la lista de piezas (`...(false ? [`) → 2 fallos (el orden en la barra
//       dibujada; la lista de piezas). El de «la barra de las lecciones es la de siempre» queda verde,
//       que es lo correcto: sin extra, la barra no cambia.
