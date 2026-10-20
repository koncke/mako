// Ticket #5 (18/10/2026): a Mauricio (ws1) MaKo no le contestó en el chat de la app, y la Ticketera lo leyó como un
// bug: «responder: Claude vetado — «mako-doer» no está en la lista blanca». No era un veto: la cascada gratis no
// contestó, y el «falló la IA» que `chatClaudeTools` re-lanza con `sinFallbackClaude` caía en el `catch` vacío que
// envolvía la lectura del registro de modelos. El modelo quedaba vacío y el veto hablaba por él (en `anthropic_usage`
// quedó `vetado:-`: sin modelo).
//
// Lo que se fija acá: el `catch` del registro envuelve SÓLO la lectura del registro, la cascada corre afuera, y entre
// la cascada y el veto no hay ningún `catch` que se trague un error.
//
// Probado rompiéndolo (18/10/2026):
//   - con la forma vieja (try{ registro + cascada } catch{}) → 3 de 3 fallan;
//   - sacando el `throw` del `catch` del registro → 1 de 3 falla («sin registro y sin respaldo…»).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../lib/anthropic.ts', import.meta.url), 'utf8');
const desde = SRC.indexOf('export async function chatClaudeTools');
const CUERPO = SRC.slice(desde, SRC.indexOf('EL VETO, la MISMA puerta que chatClaude', desde));

test('chatClaudeTools: el catch del registro termina ANTES de la cascada gratis', () => {
  assert.ok(desde > 0 && CUERPO.length > 0, 'no encontré chatClaudeTools ni su veto');
  const registro = CUERPO.indexOf('sin registro');
  const cascada = CUERPO.indexOf('chatCheapToolsCascade(');
  assert.ok(registro > 0 && cascada > 0, 'falta la lectura del registro o la cascada');
  assert.ok(registro < cascada, 'el catch del registro envuelve la cascada: se traga el «falló la IA» y el veto contesta por él');
});

test('chatClaudeTools: entre la cascada y el veto, ningún catch se traga el error', () => {
  const tras = CUERPO.slice(CUERPO.indexOf('chatCheapToolsCascade('));
  assert.doesNotMatch(tras, /catch\s*\{/, 'un `catch {}` sin variable después de la cascada se come el re-lanzado de sinFallbackClaude');
  assert.doesNotMatch(tras, /catch\s*\(\w+\)\s*\{\s*(\/\*[\s\S]*?\*\/\s*)?\}/, 'un catch vacío después de la cascada');
});

test('chatClaudeTools: sin registro y sin respaldo de Claude, el error dice «falló la IA», no «Claude vetado»', () => {
  const registro = CUERPO.slice(0, CUERPO.indexOf('chatCheapToolsCascade('));
  assert.match(registro, /catch \(e\) \{\s*if \(opts\.sinFallbackClaude\) throw new Error\(`falló la IA/);
});
