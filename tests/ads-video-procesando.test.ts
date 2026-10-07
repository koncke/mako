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
  const sub = cuerpo(SUBIDA, 'export async function subirCreativo(');
  assert.match(sub, /processing: j\.media_type === 'video' && !!j\.video_id && j\.processing === true/, 'el processing sale de la respuesta');
  assert.doesNotMatch(sub, /processing: false/);
  //   ROTO A PROPÓSITO (07/10/2026): con el return viejo (sin processing), el typecheck
  //   ya lo frena; con `processing: false` escrito a mano, pass 6 / fail 1 — éste.
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
    assert.match(src, /idem_key: k\.clave/, `${ruta}: manda la clave de idempotencia`);
  }
  assert.match(SUBIDA, /signal: AbortSignal\.timeout\(TOPE_POST_MS\)/);
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
  const rutas: Array<[string, string[]]> = [
    ['app/api/ads-manager/campaign-create/route.ts', ['createCampaign(spec)']],
    ['app/api/ads-manager/ad-add/route.ts', ['addAdToAdset(adsetId, creative, name)', 'addAdToAdset(adsetId, ads[i].creative']],
    ['app/api/ads-manager/adset-add/route.ts', ['addAdsetToCampaign(campaignId']],
  ];
  for (const [ruta, crean] of rutas) {
    const src = codigo(ruta);
    // Sólo adentro del POST: un helper definido arriba haría pasar el orden de gratis.
    const post = src.indexOf('export async function POST(');
    for (const crea of crean) {
      const iCrea = src.indexOf(crea);
      assert.ok(iCrea > post && post > 0, `${ruta}: no encontré «${crea}» en el POST`);
      const antes = src.slice(post, iCrea);
      const iVideos = Math.max(antes.lastIndexOf('videosSinProcesar('), antes.lastIndexOf('await sinProcesar('));
      const iRegistro = antes.lastIndexOf('abrirRegistro(');
      assert.ok(iVideos >= 0, `${ruta}: «${crea}» sin preguntar antes por los videos`);
      // Antes de abrir el registro: un 409 de videos no puede dejar una fila 'creando'
      // que haga esperar 6 minutos al reintento.
      assert.ok(iVideos < iRegistro, `${ruta}: los videos se preguntan antes de abrir el registro`);
    }
    assert.match(src, /\{ status: 409 \}/);
  }
  //   ROTO A PROPÓSITO (07/10/2026): sacando el chequeo de videos del modo simple de
  //   ad-add (`const motivo = null`), pass 6 / fail 1 — éste. Con el recorte desde el
  //   principio del archivo pasaba de gratis: el helper `sinProcesar` está arriba del POST.
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
  assert.match(src, /p\.startsWith\('nueva\/'\) && !p\.includes\('\.\.'\)/);
  //   ROTO A PROPÓSITO (07/10/2026): con `if (pathDeStaging(path))` (borrar sin mirar el
  //   estado: Meta todavía lo estaba bajando), pass 6 / fail 1 — éste.
});
