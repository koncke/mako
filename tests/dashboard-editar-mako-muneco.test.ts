// =============================================================================
// «Editar con MaKo» (Dashboard y General) tiene la cara del Ops Center: el muñeco de la tab, el hilo y la caja únicos
// =============================================================================
// 17/10/2026: el muñeco de la tab donde iba el logo, y el micrófono del Second Brain (como el chat del CRM, 8db1e3cbc).
// 22/10/2026 (TB3; Martín: «quiero que todos los chats de MaKo en las tabs sean el del Ops Center»): el hilo es `HiloMako`
// con el muñeco de la tab como quien contesta, y la caja es `CajaChat` (que trae el micrófono que dicta, el «+» y los
// emojis). Lo propio de este chat —lo que cambió con su Deshacer, los pedidos de otra hoja— va en el hueco `enMensaje`
// (app/dashboard/items-edicion.ts). Y el panel va a la IZQUIERDA (el marco `.an`, app/dashboard/PanelAnalista.tsx).
//
// Correr: node --import tsx --test tests/dashboard-editar-mako-muneco.test.ts
//
// ⚠️ PROBADO ROMPIENDOLO (22/10/2026, base 4/0): el hilo sin `quien={{ nombre: tab }}` → 3/1; volver al <textarea> propio
// → 3/1; el marco `.an` otra vez a la derecha → 3/1; `itemsDeEdicion` con ids que no son la posición → 3/1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indiceDe, itemsDeEdicion } from '../app/dashboard/items-edicion';
import type { MensajeEdicion } from '../app/dashboard/PanelEditarMako';

const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
const panel = sinComentarios(readFileSync('app/dashboard/PanelEditarMako.tsx', 'utf8'));

test('el muñeco de la tab en la cabecera, la portada y en el hilo (lo que contesta y mientras piensa)', () => {
  assert.match(panel, /const tab = informe === 'general' \? 'General' : 'Dashboard';/);
  assert.match(panel, /<Muneco titulo=\{tab\} animo=\{animo\} size=\{26\} \/>/, 'la cabecera');
  assert.match(panel, /<Muneco titulo=\{tab\} animo=\{animo\} size=\{64\} \/>/, 'la portada vacía');
  assert.match(panel, /<HiloMako items=\{items\} quien=\{\{ nombre: tab \}\} ahora=\{ahora\} escribiendo=\{pensando \? \{ segs: segundos \} : null\}/,
    'el hilo del Ops Center, con el muñeco de la tab y su «Trabajando…»');
  assert.match(panel, /enMensaje=\{enMensaje\}/, 'lo que cambió y los pedidos, en el hueco del hilo');
  assert.doesNotMatch(panel, /<LogoMako\b/, 'volvió el logo');
});

test('la caja es la única, con la hoja del Centro cargada', () => {
  assert.match(panel, /import \{ CajaChat \} from '@\/app\/_chat\/CajaChat';/);
  assert.match(panel, /<CajaChat campo=\{campo\} texto=\{texto\}[\s\S]{0,300}?placeholder="Pídele un cambio a MaKo"[\s\S]{0,120}?enterManda/);
  assert.doesNotMatch(panel, /<textarea\b|<Microfono\b|className="em-mandar"/, 'volvió la caja propia');
  assert.match(panel, /import '@\/app\/admin\/operaciones\/centro\.css';/, 'sin la hoja del Centro, el hilo y la caja no tienen forma');
});

test('el marco del panel va a la izquierda (todo MaKo en una tab), y el editor le deja el lugar a la estrella', () => {
  const marco = readFileSync('app/dashboard/PanelAnalista.tsx', 'utf8');
  assert.match(marco, /\.an \{ flex: none; position: absolute; top: 12px; left: 12px; bottom: 12px;/);
  assert.match(readFileSync('app/dashboard/edicion-css.ts', 'utf8'), /\.lk-cuerpo > \.an \{ position: absolute; top: 12px; left: 12px; bottom: 12px;/);
  assert.match(readFileSync('app/dashboard/editor-css.ts', 'utf8'), /margin-left: var\(--ancho-panel-mako, 0px\); \}/);
});

test('los dos paneles NO son un <aside>: la barra de la agencia les forzaba el alto de la ventana (22/10/2026)', () => {
  // Medido en producción, con el super admin mirando el ws3: `[data-barra-agencia] aside` (app/globals.css) le pone a todo
  // <aside> `top` y `height: calc(100vh - barra)` con !important, y el panel medía 761 px en un lienzo de 612: la caja de
  // «Editar con MaKo» quedaba fuera de la vista. Sin el atributo, 588. Verificado poniendo <aside> otra vez: 4/1.
  for (const f of ['app/dashboard/PanelEditarMako.tsx', 'app/dashboard/PanelAnalista.tsx']) {
    const src = sinComentarios(readFileSync(f, 'utf8'));
    assert.doesNotMatch(src, /<aside className="an/, `${f}: volvió el <aside>`);
    assert.match(src, /<section role="complementary" className="an/);
  }
});

test('los mensajes del panel como filas del hilo: el id es la posición, y vuelve', () => {
  const hilo: MensajeEdicion[] = [
    { k: 'yo', texto: 'Agrega los leads por semana' },
    { k: 'el', texto: 'Listo.', cambios: ['Agregué «Leads por semana»'], avisos: [] },
    { k: 'error', texto: 'No pude.' },
  ];
  const items = itemsDeEdicion(hilo);
  assert.deepEqual(items.map((x) => (x.k === 'msg' ? [x.role, x.texto] : x.k)), [['user', 'Agrega los leads por semana'], ['assistant', 'Listo.'], ['assistant', '']]);
  assert.deepEqual(items.map((x) => indiceDe(x.id)), [0, 1, 2]);
  assert.equal(indiceDe('c3'), null, 'un id de otro hilo');
});
