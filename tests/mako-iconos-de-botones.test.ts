// =============================================================================
// Cuando MaKo nombra un botón o una tab, se ve su ícono de verdad (ticket 874749710-12 de Leandro, 27/10/2026)
// =============================================================================
// Leandro: «Maco debería poder enviar íconos». Automations dibujaba sólo la tuerca en su globo (8ed7f23aa); los demás chats,
// nada. Lo que fija:
//   1. el catálogo (app/_chat/iconos-de-botones.ts) sale de la BARRA: cada tab con el ícono que dibuja la barra, y los botones
//      que no son tab (la tuerca de Configuraciones) con el de su pantalla; todos existen en app/_components/icons.tsx;
//   2. sólo lo que va entre «» es un botón nombrado; un nombre que no es ni tab ni botón queda como texto;
//   3. el renderizador compartido (Markdown con `iconos`) lo dibuja, y los mensajes de MaKo de TODOS los chats que usan el hilo
//      compartido (HiloMako) y el de Offer en el teléfono lo piden.
//
// Probado rompiéndolo (27/10/2026): al pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { iconoDe, trozosConIconos } from '../app/_chat/iconos-de-botones';
import { NOMBRES_ICONO } from '../app/_components/icons';
import { MAKO_NAV, USER_NAV } from '../app/_components/nav';
import { Markdown } from '../app/_components/Markdown';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

test('1. cada tab de la barra lleva el MISMO ícono que dibuja la barra, y los botones que no son tab el de su pantalla', () => {
  // Lo que ve el negocio arriba de la barra va primero en el catálogo: su nombre lleva SU ícono (su «Ops Center», el cerebro).
  for (const it of MAKO_NAV) if (it.label && it.icon) assert.equal(iconoDe(it.label), it.icon, `«${it.label}»`);
  // Y toda tab del menú del negocio tiene ícono en el catálogo.
  for (const it of USER_NAV) if (it.label && it.icon) assert.ok(iconoDe(it.label), `«${it.label}» sin ícono`);
  assert.equal(iconoDe('Settings'), 'tuerca');
  assert.equal(iconoDe('CRM'), 'crm');
  assert.equal(iconoDe('Configuraciones'), 'config', 'la tuerca del título de una automatización');
  assert.equal(iconoDe('settings'), 'tuerca', 'sin importar mayúsculas');
  for (const nombre of ['Settings', 'CRM', 'Configuraciones', 'Automations', 'Ops Center', 'Classroom']) {
    const i = iconoDe(nombre);
    assert.ok(i && NOMBRES_ICONO.includes(i), `«${nombre}» con un ícono que no existe: ${i}`);
  }
});

test('2. sólo lo que va entre «» es un botón nombrado; lo que no es tab ni botón queda como texto', () => {
  assert.deepEqual(trozosConIconos('Tocá «Settings» y después «Notificaciones».'), [
    { t: 'texto', s: 'Tocá ' }, { t: 'boton', nombre: 'Settings', icono: 'tuerca' }, { t: 'texto', s: ' y después «Notificaciones».' },
  ]);
  assert.deepEqual(trozosConIconos('Entra a Settings sin comillas.'), [{ t: 'texto', s: 'Entra a Settings sin comillas.' }]);
  assert.deepEqual(trozosConIconos('Dijo «hola» nomás.'), [{ t: 'texto', s: 'Dijo «hola» nomás.' }]);
});

test('3. el renderizador lo dibuja con el ícono sólo si se le pide, y los chats de MaKo lo piden', () => {
  const con = renderToStaticMarkup(createElement(Markdown, { text: 'Tocá «Settings» arriba a la derecha.', iconos: true }));
  assert.match(con, /data-boton-nombrado=""[^>]*><svg/, 'el botón nombrado no lleva su ícono');
  assert.match(con, /Settings<\/span>/);
  const sin = renderToStaticMarkup(createElement(Markdown, { text: 'Tocá «Settings» arriba a la derecha.' }));
  assert.doesNotMatch(sin, /data-boton-nombrado/, 'sin `iconos`, el texto sigue igual (otros usos de Markdown)');
  // También adentro de una negrita, una lista o con links.
  assert.match(renderToStaticMarkup(createElement(Markdown, { text: '- Abre **«CRM»** y busca el lead', iconos: true, enlaces: true })), /data-boton-nombrado/);
  assert.match(fuente('app/_chat/HiloMako.tsx'), /<Markdown text=\{x\.texto\} iconos(?: enlaces=\{!!x\.grupo\})? \/>/, 'los mensajes de MaKo del hilo compartido no piden los íconos');
  assert.match(fuente('app/m/offer/HiloOfferM.tsx'), /<Markdown text=\{m\.texto\} compacto iconos \/>/);
});

// ── Probado rompiéndolo (27/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado de memoria:
//   1. la tuerca de Configuraciones fuera del catálogo                → rojo el 1.
//   2. cualquier palabra con mayúscula (sin «») como botón            → rojo el 2.
//   3. Markdown ignorando `iconos`                                     → rojo el 3.
//   4. el hilo compartido (HiloMako) sin pedirlos                       → rojo el 3.
//   5. la ÚLTIMA tab con ese nombre gana                                → rojo el 1.
// La primera corrida dio rojo SIN romper nada: hay dos «Ops Center» (el del negocio, con el cerebro, y el del super admin, con
// otro ícono) y ganaba el del super admin. MaKo le habla al negocio: lo suyo va primero en el catálogo.
