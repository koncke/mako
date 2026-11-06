// =============================================================================
// tests/recorrido-crm-tarjeta — lo del CRM que quedó abierto del recorrido visual del 30/10/2026 (docs/recorrido-visual-30-10.md)
// =============================================================================
//   C1 · la foto que falló ANTES de hidratar quedaba como imagen rota: al montar se pregunta `fotoQueNoCargo` y cae a las
//        iniciales (el `onError` ya no toca el DOM: es estado, y sobrevive a un re-render).
//   C2 · el nombre (en un lead sin nombre, el teléfono) se cortaba en un renglón con la píldora «Ver info» al lado: baja a
//        DOS renglones antes de cortarse, y lo entero va en el `title`.
//   C4 · las flechas de «Columnas» del «⋯» de una columna eran dos íconos sueltos: ahora dicen «Mover la etapa» a la izquierda
//        (`conRotulo`). La línea de reacciones de un mensaje sigue sin rótulo.
// La foto que falla antes de hidratar se vio con React de verdad en un banco (docs/recorrido-visual/c1-*.png): en node no
// hay DOM (jsdom no es dependencia del repo), así que acá va la regla pura y lo que dibuja el server.
//
// Probado rompiéndolo (6/11/2026), base 6 pasan / 0 fallan:
//   · fotoQueNoCargo sin mirar `complete` ...................... 1 falla (C1, regla)
//   · el nombre otra vez en un renglón (`white-space: nowrap`) .. 1 falla (C2)
//   · el nombre sin `title` ..................................... 1 falla (C2)
//   · el CRM sin `conRotulo` .................................... 1 falla (C4)
//   · MenuContextual sin dibujar el rótulo ...................... 1 falla (C4)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fotoQueNoCargo } from '../lib/tarjeta-kanban';
import { CaraTarjeta, TarjetaPersona } from '../app/_ui/TarjetaKanban';
import { ListaMenuContextual } from '../app/_ui/MenuContextual';
import { itemsCrm, opcionesCrm, type DatosMenuCrm } from '../app/crm/menu-contextual-crm';

const DATOS: DatosMenuCrm = {
  etapas: [{ key: 'lead', label: 'Lead entrante', color: '#111' }, { key: 'agenda', label: 'Reunión 1', color: '#222' }],
  etapaActual: 'agenda',
  equipo: [{ nombre: 'Ana', foto: null }],
  etiquetas: [],
  funnels: [],
};

test('C1: una foto terminada y sin ancho es una foto que no cargó; una que carga, todavía no', () => {
  assert.equal(fotoQueNoCargo({ complete: true, naturalWidth: 0 }), true, 'falló antes de hidratar: hay que caer a las iniciales');
  assert.equal(fotoQueNoCargo({ complete: false, naturalWidth: 0 }), false, 'todavía está cargando: para ésa vale el onError');
  assert.equal(fotoQueNoCargo({ complete: true, naturalWidth: 46 }), false, 'cargó bien');
  assert.equal(fotoQueNoCargo(null), false);
});

test('C1: con foto, el server dibuja la foto y deja las iniciales listas debajo (escondidas); sin foto, sólo las iniciales', () => {
  const con = renderToStaticMarkup(createElement(CaraTarjeta, { nombre: 'Ana Gómez', foto: '/api/x?avatarimg=1' }));
  assert.match(con, /<img src="\/api\/x\?avatarimg=1"/);
  assert.match(con, /<span class="tk-ini [^"]*"[^>]*style="[^"]*display:none[^"]*">AG<\/span>/);
  const sin = renderToStaticMarkup(createElement(CaraTarjeta, { nombre: 'Ana Gómez', foto: null }));
  assert.doesNotMatch(sin, /<img/);
  assert.doesNotMatch(sin, /display:none/);
});

test('C2: el nombre baja a dos renglones antes de cortarse, y lo entero queda en el title', () => {
  const html = renderToStaticMarkup(createElement(TarjetaPersona, { nombre: '+52 1 664 123 4567', subtitulo: 'Instagram · hace 2 días' }));
  assert.match(html, /<div class="tk-nom"><span title="\+52 1 664 123 4567">\+52 1 664 123 4567<\/span>/, 'el nombre no lleva su title');
  assert.match(html, /<span class="tk-sub" title="Instagram · hace 2 días">/, 'el subtítulo no lleva su title');
  const regla = /\.tk-nom > span \{([^}]*)\}/.exec(html)?.[1] ?? '';
  assert.ok(regla, 'no encontré la regla del nombre en la hoja de la tarjeta');
  assert.match(regla, /-webkit-line-clamp:\s*2/, 'el nombre no baja a un segundo renglón');
  assert.doesNotMatch(regla, /white-space:\s*nowrap/, 'el nombre sigue en un solo renglón');
});

test('C4: las flechas de la columna dicen «Mover la etapa» a la izquierda', () => {
  const ids = opcionesCrm({ sobre: 'columna', mover: true, entrada: false, curso: null, borrable: true });
  const items = itemsCrm(ids, DATOS);
  const flechas = items.find((it) => it && it.enLinea);
  assert.ok(flechas, 'no están las flechas');
  assert.equal(flechas.conRotulo, true, 'el CRM no pide el rótulo');
  const html = renderToStaticMarkup(createElement(ListaMenuContextual, { items, onElegir: () => {} }));
  assert.match(html, /<div role="group" aria-label="Mover la etapa"[^>]*><span aria-hidden="true"[^>]*>Mover la etapa<\/span>/, 'el rótulo no se dibuja');
});

test('C4: una línea sin `conRotulo` (las reacciones de un mensaje) sigue siendo sólo de botones', () => {
  const html = renderToStaticMarkup(createElement(ListaMenuContextual, {
    items: [{ id: 'r', label: 'Reaccionar', enLinea: [{ id: 'a', label: 'Reaccionar con 👍', icono: 'check' }] }],
    onElegir: () => {},
  }));
  assert.doesNotMatch(html, />Reaccionar<\/span>/);
});

test('C4: con rótulo, cada flecha se sigue anunciando por su nombre', () => {
  const items = itemsCrm(opcionesCrm({ sobre: 'columna', mover: true, entrada: false, curso: null, borrable: true }), DATOS);
  const html = renderToStaticMarkup(createElement(ListaMenuContextual, { items, onElegir: () => {} }));
  const botones = [...html.matchAll(/<button[^>]*role="menuitem"[^>]*aria-label="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(botones.some((b) => /izquierda/i.test(b)) && botones.some((b) => /derecha/i.test(b)), botones.join(' · '));
});
