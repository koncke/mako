// =============================================================================
// Los chats del Image Editor y del Video Editor con las piezas del Ops Center (22/10/2026, TB3)
// =============================================================================
// Martín, 22/10: «quiero que todos los chats de MaKo en las tabs sean el del Ops Center». Los dos editores tenían su
// <textarea> y sus burbujas. Ahora el hilo es `HiloMako` con la criatura de la tab (la misma que los nombra en el Ops Center,
// OC8) y la caja es `CajaChat`. El motor es el de cada editor: edita lo ABIERTO y nada se aplica sin «Aceptar». La propuesta
// con «Original | Modificado» va en el hueco `enMensaje` de la respuesta de MaKo que la trajo. En el Video Editor, desde el
// 29/10/2026, las piezas usan los tokens de MaKo tal cual (antes, los de CapCut redefinidos bajo `.cc-chat`).
// ⚠️ PROBADO ROMPIENDOLO (29/10/2026): `CSS_CHAT` de vuelta en PanelChat.tsx → 3/1.
//
// ⚠️ PROBADO ROMPIENDOLO (22/10/2026, base 4/0): la propuesta del Image Editor fuera del hueco → 3/1; el hueco también en lo
// de la persona → 3/1; el Video Editor sin `.cc-chat` en la raíz (las piezas con los colores claros de la app) → 3/1; el
// `data-mensaje` del foco fuera del hueco → 3/1 (y tests/video-editor-propuesta-link.test.ts).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const imagen = sinComentarios(readFileSync('app/image-editor/mako/chat/PanelMakoIA.tsx', 'utf8'));
const video = sinComentarios(readFileSync('app/video-editor/_opencut/chat/PanelChat.tsx', 'utf8'));
const hueco = (src: string) => src.slice(src.indexOf('const enMensaje = ('), src.indexOf('return (', src.indexOf('const enMensaje = (') + 600));

test('el Image Editor: el hilo con su criatura, la propuesta en el hueco de MaKo y la caja única', () => {
  assert.match(imagen, /const QUIEN = \{ nombre: 'Image Editor' \};/);
  assert.match(imagen, /<HiloMako items=\{nota\.conNotas\(items\)\} quien=\{QUIEN\} [^>]*enMensaje=\{enMensaje\} \/>/);
  const h = hueco(imagen);
  assert.match(h, /if \(!m \|\| m\.de !== 'mako'\) return null;/, 'lo de la persona no lleva propuesta');
  assert.match(h, /<RevisionPropuesta[\s\S]*onAceptar=\{\(\) => void aceptarPropuesta\(editorRef\.current, m\)\}/);
  assert.match(imagen, /<CajaChat campo=\{inputRef\} texto=\{texto\} onTexto=\{setTexto\} onMandar=\{\(\) => \{ if \(!adj\.preparando\) enviar\(texto, alcanceReal, \{ archivos: adj\.tomar\(\) \}\); \}\} ocupado=\{hilo\.corriendo \|\| nota\.pendientes\}/);
  assert.doesNotMatch(imagen, /<textarea\b/);
});

test('el Video Editor: igual, con el foco del link en el hueco y los colores de MaKo', () => {
  assert.match(video, /const QUIEN = \{ nombre: "Video Editor" \};/);
  assert.match(video, /<HiloMako items=\{nota\.conNotas\(items\)\} quien=\{QUIEN\} [^>]*enMensaje=\{enMensaje\} \/>/);
  const h = hueco(video);
  assert.match(h, /if \(!m \|\| m\.de !== "mako"\) return null;/);
  assert.match(h, /<div data-mensaje=\{m\.id\} [^>]*style=\{foco === m\.id \?/, 'el foco de `?propuesta=` busca el hueco');
  assert.match(h, /onAceptar=\{\(\) => void aceptar\(m\)\}/);
  assert.match(video, /<section role="complementary" className="cc-chat /, 'con <aside>, la barra de la agencia lo estira');
  // 29/10/2026 (Martín: «los colores de MaKo, no esos colores»): el chat es la tarjeta izquierda de Create y usa los tokens de
  // MaKo tal cual. Ni `CSS_CHAT` (que les ponía los `--cc-*` de CapCut a las piezas) ni un `--cc-*` en sus clases.
  assert.doesNotMatch(video, /CSS_CHAT/, 'volvió CSS_CHAT: las piezas del Ops Center con los colores de CapCut');
  assert.doesNotMatch(video, /--cc-[a-z]/, 'el chat volvió a un token de CapCut: usa los de MaKo (--surface, --ink, --primary…)');
  assert.match(video, /<CajaChat campo=\{inputRef\} texto=\{texto\} onTexto=\{setTexto\} onMandar=\{\(\) => \{ if \(!adj\.preparando\) enviar\(texto, alcanceReal, \{ archivos: adj\.tomar\(\) \}\); \}\} ocupado=\{hilo\.corriendo \|\| nota\.pendientes\}/);
  assert.doesNotMatch(video, /<textarea\b/);
});

test('los dos cargan la hoja del Centro (sin ella, el hilo y la caja no tienen forma)', () => {
  for (const src of [imagen, video]) assert.match(src, /import ["']@\/app\/admin\/operaciones\/centro\.css["'];/);
});

test('los dos siguen recortando lo que se pide a su tope (la caja única no tiene `maxLength`)', () => {
  // Con «Discutir | Editar» y la marca (5/11/2026) el pedido lleva sus opciones al final: lo que se cuida es el recorte.
  assert.match(imagen, /pedirEdicion\(editorRef\.current, instruccion\.slice\(0, TOPES_CHAT_IMAGEN\.instruccion\), alc, archivos(\)|, \{ intencion, kit \}\))/);
  assert.match(video, /pedirEdicion\(editorRef\.current, instruccion\.slice\(0, TOPES_CHAT\.instruccion\), alc, (op|\{ \.\.\.op, intencion \})\)/);
});
