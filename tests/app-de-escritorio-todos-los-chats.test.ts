// =============================================================================
// Ninguna caja de MaKo se apaga sin la app de escritorio (20/11/2026, la llamada con Leila)
// =============================================================================
// Martín (00:31:18): «hoy en día utilizamos los MaKo Tokens. Entonces, no pongas la restricción de instalar MaKo para enviar
// mensajes». Desde el 25/10 («En ningún chat») toda caja con motor propio montaba `useAppDeEscritorio` y se apagaba con «Instala
// MaKo para escribir» y el botón en el lugar del micrófono. Primero el gancho quedó inerte (8064be726); después se sacó el
// cableado de las ~20 pantallas y se borró el gancho. Esto fija lo contrario:
//   1. ninguna pantalla usa el gancho ni `appEscritorio` (y el gancho no existe);
//   2. ninguna caja de MaKo (toda pantalla con CajaChat, CajaPedido o CajaAgente, sus motores y «Editar con IA») dice «Instala
//      MaKo» ni «instala su app». CajaAgente entró al barrido el 20/11: Copywriting la usa y su «instala su app» no se veía;
//   3. la caja de pedido, sin `bloqueo`, con su ↑ y su «+» (la prop sigue: es de la caja, no de la app).
// Lo del servidor, la caja común, las aperturas y la guía: tests/app-de-escritorio-primero.test.ts.
//
// Correr: node --import tsx --test tests/app-de-escritorio-todos-los-chats.test.ts
// PROBADO ROMPIÉNDOLO: ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CajaPedido } from '../app/web-generator/CajaPedido';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

function archivos(dir: string, fuera: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== 'node_modules') archivos(p, fuera); } else if (n.endsWith('.tsx')) fuera.push(p);
  }
  return fuera;
}
const conCaja = () => archivos(join(RAIZ, 'app'))
  .filter((p) => /<(CajaChat|CajaPedido|CajaAgente)\b/.test(sinComentarios(readFileSync(p, 'utf8'))))
  .map((p) => relative(RAIZ, p).replace(/\\/g, '/'));
// Los motores que arman la caja de otra pantalla, y «Editar con IA» (una caja que no es CajaChat ni CajaPedido).
const MOTORES = ['app/automations/ChatMako.tsx', 'app/offer/OfferApp.tsx', 'app/web-generator/editor/paneles/PanelAgente.tsx', 'app/web-generator/editor/AskAgent.tsx'];

test('1. ninguna pantalla usa el gancho de la app de escritorio, y el gancho no existe', () => {
  assert.equal(existsSync(join(RAIZ, 'app/_chat/useAppDeEscritorio.tsx')), false);
  const cajas = conCaja();
  assert.ok(cajas.length > 15, `se esperaban las cajas de MaKo y llegaron ${cajas.length}: el barrido se rompió`);
  const usan = [...cajas, ...MOTORES].filter((f) => /useAppDeEscritorio|appEscritorio|sinApp\b/.test(sinComentarios(leer(f))));
  assert.deepEqual(usan, []);
});

test('2. ninguna caja de MaKo dice «Instala MaKo» ni «instala su app»', () => {
  const dicen = [...conCaja(), ...MOTORES].filter((f) => /Instala(r)? MaKo|instala su app|Descarga MaKo en tu computadora/i.test(sinComentarios(leer(f))));
  assert.deepEqual(dicen, []);
});

test('3. la caja de pedido sin bloqueo: con su ↑ y su «+»', () => {
  const props = {
    valor: 'una landing', onValor: () => {}, onEnviar: () => {}, ejemplos: ['x'], animar: true, placeholderQuieto: 'Escribe',
    etiqueta: 'Qué', onError: () => {}, antes: createElement('button', { type: 'button', 'data-mas': '' }, '+'),
  };
  const libre = renderToStaticMarkup(createElement(CajaPedido, props));
  assert.match(libre, /class="gp-cc-enviar"/, 'sin el ↑ no se puede mandar');
  assert.match(libre, /data-mas=""/);
  assert.doesNotMatch(libre, /<textarea[^>]* disabled=""/, 'el campo apagado');
});

// PROBADO ROMPIÉNDOLO (20/11/2026, base 3/0), de a una y restaurando:
//   · el asesor de WhatsApp otra vez con `appEscritorio`                   → 2/1 (1)
//   · Copywriting otra vez con «Para que MaKo lo escriba, instala su app»   → 2/1 (2) (la primera vez quedó VERDE: su caja es
//     CajaAgente, que el barrido no miraba; ahora la mira)
// (Lo del gancho inerte, antes de borrarlo, en 8064be726: «bloqueada: true» → 1/2 y «Instala MaKo» en una caja → 2/1.)
