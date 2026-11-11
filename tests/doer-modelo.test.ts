// =============================================================================
// MaKo en WhatsApp contesta con el modelo del negocio, y bajar de modelo queda escrito (27/10/2026, P5; lib/doer-modelo.ts)
// =============================================================================
// La lectura del Cerebro (20 al 27/10): 38 de 42 turnos con Gemini fueron flash-lite, un negocio fijo en `gpt-4o-mini` y otro
// en Groq. El doer fijaba `gpt-4o-mini` para su ChatGPT (la app ya usa `MODELO_SU_OPENAI_DEFAULT` desde el 23/10), y el porqué
// de bajar a flash-lite vivía sólo en los logs de Vercel.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OPENAI_BARATO_DEL_DOER, pinDelDoer } from '../lib/doer-modelo';
import { MODELO_SU_OPENAI_DEFAULT } from '../lib/chat-ia-reglas';
import { estadoDeSuClave } from '../lib/su-clave-reglas';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('1. con su IA y sin pin, su ChatGPT con el modelo de la app, nunca gpt-4o-mini', () => {
  assert.deepEqual(pinDelDoer(null, true), { provider: 'openai', model: MODELO_SU_OPENAI_DEFAULT });
  assert.notEqual(MODELO_SU_OPENAI_DEFAULT, 'gpt-4o-mini');
  // Un pin viejo a gpt-4o-mini (el default de antes) pasa al de la app; un pin elegido a otro modelo, manda.
  assert.deepEqual(pinDelDoer({ provider: 'openai', model: 'gpt-4o-mini' }, true), { provider: 'openai', model: MODELO_SU_OPENAI_DEFAULT });
  assert.deepEqual(pinDelDoer({ provider: 'openai', model: 'gpt-6.1-sol' }, true), { provider: 'openai', model: 'gpt-6.1-sol' });
  assert.deepEqual(pinDelDoer({ provider: 'gemini', model: 'gemini-flash-latest' }, false), { provider: 'gemini', model: 'gemini-flash-latest' });
});

test('2. un pin a Groq (no contesta texto desde IA16) o a Claude (va por su camino) no manda en la capa barata', () => {
  assert.deepEqual(pinDelDoer({ provider: 'groq', model: 'openai/gpt-oss-20b' }, true), { provider: 'openai', model: MODELO_SU_OPENAI_DEFAULT });
  // Sin su IA y sin pin (o con uno que no manda), el OpenAI barato, NUNCA ninguno (11/11/2026): con `null` el turno caía a la
  // puerta 1 (Sonnet u Opus, que el veto corta) y se salteaba el «Claude primero» del grupo.
  assert.deepEqual(pinDelDoer({ provider: 'groq', model: 'x' }, false), OPENAI_BARATO_DEL_DOER);
  assert.deepEqual(pinDelDoer({ provider: 'anthropic', model: 'haiku' }, false), OPENAI_BARATO_DEL_DOER);
  assert.deepEqual(pinDelDoer(null, false), OPENAI_BARATO_DEL_DOER);
});

test('3. bajar de modelo queda escrito en la base, y esa fila no cuenta como que su clave anduvo', () => {
  const ai = leer('lib/ai-cheap.ts');
  // Sin el 429: ése ya es una fila `rebote429:`, y `plegarUso` contaría el mismo pedido dos veces contra la cuota del día.
  assert.match(ai, /if \(tipo !== 'cuota' && paso\.modelo && paso\.modelo !== model\) void recordUsage\(opts\.feature \|\| 'ia-barata-tools', `\$\{PREFIJO_REBOTE\}\$\{model\}`/,
    'un 429 cubierto por el respaldo se anota dos veces (rebote429: y rebote:)');
  const e = estadoDeSuClave('gemini', [{ provider: 'gemini', model: 'rebote:gemini-flash-latest', motivo: '503 high demand → gemini-flash-lite-latest', created_at: '2026-10-26T10:00:00Z', cost_usd: 0 } as never]);
  assert.equal(e.anduvo, null, 'el rebote se leyó como que su Gemini contestó');
  const doer = leer('lib/mako-doer-in.ts');
  assert.match(doer, /const pinL = pinDelDoer\(pin, suIA\);/);
  assert.doesNotMatch(doer, /model: 'gpt-4o-mini' \}/, 'el doer volvió a fijar gpt-4o-mini');
});
