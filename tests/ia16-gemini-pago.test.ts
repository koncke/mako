// =============================================================================
// IA16 (22/10/2026): Groq sólo escucha las notas de voz, y el Gemini PAGO de la plataforma es la base de quien no tiene IA
// =============================================================================
// Martín, 22/10/2026, textual: «¿Activo el pago por uso de Gemini?» → «Sí, sin tope»; «¿Dejamos Groq sólo para transcribir
// las notas de voz?» → «Groq sólo para las notas de voz»; y de la OpenAI de MaKo sin crédito: «Tenemos Gemini que hace todo
// eso». Lo que fija este test, corriendo la capa real (tests/_ia16-hijo.ts):
//   1. Groq no contesta TEXTO —ni pedido a mano, ni por un pin de /modelos-ia— y sigue escuchando las notas de voz;
//   2. el audio de un anuncio (`sinGroq`) no va a Groq;
//   3. con datos de clientes y SIN la marca del Gemini pago, la red de la plataforma no corre para texto, y para una nota de
//      voz sólo con Groq (que no entrena); CON la marca, también Gemini;
//   4. el embedding del buscador de conocimiento: sin la marca, tira (no al plan gratis); con la marca, la clave de la FILA
//      de la plataforma (no la del entorno), 768; y el buscador sólo compara vectores del mismo largo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let cache: Record<string, any> | null = null;
function correr(): Record<string, any> {
  if (cache) return cache;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_ia16-hijo.ts', import.meta.url))], { encoding: 'utf8', timeout: 180_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@IA16@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  cache = JSON.parse(linea.slice('@@IA16@@'.length));
  assert.equal(cache!.error, undefined, String(cache!.error));
  return cache!;
}
const GROQ = 'api.groq.com';
const GEMINI = 'generativelanguage.googleapis.com';

test('1. Groq no contesta texto (ni pedido a mano, ni con su modelo) y sigue escuchando las notas de voz', () => {
  const { sinMarca } = correr();
  for (const caso of ['ws12Texto', 'ws12TextoPedidoAGroq', 'ws12ChatCheapGroq', 'ws14TextoSinPII']) {
    assert.ok(!(sinMarca[caso] as string[]).includes(GROQ), `${caso}: Groq contestó texto`);
  }
  assert.ok((sinMarca.ws12NotaDeVoz as string[]).includes(GROQ), 'la nota de voz dejó de ir a su Groq');
  // Lo que antes era Groq va a Gemini (la red de la plataforma, sin datos de clientes).
  assert.ok((sinMarca.ws14TextoSinPII as string[]).includes(GEMINI), 'el texto sin datos de clientes dejó de ir al Gemini de la plataforma');
  // Cada capa sola: la cascada ni prueba un Groq pedido a mano, y la red trae Groq sólo para audio.
  const r = correr();
  assert.ok(!(r.erroresConGroqPedido as string[]).some((e) => /groq/i.test(e)), `la cascada probó a Groq: ${r.erroresConGroqPedido}`);
  assert.deepEqual(r.redTexto, ['gemini'], 'la red de texto de la plataforma trae a Groq');
  assert.deepEqual([...r.redAudio].sort(), ['gemini', 'groq'], 'la red de audio perdió a Groq');
});

test('2. el audio de un anuncio no va a Groq (ni el del negocio ni el de la red)', () => {
  const { sinMarca, conMarca } = correr();
  assert.deepEqual(sinMarca.ws12Anuncio, [], 'el anuncio fue a Groq');
  assert.ok(!(conMarca.ws14AnuncioConPII as string[]).includes(GROQ), 'el anuncio fue al Groq de la plataforma');
  assert.ok((conMarca.ws14AnuncioConPII as string[]).includes(GEMINI), 'con el Gemini pago, el anuncio se transcribe con Gemini');
});

test('3. con datos de clientes: sin la marca, ni texto a la red ni Gemini para el audio; con la marca, Gemini', () => {
  const { sinMarca, conMarca } = correr();
  assert.deepEqual(sinMarca.ws14TextoConPII, [], 'sin el Gemini pago, el texto con datos de clientes fue a la red');
  assert.deepEqual([...new Set(sinMarca.ws14NotaDeVozConPII as string[])], [GROQ], 'sin el Gemini pago, la nota de voz va sólo al Groq de la red (no entrena)');
  assert.ok((conMarca.ws14TextoConPII as string[]).includes(GEMINI), 'con el Gemini pago, el texto con datos de clientes usa la red');
  assert.ok(!(conMarca.ws14TextoConPII as string[]).includes(GROQ));
  assert.deepEqual([...new Set(conMarca.ws14NotaDeVozConPII as string[])], [GROQ, GEMINI], 'la nota de voz: Groq primero y después el Gemini pago');
});

test('4. el embedding: sin la marca tira; con la marca, la clave de la FILA de la plataforma y 768; el buscador no mezcla modelos', () => {
  const r = correr();
  assert.match(r.embedSinMarca, /^tiró: embeddings: el Gemini de la plataforma no está en el plan pago/);
  assert.equal(r.embedConMarca, 'vector de 768');
  assert.deepEqual(r.claveEmbed, ['AQ.PLATAFORMA-paga-p'], 'el embedding usó la clave del entorno (puede ser una gratis), no la de la fila de la plataforma');
  assert.deepEqual(r.busqueda, ['nueva'], 'una fila con el vector viejo de OpenAI se comparó contra uno de Gemini');
});

test('5. las listas de texto no nombran a Groq; las de audio sí', () => {
  const ai = readFileSync(new URL('../lib/ai-cheap.ts', import.meta.url), 'utf8');
  for (const lista of ['CASCADA_GRATIS', 'CASCADA_DOCS', 'CASCADA_TOOLS']) {
    const linea = new RegExp(`export const ${lista}: ProvName\\[\\] = \\[([^\\]]*)\\]`).exec(ai)?.[1] ?? '';
    assert.ok(linea && !linea.includes('groq'), `${lista} volvió a nombrar a Groq: [${linea}]`);
  }
  assert.match(ai, /export const CASCADA_STT: ProvName\[\] = \['gemini', 'groq', 'openai'\];/, 'las notas de voz se quedaron sin Groq');
  assert.match(ai, /export const PROVS_SOLO_AUDIO: readonly ProvName\[\] = \['groq'\];/);
  const catalogo = readFileSync(new URL('../lib/model-catalogo.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(catalogo, /def: GROQ\(/, 'una función de texto vuelve a Groq por default');
});
