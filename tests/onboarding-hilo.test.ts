// =============================================================================
// Al terminar, el onboarding entra al chat «Onboarding» con la conversación tal cual (20/10/2026)
// =============================================================================
// Martín (pedido del 18/10, punto 13): «Cuando uno entra, debería estar posicionado en el chat de "Onboarding" que es el
// chat que recién se estuvo completando... Con toda la conversación tal cual... Y luego debería iniciar el tutorial de
// la app». El server arma el chat (lib/onboarding-arranque-server.ts → hiloDelOnboarding) con los mensajes del arranque y
// los de la conversación de Offer, en el orden de la pantalla, una sola vez; la pantalla entra a /second-brain?chat=<id>
// con el tutorial.
//
// ROTURAS (20/10/2026, arnés romper-hilo.js del scratchpad; base 3/0): sin el id guardado (duplica el chat) → 2/1 · sin
// el chat principal antes (el «Onboarding» quedaría como «Second Brain») → 2/1 · la ruta sin el chat → 2/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rutaDelHilo, RUTA_AL_TERMINAR, RECORRIDO_INICIO } from '../lib/onboarding-arranque';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('la ruta del final abre el chat y el tutorial; sin chat, el Ops Center igual', () => {
  assert.equal(rutaDelHilo(42), `${RUTA_AL_TERMINAR}?chat=42&recorrido=${RECORRIDO_INICIO}`);
  assert.equal(rutaDelHilo(null), `${RUTA_AL_TERMINAR}?recorrido=${RECORRIDO_INICIO}`, 'si no se pudo crear el chat, el final no se traba');
});

test('el chat «Onboarding» se crea una vez, con la conversación entera y en orden, y no como el principal', () => {
  const s = leer('lib/onboarding-arranque-server.ts');
  const i = s.indexOf('export async function hiloDelOnboarding()');
  assert.ok(i > 0, 'falta hiloDelOnboarding');
  const f = s.slice(i, s.indexOf('\n}\n', i));
  assert.match(f, /if \(previo\.hiloChat\) return previo\.hiloChat;/, 'una segunda llamada duplicaría el chat');
  assert.match(f, /\[\.\.\.v\.antes, \.\.\.\(v\.sesion\?\.mensajes \?\? \[\]\), \.\.\.v\.despues\]/, 'la conversación no va tal cual (el orden de la pantalla)');
  assert.match(f, /if \(!\(await listSessions\(chartKey\)\)\.length\) await createSession\(chartKey, null, null\);/,
    'sin un chat principal antes, el más viejo es el jefe y «Onboarding» se mostraría como «Second Brain»');
  assert.match(f, /const hilo = await createSession\(chartKey, 'Onboarding', null\);/);
  assert.match(f, /appendMessage\(hilo\.id, m\.de === 'yo' \? 'user' : 'assistant', m\.texto\.trim\(\)\)/);
  assert.match(f, /await guardarEstadoArranque\(\{ hiloChat: hilo\.id \}\);/);
});

test('la ruta del arranque lo arma a pedido de la pantalla, y la pantalla entra a ese chat', () => {
  assert.match(leer('app/api/onboarding/arranque/route.ts'), /case 'hilo': \{\s*return NextResponse\.json\(\{ ok: true, chat: await hiloDelOnboarding\(\) \}\);/);
  assert.match(leer('app/onboarding/ChatArranque.tsx'), /body: JSON\.stringify\(\{ action: 'hilo' \}\)/);
});
