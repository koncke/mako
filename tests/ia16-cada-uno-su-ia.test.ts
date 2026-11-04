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
//   4. el buscador de conocimiento embebe con la IA DEL NEGOCIO: su OpenAI primero, su Gemini si es lo único (prueba la
//      otra cuenta si una rebota); sin ninguna (o con una copia de la de la plataforma) busca por PALABRAS, sin salir a la
//      red y sin «Conecta tu Gemini» (25/10/2026, el Cerebro; IA16 lo hacía sólo con su Gemini); el ws9 usa la de la
//      plataforma; una consulta se compara sólo contra vectores del MISMO modelo, y lo demás se encuentra por palabras.
//
// Probado rompiéndolo (22/10/2026 y 25/10/2026, una rotura por vez, restaurada): ver docs/hallazgos-ia.md («IA16 v2» y
// «El buscador de conocimiento sin Gemini»).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let cache: Record<string, any> | null = null;
function correr(): Record<string, any> {
  if (cache) return cache;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_ia16-hijo.ts', import.meta.url))], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180_000 });
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

test('4. el buscador: su OpenAI primero, su Gemini si es lo único; sin ninguna, por palabras (nunca «Conecta tu Gemini»)', () => {
  const { embed, POR_PALABRAS, busqueda } = correr();
  assert.equal(embed.ws15.r, 'text-embedding-3-small de 1536', 'con su OpenAI y su Gemini, no embebió con su OpenAI');
  assert.deepEqual(embed.ws15.claves, ['15-OPENAI_API_KEY-kk']);
  assert.equal(embed.ws13.r, 'gemini-embedding-001 de 768');
  // La primera que probó rebotó (429): tiene que haber probado la OTRA, las dos del ws13.
  assert.deepEqual([...embed.ws13.claves].sort(), ['13-GEMINI_API_KEY-kk', '13-GEMINI_API_KEY_2-'], 'no probó su otra cuenta tras el 429');
  assert.equal(POR_PALABRAS, 'Se busca por palabras hasta que conectes tu GPT.');
  assert.doesNotMatch(POR_PALABRAS, /gemini/i);
  // Sin ninguna IA (el ws12 tiene sólo Groq, que no embebe; el ws1, una copia de la de la plataforma): no sale a la red.
  for (const ws of ['ws14', 'ws1', 'ws12'] as const) {
    assert.equal(embed[ws].r, `tiró: ${POR_PALABRAS}`, `${ws}: embebió sin su IA`);
    assert.deepEqual(embed[ws].claves, [], `${ws}: salió a la red sin su IA (¿con la de la plataforma o la del entorno?)`);
  }
  assert.equal(embed.ws9.r, 'gemini-embedding-001 de 768');
  assert.deepEqual(embed.ws9.claves, ['AQ.PLATAFORMA-gemini'], 'lo interno de MaKo no usó la fila de la plataforma (¿la del entorno?)');
  // Con su Gemini: el método de la plataforma por vector (mismo modelo, otra cuenta); la vieja de OpenAI, no.
  assert.deepEqual(busqueda.ws13.r, [['del método', 1]], 'la consulta con su Gemini no encontró el método, o se comparó contra el vector viejo de OpenAI');
  // Con su OpenAI: lo suyo por vector, y el método (Gemini) por PALABRAS: puntaje 1 (las dos palabras, en el título). Un
  // coseno entre un vector de OpenAI y uno de Gemini no da 1, ni lo deja afuera: daría un puntaje plausible y equivocado.
  assert.deepEqual(busqueda.ws15.r, [['Mi oferta', 1], ['Objeciones de precio', 1]], 'con su OpenAI no encontró lo suyo por vector y el método por palabras');
  assert.deepEqual(busqueda.ws15.salio, ['api.openai.com'], 'la consulta con su OpenAI salió también a Google');
  // Sin ninguna IA: por palabras, sin red y sin fallo; una pregunta sin palabras que digan algo no trae todo.
  assert.deepEqual(busqueda.ws14, { r: [['Objeciones de precio', 1]], salio: [], fallo: null }, 'sin su IA el buscador no busca por palabras (o salió a la red, o lo contó como fallo)');
  assert.deepEqual(busqueda.ws14Hola.r, []);
  // Su IA no contesta: por palabras igual, y queda dicho (`falloDelRag`): «no tiene método» y «no pude» no son lo mismo.
  assert.deepEqual(busqueda.ws16.r, [['Objeciones de precio', 1]], 'con su Gemini caído el buscador quedó vacío');
  assert.match(String(busqueda.ws16.fallo), /^no pude embeber la consulta \(busqué por palabras\): embeddings: Internal error/);
});

test('6. el método de MaKo (en el ws1, un cliente sin su IA) se embebe con la de la plataforma; lo del ws1, por palabras', () => {
  const { metodoWs1, notaWs1, yaEmbebida, cambio, POR_PALABRAS } = correr();
  assert.deepEqual(metodoWs1, { estado: 'indexado', error: null, claves: ['AQ.PLATAFORMA-gemini'], largo: 768, modelo: 'gemini-embedding-001' },
    'el método no se embebió con la de la plataforma (o usó la del entorno, o no anotó el modelo)');
  // Sin su IA no es un error: queda `pendiente`, se busca por palabras y espera su IA.
  assert.deepEqual(notaWs1, { estado: 'pendiente', error: POR_PALABRAS, claves: [], largo: 0, modelo: null }, 'lo del ws1 salió a la red con una clave que no es suya, o quedó como error');
  // Re-indexar sin IA no borra el vector que todavía es de ESTE texto; el de un cuerpo que cambió, sí.
  assert.deepEqual(yaEmbebida, { estado: 'indexado', error: null, claves: [], largo: 768, modelo: null }, 're-indexar sin su IA le borró un vector que servía');
  assert.deepEqual(cambio, { estado: 'pendiente', error: POR_PALABRAS, claves: [], largo: 0, modelo: null }, 'un cuerpo que cambió se quedó con el vector del texto viejo');
});

test('7. al conectar su IA, lo que quedó sin vector o con el de otro modelo se embebe con SU cuenta, de a poco', () => {
  const { alConectar, alConectarOpenAI } = correr();
  // Del ws13 (sólo su Gemini): la vieja de OpenAI (1536) y la sin vector se embeben; la que ya estaba en Gemini, no.
  assert.equal(alConectar.n, 2);
  assert.ok(alConectar.claves.length > 0 && alConectar.claves.every((k: string) => k.startsWith('13-GEMINI_API_KEY')), `claves: ${alConectar.claves}`);
  assert.deepEqual(alConectar.filas, [['vieja', 768, 'gemini-embedding-001'], ['sin vector', 768, 'gemini-embedding-001'], ['ya en Gemini', 768, null]]);
  // Del ws15 (su OpenAI y su Gemini): todo a su OpenAI, de a `limite` por vez (1, después lo que queda, después nada).
  assert.deepEqual(alConectarOpenAI.tandas, [1, 2, 0], 'no re-embebe de a poco (o no termina)');
  // La que ya falló va al final aunque su id sea el menor: la primera tanda (de 1) es para la que está en Gemini.
  assert.deepEqual(Object.fromEntries(alConectarOpenAI.trasLaPrimera.map(([t, largo]: [string, number]) => [t, largo])), { 'Mi oferta': 1536, 'en Gemini': 1536, 'sin vector': 0, falló: 0 },
    'una fila que ya falló se quedó con la tanda de las que se pueden embeber');
  assert.deepEqual(alConectarOpenAI.claves, ['15-OPENAI_API_KEY-kk']);
  assert.deepEqual(alConectarOpenAI.filas, [['Mi oferta', 1536, 'text-embedding-3-small'], ['en Gemini', 1536, 'text-embedding-3-small'], ['sin vector', 1536, 'text-embedding-3-small'], ['falló', 1536, 'text-embedding-3-small']]);
  // Lo dispara guardar su OpenAI o su Gemini en /integraciones.
  const ruta = readFileSync(new URL('../app/api/integraciones/credencial/route.ts', import.meta.url), 'utf8');
  assert.match(ruta, /if \(guardadas > 0 && \(EMBEBEN as readonly string\[\]\)\.includes\(servicio\.key\)\) await reembeberAlConectarSuIA\(ctx\.ws\);/);
  const al = readFileSync(new URL('../lib/reembeber-al-conectar.ts', import.meta.url), 'utf8');
  assert.match(al, /export const EMBEBEN = \['openai', 'gemini'\] as const;/);
});

test('9. sin la migración de `embedding_modelo`, el buscador escribe y busca igual (el modelo sale del largo)', () => {
  const { sinColumna } = correr();
  assert.equal(sinColumna.n, 1, 'sin la columna no re-embebió');
  assert.deepEqual(sinColumna.fila, [1536, 'indexado', null], 'sin la columna la fila no quedó embebida');
  assert.equal(sinColumna.busqueda.fallo, null, `sin la columna el buscador falló: ${sinColumna.busqueda.fallo}`);
  assert.ok(sinColumna.busqueda.r.some(([t]: [string]) => t === 'sin columna') && sinColumna.busqueda.r.some(([t]: [string]) => t === 'Objeciones de precio'),
    `sin la columna no encontró lo suyo por vector o el método por palabras: ${JSON.stringify(sinColumna.busqueda.r)}`);
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
  // La ingesta de El Archivero salió del turno el 03/11/2026 (27a0e7565): la pregunta vive donde vive la ingesta.
  const turno = readFileSync(new URL('../lib/archivero-ingesta.ts', import.meta.url), 'utf8');
  assert.match(turno, /for \(const p of PROVS_SU_IA\) if \(\(await provsDe\(p as never\)\)\.length > 0\) return 'si';/);
  const dictado = readFileSync(new URL('../app/api/plan-dictado/route.ts', import.meta.url), 'utf8');
  assert.match(dictado, /PROVS_SU_IA\.map\(\(p\) => provsDe\(p as never\)\)/);
  assert.doesNotMatch(dictado, /negocio\.suIA && !\(await provsDe\('openai'\)\)\.length/);
  const negocio = readFileSync(new URL('../lib/ia-del-negocio.ts', import.meta.url), 'utf8');
  assert.match(negocio, /export const CLAVES_SU_IA = \['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'\] as const;/);
  assert.doesNotMatch(ai + readFileSync(new URL('../lib/embeddings.ts', import.meta.url), 'utf8'), /gemini-pago|plataforma_paga/, 'volvió la marca del Gemini pago: la IA de un cliente la paga el cliente');
});

// Lo vio Integraciones en producción el 23/10 (ws10, sin ninguna IA gratis): «Costo de MaKo» le dibujaba Gemini, Groq,
// Mistral y OpenRouter como «gratis», como si la plataforma se las prestara.
test('8. «Costo de MaKo» dibuja sólo las IA que el negocio TIENE; Mistral y OpenRouter ya no tienen caja', async () => {
  const c = correr().cajas;
  assert.deepEqual(c.ws14, [], 'a un negocio sin ninguna IA gratis se le dibujan cajas «gratis»');
  assert.deepEqual(c.ws12, ['groq'], 'su Groq (sólo notas de voz)');
  assert.deepEqual(c.ws13, ['gemini'], 'su Gemini');
  assert.deepEqual(c.ws9, ['gemini', 'groq'], 'lo de la plataforma, en la plataforma');
  assert.deepEqual(c.ws14Api, ['gemini', 'groq'], 'la API de MaKo (ver_cuotas_ia) dice también las que tienen 0 cuentas');
  const { LIMITES_PROVEEDOR } = await import('../lib/ia-cuotas-calculo');
  assert.deepEqual(Object.keys(LIMITES_PROVEEDOR).sort(), ['gemini', 'groq'], 'volvió un proveedor que IA8 sacó');
  const pagina = readFileSync(new URL('../app/integraciones/page.tsx', import.meta.url), 'utf8');
  assert.match(pagina, /const cuotas = await cuotasProveedores\(undefined, \{ soloCargadas: true \}\)/);
  const board = readFileSync(new URL('../app/integraciones/IntegracionesBoard.tsx', import.meta.url), 'utf8');
  const limite = board.slice(board.indexOf('const LIMITE_FREE'), board.indexOf('type Resumen'));
  assert.ok(limite.length > 50 && limite.length < 600, `el recorte de LIMITE_FREE mide ${limite.length}`);
  assert.doesNotMatch(limite, /cerebras|mistral|openrouter/i, 'el panel volvió a describir un proveedor sacado');
});
