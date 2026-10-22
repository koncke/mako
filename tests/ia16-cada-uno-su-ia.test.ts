// =============================================================================
// IA16 (22/10/2026): cada negocio paga su IA —también su Gemini— y Groq sólo escucha las notas de voz
// =============================================================================
// Martín, 22/10/2026, textual: «Cada usuario debe poder pagar su token, su propia IA de gemini» y «Groq sólo para las
// notas de voz»; de la OpenAI de MaKo sin crédito: «Tenemos Gemini que hace todo eso». Lo que fija este test, corriendo
// la capa real (tests/_ia16-hijo.ts):
//   1. Groq no contesta TEXTO —ni pedido a mano, ni por un pin de /modelos-ia— y sigue escuchando las notas de voz con la
//      clave del negocio; el audio de un anuncio (`sinGroq`) no va a Groq;
//   2. sin su IA, NADA va a la plataforma —con o sin datos de clientes, texto o audio—, y una copia de la clave de la
//      plataforma no cuenta como suya; la red queda sólo para lo interno de MaKo (el ws9);
//   3. con su Gemini, el texto y la nota de voz van a SU cuenta (las dos, en orden), nunca a la de la plataforma ni a la
//      del entorno de la PC;
//   4. el buscador de conocimiento embebe con SU Gemini (prueba la otra cuenta si una rebota); sin su Gemini (o con una
//      copia), tira «Conecta tu Gemini»; el ws9 usa la de la plataforma; y la consulta de un negocio encuentra el método
//      de la plataforma (mismo modelo, otra cuenta) pero no un vector viejo de OpenAI.
//
// Probado rompiéndolo (22/10/2026, una rotura por vez, restaurada): ver docs/hallazgos-ia.md («IA16 v2»).
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
type Salida = { host: string; camino: string; clave: string };
const claves = (s: Salida[]) => [...new Set(s.map((x) => x.clave))];

test('1. Groq no contesta texto y sigue escuchando las notas de voz (con la clave del negocio); el anuncio no va a Groq', () => {
  const { groq, erroresConGroqPedido } = correr();
  for (const caso of ['ws12Texto', 'ws12TextoPedidoAGroq', 'ws12ChatCheapGroq']) {
    assert.ok(!(groq[caso] as string[]).includes(GROQ), `${caso}: Groq contestó texto`);
  }
  const nota = groq.ws12NotaDeVoz as Salida[];
  assert.ok(nota.length > 0 && nota.every((x) => x.host === GROQ && x.camino.endsWith('/audio/transcriptions')), 'la nota de voz dejó de ir a su Groq');
  assert.deepEqual(claves(nota), ['12-GROQ_API_KEY-kkkk'], 'la nota de voz fue con otra clave que la del negocio');
  assert.deepEqual(groq.ws12Anuncio, [], 'el anuncio fue a Groq');
  // La cascada ni prueba un Groq pedido a mano (sus errores no lo nombran).
  assert.ok(!(erroresConGroqPedido as string[]).some((e) => /groq/i.test(e)), `la cascada probó a Groq: ${erroresConGroqPedido}`);
});

test('2. sin su IA, nada va a la plataforma (con o sin datos de clientes); la red es sólo lo interno de MaKo', () => {
  const { sinSuIA, redCliente, redPlataforma } = correr();
  for (const [caso, salio] of Object.entries(sinSuIA as Record<string, string[]>)) {
    assert.deepEqual(salio, [], `${caso}: salió a ${salio.join(', ')} sin una IA del negocio`);
  }
  assert.deepEqual(redCliente, { texto: [], audio: [] }, 'la red de la plataforma corre para un negocio');
  assert.deepEqual(redPlataforma, { texto: ['gemini'], audio: ['gemini', 'groq'] }, 'lo interno de MaKo perdió su red (o la de texto trae a Groq)');
});

test('3. con su Gemini, el texto y la nota de voz van a SU cuenta (las dos), nunca a la de la plataforma', () => {
  const { suGemini } = correr();
  for (const caso of ['texto', 'nota'] as const) {
    const s = suGemini[caso] as Salida[];
    assert.ok(s.length > 0 && s.every((x) => x.host === GEMINI), `${caso}: no fue a su Gemini (${s.map((x) => x.host)})`);
    assert.deepEqual(claves(s).sort(), ['13-GEMINI_API_KEY-kk', '13-GEMINI_API_KEY_2-'], `${caso}: claves ${claves(s)}`);
  }
});

test('4. el buscador: SU Gemini (y la otra cuenta si una rebota); sin la suya, «Conecta tu Gemini»; el ws9, la de la plataforma', () => {
  const { embed, SIN_SU_GEMINI, busqueda, busquedaSinSuGemini } = correr();
  assert.equal(embed.ws13.r, 'vector de 768');
  // La primera que probó rebotó (429): tiene que haber probado la OTRA, las dos del ws13.
  assert.deepEqual([...embed.ws13.claves].sort(), ['13-GEMINI_API_KEY-kk', '13-GEMINI_API_KEY_2-'], 'no probó su otra cuenta tras el 429');
  assert.equal(SIN_SU_GEMINI, 'Conecta tu Gemini en Integraciones para que MaKo busque en tu conocimiento');
  for (const ws of ['ws14', 'ws1'] as const) {
    assert.equal(embed[ws].r, `tiró: ${SIN_SU_GEMINI}`, `${ws}: embebió sin su Gemini`);
    assert.deepEqual(embed[ws].claves, [], `${ws}: salió a Google sin su Gemini (¿con la de la plataforma o la del entorno?)`);
  }
  assert.equal(embed.ws9.r, 'vector de 768');
  assert.deepEqual(embed.ws9.claves, ['AQ.PLATAFORMA-gemini'], 'lo interno de MaKo no usó la fila de la plataforma (¿la del entorno?)');
  assert.deepEqual(busqueda, ['del método'], 'la consulta con su Gemini no encontró el método de la plataforma, o se comparó contra el vector viejo de OpenAI');
  assert.deepEqual(busquedaSinSuGemini, []);
});

test('6. el método de MaKo (en el ws1, un cliente sin su Gemini) se embebe con la de la plataforma; lo del ws1, no', () => {
  const { metodoWs1, notaWs1, SIN_SU_GEMINI } = correr();
  assert.equal(metodoWs1.estado, 'indexado', `el método no se embebió: ${metodoWs1.error}`);
  assert.deepEqual(metodoWs1.claves, ['AQ.PLATAFORMA-gemini'], 'el método no usó la de la plataforma (o usó la del entorno)');
  assert.equal(notaWs1.estado, 'error');
  assert.equal(notaWs1.error, SIN_SU_GEMINI);
  assert.deepEqual(notaWs1.claves, [], 'lo del ws1 salió a Google con una clave que no es suya');
});

test('7. al conectar su Gemini, lo que quedó sin buscador se embebe con SU cuenta (y lo que ya está, no)', () => {
  const { alConectar } = correr();
  // Del ws13: la vieja de OpenAI (1536) y la sin vector se embeben; la que ya estaba en Gemini, no.
  assert.equal(alConectar.n, 2);
  assert.ok(alConectar.claves.length > 0 && alConectar.claves.every((k: string) => k.startsWith('13-GEMINI_API_KEY')), `claves: ${alConectar.claves}`);
  assert.deepEqual(Object.fromEntries(alConectar.largos), { vieja: 768, 'sin vector': 768, 'ya en Gemini': 768 });
  const ruta = readFileSync(new URL('../app/api/integraciones/credencial/route.ts', import.meta.url), 'utf8');
  assert.match(ruta, /if \(guardadas > 0 && servicio\.key === 'gemini'\) await reembeberAlConectarGemini\(ctx\.ws\);/);
});

test('5. las listas de texto no nombran a Groq; las de audio sí; y la marca del Gemini pago no vuelve', () => {
  const ai = readFileSync(new URL('../lib/ai-cheap.ts', import.meta.url), 'utf8');
  for (const lista of ['CASCADA_GRATIS', 'CASCADA_DOCS', 'CASCADA_TOOLS']) {
    const linea = new RegExp(`export const ${lista}: ProvName\\[\\] = \\[([^\\]]*)\\]`).exec(ai)?.[1] ?? '';
    assert.ok(linea && !linea.includes('groq'), `${lista} volvió a nombrar a Groq: [${linea}]`);
  }
  assert.match(ai, /export const CASCADA_STT: ProvName\[\] = \['gemini', 'groq', 'openai'\];/, 'las notas de voz se quedaron sin Groq');
  assert.match(ai, /export const PROVS_SOLO_AUDIO: readonly ProvName\[\] = \['groq'\];/);
  const catalogo = readFileSync(new URL('../lib/model-catalogo.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(catalogo, /def: GROQ\(/, 'una función de texto vuelve a Groq por default');
  const suIA = readFileSync(new URL('../lib/solo-su-ia.ts', import.meta.url), 'utf8');
  assert.match(suIA, /export const PROVS_SU_IA: readonly string\[\] = \['openai', 'gemini'\];/, 'su Gemini dejó de ser su IA, o pasó adelante de su GPT');
  // El Archivero del Ops Center y el dictado del Plan, con cualquiera de su IA (la revisión: con sólo su Gemini, «no»).
  const turno = readFileSync(new URL('../lib/mako-turno-app.ts', import.meta.url), 'utf8');
  assert.match(turno, /for \(const p of PROVS_SU_IA\) if \(\(await provsDe\(p as never\)\)\.length > 0\) return 'si';/);
  const dictado = readFileSync(new URL('../app/api/plan-dictado/route.ts', import.meta.url), 'utf8');
  assert.match(dictado, /PROVS_SU_IA\.map\(\(p\) => provsDe\(p as never\)\)/);
  assert.doesNotMatch(dictado, /negocio\.suIA && !\(await provsDe\('openai'\)\)\.length/);
  const negocio = readFileSync(new URL('../lib/ia-del-negocio.ts', import.meta.url), 'utf8');
  assert.match(negocio, /export const CLAVES_SU_IA = \['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'\] as const;/);
  assert.doesNotMatch(ai + readFileSync(new URL('../lib/embeddings.ts', import.meta.url), 'utf8'), /gemini-pago|plataforma_paga/, 'volvió la marca del Gemini pago: la IA de un cliente la paga el cliente');
});
