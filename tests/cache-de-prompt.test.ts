// =============================================================================
// La caché de prompt en el turno con herramientas (12/11/2026, docs/hallazgos-ia.md «No hay caché de prompt»)
// =============================================================================
// Medido en 7 días: 101 llamadas del turno de WhatsApp en Haiku 4.5, ~9.900 tokens de entrada cada una y 0 leídos de caché. Un turno
// son ~2,1 llamadas y la segunda re-manda el mismo system y las mismas herramientas. Lo que fija: el system del bucle con herramientas
// (`chatClaudeTools`, lib/anthropic.ts) va como bloque con `cache_control` efímero, en las dos formas del pedido (con la clave del
// negocio y con la de la plataforma), y lo que cambia (los mensajes) va después, sin marca.
// Probado rompiéndolo: sacar la marca, o volver a `system` en texto en cualquiera de las dos formas → falla.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fuente = readFileSync(new URL('../lib/anthropic.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

test('el system del turno con herramientas va con cache_control efímero, en las dos formas del pedido', () => {
  const tools = fuente.slice(fuente.indexOf('export async function chatClaudeTools('));
  assert.ok(tools.length > 100, 'no encontré chatClaudeTools');
  assert.match(tools, /const systemConCache = \[\{ type: 'text', text: system, cache_control: \{ type: 'ephemeral' \} \}\];/);
  const payload = tools.slice(tools.indexOf('const payload: Record<string, unknown> = delNegocio'), tools.indexOf('if (opts.toolChoice)'));
  assert.match(payload, /\? \{ model, max_tokens: opts\.maxTokens \?\? 4096, system: systemConCache, messages: msgs, tools \}/, 'con la clave del negocio, sin caché');
  assert.match(payload, /max_tokens: opts\.maxTokens \?\? 16000,\n\s*system: systemConCache,/, 'con la plataforma, sin caché');
  assert.doesNotMatch(payload, /\bsystem,/, 'volvió el system en texto');
});
