// =============================================================================
// Ninguna caja de MaKo se apaga sin la app de escritorio (20/11/2026, la llamada con Leila)
// =============================================================================
// Martín (00:31:18): «hoy en día utilizamos los MaKo Tokens. Entonces, no pongas la restricción de instalar MaKo para enviar
// mensajes». Desde el 25/10 («En ningún chat») toda caja con motor propio montaba `useAppDeEscritorio` y se apagaba con «Instala
// MaKo para escribir» y el botón en el lugar del micrófono. Esto fija lo contrario:
//   1. el gancho que montan las cajas no bloquea nunca: `bloqueada: false` y sin `bloqueo`, sin preguntarle nada al servidor ni
//      traer el botón. Las pantallas que lo llaman siguen llamándolo hasta que se saque el cableado: el parche sin subir de las
//      pestañas («reto-tutoriales», pestanas-sin-subir-20-11) toca esas mismas líneas en 13 de ellas, y se saca después de él;
//   2. ninguna caja de MaKo (toda pantalla con CajaChat o CajaPedido, sus motores y «Editar con IA») dice «Instala MaKo»;
//   3. la caja de pedido sin bloqueo: con su ↑ y su «+».
// Lo del servidor, la caja común, las aperturas y la guía: tests/app-de-escritorio-primero.test.ts.
//
// Correr: node --import tsx --test tests/app-de-escritorio-todos-los-chats.test.ts
// PROBADO ROMPIÉNDOLO: ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CajaPedido } from '../app/web-generator/CajaPedido';
import { useAppDeEscritorio } from '../app/_chat/useAppDeEscritorio';

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

test('1. el gancho de las cajas no bloquea nunca, ni le pregunta nada al servidor', () => {
  assert.deepEqual(useAppDeEscritorio(), { bloqueada: false, bloqueo: undefined });
  const gancho = sinComentarios(leer('app/_chat/useAppDeEscritorio.tsx'));
  assert.doesNotMatch(gancho, /InstalarMaKo|dynamic\(|fetch\(|useAppBloqueada|FRASE_/, 'el gancho vuelve a decidir algo');
});

test('2. ninguna caja de MaKo dice «Instala MaKo»', () => {
  const conCaja = archivos(join(RAIZ, 'app'))
    .filter((p) => /<(CajaChat|CajaPedido)\b/.test(sinComentarios(readFileSync(p, 'utf8'))))
    .map((p) => relative(RAIZ, p).replace(/\\/g, '/'));
  assert.ok(conCaja.length > 15, `se esperaban las cajas de MaKo y llegaron ${conCaja.length}: el barrido se rompió`);
  // Los motores que arman la caja de otra pantalla, y «Editar con IA» (una caja que no es CajaChat ni CajaPedido).
  const motores = ['app/automations/ChatMako.tsx', 'app/offer/OfferApp.tsx', 'app/web-generator/editor/paneles/PanelAgente.tsx', 'app/web-generator/editor/AskAgent.tsx'];
  const dicen = [...conCaja, ...motores].filter((f) => /Instala(r)? MaKo|Descarga MaKo en tu computadora/.test(sinComentarios(leer(f))));
  assert.deepEqual(dicen, []);
});

test('3. la caja de pedido sin bloqueo: con su ↑ y su «+»', () => {
  const props = {
    valor: 'una landing', onValor: () => {}, onEnviar: () => {}, ejemplos: ['x'], animar: true, placeholderQuieto: 'Escribe',
    etiqueta: 'Qué', onError: () => {}, antes: createElement('button', { type: 'button', 'data-mas': '' }, '+'),
    bloqueo: useAppDeEscritorio().bloqueo,
  };
  const libre = renderToStaticMarkup(createElement(CajaPedido, props));
  assert.match(libre, /class="gp-cc-enviar"/, 'sin el ↑ no se puede mandar');
  assert.match(libre, /data-mas=""/);
  assert.doesNotMatch(libre, /<textarea[^>]* disabled=""/, 'el campo apagado');
});

// PROBADO ROMPIÉNDOLO (20/11/2026, base 3/0; contra el código de antes 1/2, sólo pasaba el 2), de a una y restaurando:
//   · el gancho devolviendo `bloqueada: true` con su `bloqueo`             → 1/2 (1, 3)
//   · el asesor de WhatsApp con «Instala MaKo para escribir» en el código  → 2/1 (2)
