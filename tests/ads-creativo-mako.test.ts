// =============================================================================
// El video de MaKo en el Ads Manager: lo que NO puede pasar por el camino (tarea #797)
// =============================================================================
// Guards sobre el FUENTE (las rutas y los modales no se pueden importar en node:test).
// Cada uno fija una trampa medida antes de escribir el código:
//   · la url NUNCA viaja del navegador (el bucket es público y su ruta no lleva el
//     workspace: un admin del ws A publicaría el video del ws B);
//   · la rama nueva de creative-upload NO borra nada (el montado es la ÚNICA copia) ni
//     escribe una transcripción (el cron transcribe-ads se saltearía ese anuncio para
//     siempre);
//   · la miniatura es una data: hecha en el navegador o nada, nunca la url del .mp4
//     (viajaría como video_data.image_url y Meta rechaza el creativo);
//   · la lectura y la escritura en Meta resuelven el MISMO workspace, y la lectura corre
//     ADENTRO del contexto fijado, no sólo después de fijarlo;
//   · «no pude leer» no se contesta como lista vacía, ni con un catch que devuelva [];
//   · una toma que se volvió a filmar contesta 409 y no sube el clip nuevo, y en Nueva
//     campaña el panel vuelve a pedir la lista para que «vuelve a elegirla» tenga salida;
//   · y la capacidad tiene call site en los TRES modales (AGENTS.md: «Escribir la salida
//     no es ofrecerla»).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (AGENTS.md).
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const codigo = (p: string) => sinComentarios(leer(p));

/** Desde la firma hasta la primera línea que cierra en la columna 0. */
function cuerpo(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.indexOf('\n}\n', i);
  assert.ok(fin > i, `no encontré el cierre de «${firma}»`);
  return src.slice(i, fin);
}

const ABRE_CONTEXTO = 'return runWithWorkspace(ws, async () => {';

/**
 * El cuerpo del callback de `runWithWorkspace` (desde `desde`) hasta SU llave de cierre,
 * y todo el resto del archivo. Las llaves se cuentan sobre el código sin comentarios; las
 * de un `${…}` vienen de a pares.
 */
function contexto(src: string, desde: string): { dentro: string; fuera: string } {
  const i = src.indexOf(ABRE_CONTEXTO, src.indexOf(desde));
  assert.ok(i >= 0, `no encontré «${ABRE_CONTEXTO}» después de «${desde}»`);
  let prof = 0;
  let fin = -1;
  for (let k = i + ABRE_CONTEXTO.length - 1; k < src.length; k++) {
    if (src[k] === '{') prof++;
    else if (src[k] === '}' && --prof === 0) { fin = k; break; }
  }
  assert.ok(fin > i, 'no encontré el cierre del callback');
  assert.equal(src.slice(fin, fin + 3), '});', 'el callback cierra con «});»');
  return { dentro: src.slice(i + ABRE_CONTEXTO.length, fin), fuera: src.slice(0, i) + src.slice(fin) };
}

const RUTA = 'app/api/ads-manager/creative-upload/route.ts';
const MODALES = ['app/ads-manager/AgregarAnuncioModal.tsx', 'app/ads-manager/AgregarConjuntoModal.tsx', 'app/ads-manager/NuevaCampanaModal.tsx'];

test('creative-upload: la rama de MaKo recibe SÓLO `mako`, y va antes de exigir `path`', () => {
  const src = codigo(RUTA);
  const post = cuerpo(src, 'export async function POST(');
  const iRama = post.indexOf('if (body.mako !== undefined) return subirCreativoMako(body.mako);');
  const iPath = post.indexOf("const path = String(body.path ?? '');");
  assert.ok(iRama > 0, 'la rama de MaKo despacha sólo body.mako');
  assert.ok(iPath > iRama, 'la rama va ANTES del chequeo de path (la subida de archivos no se toca)');
  const mako = cuerpo(src, 'async function subirCreativoMako(');
  // La función no ve el body: no puede leer una url, un file_url ni un path del navegador.
  assert.doesNotMatch(mako, /\bbody\b|\breq\b|file_url|searchParams/, 'subirCreativoMako no lee nada del request más que su referencia');
  assert.match(mako, /const ref = leerRefCreativo\(crudo\);/);
  assert.match(mako, /c = await resolverCreativoMako\(ref\);/, 'la url sale de resolver la referencia en el server');
  assert.match(mako, /uploadAdVideoByUrl\(c\.url, /, 'a Meta va la url RESUELTA');
  assert.match(mako, /if \(!mismoOrigen\(c\.url, process\.env\.NEXT_PUBLIC_SUPABASE_URL\)\)/, 'el origen se mira con new URL antes de dársela a Meta');
  // Una toma que se volvió a filmar después de abrir la lista no sube el clip de hoy.
  const iCambio = mako.indexOf("if (c === 'cambio') return Response.json({ ok: false, error: 'Esa toma cambió. Vuelve a elegirla.' }, { status: 409 });");
  assert.ok(iCambio > 0, 'la toma que cambió es un 409');
  assert.ok(iCambio < mako.indexOf('uploadAdVideoByUrl('), 'y se decide ANTES de llamar a Meta');
});

test('creative-upload: la rama de MaKo no borra nada ni escribe una transcripción', () => {
  const mako = cuerpo(codigo(RUTA), 'async function subirCreativoMako(');
  for (const prohibido of [/\.remove\(/, /borrarStaging\(/, /barrerStagingViejo\(/, /transcribirYGuardar\(/, /guardarTranscripcion\(/, /creative_transcripts/, /after\(/]) {
    assert.doesNotMatch(mako, prohibido, `subirCreativoMako: ${prohibido} es del staging; acá el archivo es el original`);
  }
  // Y un 'error' de Meta es un fallo, no un ok (la rama de archivo lo devuelve 422 desde la #59).
  assert.match(mako, /if \(estado === 'error'\) \{\n\s*return Response\.json\(\{ ok: false,[^\n]*\{ status: 422 \}\);/);
  // La miniatura no es la url del video.
  assert.match(mako, /thumbnail_url: null/);
  assert.doesNotMatch(mako, /thumbnail_url: c\.url/);
});

test('el workspace que LEE es el que ESCRIBE: las dos rutas fijan wsDeAdsManager() y leen ADENTRO', () => {
  const src = codigo(RUTA);
  const mako = cuerpo(src, 'async function subirCreativoMako(');
  assert.match(mako, /const ws = await wsDeAdsManager\(\);[\s\S]*?return runWithWorkspace\(ws, async \(\) => \{/);
  // Fijar el contexto no alcanza: la lectura tiene que CORRER adentro. Una promesa armada
  // antes del wrapper y esperada adentro lee con el id -1 y deja a cred() en OWNER_WS.
  const sube = contexto(src, 'async function subirCreativoMako(');
  assert.match(sube.dentro, /c = await resolverCreativoMako\(ref\);/, 'la referencia se resuelve adentro del contexto');
  assert.match(sube.dentro, /uploadAdVideoByUrl\(c\.url, /, 'y se sube a Meta adentro del mismo');
  assert.doesNotMatch(sube.fuera, /resolverCreativoMako\(/, 'ninguna lectura del video de MaKo afuera del contexto');

  const lista = codigo('app/api/ads-manager/mis-creativos/route.ts');
  assert.match(lista, /const no = await guardAdsWs\(\); if \(no\) return no;/);
  assert.match(lista, /const ws = await wsDeAdsManager\(\);[\s\S]*?return runWithWorkspace\(ws, async \(\) => \{/);
  const lee = contexto(lista, 'export async function GET(');
  assert.match(lee.dentro, /await Promise\.all\(\[montadosDelWorkspace\(\), tomasDelWorkspace\(\)\]\)/, 'las dos lecturas, adentro del contexto');
  assert.doesNotMatch(lee.fuera, /montadosDelWorkspace\(|tomasDelWorkspace\(/, 'ninguna lectura afuera del contexto');
});

test('«no pude leer» no es «no tienes videos»', () => {
  const lista = codigo('app/api/ads-manager/mis-creativos/route.ts');
  assert.match(lista, /\{ ok: false, error: [^}]*\}, \{ status: 500 \}/, 'un fallo de lectura es un 500 con su mensaje');
  const fuentes = codigo('lib/creativo-mako-fuentes.ts');
  // Las dos lecturas de montaje_trabajos leen el error, y el historial va en estricto.
  assert.equal((fuentes.match(/if \(error\) throw new Error\(/g) ?? []).length, 2, 'las dos lecturas de montaje_trabajos tiran con su error');
  assert.equal((fuentes.match(/\.from\('montaje_trabajos'\)/g) ?? []).length, 2);
  assert.match(fuentes, /leerHistorialEstricto\(\)/);
  assert.doesNotMatch(fuentes, /\bleerHistorial\(\)/, 'leerHistorial traga el error y devuelve []');
  // Y nada acá lo vuelve a tragar: este módulo no tiene ningún catch legítimo. Un
  // `try { … } catch { return []; }` alrededor de la lectura estricta deja el literal de
  // arriba en pie y pinta «Todavía no hay videos» sobre un workspace que los tiene.
  assert.doesNotMatch(fuentes, /\bcatch\b|allSettled|\.then\(/, 'lib/creativo-mako-fuentes.ts no atrapa errores: los que no puede leer, los tira');
  // Y nunca el pedido entero (las urls de las tomas y el guion) ni el resultado entero:
  // las dos lecturas usan las mismas columnas, y ninguna es el jsonb pelado.
  assert.equal((fuentes.match(/\.select\(COLUMNAS_MONTAJE\)/g) ?? []).length, 2);
  const cols = /const COLUMNAS_MONTAJE = '([^']*)';/.exec(fuentes)?.[1] ?? '';
  assert.ok(cols.includes('url:resultado->>url'), 'la url sale del jsonb, sola');
  for (const c of cols.split(',').map((s) => s.trim())) assert.doesNotMatch(c, /^(pedido|resultado)$/, `columna entera: ${c}`);
});

test('la miniatura es una data: hecha en el navegador: la url del video sólo entra a makeThumbDeUrl', () => {
  for (const ruta of MODALES) {
    const src = codigo(ruta);
    const usos = [...src.matchAll(/\bmako\.url\b/g)];
    assert.ok(usos.length > 0, `${ruta}: no encontré el uso de la url del video`);
    for (const u of usos) {
      const antes = src.slice(Math.max(0, (u.index ?? 0) - 'makeThumbDeUrl(f.'.length), u.index);
      assert.equal(antes, 'makeThumbDeUrl(f.', `${ruta}: la url del video se usa fuera de makeThumbDeUrl`);
    }
    assert.doesNotMatch(src, /thumbnail_url: [^,}\n]*\.url\b/, `${ruta}: una url de video no va a thumbnail_url`);
  }
  const sub = codigo('app/ads-manager/creativeUpload.ts');
  const thumb = cuerpo(sub, 'export function makeThumbDeUrl(');
  assert.match(thumb, /resolve\(dt && dt\.startsWith\('data:'\) \? dt : null\)/, 'devuelve una data: o null');
  assert.match(thumb, /v\.crossOrigin = 'anonymous'/, 'sin crossOrigin el canvas queda tainted');
});

test('las tres puertas tienen call site: el componente, el elegir y la prop de CreativosPicker', () => {
  for (const ruta of MODALES) {
    const src = codigo(ruta);
    assert.match(src, /import \{ MisCreativosMako \} from '\.\/MisCreativosMako';/, `${ruta}: no importa MisCreativosMako`);
    assert.match(src, /<MisCreativosMako (key=\{\w+\} )?onElegir=/, `${ruta}: no dibuja MisCreativosMako`);
    assert.match(src, /subir\(\{ mako: c \}\)/, `${ruta}: elegir no pasa por la misma subida`);
    assert.match(src, /await usarCreativoMako\(f\.mako\.ref\)/, `${ruta}: no usa el video elegido`);
  }
  const nueva = codigo('app/ads-manager/NuevaCampanaModal.tsx');
  const montaje = nueva.slice(nueva.indexOf('<CreativosPicker '), nueva.indexOf('/>', nueva.indexOf('<CreativosPicker ')));
  assert.match(montaje, /onMako=\{\(c\) => subir\(\{ mako: c \}\)\}/, 'la prop está cableada en el montaje de CreativosPicker');
  const picker = cuerpo(nueva, 'function CreativosPicker(');
  assert.match(picker, /<MisCreativosMako [^>]*onElegir=\{onMako\} elegidos=\{makoElegidos\} \/>/);
  // El mismo video no entra dos veces a la bandeja (dos videos en la biblioteca de Meta).
  assert.match(cuerpo(nueva, 'export function NuevaCampanaModal('), /if \('mako' in f && tray\.some\(\(t\) => t\.mako_ref === f\.mako\.ref\)\) return;/);
});

test('Nueva campaña: un video de MaKo que falla vuelve a pedir la lista', () => {
  // Acá el panel queda abierto: sin volver a montarlo, la tarjeta sigue con la ref del
  // clip viejo y «Esa toma cambió. Vuelve a elegirla.» da el mismo 409 para siempre.
  const nueva = codigo('app/ads-manager/NuevaCampanaModal.tsx');
  const subir = nueva.slice(nueva.indexOf('async function subir('), nueva.indexOf('function seguirProcesando('));
  assert.ok(subir.length > 200 && subir.length < 6000, `el recorte de subir mide ${subir.length}`);
  const enCatch = subir.slice(subir.lastIndexOf('} catch (e) {'));
  assert.match(enCatch, /if \('mako' in f\) setVueltaMako\(\(n\) => n \+ 1\);/, 'el fallo de un video de MaKo sube la vuelta');
  const montaje = nueva.slice(nueva.indexOf('<CreativosPicker '), nueva.indexOf('/>', nueva.indexOf('<CreativosPicker ')));
  assert.match(montaje, /vueltaMako=\{vueltaMako\}/, 'la vuelta llega al picker');
  assert.match(cuerpo(nueva, 'function CreativosPicker('), /<MisCreativosMako key=\{vueltaMako\} /, 'y es la key del panel: lo vuelve a montar');
});

test("'use client' sólo importa TIPOS de lib/creativo-mako", () => {
  const dir = join(process.cwd(), 'app/ads-manager');
  for (const f of readdirSync(dir).filter((x) => /\.tsx?$/.test(x))) {
    const src = leer(`app/ads-manager/${f}`);
    if (!src.includes("'use client'")) continue;
    for (const m of src.matchAll(/^import ([^;]*) from '@\/lib\/creativo-mako';/gm)) {
      assert.match(m[1], /^type \{/, `app/ads-manager/${f}: importa un VALOR de lib/creativo-mako`);
    }
    assert.doesNotMatch(src, /from '@\/lib\/creativo-mako-fuentes'/, `app/ads-manager/${f}: importa el módulo del server`);
  }
});

test('Nueva campaña: el análisis de cada creativo se busca por SU miniatura, no por posición', () => {
  const nueva = codigo('app/ads-manager/NuevaCampanaModal.tsx');
  const de = nueva.slice(nueva.indexOf('function analisisDe('), nueva.indexOf('function promptDeRespuestas('));
  assert.match(de, /const k = conVer\.indexOf\(t\);/);
  const resp = nueva.slice(nueva.indexOf('function promptDeRespuestas('), nueva.indexOf('function promptExistente('));
  assert.match(resp, /const a = analisisDe\(t, an\);/, 'promptDeRespuestas usa analisisDe');
  assert.doesNotMatch(resp, /an\[i\]/, 'an[i] sobre usables() corre las descripciones al anuncio equivocado');
});

//   ROTO A PROPÓSITO (07/10/2026), de a una y restaurando de memoria; re-contadas en la
//   revisión con los 9 tests de ahora, cada una da pass 8 / fail 1 y el que cae es el que
//   la nombra:
//   · el POST pasándole el body ENTERO a subirCreativoMako → «recibe SÓLO `mako`»;
//   · un `after(() => borrarStaging(c.url))` en la rama de MaKo → «no borra nada»;
//   · sin runWithWorkspace en la rama de MaKo → «el workspace que LEE es el que ESCRIBE»;
//   · mis-creativos contestando `{ ok: true, montados: [], tomas: [] }` al fallar → «no
//     pude leer»;
//   · `thumbnail_url: f.mako.url` en AgregarConjuntoModal → «la miniatura es una data:»;
//   · sin `onMako=` en el montaje de CreativosPicker → «las tres puertas tienen call site»;
//   · `an[i]` de vuelta en promptDeRespuestas → «el análisis de cada creativo…».
//   Y las de la revisión, también pass 8 / fail 1 salvo donde se dice:
//   · ⚠️ la del revisor: mis-creativos armando `Promise.all([montados…(), tomas…()])` ANTES
//     del wrapper y esperándola adentro → «el workspace que LEE…». El guard viejo (que sólo
//     miraba el ORDEN de `wsDeAdsManager()` y el wrapper) la dejaba pasar: ese test, corrido
//     desde HEAD sobre la rotura, 1 pass / 0 fail;
//   · lo mismo en creative-upload (`const pedido = resolverCreativoMako(ref)` afuera) →
//     pass 7 / fail 2: «el workspace que LEE…» y «recibe SÓLO `mako`», que fija la línea;
//   · ⚠️ la del revisor: tomasDelWorkspace envuelto en `try { … } catch { return []; }` →
//     «no pude leer». El guard viejo (el literal y la cuenta de throws) también: 1 pass / 0 fail;
//   · creative-upload sin el 409 de la toma que cambió → «recibe SÓLO `mako`»;
//   · Nueva campaña sin `setVueltaMako` en el catch, y el panel sin `key={vueltaMako}` →
//     «un video de MaKo que falla vuelve a pedir la lista», las dos.
