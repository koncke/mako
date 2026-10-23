// =============================================================================
// Una foto mandada por la caja del Ops Center se ve en CUALQUIER dispositivo (23/10/2026)
// =============================================================================
// Hasta acá la foto se veía sólo en el navegador que la mandó (su miniatura en IndexedDB); en el teléfono salía su nombre.
// Martín, 18/10: «cuando envío imágenes por aquí o adjunto cosas también deberían aparecer en el Center», y con eso quedó
// decidido que las fotos del Ops Center SÍ quedan del lado del servidor (bucket privado, URL firmada, sólo puedeOperar).
// Lo que se fija:
//   1. de un texto firmado salen sólo las FOTOS, en su orden, con su `ref` y el nombre recortado como `nombresDeAdjuntos`;
//   2. el servidor guarda una miniatura sólo si es de una foto de ESE trabajo, chica y una foto por sus bytes;
//   3. el barrido del storage borra sólo las miniaturas vencidas, por su fecha;
//   4. la ruta pregunta puedeOperar antes de leer nada, no lee un cuerpo sin largo, guarda sólo por la función que mira el
//      trabajo, no firma lo vencido, no toma una falla del storage por «no tiene», barre también al leer, y la caché dura
//      lo que la URL;
//   5. las burbujas que se abren juntas van al servidor en UNA ida; lo que volvió COMPLETO se guarda mientras la URL
//      sirve, lo incompleto poco, y un fallo de red nada;
//   6. el que manda sube la miniatura REDIBUJADA (nunca el original, con su EXIF) de cada FOTO firmada, con el `ref` de su
//      original; si no se pudo redibujar, no sube nada;
//   7. el barrido de IndexedDB borra sólo las miniaturas sin burbuja, nunca un borrador de la caja;
//   8. el cableado: la cola dice qué adjuntos son fotos, la burbuja sabe cuántas espera, tiene la identidad de su mensaje,
//      y sin fotos no va al servidor;
//   9. la burbuja resta los nombres contando repeticiones: dos «image.png» con una sola foto a la vista dejan un renglón;
//  10. mientras falten fotos se vuelve a preguntar, cada vez más espaciado, sólo en los primeros minutos del mensaje.
//
// Probado rompiéndolo (23/10/2026, con la base en 0 fallos): ver la tabla al pie del archivo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAX_BYTES_MINIATURA, MINIATURA_VENCE_MS, fotosDeFirmado, miniaturasVencidas, nombresDeAdjuntos, problemaDeMiniatura,
} from '../lib/operaciones-reglas';
import { crearPedidorDeFotos, POR_PEDIDO } from '../app/admin/operaciones/fotos-remotas';

const leer = (r: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const REF_FOTO = '0f69b05d-1111-4111-8111-111111111111';
const REF_PDF = '0f69b05d-2222-4222-8222-222222222222';
const REF_OTRA = '0f69b05d-3333-4333-8333-333333333333';
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]);
const firmado = JSON.stringify({
  v: 1, texto: 'mira',
  adjuntos: [
    { ref: REF_PDF, nombre: 'presupuesto.pdf', mime: 'application/pdf', bytes: 9, sha256: 'a'.repeat(64) },
    { ref: REF_FOTO, nombre: `captura-${'x'.repeat(200)}.png`, mime: 'image/png', bytes: 12, sha256: 'b'.repeat(64) },
    { ref: 'no-es-un-uuid', nombre: 'rara.jpg', mime: 'image/jpeg', bytes: 12, sha256: 'c'.repeat(64) },
    { ref: REF_OTRA, nombre: 'otra.webp', mime: 'image/webp', bytes: 12, sha256: 'd'.repeat(64) },
  ],
});

test('1. de un texto firmado salen sólo las fotos, en su orden, con su ref y el nombre como lo dibuja la burbuja', () => {
  const fotos = fotosDeFirmado(firmado);
  assert.deepEqual(fotos.map((f) => f.ref), [REF_FOTO, REF_OTRA], 'ni el PDF ni un ref que no es un uuid');
  const nombres = nombresDeAdjuntos(firmado);
  assert.ok(fotos.every((f) => nombres.includes(f.nombre)), 'la burbuja separa fotos de documentos comparando nombres: se recortan igual');
  assert.deepEqual(fotosDeFirmado('no es json'), []);
  assert.deepEqual(fotosDeFirmado(null), []);
  assert.deepEqual(fotosDeFirmado(JSON.stringify({ texto: 'sin adjuntos' })), []);
});

test('2. una miniatura se guarda sólo si es de una foto de ESE trabajo, chica, y una foto por sus bytes', () => {
  const fotos = fotosDeFirmado(firmado);
  assert.equal(problemaDeMiniatura(JPEG, fotos, REF_FOTO), null);
  assert.ok(problemaDeMiniatura(JPEG, fotos, REF_PDF), 'el ref de un PDF no es una foto');
  assert.ok(problemaDeMiniatura(JPEG, fotos, '0f69b05d-9999-4999-8999-999999999999'), 'un ref de otro trabajo no entra');
  assert.ok(problemaDeMiniatura(PDF, fotos, REF_FOTO), 'los bytes de un PDF no son una foto');
  const grande = new Uint8Array(MAX_BYTES_MINIATURA + 1);
  grande.set(JPEG);
  assert.ok(problemaDeMiniatura(grande, fotos, REF_FOTO), 'una miniatura no pesa más que el tope');
  assert.ok(problemaDeMiniatura(new Uint8Array(0), fotos, REF_FOTO), 'vacía no');
});

test('3. el barrido del storage borra sólo lo vencido, por su fecha', () => {
  const ahora = Date.parse('2026-10-23T12:00:00Z');
  const hace = (ms: number) => new Date(ahora - ms).toISOString();
  const vencidas = miniaturasVencidas([
    { name: REF_FOTO, created_at: hace(MINIATURA_VENCE_MS + 60_000) },
    { name: REF_OTRA, created_at: hace(60_000) },
    { name: REF_PDF, created_at: null },
    { name: '.emptyFolderPlaceholder', created_at: hace(MINIATURA_VENCE_MS * 2) },
  ], ahora);
  assert.deepEqual(vencidas, [REF_FOTO], 'la nueva, la sin fecha y lo que no es una miniatura se quedan');
});

test('4. la ruta: la guarda antes que todo, un cuerpo sin largo no se lee, y lo del storage dice la verdad', () => {
  const ruta = sinComentarios(leer('app/api/operaciones/adjuntos/route.ts'));
  for (const verbo of ['GET', 'POST']) {
    const cuerpo = ruta.slice(ruta.indexOf(`export async function ${verbo}(`));
    const guarda = cuerpo.indexOf('puedeOperar(admin');
    const lee = cuerpo.search(/searchParams|req\.(arrayBuffer|formData|json)\(/);
    assert.ok(guarda > 0 && lee > guarda, `${verbo}: la guarda va antes de leer el pedido`);
  }
  const post = ruta.slice(ruta.indexOf('export async function POST('));
  const miniatura = post.slice(post.indexOf("if (busca.has('miniatura'))"), post.indexOf('req.arrayBuffer()'));
  assert.match(miniatura, /Number\(req\.headers\.get\('content-length'\) \?\? NaN\)/, 'sin Content-Length el largo no vale 0');
  assert.match(miniatura, /if \(!\(largo > 0 && largo <= MAX_BYTES_MINIATURA\)\) return/, 'un largo que no vale no se lee');
  assert.match(ruta, /guardarMiniaturaEnviada\(busca\.get\('miniatura'\)/, 'la miniatura entra por la función que mira el trabajo');
  const get = ruta.slice(ruta.indexOf('export async function GET('), ruta.indexOf('export async function POST('));
  assert.match(get, /after\(\(\) => barrerSiToca\(\)\)/, 'leer también barre: sin fotos nuevas, las vencidas se van igual');

  const lib = sinComentarios(leer('lib/operaciones-adjuntos.ts'));
  const guardar = lib.slice(lib.indexOf('export async function guardarMiniaturaEnviada('), lib.indexOf('export async function fotosEnviadasDe('));
  const mira = guardar.indexOf('problemaDeMiniatura(');
  const sube = guardar.indexOf('.upload(');
  assert.ok(guardar.indexOf('fotosDelTrabajo(') >= 0 && mira > 0 && sube > mira, 'primero el trabajo y la miniatura, después el storage');
  assert.match(guardar, /'cache-control': 'private, max-age=600'/, 'la caché dura lo que la URL, y sólo en el navegador');
  const firmar = lib.slice(lib.indexOf('export async function fotosEnviadasDe('), lib.indexOf('export async function barrerMiniaturasViejas('));
  assert.match(firmar, /\.gte\('created_at', new Date\(ahora - MINIATURA_VENCE_MS\)\.toISOString\(\)\)/, 'lo vencido no se firma aunque el barrido no haya pasado');
  assert.match(firmar, /if \(noFirmo \|\| !firmadas\) throw/, 'una falla del storage no es «no tiene foto»');
  assert.doesNotMatch(firmar, /createSignedUrls\([^)]*\)[^;]*\.catch\(/, 'sin un catch que convierta la falla en vacío');
});

test('5. las burbujas que se abren juntas van al servidor en una ida, y se guarda sólo lo completo', async () => {
  let t = 1_000;
  const idas: string[][] = [];
  let falla = false;
  const pedidor = crearPedidorDeFotos(async (ids) => {
    idas.push(ids);
    if (falla) return null;
    return Object.fromEntries(ids.filter((id) => id.startsWith('con')).map((id) => [id, [{ url: `https://x/${id}`, nombre: `${id}.png` }]]));
  }, { esperaMs: 1, vigenciaMs: 5_000, vacioMs: 500, ahora: () => t });
  const [a, b, c, d] = await Promise.all([pedidor.pedir('con-1', 1), pedidor.pedir('con-2', 1), pedidor.pedir('sin-1', 1), pedidor.pedir('con-a-medias', 2)]);
  assert.equal(idas.length, 1, 'una sola ida para las cuatro');
  assert.deepEqual(idas[0], ['con-1', 'con-2', 'sin-1', 'con-a-medias']);
  assert.equal(a[0]?.url, 'https://x/con-1');
  assert.equal(b.length, 1);
  assert.deepEqual(c, []);
  assert.equal(d.length, 1, 'vuelve lo que hay');
  assert.ok(pedidor.yaSabidas('con-1'), 'lo completo se guarda');
  t += 600;
  assert.equal(pedidor.yaSabidas('sin-1'), null, 'un «no tiene» se cree poco: la miniatura puede estar subiendo');
  assert.equal(pedidor.yaSabidas('con-a-medias'), null, '1 de 2 se cree poco: la segunda puede estar subiendo');
  assert.ok(pedidor.yaSabidas('con-1'), 'lo completo sigue');
  t += 5_000;
  assert.equal(pedidor.yaSabidas('con-1'), null, 'pasada la vigencia, la URL ya no sirve');
  falla = true;
  assert.deepEqual(await pedidor.pedir('con-3', 1), []);
  assert.equal(pedidor.yaSabidas('con-3'), null, 'un fallo de red no se guarda');
  idas.length = 0;
  falla = false;
  await Promise.all(Array.from({ length: POR_PEDIDO + 5 }, (_, i) => pedidor.pedir(`otra-${i}`)));
  assert.deepEqual(idas.map((x) => x.length), [POR_PEDIDO, 5], 'más de las que entran en una ida se parten');
});

// El navegador, de mentira: createImageBitmap y un lienzo cuyo toBlob devuelve un JPEG DISTINTO del original.
const MINI = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x4d, 0x49, 0x4e, 0x49]);
type Subida = { url: string; tipo: string | null; cuerpo: Uint8Array };
async function conNavegador(redibuja: boolean, hacer: (subidas: Subida[]) => Promise<void>) {
  const g = globalThis as Record<string, unknown>;
  const antes = { fetch: g.fetch, crear: URL.createObjectURL, bitmap: g.createImageBitmap, document: g.document };
  const subidas: Subida[] = [];
  g.fetch = async (url: string, init?: { headers?: Record<string, string>; body?: Blob }) => {
    subidas.push({ url: String(url), tipo: init?.headers?.['content-type'] ?? null, cuerpo: new Uint8Array(init?.body ? await init.body.arrayBuffer() : new ArrayBuffer(0)) });
    return new Response('{"ok":true}', { status: 200 });
  };
  URL.createObjectURL = () => 'blob:x';
  g.createImageBitmap = async () => { if (!redibuja) throw new Error('no se puede decodificar'); return { width: 1280, height: 960, close() {} }; };
  g.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }), toBlob: (ok: (b: Blob) => void, tipo: string) => ok(new Blob([MINI], { type: tipo })) }) };
  try { await hacer(subidas); } finally {
    g.fetch = antes.fetch; URL.createObjectURL = antes.crear; g.createImageBitmap = antes.bitmap; g.document = antes.document;
  }
}
const esperarSubidas = async (subidas: unknown[], n: number) => {
  for (let i = 0; i < 100 && subidas.length < n; i += 1) await new Promise((ok) => setTimeout(ok, 5));
  await new Promise((ok) => setTimeout(ok, 20));
};
const sub = (ref: string, f: File, mime: string, bytes = f.size) => ({ ref, nombre: f.name, mime: mime as 'image/jpeg', bytes, sha256: 'e'.repeat(64) });

test('6. el que manda sube la miniatura REDIBUJADA de cada foto firmada, con el ref de su original; si no se pudo, nada', async () => {
  const { recordarEnviadas, fotosYaLeidas } = await import('../app/admin/operaciones/fotos-enviadas');
  await conNavegador(true, async (subidas) => {
    const foto = new File([JPEG], 'captura.jpg ', { type: 'image/jpeg' });
    const sinTipo = new File([JPEG, JPEG], 'de-android.jpg', { type: '' });
    const pdf = new File([PDF], 'presupuesto.pdf', { type: 'application/pdf' });
    const otra = new File([JPEG, JPEG, JPEG], 'otra.jpg', { type: 'image/jpeg' });
    const ID = '7a7a7a7a-1111-4111-8111-111111111111';
    // El PDF no es foto; la del selector de Android sin tipo SÍ (lo dice el trabajo firmado); la última llegó con otro
    // tamaño (no es la misma): no sube con un ref que no es el suyo. La primera se firmó con su nombre saneado (sin el
    // espacio del final): la burbuja compara con ése.
    recordarEnviadas(ID, [pdf, foto, sinTipo, otra], [
      sub(REF_PDF, pdf, 'application/pdf'), { ...sub(REF_FOTO, foto, 'image/jpeg'), nombre: 'captura.jpg' }, sub(REF_OTRA, sinTipo, 'image/jpeg'), sub('0f69b05d-4444-4444-8444-444444444444', otra, 'image/jpeg', 1),
    ]);
    assert.deepEqual(fotosYaLeidas(ID)?.map((f) => f.nombre), ['captura.jpg', 'de-android.jpg'], 'se ven en el acto, sólo las fotos, con el nombre FIRMADO');
    await esperarSubidas(subidas, 2);
    assert.deepEqual(subidas.map((s) => s.url), [
      `/api/operaciones/adjuntos?miniatura=${ID}&ref=${REF_FOTO}`,
      `/api/operaciones/adjuntos?miniatura=${ID}&ref=${REF_OTRA}`,
    ], 'una subida por foto, con el ref de SU original');
    for (const s of subidas) {
      assert.equal(s.tipo, 'image/jpeg');
      assert.deepEqual([...s.cuerpo], [...MINI], 'sube la miniatura redibujada, nunca los bytes del original');
    }
  });
  await conNavegador(false, async (subidas) => {
    const foto = new File([JPEG], 'rara.jpg', { type: 'image/jpeg' });
    recordarEnviadas('7a7a7a7a-2222-4222-8222-222222222222', [foto], [sub(REF_FOTO, foto, 'image/jpeg')]);
    await esperarSubidas(subidas, 1);
    assert.equal(subidas.length, 0, 'si no se pudo redibujar, no sube el original (con su EXIF)');
  });
});

test('7. el barrido de IndexedDB borra sólo las miniaturas sin burbuja y viejas, nunca un borrador de la caja', async () => {
  const { enviadasParaBorrar, copiaVieja, COPIA_NUEVA_MS } = await import('../app/admin/operaciones/fotos-enviadas');
  const borrar = enviadasParaBorrar(['enviado:viejo', 'enviado:vigente', 'local_11111111-1111-4111-8111-111111111111', 'nombre:cerebro'], new Set(['vigente']));
  assert.deepEqual(borrar, ['enviado:viejo']);
  const ahora = Date.parse('2026-10-23T12:00:00Z');
  assert.equal(copiaVieja([{ lastModified: ahora - COPIA_NUEVA_MS - 1 }], ahora), true);
  assert.equal(copiaVieja([{ lastModified: ahora - COPIA_NUEVA_MS - 1 }, { lastModified: ahora - 60_000 }], ahora), false, 'una copia de la última hora pudo escribirla otra pestaña');
  const motor = sinComentarios(leer('app/admin/operaciones/fotos-enviadas.ts'));
  assert.match(motor, /if \(barrida \|\| !vigentes\.length\) return;/, 'con la cola vacía (una lectura que falló) no barre');
  assert.match(motor, /new Set\(\[\.\.\.vigentes, \.\.\.leidas\.keys\(\)\]\)/, 'lo recién mandado no se barre aunque la cola no lo traiga');
  assert.match(motor, /if \(copiaVieja\(await leerAdjuntosGuardados\(d\), ahora\)\) await guardarAdjuntos\(d, \[\]\)/, 'sólo se borra una copia vieja');
});

test('8. el cableado: la cola dice qué son fotos, la burbuja sabe cuántas espera y es de SU mensaje, y sin fotos no pregunta', async () => {
  assert.match(sinComentarios(leer('lib/operaciones.ts')), /fotosDeFirmado\(firmado as string \| null\)/, 'listarPedidos saca las fotos del texto firmado');
  assert.match(leer('app/admin/operaciones/useCentro.ts'), /\.\.\.\(p\.fotos\?\.length \? \{ fotos: p\.fotos \} : \{\}\)/, 'el trabajo de la conversación las lleva');
  assert.match(leer('app/admin/operaciones/Hilo.tsx'), /<AdjuntosEnBurbuja key=\{w\.id\} id=\{w\.id\} nombres=\{w\.adjuntos\} fotos=\{w\.fotos\} creado=\{w\.created_at\} \/>/, 'la burbuja es de su mensaje, recibe sus fotos y cuándo salió');
  const burbuja = sinComentarios(leer('app/admin/operaciones/FotosEnviadas.tsx'));
  assert.match(burbuja, /const esperadas = nombresDeFotos\?\.length \?\? 0;/);
  assert.match(burbuja, /leerFotosEnviadas\(id, esperadas\)/);
  assert.match(burbuja, /if \(tengo >= esperadas\) return;/, 'con todas, no pregunta más');
  assert.match(burbuja, /const espera = proximoIntento\(intento, desde, Date\.now\(\)\);/, 'mientras falte alguna, vuelve a preguntar con su espera');
  assert.match(burbuja, /if \(espera != null\) reloj = setTimeout\(mirar, espera\);/);
  assert.match(leer('app/admin/operaciones/useCentro.ts'), /recordarEnviadas\(r\.id, archivos\.map\(\(a\) => a\.file\), subidos\)/, 'mandar pasa los refs');
  // Y de verdad: sin fotos esperadas, ninguna ida al servidor.
  const g = globalThis as Record<string, unknown>;
  const antes = g.fetch;
  let idas = 0;
  g.fetch = async () => { idas += 1; return new Response('{"ok":true,"fotos":{}}'); };
  try {
    const { leerFotosEnviadas } = await import('../app/admin/operaciones/fotos-enviadas');
    assert.deepEqual(await leerFotosEnviadas('7a7a7a7a-3333-4333-8333-333333333333', 0), []);
    await new Promise((ok) => setTimeout(ok, 80));
    assert.equal(idas, 0, 'una burbuja con un PDF no va al servidor');
  } finally { g.fetch = antes; }
});

test('9. la burbuja resta los nombres contando repeticiones', async () => {
  const { nombresSinFoto } = await import('../app/admin/operaciones/fotos-enviadas');
  assert.deepEqual(nombresSinFoto(['image.png', 'image.png', 'plan.pdf'], [{ nombre: 'image.png' }]), ['image.png', 'plan.pdf'], 'la segunda captura sigue en la lista');
  assert.deepEqual(nombresSinFoto(['a.png', 'b.png'], [{ nombre: 'a.png' }, { nombre: 'b.png' }]), []);
  assert.deepEqual(nombresSinFoto(['a.png'], []), ['a.png']);
});

test('10. mientras falten fotos se vuelve a preguntar, cada vez más espaciado, sólo en los primeros minutos del mensaje', async () => {
  const { proximoIntento, PRIMER_REINTENTO_MS, TOPE_REINTENTOS_MS } = await import('../app/admin/operaciones/fotos-enviadas');
  const creado = Date.parse('2026-10-23T12:00:00Z');
  assert.equal(proximoIntento(0, creado, creado + 1_000), PRIMER_REINTENTO_MS, 'la primera vez siempre');
  assert.equal(proximoIntento(0, NaN, creado), PRIMER_REINTENTO_MS, 'sin fecha, igual una vez');
  assert.equal(proximoIntento(1, creado, creado + 20_000), PRIMER_REINTENTO_MS * 2);
  assert.equal(proximoIntento(2, creado, creado + 45_000), PRIMER_REINTENTO_MS * 4, 'cada vez el doble');
  assert.equal(proximoIntento(3, creado, creado + TOPE_REINTENTOS_MS + 1), null, 'un mensaje de hace más del tope no se queda preguntando');
  assert.equal(proximoIntento(1, NaN, creado), null, 'sin fecha, una sola vez');
});

// Probado rompiéndolo (23/10/2026, con la base en 0 fallos), cada rotura con el test que la caza:
//   · `fotosDeFirmado` sin mirar el mime (toma el PDF)                         → 1 y 2;
//   · `problemaDeMiniatura` sin comparar el ref con las fotos del trabajo       → 2;
//   · `miniaturasVencidas` sin la fecha (borra todo)                            → 3;
//   · la ruta leyendo `searchParams` antes de puedeOperar                       → 4;
//   · la rama de la miniatura con `?? 0` (lee un cuerpo sin largo)              → 4;
//   · `fotosEnviadasDe` con el `.catch` que vuelve vacío                        → 4;
//   · el pedidor guardando también lo que falló                                 → 5;
//   · el pedidor guardando 1 de 2 como completo                                 → 5;
//   · `miniatura()` devolviendo el original cuando no puede redibujar           → 6;
//   · `recordarEnviadas` filtrando por el tipo del navegador (`f.type`)         → 6;
//   · `recordarEnviadas` sin mirar el tamaño (la foto con el ref de otro)       → 6;
//   · `enviadasParaBorrar` sin el prefijo (borra los borradores)                → 7;
//   · Hilo.tsx sin `key={w.id}` en la burbuja                                   → 8;
//   · `leerFotosEnviadas` preguntando al servidor sin fotos esperadas           → 8;
//   · `nombresSinFoto` con un Set                                               → 9;
//   · (segunda revisión) la foto local con el nombre del archivo y no el firmado → 6;
//   · el barrido de IndexedDB sin `copiaVieja` (se lleva la de otra pestaña)    → 7;
//   · `proximoIntento` sin el tope de tiempo (pregunta para siempre)            → 10;
//   · la burbuja con un solo reintento (sin `proximoIntento`)                   → 8.
