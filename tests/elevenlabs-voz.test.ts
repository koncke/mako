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

test('⚠️ la key de ElevenLabs es la DEL CLIENTE, y nunca cae al entorno', () => {
  // ⚠️ ESTE TEST ESTABA AL REVÉS HASTA EL 02/09/2026, y se invirtió en vez de
  // borrarse: fijaba que la voz corriera con la cuenta de la plataforma, y el
  // dueño lo dio vuelta porque no la puede costear («haz que cada cliente traiga
  // su api de eleven»). Lo que el test protege es lo mismo de siempre: que la
  // pregunta «¿de quién es esta key?» no dependa de acordarse de un argumento.
  //
  // `credWs` cae a `process.env[clave]` cuando el workspace es OWNER_WS —que es
  // Mauricio, un CLIENTE—, así que usarla acá le entregaría la cuenta de MaKo a
  // él solo, facturada a la casa, y sin fallar: funcionaría. Por eso la única
  // forma permitida es `credDelCliente`, que es `credWs` sin esa línea.
  const src = sinComentarios(readFileSync(join(RAIZ, 'lib/elevenlabs.ts'), 'utf8'));

  assert.doesNotMatch(src, /credWs\(/, 'volvió `credWs`: cae al entorno para OWNER_WS');
  assert.doesNotMatch(src, /wsSuperAdmin\(/, 'volvió a resolver contra la plataforma: la voz la paga el cliente');

  const lineas = src.split('\n').filter((l) => l.includes('credDelCliente('));
  assert.equal(lineas.length, 1, 'la key se resuelve en UN solo lugar (elevenKey), no en cada función');
  assert.match(lineas[0], /ELEVENLABS_API_KEY/);
});

test('la key de ElevenLabs no se siembra sola en el workspace de nadie', () => {
  // ⚠️ LA GUARDA QUE MÁS CUESTA VER. Borrar la fila de un cliente no dura: el
  // boot corre `migrarEnvACredenciales`, que RELLENA HUECOS desde el entorno, y
  // el `.env.local` apunta a la base de PRODUCCIÓN. O sea que un `npm run dev`
  // alcanzaba para que la cuenta de MaKo reapareciera dentro del ws1 disfrazada
  // de conexión propia de Mauricio.
  //
  // Medido el 02/09/2026: ws1 y ws4 tenían la key de la casa en su propia fila.
  const src = readFileSync(join(RAIZ, 'lib/credenciales.ts'), 'utf8');
  const lista = /NO_MIGRAR_A_WS[^=]*=\s*new Set\(\[([^\]]*)\]\)/.exec(src)?.[1] ?? '';
  assert.match(lista, /ELEVENLABS_API_KEY/, 'sin esto, el próximo boot re-siembra la key de la casa en el ws1');

  // Y el otro camino por el que volvía: «Datos de Mau» copia las credenciales del
  // ws1 al workspace destino. Pregunta a la MISMA lista y no a `soloPlataforma`,
  // que es un flag que se apaga justo cuando una credencial pasa a BYOK.
  const mau = sinComentarios(readFileSync(join(RAIZ, 'lib/datos-mau.ts'), 'utf8'));
  assert.match(mau, /esCredencialDeLaCasa\(campo\.env\)/, 'datos-mau vuelve a copiar la cuenta de la casa');
});
test('ElevenLabs se le ofrece al CLIENTE en los DOS catálogos', () => {
  // ⚠️ INVERTIDO el 02/09/2026, con el resto del cambio a BYOK. Antes fijaba
  // `soloPlataforma: true` en los dos.
  //
  // Los dos tienen que decir lo mismo, y no es simetría estética: son flags
  // distintos que hacen cosas distintas. El de `integraciones-catalogo` decide si
  // se DIBUJA la tarjeta; el de `metodo-catalogo` lo lee `servicioDelContexto` en
  // la ruta de credenciales, que es el choke point de guardar, verificar y
  // revelar. Con uno solo sacado, el cliente ve la tarjeta y al guardar recibe
  // «servicio inválido» — un mensaje que lo culpa a él por haber elegido bien.
  const tarjeta = DEFS.find((d) => d.key === 'elevenlabs');
  assert.ok(tarjeta, 'desapareció la tarjeta de ElevenLabs');
  assert.ok(!tarjeta.soloPlataforma, 'la tarjeta volvió a esconderse de los clientes');
  const ficha = fichaDe('elevenlabs');
  assert.ok(ficha, 'desapareció la ficha de ElevenLabs');
  assert.doesNotMatch(ficha, /soloPlataforma: true/, 'la ficha volvió a cerrarle la API al cliente');
});
test('y su tutorial le enseña a sacar SU key, con la trampa del plan gratis', () => {
  // ⚠️ TAMBIÉN INVERTIDO: este test PROHIBÍA la frase «tu propia cuenta de
  // ElevenLabs» porque bajo el modelo viejo era mentira. Con BYOK volvió a ser la
  // verdad, y lo que hay que fijar es lo que un cliente no puede adivinar solo.
  const texto = fichaDe('elevenlabs');
  assert.match(texto, /TU cuenta de ElevenLabs/i, 'el copy sigue hablando de la cuenta de la plataforma');

  // ⚠️ LO MÁS IMPORTANTE DEL TUTORIAL, y no es un permiso: el plan GRATIS de
  // ElevenLabs es de uso NO COMERCIAL. Una key en free tier produce audio que no
  // se puede poner en un anuncio — y eso no falla, sale bien. Es la única parte
  // que el cliente no puede descubrir usando el producto.
  assert.match(texto, /NO COMERCIAL/i, 'no avisa que el plan gratis no sirve para anuncios');

  // Y los dos permisos, que fallan en momentos distintos.
  assert.match(texto, /Speech to Speech/i, 'no nombra el permiso que hace falta para convertir');
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
