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
import { rutaDelHilo, RUTA_AL_TERMINAR } from '../lib/onboarding-arranque';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('la ruta del final abre el chat; sin chat, el Ops Center igual; sin `?recorrido=` (la guía pregunta sola)', () => {
  // 5/11/2026 (G2 de docs/mako-iniciativa/guia.md): `sb-inicio` lo reemplazó la guía del Ops Center, que pregunta la primera vez
  // de cada persona entre por donde entre. El parámetro ya no abría nada.
  assert.equal(rutaDelHilo(42), `${RUTA_AL_TERMINAR}?chat=42`);
  assert.equal(rutaDelHilo(null), RUTA_AL_TERMINAR, 'si no se pudo crear el chat, el final no se traba');
});

test('el chat «Onboarding» se crea una vez, con la conversación entera y en orden, y no como el principal', () => {
  const s = leer('lib/onboarding-arranque-server.ts');
  const i = s.indexOf('export async function hiloDelOnboarding()');
  assert.ok(i > 0, 'falta hiloDelOnboarding');
  const f = s.slice(i, s.indexOf('\n}\n', i));
  // Una segunda llamada no duplica (la decisión 'listo'); la carrera, la copia a medias y el dueño los prueba con la base de
  // mentira tests/onboarding-hilo-carrera.test.ts (20/10/2026, revisión del Cerebro).
  assert.match(f, /if \(decision === 'listo'\) return/, 'una segunda llamada duplicaría el chat');
  // Desde el 21/10 sale del HISTORIAL guardado, junto por hora con Offer (tests/onboarding-historial.test.ts): armado del
  // estado de hoy, un dato arreglado después cambiaba lo que la persona «contestó».
  assert.match(s, /mensajesDelHilo\(unirConOffer\(historial, h\.sesion\?\.mensajes \?\? \[\]\), \{ nombre: e\.nombre, telefonoVerificado: e\.telefono === 'verificado' \}\)/, 'la conversación no va tal cual (lo que se le preguntó y contestó)');
  assert.match(f, /if \(!sesiones\.some\(\(s\) => !s\.archived && s\.contexto !== marca\)\) await createSession\(chartKey, null, null\);/,
    'sin un chat principal antes, el más viejo es el jefe y «Onboarding» se mostraría como «Second Brain»');
  assert.match(f, /const hilo = await createSession\(chartKey, TITULO_HILO, marca\);/);
  assert.match(f, /await guardarEstadoArranque\(\{ hiloChat: hilo\.id, hiloDe: chartKey, hiloAt: new Date\(\)\.toISOString\(\), hiloCreando: undefined,/);
  // Cada mensaje con su hora, creciente: en UN insert todas llevaban el mismo now() y el chat salía desordenado (cuarta
  // revisión, 21/10).
  assert.match(f, /const t0 = Date\.now\(\) - mensajes\.length;/);
  assert.match(f, /session_id: hilo\.id, role: m\.role, content: m\.content, created_at: new Date\(t0 \+ i\)\.toISOString\(\),/);
});

test('la ruta del arranque lo arma a pedido de la pantalla, y la pantalla entra a ese chat', () => {
  // Sólo con el onboarding terminado (20/10/2026, revisión del Cerebro: un POST a mano lo armaba a medias).
  assert.match(leer('app/api/onboarding/arranque/route.ts'),
    /case 'hilo': \{[\s\S]*?if \(\(await getEstadoOnboarding\(\)\)\.status !== 'done'\) return NextResponse\.json\(\{ ok: true, chat: null \}\);\s*return NextResponse\.json\(\{ ok: true, chat: await hiloDelOnboarding\(\) \}\);/);
  assert.match(leer('app/onboarding/ChatArranque.tsx'), /body: JSON\.stringify\(\{ action: 'hilo' \}\)/);
});
