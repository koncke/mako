// =============================================================================
// Los chats del Image Editor y del Video Editor con las piezas del Ops Center (22/10/2026, TB3)
// =============================================================================
// Martín, 22/10: «quiero que todos los chats de MaKo en las tabs sean el del Ops Center». Los dos editores tenían su
// <textarea> y sus burbujas. Ahora el hilo es `HiloMako` con la criatura de la tab (la misma que los nombra en el Ops Center,
// OC8) y la caja es `CajaChat`. El motor es el de cada editor: edita lo ABIERTO y nada se aplica sin «Aceptar». La propuesta
// con «Original | Modificado» va en el hueco `enMensaje` de la respuesta de MaKo que la trajo. En el Video Editor, las piezas
// tomaban los colores de CapCut redefiniendo sus tokens bajo `.cc-chat`; desde el 27/10/2026 llevan los de MaKo (abajo).
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

// 26/10/2026 (Martín: «que tengan el chat de mako siempre abierto, como web generator»): el Image Editor dibuja el PANEL ÚNICO
// (PanelDeChat) fijo a la izquierda, con la estrella de MaKo (como el agente del Web Generator desde el 23/10) y «Discutir |
// Editar» arriba de la caja. PROBADO ROMPIENDOLO (26/10/2026, base 4/0): sin el panel único → 3/1; sin el selector → 3/1;
// la intención sin llegar al motor → 3/1.
test('el Image Editor: el panel único con la estrella de MaKo, la propuesta en el hueco y la caja única', () => {
  assert.match(imagen, /const QUIEN = \{ nombre: 'MaKo', aspecto: ASPECTO_MAKO \};/);
  assert.match(imagen, /<PanelDeChat\b/, 'el panel único, como el Web Generator');
  assert.match(imagen, /<SelectorIntencion valor=\{intencion\} onCambio=\{elegirIntencion\}/, '«Discutir | Editar», como el Web Generator');
  assert.match(imagen, /<HiloMako items=\{nota\.conNotas\(items\)\} quien=\{QUIEN\} [^>]*enMensaje=\{enMensaje\} \/>/);
  const h = hueco(imagen);
  assert.match(h, /if \(!m \|\| m\.de !== 'mako'\) return null;/, 'lo de la persona no lleva propuesta');
  assert.match(h, /<RevisionPropuesta[\s\S]*onAceptar=\{\(\) => void aceptarPropuesta\(editorRef\.current, m\)\}/);
  assert.match(imagen, /<CajaChat campo=\{inputRef\} texto=\{texto\} onTexto=\{setTexto\} onMandar=\{\(\) => \{ if \(!adj\.preparando\) enviar\(texto, alcanceReal, \{ archivos: adj\.tomar\(\) \}\); \}\} ocupado=\{hilo\.corriendo \|\| nota\.pendientes\}/);
  assert.doesNotMatch(imagen, /<textarea\b/);
});

// 27/10/2026 (Martín: «adaptar las tabs de video e imagen con el chat que tenemos de MaKo... algo similar a lo que hicimos
// con Web Generator, que este al costado... ponle los colores de MaKo»): el Video Editor también dibuja el PANEL ÚNICO, fijo
// a la izquierda (el marco, app/video-editor/_opencut/marco.tsx), con la estrella de MaKo y «Discutir | Editar». Ya no
// redefine los tokens de las piezas con los de CapCut: adentro de `.ce-mako` valen los de la app (capcut-theme.css).
// PROBADO ROMPIENDOLO (27/10/2026, base 4/0): sin el panel único → 3/1; sin el selector → 3/1; la intención sin llegar al
// motor (`op` sin `intencion`) → 3/1; las piezas otra vez con los tokens de CapCut (`--surface:var(--cc-raised)`) → 3/1;
// el `data-mensaje` del foco fuera del hueco → 3/1.
test('el Video Editor: el panel único con la estrella de MaKo, el foco del link en el hueco y los colores de la app', () => {
  assert.match(video, /const QUIEN = \{ nombre: "MaKo", aspecto: ASPECTO_MAKO \};/);
  assert.match(video, /<PanelDeChat\b/, 'el panel único, como el Web Generator');
  assert.match(video, /<SelectorIntencion valor=\{intencion\} onCambio=\{elegirIntencion\}/, '«Discutir | Editar», como el Web Generator');
  assert.match(video, /<HiloMako items=\{nota\.conNotas\(items\)\} quien=\{QUIEN\} [^>]*enMensaje=\{enMensaje\} \/>/);
  const h = hueco(video);
  assert.match(h, /if \(!m \|\| m\.de !== "mako"\) return null;/);
  assert.match(h, /<div data-mensaje=\{m\.id\} [^>]*style=\{foco === m\.id \?/, 'el foco de `?propuesta=` busca el hueco');
  assert.match(h, /onAceptar=\{\(\) => void aceptar\(m\)\}/);
  assert.doesNotMatch(video, /<aside\b/, 'con <aside>, la barra de la agencia lo estira');
  assert.doesNotMatch(video, /--(surface|ink|primary):var\(--cc-/, 'las piezas otra vez con los tokens de CapCut: el chat sale oscuro en el editor claro');
  assert.match(video, /<CajaChat campo=\{inputRef\} texto=\{texto\} onTexto=\{setTexto\} onMandar=\{\(\) => \{ if \(!adj\.preparando\) enviar\(texto, alcanceReal, \{ archivos: adj\.tomar\(\) \}\); \}\} ocupado=\{hilo\.corriendo \|\| nota\.pendientes\}/);
  assert.doesNotMatch(video, /<textarea\b/);
});

test('los dos cargan la hoja del Centro (sin ella, el hilo y la caja no tienen forma)', () => {
  for (const src of [imagen, video]) assert.match(src, /import ["']@\/app\/admin\/operaciones\/centro\.css["'];/);
});

test('los dos siguen recortando lo que se pide a su tope (la caja única no tiene `maxLength`)', () => {
  assert.match(imagen, /pedirEdicion\(editorRef\.current, instruccion\.slice\(0, TOPES_CHAT_IMAGEN\.instruccion\), alc, intencion, archivos\)/);
  // El video con la intención de «Discutir | Editar» adentro de `op` (27/10/2026).
  assert.match(video, /pedirEdicion\(editorRef\.current, instruccion\.slice\(0, TOPES_CHAT\.instruccion\), alc, \{ \.\.\.op, intencion \}\)/);
});
