import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { clasificarEleven, elSondeoDicePuede, pareceAudio } from '../lib/elevenlabs-fallo';
import { TAB_ONBOARDINGS } from '../lib/tab-onboarding-catalogo';
import { DEFS } from '../lib/integraciones-catalogo';

const RAIZ = join(import.meta.dirname, '..');

/**
 * ⚠️ La ficha se lee del FUENTE y no se importa: `lib/metodo-catalogo.ts` tiene
 * `server-only`, así que importarlo desde un test explota. Es la misma técnica
 * que ya usa `tests/integraciones-visibles.test.ts` con `lib/integraciones.ts`.
 */
const FUENTE_METODO = readFileSync(join(RAIZ, 'lib/metodo-catalogo.ts'), 'utf8').replace(/\r\n/g, '\n');

/**
 * El fuente SIN comentarios.
 *
 * ⚠️ HACE FALTA, Y LO DESCUBRIÓ ESTE MISMO TEST FALLANDO. Un guard que lee el
 * fuente también lee los COMENTARIOS — y el comentario que documenta un bug
 * suele citar el código viejo textual, que es exactamente lo que el guard busca.
 * Los cuatro guards de este archivo fallaron la primera vez contra las citas que
 * explican por qué existen.
 */
function sinComentarios(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** El bloque de la ficha de un servicio, del fuente. */
function fichaDe(key: string): string {
  const i = FUENTE_METODO.indexOf(`    key: '${key}',`);
  if (i < 0) return '';
  const j = FUENTE_METODO.indexOf('\n  {\n', i);
  return sinComentarios(FUENTE_METODO.slice(i, j < 0 ? undefined : j));
}

// =============================================================================
// La clonación de voz — lo que puede mandar a arreglar lo que no era
// =============================================================================

// ── Los dos 401 de la MISMA cuenta ─────────────────────────────────────────
// Son respuestas reales, copiadas de las dos mediciones. Se ven iguales desde
// afuera y mandan a hacer cosas opuestas: pagar una factura contra editar los
// permisos de la key.

const IMPAGO = JSON.stringify({
  detail: {
    type: 'payment_required',
    code: 'payment_issue',
    message: 'Your subscription has a failed or incomplete payment. Complete the latest invoice to continue usage.',
  },
});

const SIN_PERMISO = JSON.stringify({
  detail: {
    type: 'authentication_error',
    code: 'unauthorized',
    message: 'The API key you used is missing the permission user_read to execute this operation.',
    status: 'missing_permissions',
  },
});

test('un 401 por FACTURA IMPAGA no se lee como un permiso faltante', () => {
  // Es el diagnóstico que se sacó el 22/08/2026 y era falso. Mandó a mirar los
  // permisos de una key que estaba perfecta.
  const c = clasificarEleven(401, IMPAGO);
  assert.equal(c.motivo, 'impago');
  assert.match(c.error, /pago|payment/i);
});

test('y un 401 por PERMISO FALTANTE no manda a pagar una factura que está al día', () => {
  const c = clasificarEleven(401, SIN_PERMISO);
  assert.equal(c.motivo, 'sin_permiso');
});

test('el impago se clasifica por el CODE aunque el status diga otra cosa', () => {
  // El status de un impago no siempre es 401. Si la regla mirara el status
  // primero, un 403 o un 200 con el mismo cuerpo caerían al motivo equivocado.
  assert.equal(clasificarEleven(403, IMPAGO).motivo, 'impago');
  assert.equal(clasificarEleven(200, IMPAGO).motivo, 'impago');
});

test('una voz borrada a mano se distingue de todo lo demás', () => {
  const c = clasificarEleven(404, JSON.stringify({ detail: { code: 'voice_not_found', message: 'Voice not found' } }));
  assert.equal(c.motivo, 'voz_muerta');
});

test('⚠️ un `detail` que es ARRAY no rompe la clasificación', () => {
  // Es exactamente lo que devuelve el 422 del sondeo de permisos:
  // {"detail":[{"type":"missing","loc":["body","name"],"msg":"Field required"}]}
  // Leerle `.code` a un array da undefined y el motivo caería al genérico.
  const c = clasificarEleven(422, JSON.stringify({
    detail: [{ type: 'missing', loc: ['body', 'name'], msg: 'Field required', input: null }],
  }));
  assert.equal(c.motivo, 'nuestra');
});

test('un cuerpo que no es JSON no inventa un motivo', () => {
  assert.equal(clasificarEleven(500, '<html>oops</html>').motivo, 'proveedor');
  assert.equal(clasificarEleven(401, '').motivo, 'sin_permiso');
});

// ── El sondeo que comprueba sin gastar ─────────────────────────────────────

test('el sondeo dice PUEDE sólo con 422, que es «te falta el cuerpo»', () => {
  // Medido contra la cuenta real: `POST /v1/voices/add` y
  // `POST /v1/speech-to-speech/{id}` con FormData vacío devuelven 422 «Field
  // required» cuando el permiso está. Un 401 es que no está.
  assert.ok(elSondeoDicePuede(422));
  assert.ok(!elSondeoDicePuede(401));
  assert.ok(!elSondeoDicePuede(200), 'un 200 en un pedido sin cuerpo sería otra cosa, no un permiso');
});

test('un JSON de error no se confunde con audio', () => {
  // Si esto falla, el cuerpo del error se escribe como `sts-N.mp3` y ffmpeg
  // revienta TRES etapas después con un mensaje sobre el formato del archivo.
  assert.ok(!pareceAudio(JSON.stringify({ detail: { code: 'payment_issue' } }).length));
  assert.ok(!pareceAudio(0));
  assert.ok(pareceAudio(24000), 'un segundo de mp3 a 192 kbps son ~24 KB');
});

// ── De quién es la key ─────────────────────────────────────────────────────

test('⚠️ la key de ElevenLabs NUNCA se resuelve por el workspace en curso', () => {
  // `credWs(clave)` sin segundo argumento resuelve por el workspace del request,
  // y devuelve `process.env[clave]` cuando ese workspace es OWNER_WS — que es
  // Mauricio, un CLIENTE. La llamada no falla: funciona, y entrega la key de la
  // plataforma adentro del workspace de un cliente.
  //
  // Medido el 02/09/2026: hay filas de esta key en CUATRO workspaces y tres
  // resuelven a la misma. Por eso el guard mira el código y no la intención.
  const src = sinComentarios(readFileSync(join(RAIZ, 'lib/elevenlabs.ts'), 'utf8'));
  // ⚠️ Se mira la LÍNEA entera y no una captura entre paréntesis: un
  // `credWs('X', await wsSuperAdmin())` tiene paréntesis anidados, así que una
  // captura de «todo lo que no sea cierre» corta en el de `wsSuperAdmin(` y deja
  // afuera justo lo que hay que comprobar. Este test falló así la primera vez.
  const lineas = src.split('\n').filter((l) => l.includes('credWs('));
  assert.ok(lineas.length > 0, 'no se encontró ninguna llamada a credWs: ¿se renombró?');
  for (const l of lineas) {
    assert.match(
      l,
      /wsSuperAdmin\(\)/,
      `«${l.trim()}» no resuelve contra el workspace de la plataforma`,
    );
  }
});

test('ElevenLabs está declarada como credencial de PLATAFORMA en los DOS catálogos', () => {
  // Los dos tienen que decir lo mismo, o una UI la esconde y la otra la muestra.
  const tarjeta = DEFS.find((d) => d.key === 'elevenlabs');
  assert.ok(tarjeta, 'desapareció la tarjeta de ElevenLabs');
  assert.equal(tarjeta.soloPlataforma, true, 'la tarjeta se le sigue ofreciendo a los clientes');
  const ficha = fichaDe('elevenlabs');
  assert.ok(ficha, 'desapareció la ficha de ElevenLabs');
  assert.match(ficha, /soloPlataforma: true/, 'la ficha se le sigue ofreciendo a los clientes');
});

test('y su tutorial ya no le enseña a un cliente a sacar SU key', () => {
  // El copy tiene que ser CIERTO: decía «usando tu propia cuenta de ElevenLabs» y
  // «activa el acceso a Text to Speech». Las dos cosas dejaron de ser verdad, y un
  // tutorial que enseña un trámite que el producto no usa manda a perder el tiempo.
  const texto = fichaDe('elevenlabs');
  assert.doesNotMatch(texto, /tu propia cuenta de ElevenLabs/i);
  assert.match(texto, /Speech to Speech/i, 'no nombra el permiso que de verdad hace falta');
  assert.match(texto, /«Voices» con/i, 'no nombra el permiso de escritura de voces');
});

// ── El paso del onboarding ─────────────────────────────────────────────────

test('el paso de voz es OPCIONAL, y de eso depende no re-encerrar a nadie', () => {
  // `marcarPasoTab` recalcula el `status` contra el catálogo ACTUAL: un paso nuevo
  // NO opcional devuelve a «pendiente» a todos los que ya tenían la tab cerrada y
  // les reabre el wizard encima de un anuncio a medio hacer.
  const paso = TAB_ONBOARDINGS['video-generator'].pasos.find((p) => p.key === 'vg_voz');
  assert.ok(paso, 'no está el paso de voz');
  assert.equal(paso.opcional, true);
});

test('va con prefijo vg_, como todos los de esta tab', () => {
  // `voz` pelado colisiona vía el registro compartido con «Tus audios» del Chat
  // Agent: cerrar uno marcaría el otro como hecho.
  for (const p of TAB_ONBOARDINGS['video-generator'].pasos) {
    assert.match(p.key, /^vg_/, `el paso «${p.key}» puede colisionar con otra tab`);
  }
});

test('⚠️ cada pantalla del wizard declara QUÉ paso cierra', () => {
  // Acá había un ternario: `paso === 'cara' ? 'vg_cara' : 'vg_puente'`. O sea que
  // cualquier pantalla nueva marcaba el PUENTE como hecho — no falla, tipa bien, y
  // deja a alguien saltando el paso del navegador sin haberlo conectado nunca.
  //
  // El guard mira el código porque el bug es una FORMA, no un valor.
  const src = sinComentarios(readFileSync(join(RAIZ, 'app/video-generator/OnboardingVideoGen.tsx'), 'utf8'));
  assert.match(src, /const CLAVE_DE_PASO: Record</, 'volvió a ser un ternario o cambió de nombre');
  assert.doesNotMatch(
    src,
    /marcarPasoVideoAction\(\s*paso ===/,
    'la clave del paso se está decidiendo con un ternario otra vez',
  );
});
