// =============================================================================
// El pipeline de los cursos (y de los anuncios) también pasa el detector de bucles
// =============================================================================
// AGENTS.md: «Todo camino que transcriba llama al detector (`lib/transcribe.ts`, el de los cursos,
// todavía no)». Desde el 13/10/2026 sí: los tres caminos de lib/transcribe.ts que le piden texto a
// un STT —la cascada de Whisper, Gemini inline y el whisper de los anuncios— pasan la salida por
// `salidaDegenerada` (lib/stt-degenerado.ts) y la cuentan como fallo, sin recortarla. Los umbrales
// se miden en tests/stt-degenerado.test.ts; acá sólo se fija el cableado.
//
// El último test cuenta: cada pedido a un STT del archivo tiene su llamada al detector. Un camino
// nuevo que transcriba sin pasarlo hace caer la cuenta.
//
// Probado rompiéndolo (13/10/2026), una rotura por vez, restaurando desde memoria. Base: 4 / 0.
//   · sin el chequeo en sttGemini ......................... 2 / 2
//   · sin el chequeo en la cascada de Whisper ............. 2 / 2
//   · sin el chequeo en transcribeAd ...................... 2 / 2
//   · el bucle de Whisper con `return` en vez de `continue`  3 / 1
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (r: string) => readFileSync(new URL(r, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
// IA7 (22/10/2026): lo de los cursos (la cascada de Whisper y Gemini inline) se mudó a lib/transcribe-plataforma.ts, y los
// anuncios escuchan con la IA del negocio (`transcribirAudio`, que tiene su propio detector) más el chequeo de `escuchar`.
// lib/transcribe.ts ya no le pide nada a un STT directo: el último test lo fija.
const SRC = sinComentarios(leer('../lib/transcribe-plataforma.ts'));
const ANUNCIOS = sinComentarios(leer('../lib/transcribe.ts'));

const entre = (desde: string, hasta: string) => {
  const i = SRC.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = SRC.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}» después de «${desde}»`);
  return SRC.slice(i, j);
};

test('Gemini: un bucle con STOP tira, y la cascada lo anota como fallo', () => {
  const cuerpo = entre('async function sttGemini(', 'export async function transcribeMediaBuffer(');
  assert.match(cuerpo, /const bucle = salidaDegenerada\(texto\);\s*if \(bucle\) \{[\s\S]*?throw new Error\(bucle\.motivo\)/);
});

test('Whisper (cascada de cursos): un bucle se anota y se prueba el proveedor que sigue', () => {
  const cuerpo = entre('export async function transcribeMediaBuffer(', 'const kGemini');
  assert.match(cuerpo, /salidaDegenerada\(tr\.text \?\? ''\);\s*if \(bucle\) \{\s*errores\.push\([^;]*bucle\.motivo[^;]*\);[\s\S]*?continue;\s*\}/);
});

test('los anuncios: un bucle es un error, no el guion', () => {
  const i = ANUNCIOS.indexOf('async function escuchar(');
  assert.ok(i >= 0, 'no encontré «async function escuchar(»');
  assert.match(ANUNCIOS.slice(i), /const bucle = salidaDegenerada\(texto\);\s*if \(bucle\) return \{ error: bucle\.motivo \};/);
  assert.match(ANUNCIOS, /return \{ \.\.\.base, tipo: 'video', status: 'error', error: r\.error \};/, 'el error de escuchar llega a la fila');
});

test('cada pedido a un STT de lib/transcribe-plataforma.ts tiene su detector, y lib/transcribe.ts no pide ninguno directo', () => {
  assert.equal((ANUNCIOS.match(/audio\/transcriptions|:generateContent|api\.openai\.com/g) || []).length, 0, 'lib/transcribe.ts le pide a un STT directo: tiene que ir por transcribirAudio (la IA del negocio)');
  const pedidos = (SRC.match(/audio\/transcriptions|:generateContent/g) || []).length;
  const detectores = (SRC.match(/salidaDegenerada\(/g) || []).length;
  assert.ok(pedidos >= 2, `esperaba al menos 2 pedidos a un STT, vi ${pedidos}`);
  assert.equal(detectores, pedidos, `${pedidos} pedidos a un STT y ${detectores} llamadas al detector`);
});
