// =============================================================================
// El chat de MaKo del CRM tiene la cara del chat del Second Brain
// =============================================================================
// Feedback de Martín del 16/10/2026 (punto 8 del CRM): «aún no se aplicó el diseño de los chats tipo "Second Brain" al
// chat del CRM... En lugar de la estrella de MaKo el ícono debería ser el muñequito que se asignó para CRM». El hilo es
// el del Second Brain (app/_chat/HiloMako.tsx) con el muñeco del CRM, y la caja la del Second Brain con el micrófono
// que dicta. La lógica (cargar, mandar, las tarjetas, el pedido de una sugerencia) no cambió.
//
// Correr: node --import tsx --test tests/crm-chat-second-brain.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (16/10/2026, base 2/0): volver a montar `ChatHilo` → 1 / 1; el hilo sin el muñeco del CRM
// (otro `quien`) → 1 / 1; la caja sin el micrófono → 1 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const chat = readFileSync('app/crm/mako-crm/ChatMakoCrm.tsx', 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

test('el hilo es el del Second Brain, con el muñeco del CRM y las mismas tarjetas', () => {
  assert.match(chat, /<HiloMako items=\{items\} quien=\{\{ nombre: 'CRM' \}\}/);
  assert.match(chat, /onTarjeta=\{\(x, a\) => void correrTarjeta\(x, a\)\} onReintentar=\{reintentar\} onRecargar=\{recargar\}/);
  assert.doesNotMatch(chat, /<ChatHilo\b|<ComposerWhatsApp\b|<BurbujaHilo\b|<AvatarMako\b/, 'volvieron las piezas del chat de WhatsApp');
});

test('la caja es la del Second Brain: el micrófono dicta y Enter manda', () => {
  assert.match(chat, /<Microfono valor=\{texto\} onValor=\{\(v\) => \{ setFaltaMic\(null\); setTexto\(v\); \}\}/);
  assert.match(chat, /if \(e\.key === 'Enter' && !e\.shiftKey && !e\.nativeEvent\.isComposing\) \{ e\.preventDefault\(\); enviarComposer\(\); \}/);
  assert.match(chat, /<Muneco titulo="CRM" animo="despierto" size=\{76\} \/>/, 'la portada vacía, con el muñeco');
});
