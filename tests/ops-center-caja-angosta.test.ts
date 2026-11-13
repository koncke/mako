// =============================================================================
// «Conectar tu IA» no le come el ancho al campo en la caja angosta (22/10/2026)
// =============================================================================
// Offer, en producción (tren 9, ws3): en el panel de la estrella, de 440 px, «Escribe a Cerebro» salía cortado porque «Conectar
// tu IA» y el micrófono ocupaban casi toda la fila. El Cerebro: «en la caja angosta, "Conectar tu IA" va como un chip arriba del
// campo… y nunca le come el ancho al campo. Que entre el placeholder entero a 440 px y en el teléfono».
//   1. en la caja angosta (el panel de la estrella y el teléfono) el chip va ARRIBA del campo, nunca en la fila;
//   2. en la ancha (el Ops Center) sigue al final de la fila, como lo pidió Martín el 21/10;
//   3. lo dibujado: el chip arriba, y en la fila sólo el «+», los emojis, el campo y el botón.
//
// Correr: node --import tsx --test tests/ops-center-caja-angosta.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as modulo from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// CajaChat importa su CSS: Node no lo carga. Como en tests/offer-hilo-unico.test.ts, los `.css` salen vacíos (y la caja se
// importa DESPUÉS, con un import dinámico: los estáticos corren antes del hook).
type Loader = (url: string, ctx: unknown, next: (url: string, ctx: unknown) => unknown) => unknown;
const { registerHooks } = modulo as unknown as { registerHooks: (h: { load: Loader }) => void };
registerHooks({ load: (url, ctx, next) => (/\.css($|\?)/.test(url) ? { format: 'commonjs', source: '', shortCircuit: true } : next(url, ctx)) });

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. en la caja angosta (la estrella y el teléfono) el chip va arriba del campo, nunca en la fila', () => {
  const piezas = sinComentarios(leer('app/second-brain/PiezasCliente.tsx'));
  assert.match(piezas, /export function CajaDelCliente\(\{ k, campo, seguir, movil = false, angosta = movil, avisosArriba = false \}/, 'el teléfono es angosto');
  // 24/10/2026: sin la app (`bloqueada`), ni al final ni arriba: no destraba nada (tests/app-de-escritorio-primero.test.ts, 3).
  assert.match(piezas, /alFinal=\{angosta \|\| bloqueada \? null : conectar\}/, 'en la angosta, nada al final de la fila');
  assert.match(piezas, /arriba=\{<>\n\s*\{angosta && conectar && !bloqueada && <div className="co-conectar-ia-arriba">\{conectar\}<\/div>\}/, 'arriba del campo');
  assert.match(sinComentarios(leer('app/_chat/MakoEnLaTab.tsx')), /<CajaDelCliente k=\{k\} campo=\{caja\} seguir=\{seguirHilo\} angosta \/>/, 'el panel de la estrella, de 440 px');
  // El teléfono (13/11/2026): el chip ni siquiera va arriba del campo, sino en la línea debajo de la cabecera (app/m/_chat/AvisoDeIA.tsx,
  // tests/m-chat-pantalla.test.ts, 9).
  assert.match(sinComentarios(leer('app/m/second-brain/ChatClienteM.tsx')), /<CajaDelCliente k=\{k\} campo=\{caja\} seguir=\{seguirHoja\} movil avisosArriba \/>/, 'el teléfono');
  assert.match(leer('app/_chat/chat.css'), /\.co-conectar-ia-arriba \{ display: flex;/);
});

test('2. en la caja ancha (el Ops Center) sigue al final de la fila', () => {
  assert.match(sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx')), /<CajaDelCliente k=\{k\} campo=\{caja\} seguir=\{seguirHilo\} \/>/, 'sin `angosta`');
});

test('3. lo dibujado: el chip arriba, y en la fila sólo el «+», los emojis, el campo y el botón', async () => {
  const { CajaChat } = await import('../app/_chat/CajaChat');
  const chip = createElement('div', { className: 'co-conectar-ia-arriba' }, createElement('button', { type: 'button', className: 'co-chip co-conectar-ia' }, 'Conectar tu IA'));
  const html = renderToStaticMarkup(createElement(CajaChat, { texto: '', onTexto: () => {}, onMandar: () => {}, placeholder: 'Escribe a Cerebro', arriba: chip }));
  const fila = html.indexOf('class="co-caja__fila"');
  assert.ok(fila > 0 && html.indexOf('Conectar tu IA') > -1 && html.indexOf('Conectar tu IA') < fila, 'el chip, antes de la fila');
  assert.doesNotMatch(html.slice(fila), /Conectar tu IA/, 'la fila no lo lleva');
  assert.match(html.slice(fila), /placeholder="Escribe a Cerebro"/);
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 3/0):
//   · el chip vuelve al final en la angosta            → 2/1 (1)
//   · la estrella sin `angosta`                        → 2/1 (1)
//   · el teléfono no es angosto                        → 2/1 (1)
//   · la angosta sin el chip arriba                    → 2/1 (1)
//   · el Ops Center se vuelve angosto                  → 2/1 (2)
