// =============================================================================
// Un video no se da por listo hasta que Meta lo procesó (tarea #59)
// =============================================================================
// El bug medido el 25/09 y vivo hasta el 07/10: creative-upload devolvía `processing` y
// `video_status`, el tipo SubidoCreativo no los declaraba y los TRES modales escribían
// `processing: false` sin mirar. Un video que Meta tardaba en procesar entraba a la
// bandeja como listo, y el rechazo llegaba al crear el creativo, con la campaña y el
// conjunto ya creados. Son asserts sobre el FUENTE: los modales son 'use client' y las
// rutas no se pueden importar en node:test.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (AGENTS.md: un `/*` adentro de
// un `//` abre un bloque que se come el código del medio).
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const codigo = (p: string) => sinComentarios(leer(p));

const SUBIDA = codigo('app/ads-manager/creativeUpload.ts');
const MODALES = ['app/ads-manager/NuevaCampanaModal.tsx', 'app/ads-manager/AgregarConjuntoModal.tsx', 'app/ads-manager/AgregarAnuncioModal.tsx'];
const LIB = codigo('lib/meta-ads-create.ts');

/** El cuerpo de una función: desde su firma hasta la primera línea que cierra en la
 *  columna 0 (`}`), que en estos archivos es el cierre de la función. */
function cuerpo(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.indexOf('\n}\n', i);
  return src.slice(i, fin < 0 ? undefined : fin);
}

test('SubidoCreativo declara processing, y subirCreativo lo pasa desde el server', () => {
  assert.match(SUBIDA, /export type SubidoCreativo = \{[\s\S]*?\bprocessing: boolean;[\s\S]*?\bvideo_status:/);
  // Desde la #797 hay DOS puertas (un archivo y un video que MaKo ya generó) y una sola
  // lectura de la respuesta: subidoDeRespuesta. El processing se mira ahí, y las dos
  // puertas tienen que pasar por ella —una copia del return es lo que la #59 sacó—.
  const resp = cuerpo(SUBIDA, 'export function subidoDeRespuesta(');
  assert.match(resp, /processing: j\.media_type === 'video' && !!j\.video_id && j\.processing === true/, 'el processing sale de la respuesta');
  assert.doesNotMatch(resp, /processing: false/);
  assert.match(cuerpo(SUBIDA, 'async function procesarEnMeta('), /return subidoDeRespuesta\(j, pathRespaldo\);/);
  for (const puerta of ['export async function subirCreativo(', 'export async function usarCreativoMako(']) {
    assert.match(cuerpo(SUBIDA, puerta), /return procesarEnMeta\(/, `${puerta}: lee la respuesta por procesarEnMeta`);
  }
  //   ROTO A PROPÓSITO (07/10/2026): con el return viejo (sin processing), el typecheck
  //   ya lo frena; con `processing: false` escrito a mano, pass 6 / fail 1 — éste.
  //   Y tras la #797 (10 tests en el archivo), de a una, restaurando de memoria:
  //   `processing: false` en subidoDeRespuesta → pass 9 / fail 1 (éste); usarCreativoMako
  //   con su propio fetch+return en vez de procesarEnMeta → pass 9 / fail 1 (éste).
});

test('en los tres modales, lo que vuelve de subirCreativo pasa TAL CUAL, con la tarjeta en 100', () => {
  for (const ruta of MODALES) {
    const src = codigo(ruta);
    const i = src.indexOf('await subirCreativo(');
    assert.ok(i >= 0, `${ruta}: tiene que subir por creativeUpload.ts`);
    // Del regreso de la subida hasta que arranca (o se delega) la espera a Meta.
    const fin = src.search(/esperarVideoListo\(|seguirProcesando\(id/);
    const tramo = src.slice(i, fin > i ? fin : i + 1500);
    assert.doesNotMatch(tramo, /processing: false/, `${ruta}: un false a mano da por listo un video sin procesar`);
    assert.match(tramo, /processing: r\.processing/, `${ruta}: processing sale de lo que dijo Meta`);
    // Con progress en undefined la tarjeta dibuja «0%» mientras Meta procesa.
    assert.match(tramo, /progress: r\.processing \? 100 : undefined/, `${ruta}: la tarjeta queda en 100 mientras Meta procesa`);
  }
  //   ROTO A PROPÓSITO (07/10/2026), de a una, restaurando de memoria:
  //   · `processing: false, progress: undefined` en AgregarAnuncioModal → pass 6 / fail 1 (éste);
  //   · sólo `progress: undefined` en AgregarConjuntoModal → pass 6 / fail 1 (éste).
});

test('Nueva campaña ya no tiene su copia de la subida', () => {
  const src = codigo('app/ads-manager/NuevaCampanaModal.tsx');
  assert.doesNotMatch(src, /function putWithProgress\(/, 'la copia de putWithProgress vive en creativeUpload.ts');
  assert.doesNotMatch(src, /function makeThumb\(/);
  assert.doesNotMatch(src, /fetch\('\/api\/ads-manager\/creative-upload'/, 'el POST a creative-upload es de subirCreativo');
  // Un ítem que quedó procesando sin su video en Meta se descarta al abrir el borrador.
  assert.match(src, /\.filter\(\(t\) => !t\.processing \|\| !!t\.video_id\)/);
  //   ROTO A PROPÓSITO (07/10/2026): con `.filter(() => true)` en loadDraft, pass 6 / fail 1 — éste.
});

test('los publicar van con tope y sin r.json() pelado, y llevan la clave', () => {
  for (const ruta of MODALES) {
    const src = codigo(ruta);
    // Un fetch pelado a una ruta que publica era un `r.json()` sin catch y sin signal: un
    // 504 tiraba «Unexpected token» y el botón quedaba listo para crear OTRA campaña.
    assert.doesNotMatch(src, /fetch\('\/api\/ads-manager\/(campaign-create|ad-add|adset-add)'/, `${ruta}: publica sin tope`);
    assert.match(src, /postConTope\('\/api\/ads-manager\/(campaign-create|ad-add|adset-add)'/, `${ruta}: publica con postConTope`);
    assert.match(src, /idem_key: mandada\.clave/, `${ruta}: manda la clave de idempotencia`);
  }
  assert.match(SUBIDA, /signal: AbortSignal\.timeout\(TOPE_POST_MS\)/);
});

// La revisión de la #59: con la clave sacada de la firma sola, una edición después de una
// respuesta perdida acuñaba otra y el server publicaba dos veces; y en los dos modales chicos
// la clave vivía en un ref, así que cerrar y reabrir la perdía. Cada POST que publica arma su
// clave con la ABIERTA (claveAMandar(claveAbierta(destino), …)) y la anota ANTES de tirar el
// «sin respuesta»: si se anotara después, el throw se la saltearía.
test('la clave que quedó sin respuesta manda en los tres modales, y se anota antes del SIN_RESPUESTA', () => {
  for (const ruta of MODALES) {
    const src = codigo(ruta);
    assert.doesNotMatch(src, /claveParaPayload\(/, `${ruta}: la clave sale de claveAMandar, no de la firma sola`);
    const posts = [...src.matchAll(/postConTope\('\/api\/ads-manager\/(campaign-create|ad-add|adset-add)'/g)];
    assert.ok(posts.length > 0, `${ruta}: no encontré el POST que publica`);
    for (const m of posts) {
      const i = m.index ?? -1;
      const iClave = src.lastIndexOf('claveAMandar(', i);
      assert.ok(iClave >= 0, `${ruta}: la clave del POST no sale de claveAMandar`);
      assert.match(src.slice(iClave, i), /^claveAMandar\(claveAbierta\(destino\), /, `${ruta}: claveAMandar sin la clave abierta`);
      const iSin = src.indexOf('throw new Error(SIN_RESPUESTA)', i);
      assert.ok(iSin > i, `${ruta}: sin el SIN_RESPUESTA después del POST`);
      const despues = src.slice(i, iSin);
      assert.match(despues, /const t = trasRespuesta\(j, mandada, firma\);/, `${ruta}: la respuesta no pasa por trasRespuesta`);
      assert.match(despues, /anotarClaveAbierta\(destino, t\.abierta\)/, `${ruta}: la clave abierta se anota antes del throw`);
      // Una respuesta que habla del payload de ANTES no se pinta como el éxito de éste.
      const iOk = src.indexOf('if (!j.ok)', iSin);
      assert.ok(iOk > iSin, `${ruta}: sin el if (!j.ok) del POST`);
      assert.match(src.slice(iSin, iOk), /if \(t\.deAntes\)/, `${ruta}: «deAntes» se mira antes que el resultado`);
    }
  }
  //   ROTO A PROPÓSITO (07/10/2026), de a una, restaurando de memoria:
  //   · `claveAMandar(null, …)` en AgregarConjuntoModal → pass 9 / fail 1 (éste);
  //   · sin anotarClaveAbierta en el lote de NuevaCampanaModal → pass 9 / fail 1 (éste).
});

test('esperarVideoListo: «no pude leer» no es «Meta sigue procesando»', async () => {
  const { esperarVideoListo, motivoFinEspera } = await import('../app/ads-manager/creativeUpload');
  const original = globalThis.fetch;
  // Cada respuesta se usa una vez y la ÚLTIMA se repite hasta el tope.
  const con = async (respuestas: unknown[]) => {
    let i = 0;
    globalThis.fetch = (async () => {
      const r = respuestas[Math.min(i++, respuestas.length - 1)];
      if (r instanceof Error) throw r;
      return { json: async () => r } as unknown as Response;
    }) as typeof fetch;
    try { return await esperarVideoListo('123', null, { cadaMs: 1, topeMs: 40 }); }
    finally { globalThis.fetch = original; }
  };
  const processing = { ok: true, estado: 'processing' };
  assert.equal(await con([processing]), 'tope', 'Meta dijo processing hasta el final');
  assert.equal(await con([{ ok: false, error: 'no autenticado' }]), 'sin_lectura', 'un 401 del guard no es un veredicto');
  assert.equal(await con([{ ok: true, estado: null }]), 'sin_lectura', 'Meta no se pudo leer');
  assert.equal(await con([new Error('red')]), 'sin_lectura');
  assert.equal(await con([processing, { ok: false }]), 'sin_lectura', 'manda la ÚLTIMA lectura');
  assert.equal(await con([{ ok: false }, processing]), 'tope');
  assert.equal(await con([processing, { ok: true, estado: 'ready' }]), 'ready');
  assert.doesNotMatch(motivoFinEspera('sin_lectura', 'x.mp4') ?? '', /Súbelo de nuevo/, 'no se pide subir de nuevo lo que no se pudo leer');
  //   ROTO A PROPÓSITO (07/10/2026): con `return 'tope'` al final (lo de antes), pass 9 /
  //   fail 1 — éste.
});

test('en los tres modales, «no pude leer» deja la tarjeta y sigue preguntando', () => {
  const nueva = codigo('app/ads-manager/NuevaCampanaModal.tsx');
  const seguir = nueva.slice(nueva.indexOf('function seguirProcesando('), nueva.indexOf('function agregarGanador('));
  const iSin = seguir.indexOf("if (fin === 'sin_lectura') { setErr(sinLectura); seguirProcesando(id, videoId, path, nombre, CADA_MS_SIN_LECTURA); return; }");
  const iFuera = seguir.indexOf('setTray((t) => t.filter((x) => x.id !== id));');
  assert.ok(iSin > 0 && iFuera > iSin, 'NuevaCampanaModal: el «sin lectura» vuelve antes de sacar la tarjeta');
  for (const ruta of ['app/ads-manager/AgregarConjuntoModal.tsx', 'app/ads-manager/AgregarAnuncioModal.tsx']) {
    const src = codigo(ruta);
    const iLoop = src.indexOf("while (fin === 'sin_lectura' && !ctl.signal.aborted) {");
    // `nombre` y no `file.name` desde la #797: la misma espera sirve al video de MaKo.
    const iFin = src.indexOf('setErr(motivoFinEspera(fin, nombre)); setTray(null);');
    assert.ok(iLoop > 0 && iFin > iLoop, `${ruta}: el «sin lectura» se reintenta antes de sacar la tarjeta`);
    assert.match(src.slice(iLoop, iFin), /esperarVideoListo\(r\.video_id, r\.path, \{ signal: ctl\.signal, cadaMs: CADA_MS_SIN_LECTURA \}\)/);
  }
});

test('withVideoThumb NO tira (la previa se dibuja igual); el creativo de verdad SÍ exige la miniatura', () => {
  const thumb = cuerpo(LIB, 'async function withVideoThumb(');
  assert.doesNotMatch(thumb, /throw /, 'withVideoThumb la usa generatePreviews: si tira, la previa del paso de revisión se rompe');
  assert.match(cuerpo(LIB, 'export async function generatePreviews('), /withVideoThumb\(creative\)/);
  const estricta = cuerpo(LIB, 'async function conMiniaturaParaPublicar(');
  assert.match(estricta, /if \(faltaMiniatura\(out\)\) \{\n\s*throw new MetaWriteError\(/);
  // Y el creativo pasa por la estricta ANTES del POST a adcreatives.
  const crear = cuerpo(LIB, 'export async function createAdCreative(');
  const a = crear.indexOf('conMiniaturaParaPublicar(creative)');
  const b = crear.lastIndexOf('/adcreatives');
  assert.ok(a > 0 && a < b, 'la miniatura se exige antes de crear el creativo');
  //   ROTO A PROPÓSITO (07/10/2026): con `withVideoThumb(creative)` de vuelta en
  //   createAdCreative, pass 6 / fail 1 — éste; y con un `throw` en withVideoThumb (la
  //   previa rota), pass 6 / fail 1 — éste.
});

test('campaign-create, ad-add y adset-add preguntan por los videos ANTES de crear nada', () => {
  // [ruta, dónde empieza SU modo, qué crea]. ⚠️ El tramo arranca en el modo de CADA
  // creador, no en el POST (revisión de la #59): con el recorte desde el POST, el del lote
  // de ad-add incluía al modo simple, que está arriba, y sin el chequeo del lote el
  // `lastIndexOf` encontraba el del simple —antes del `abrirRegistro(` del lote— y daba
  // verde. Medido sobre una copia de HEAD (código y tests): borrar el chequeo del lote daba
  // pass 11 / fail 0 con este archivo y el del workspace.
  const casos: Array<[string, string, string]> = [
    ['app/api/ads-manager/campaign-create/route.ts', 'export async function POST(', 'createCampaign(spec)'],
    ['app/api/ads-manager/ad-add/route.ts', 'if (!Array.isArray(body.ads)) {', 'addAdToAdset(adsetId, creative, name)'],
    ['app/api/ads-manager/ad-add/route.ts', 'const ads = body.ads;', 'addAdToAdset(adsetId, ads[i].creative'],
    ['app/api/ads-manager/adset-add/route.ts', 'export async function POST(', 'addAdsetToCampaign(campaignId'],
  ];
  for (const [ruta, desde, crea] of casos) {
    const src = codigo(ruta);
    const ini = src.indexOf(desde);
    const iCrea = src.indexOf(crea, ini);
    assert.ok(ini > 0 && iCrea > ini, `${ruta}: no encontré «${crea}» después de «${desde}»`);
    const tramo = src.slice(ini, iCrea);
    const iVideos = Math.max(tramo.lastIndexOf('videosSinProcesar('), tramo.lastIndexOf('await sinProcesar('));
    const iRegistro = tramo.lastIndexOf('abrirRegistro(');
    assert.ok(iVideos >= 0, `${ruta}: «${crea}» sin preguntar antes por los videos`);
    assert.ok(iRegistro >= 0, `${ruta}: «${crea}» sin abrir su registro`);
    // Antes de abrir el registro: un 409 de videos no puede dejar una fila 'creando'
    // que haga esperar 6 minutos al reintento.
    assert.ok(iVideos < iRegistro, `${ruta}: los videos se preguntan antes de abrir el registro`);
    assert.match(src, /\{ status: 409 \}/);
  }
  //   ROTO A PROPÓSITO (07/10/2026): sacando el chequeo del modo simple de ad-add
  //   (`const motivo = null`), pass 9 / fail 1 — éste; y sacando el del LOTE —el que
  //   antes pasaba de gratis—, pass 13 / fail 1 con este archivo y el del workspace — éste.
});

test('creative-upload: error es 422, la espera es corta, y el staging se borra sólo con veredicto', () => {
  const src = codigo('app/api/ads-manager/creative-upload/route.ts');
  assert.match(src, /if \(estado === 'error'\) \{\n\s*return Response\.json\(\{ ok: false,[^\n]*\{ status: 422 \}\);/, "con 'error' el video no entra a la bandeja");
  assert.doesNotMatch(src, /timeoutMs: 150000/, 'la espera de 150 s dentro del POST es la que llevaba a los 504');
  assert.doesNotMatch(src, /Promise\.all\(\[\s*waitForVideoReady/, 'la transcripción no puede alargar la respuesta');
  // La transcripción no baja el archivo para descubrir que pesa de más.
  assert.match(src, /tamano != null && tamano <= MAX_TRANSCRIBIR \? bajarStaging\(/);
  // GET: borra sólo con 'ready' o 'error', y sólo un path del staging.
  const get = src.slice(src.indexOf('export async function GET('));
  assert.match(get, /if \(\(estado === 'ready' \|\| estado === 'error'\) && pathDeStaging\(path\)\)/);
  // El path que se acepta borrar vive en lib/ads-staging.ts (lo comparte con el barrido).
  assert.match(src, /const pathDeStaging = esPathDeStaging;/);
  assert.match(codigo('lib/ads-staging.ts'), /p\.startsWith\(`\$\{STAGING_CARPETA\}\/`\) && !p\.includes\('\.\.'\)/);
  //   ROTO A PROPÓSITO (07/10/2026): con `if (pathDeStaging(path))` (borrar sin mirar el
  //   estado: Meta todavía lo estaba bajando), pass 6 / fail 1 — éste.
});
