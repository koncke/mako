// =============================================================================
// tests/recorrido-instalar-agency — dos pedidos de la llamada con Leila del 5/11/2026
// =============================================================================
//   · «MaKo Desktop: no hay pantalla que explique para qué sirve»: en Settings › Instalar la app, la fila «Para qué sirve»
//     abre un detalle (`?ver=escritorio`) con tres filas de una línea y las descargas al pie. Sin párrafos (Settings copia a
//     Linear, y Martín rechazó dos versiones por «textos previo a la configuración que están muy de sobra», 25/10).
//   · «Agency: acceso más visible desde el menú de perfil»: Partners y Agency suben al lado de Settings. Settings sigue
//     primero (24/10) y Agency sigue «abajo de Partners» (25/10).
//
// Probado rompiéndolo (6/11/2026), base 5 pasan / 0 fallan:
//   · la fila «Para qué sirve» fuera de Instalar ................ 1 falla
//   · el detalle con un párrafo (una fila de 140 caracteres) .... 1 falla
//   · el detalle sin la descarga de Windows ..................... 1 falla
//   · Agency otra vez después de API ............................ 2 fallan
//   · Agency arriba de Partners ................................. 2 fallan
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InstalarApp, ParaQueSirve, PARA_QUE_SIRVE, RUTA_PARA_QUE_SIRVE, DESCARGA_DE } from '../app/perfil/instalar/InstalarApp';
import { USER_NAV } from '../app/_components/nav';
import { marcasDeVoseo } from '../lib/puestas-data';

test('Instalar: «En tu computadora» tiene la fila «Para qué sirve», que abre el detalle', () => {
  const html = renderToStaticMarkup(createElement(InstalarApp, { qr: null, url: 'https://hola-mako.com', extension: { version: '1.0', tienda: 'https://chromewebstore.google.com/x' } }));
  const compu = html.slice(html.indexOf('En tu computadora'), html.indexOf('En tu teléfono'));
  assert.ok(compu.includes('Para qué sirve'), 'la fila no está en «En tu computadora»');
  assert.ok(compu.includes(`href="${RUTA_PARA_QUE_SIRVE.replace(/&/g, '&amp;')}`), 'la fila no lleva al detalle');
});

test('el detalle: tres filas de una línea, en tú, con lo que la app hace hoy', () => {
  assert.equal(PARA_QUE_SIRVE.length, 3);
  for (const f of PARA_QUE_SIRVE) {
    assert.ok(f.titulo.length <= 40 && f.detalle.length <= 80, `«${f.titulo}»: una fila de Settings es una línea, no un párrafo`);
    assert.deepEqual(marcasDeVoseo(`${f.titulo}. ${f.detalle}`), [], `«${f.detalle}» en voseo`);
  }
  const html = renderToStaticMarkup(createElement(ParaQueSirve));
  for (const f of PARA_QUE_SIRVE) assert.ok(html.includes(f.titulo), `falta «${f.titulo}»`);
  assert.doesNotMatch(html, /<p[ >]/, 'el detalle no lleva párrafos');
});

test('el detalle termina con las descargas (lo que sigue a entender para qué sirve)', () => {
  const html = renderToStaticMarkup(createElement(ParaQueSirve));
  assert.ok(html.includes(`href="${DESCARGA_DE.windows.replace(/&/g, '&amp;')}"`) && html.includes(`href="${DESCARGA_DE.mac.replace(/&/g, '&amp;')}"`), 'faltan las descargas');
  assert.ok(html.includes('href="/perfil/instalar"'), 'sin volver a Instalar la app');
});

test('el menú del perfil: Settings primero, y Partners y Agency justo debajo', () => {
  const menu = USER_NAV.filter((i) => !i.soloSeccion).map((i) => i.key);
  assert.equal(menu[0], 'perfil', 'Settings va primero (24/10)');
  assert.deepEqual(menu.slice(1, 3), ['partners', 'agency'], `Agency no está a la vista: ${menu.join(' · ')}`);
});

test('el menú del perfil: Agency sigue debajo de Partners, y los dos antes de API y de «Report a problem»', () => {
  const menu = USER_NAV.filter((i) => !i.soloSeccion).map((i) => i.key);
  assert.ok(menu.indexOf('partners') < menu.indexOf('agency'), 'Agency va «abajo de Partners» (25/10)');
  assert.ok(menu.indexOf('agency') < menu.indexOf('api-mako') && menu.indexOf('agency') < menu.indexOf('tickets'));
});
