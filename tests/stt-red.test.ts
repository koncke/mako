// =============================================================================
// Una nota de voz no se pierde porque Gemini esté saturado
// =============================================================================
// Medido el 07/10/2026 a las 22:01 UTC en el grupo de Código Inmobiliario (ws13): Gemini contestó
// dos veces seguidas «HTTP 503: This model is currently experiencing high demand», el negocio
// tiene esa sola key, y MaKo contestó «Me llegó tu audio pero no lo pude escuchar… Carga una
// segunda (son gratis)». Tres cosas lo dejaban así, y este test fija las tres arregladas:
//   1. el reintento era en el mismo segundo, contra el mismo modelo saturado;
//   2. el audio no tenía red de plataforma (el chat sí, desde el 25/8);
//   3. el texto se elegía con todos los errores y le pedía otra key que no ayuda.
//
// `lib/ai-cheap.ts` es `server-only`: estos guards miran el fuente. La parte que decide el texto
// (lib/fallo-ia-texto.ts) se EJECUTA en tests/fallo-ia-texto.test.ts.
//
// Probado rompiéndolo (07/10/2026), una rotura por vez y restaurando desde memoria, corriendo
// este archivo y tests/fallo-ia-texto.test.ts: un solo modelo de Gemini, el modelo que no llega a
// la llamada, cambiar de modelo con cualquier error, el reintento sin espera, sin red de
// plataforma, la red con Gemini primero, la red sin motivo y los errores mezclados (23 / 1 cada
// una); el doer eligiendo el texto con los errores de la agencia y el saturado que pide otra key
// (22 / 2 cada una). Restaurado: 24 / 0. Y verificado de punta a punta ese día: una transcripción
// real en el ws3 (sin keys de audio) salió por la red, «escuchó con la RED DE PLATAFORMA (groq)».
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { causaDelFallo } from '../lib/fallo-ia-texto';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (ver AGENTS.md).
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const AI = sinComentarios(leer('../lib/ai-cheap.ts'));
/** El cuerpo de una función: desde su firma hasta la próxima declaración de primer nivel. */
const bloque = (firma: string) => {
  const ini = AI.indexOf(firma);
  assert.ok(ini >= 0, `no encontré ${firma}`);
  const resto = AI.slice(ini + firma.length);
  const fin = resto.search(/\n(export |async function |function |const |type |class )/);
  return AI.slice(ini, ini + firma.length + (fin < 0 ? resto.length : fin));
};

test('Gemini saturado: se prueba OTRO modelo con la misma key, sólo si está saturado', () => {
  const modelos = bloque('function modelosSttGemini(');
  assert.match(modelos, /'gemini-flash-lite-latest'/, 'sin un segundo modelo, un Google saturado es una nota de voz perdida');
  const escuchar = bloque('async function escucharCon(');
  assert.match(escuchar, /for \(const modelo of modelosSttGemini\(\)\)/);
  assert.match(escuchar, /sttGemini\(p, base64, buf, mime, o, modelo\)/, 'el modelo elegido no le llega a la llamada');
  assert.match(escuchar, /if \(!esSaturacion\(msg\)\) return null;/,
    'un error que no es de saturación (key mala, audio grande) gasta los otros modelos en vano');
});

test('el reintento de Whisper espera antes de volver a pedir', () => {
  assert.match(bloque('async function escucharCon('), /if \(intento === 0 && esTransitorio\(msg\)\) \{ await esperar\(1500\); continue; \}/,
    'reintentar en el mismo segundo contra un «alta demanda» es preguntarle lo mismo al mismo servidor saturado');
});

test('si las keys del negocio no pudieron, escucha la RED DE PLATAFORMA, Groq primero', () => {
  const t = bloque('export async function transcribirAudio(');
  const iNegocio = t.indexOf('await provsDe(nombre)');
  const iRed = t.indexOf('provsGratisDePlataforma()');
  assert.ok(iNegocio > 0 && iRed > iNegocio, 'la red de la agencia tiene que ser el ÚLTIMO recurso, después de las keys del negocio');
  assert.match(t, /\[\.\.\.red\.filter\(\(r\) => r\.provider !== 'gemini'\), \.\.\.red\.filter\(\(r\) => r\.provider === 'gemini'\)\]/,
    'si la Gemini del cliente está saturada, la de la agencia también: Groq va primero');
  assert.match(t, /provDe\(r\.provider, r\.clave, wsSA\)/, 'la key de la red tiene que salir del workspace del super admin');
  assert.match(t, /motivo: `⚠ red de plataforma/, 'el respaldo tiene que verse en el Saldo de IA');
  assert.match(t, /if \(wsSA != null && wsActual !== wsSA\)/, 'el super admin repetiría sus propias keys');
});

test('los errores del negocio y los de la red viajan SEPARADOS', () => {
  assert.match(bloque('export async function transcribirAudio('), /throw new SttSinEscucha\(errores, erroresPlataforma\)/);
  const doer = sinComentarios(leer('../lib/mako-doer-in.ts'));
  assert.match(doer, /const delNegocio = e instanceof SttSinEscucha \? e\.errores : \[detalle\];/,
    'el texto que lee el cliente se volvería a elegir con los errores de nuestras keys');
});

test('el caso medido ya no le pide al cliente otra key', () => {
  const medido = [
    'gemini/gemini-flash-latest: HTTP 503: This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.',
    'gemini/gemini-flash-lite-latest: HTTP 503: This model is currently experiencing high demand.',
  ];
  assert.equal(causaDelFallo(medido, 1), 'proveedor_caido');
});
