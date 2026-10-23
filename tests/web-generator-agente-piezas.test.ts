// =============================================================================
// El agente del Web Generator con las piezas del Ops Center (22/10/2026, TB3)
// =============================================================================
// Martín, 22/10: «quiero que todos los chats de MaKo en las tabs sean el del Ops Center». El agente tenía su <textarea>, su
// «+» suelto y sus burbujas. Ahora el hilo es `HiloMako` (criatura «Web Generator») y la caja `CajaChat`, los dos en
// app/web-generator/editor/paneles/ChatAgente.tsx, que el panel carga con next/dynamic (el panel lo importan tests y las
// piezas traen CSS). Lo del agente —la propuesta con «Original | Modificado», las burbujas de pedidos, un error— entra por el
// hueco `enMensaje`; la sección del pedido va como «desde …» y sus archivos como fichas del hilo.
//
// ⚠️ PROBADO ROMPIENDOLO (22/10/2026, base 3/0): la propuesta fuera del hueco → 2/1; la sección sin pasar a `desde` → 2/1;
// ChatAgente importado directo (sin next/dynamic) → 2/1 y tests/editor-landing-agente.test.ts no carga.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const panel = sinComentarios(readFileSync('app/web-generator/editor/paneles/PanelAgente.tsx', 'utf8'));
const chat = sinComentarios(readFileSync('app/web-generator/editor/paneles/ChatAgente.tsx', 'utf8'));

test('el hilo: lo de la persona con su sección y sus archivos; lo del agente en el hueco de la respuesta', () => {
  assert.match(panel, /\.\.\.\(m\.seccion \? \{ desde: m\.seccion \} : \{\}\)/, 'la sección del pedido, como «desde …»');
  assert.match(panel, /\.\.\.\(m\.adjuntos\?\.length \? \{ archivos: m\.adjuntos\.map\(archivoDe\) \} : \{\}\)/);
  const hueco = panel.slice(panel.indexOf('const enMensaje = ('), panel.indexOf('  useEffect(() => {', panel.indexOf('const enMensaje = (')));
  assert.match(hueco, /if \(m\.de === 'pedido'\) return \{ arriba: <BurbujaDePedido burbuja=\{m\.burbuja\} onBoton=\{\(b\) => alBoton\(m\.id, b\)\} \/> \};/);
  assert.match(hueco, /abajo: m\.propuesta && m\.estado \? \(\s*<RevisionPropuesta[\s\S]*onAceptar=\{\(\) => void aceptar\(m\)\}/);
  assert.match(panel, /<HiloAgente items=\{items\} corriendo=\{hilo\.corriendo\} enMensaje=\{enMensaje\} \/>/);
  assert.match(chat, /const QUIEN = \{ nombre: 'Web Generator' \};/);
});

test('las piezas entran con next/dynamic (el panel lo cargan tests) y el panel no arma ninguna caja', () => {
  assert.doesNotMatch(panel, /from '\.\/ChatAgente'/, 'importado directo: el CSS de las piezas tira abajo los tests que cargan el panel');
  assert.match(panel, /dynamic\(\(\) => import\('\.\/ChatAgente'\)/);
  assert.doesNotMatch(panel, /<textarea\b|className="gma-ag-enviar"/);
  assert.match(chat, /import '@\/app\/admin\/operaciones\/centro\.css';/);
});

test('el panel no es un <aside> (la barra de la agencia lo estiraba y la caja quedaba fuera de la vista, 22/10/2026)', () => {
  assert.match(panel, /<section\s+role="complementary"\s+className="gma gma-pb gma-ag"/);
  assert.doesNotMatch(panel, /<aside\b/);
});

test('las piezas toman los colores del editor: sus tokens bajo `.gma-ag`, también el azul del botón', () => {
  assert.match(panel, /\.gma-ag\{--primary:var\(--pb-azul\);[^}]*--on-primary:var\(--pb-azul-txt\)/);
});
