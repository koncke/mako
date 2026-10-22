// =============================================================================
// El chat del asesor de WhatsApp («MaKo — qué escribir») con las piezas del Ops Center, y su «Usar →» (22/10/2026, TB3)
// =============================================================================
// Martín, 22/10: «quiero que todos los chats de MaKo en las tabs sean el del Ops Center». El asesor tenía su <textarea> y
// sus burbujas. Ahora el hilo es `HiloMako` (con la estrella de MaKo) y la caja `CajaChat`. NO va a la estrella de la tab:
// lo suyo es «Usar →», que lleva el borrador a la caja de WhatsApp de ESTE lead, y eso el Cerebro no lo puede hacer. «Usar →»
// y «Copiar» van en el hueco `enMensaje` de cada respuesta de MaKo, nunca en lo que escribió la persona.
//
// ⚠️ PROBADO ROMPIENDOLO (22/10/2026, base 3/0): sin «Usar →» en el hueco → 2/1; el hueco también en lo de la persona
// (sin el `role !== 'assistant'`) → 2/1; volver al <textarea> propio → 2/1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const src = sinComentarios(readFileSync('app/whatsapp/WhatsAppAdvisor.tsx', 'utf8'));

test('el hilo del Ops Center, con MaKo y su estrella; la caja única con Enter que manda', () => {
  assert.match(src, /<HiloMako items=\{items\} quien=\{MAKO\} [^>]*enMensaje=\{enMensaje\} \/>/);
  assert.match(src, /const MAKO = \{ nombre: 'MaKo', aspecto: ASPECTO_MAKO \};/);
  assert.match(src, /<CajaChat texto=\{input\} onTexto=\{setInput\} onMandar=\{\(\) => \{ void enviarChat\(\); \}\} ocupado=\{pensando\}\s+placeholder="Pregúntale a MaKo…"/);
  assert.match(src, /import '@\/app\/admin\/operaciones\/centro\.css';/);
});

test('«Usar →» y «Copiar» van en el hueco de cada respuesta de MaKo, y sólo ahí', () => {
  const hueco = src.slice(src.indexOf('const enMensaje = ('), src.indexOf('return (\n    <div style={{ display: \'flex\', flexDirection: \'column\', minHeight: 0, flex: 1 }}>'));
  assert.match(hueco, /if \(!m \|\| m\.role !== 'assistant'\) return null;/, 'lo que escribió la persona no se «usa»');
  assert.match(hueco, /<button onClick=\{\(\) => onUsar\(m\.content\)\}[^>]*>Usar →<\/button>/);
  assert.match(hueco, /onClick=\{\(\) => copiar\(m\.content, `c\$\{i\}`\)\}/);
});

test('el chat no arma su propia caja', () => {
  const chat = src.slice(src.indexOf("{tab === 'chat' && ("));
  assert.doesNotMatch(chat, /<textarea\b/);
});
