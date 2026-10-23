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
//   4. la ruta pregunta puedeOperar ANTES de leer nada, y guarda sólo por `guardarMiniaturaEnviada`, que mira el trabajo
//      antes de subir;
//   5. las burbujas que se abren juntas van al servidor en UNA ida; lo que volvió se guarda mientras la URL sirve, un «no
//      tiene» poco, y un fallo de red nada;
//   6. el navegador que manda sube la miniatura de cada FOTO con el `ref` de SU original (por orden y tamaño), y no escribe
//      más miniaturas en IndexedDB;
//   7. el barrido de IndexedDB borra sólo las miniaturas de antes del 23/10 sin burbuja, nunca un borrador de la caja;
//   8. el cableado: la cola trae qué adjuntos son fotos, la burbuja los recibe y sólo pregunta al servidor si hay.
//
// Probado rompiéndolo (23/10/2026, con la base en 0 fallos):
//   · `fotosDeFirmado` sin mirar el mime (toma el PDF) → 2 fallos (1, y el 2: el ref del PDF pasaba por una foto);
//   · `problemaDeMiniatura` sin comparar el `ref` con las fotos del trabajo → 1 fallo (2);
//   · `miniaturasVencidas` sin la fecha (borra todo) → 1 fallo (3);
//   · la ruta leyendo `searchParams` antes de puedeOperar → 1 fallo (4);
//   · el pedidor guardando también lo que falló → 1 fallo (5);
//   · `recordarEnviadas` sin mirar el tamaño (la foto con el ref de otro) → 1 fallo (6);
//   · `enviadasParaBorrar` sin el prefijo (borra los borradores) → 1 fallo (7);
//   · Hilo.tsx sin pasar `fotos` → 1 fallo (8).

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

test('4. la ruta pregunta puedeOperar antes de leer nada, y guarda sólo mirando el trabajo antes de subir', () => {
  const ruta = sinComentarios(leer('app/api/operaciones/adjuntos/route.ts'));
  for (const verbo of ['GET', 'POST']) {
    const cuerpo = ruta.slice(ruta.indexOf(`export async function ${verbo}(`));
    const guarda = cuerpo.indexOf('puedeOperar(admin');
    const lee = cuerpo.search(/searchParams|req\.(arrayBuffer|formData|json)\(/);
    assert.ok(guarda > 0 && lee > guarda, `${verbo}: la guarda va antes de leer el pedido`);
  }
  assert.match(ruta, /guardarMiniaturaEnviada\(busca\.get\('miniatura'\)/, 'la miniatura entra por la función que mira el trabajo');
  const lib = sinComentarios(leer('lib/operaciones-adjuntos.ts'));
  const guardar = lib.slice(lib.indexOf('export async function guardarMiniaturaEnviada('), lib.indexOf('export async function fotosEnviadasDe('));
  const mira = guardar.indexOf('problemaDeMiniatura(');
  const sube = guardar.indexOf('.upload(');
  assert.ok(guardar.indexOf('fotosDelTrabajo(') >= 0 && mira > 0 && sube > mira, 'primero el trabajo y la miniatura, después el storage');
});

test('5. las burbujas que se abren juntas van al servidor en una ida, y lo que volvió se guarda lo que corresponde', async () => {
  let t = 1_000;
  const idas: string[][] = [];
  let falla = false;
  const pedidor = crearPedidorDeFotos(async (ids) => {
    idas.push(ids);
    if (falla) return null;
    return Object.fromEntries(ids.filter((id) => id.startsWith('con')).map((id) => [id, [{ url: `https://x/${id}`, nombre: `${id}.png` }]]));
  }, { esperaMs: 1, vigenciaMs: 5_000, vacioMs: 500, ahora: () => t });
  const [a, b, c] = await Promise.all([pedidor.pedir('con-1'), pedidor.pedir('con-2'), pedidor.pedir('sin-1')]);
  assert.equal(idas.length, 1, 'una sola ida para las tres');
  assert.deepEqual(idas[0], ['con-1', 'con-2', 'sin-1']);
  assert.equal(a[0]?.url, 'https://x/con-1');
  assert.equal(b.length, 1);
  assert.deepEqual(c, []);
  assert.ok(pedidor.yaSabidas('con-1'), 'lo que volvió con fotos se guarda');
  t += 600;
  assert.equal(pedidor.yaSabidas('sin-1'), null, 'un «no tiene» se cree poco: la miniatura puede estar subiendo');
  assert.ok(pedidor.yaSabidas('con-1'), 'lo que tiene fotos sigue');
  t += 5_000;
  assert.equal(pedidor.yaSabidas('con-1'), null, 'pasada la vigencia, la URL ya no sirve');
  falla = true;
  assert.deepEqual(await pedidor.pedir('con-3'), []);
  assert.equal(pedidor.yaSabidas('con-3'), null, 'un fallo de red no se guarda');
  // Más de las que entran en una ida: se parten.
  idas.length = 0;
  falla = false;
  await Promise.all(Array.from({ length: POR_PEDIDO + 5 }, (_, i) => pedidor.pedir(`otra-${i}`)));
  assert.deepEqual(idas.map((x) => x.length), [POR_PEDIDO, 5]);
});

test('6. el que manda sube la miniatura de cada FOTO con el ref de su original, y no la deja en IndexedDB', async () => {
  const pedidos: string[] = [];
  const g = globalThis as Record<string, unknown>;
  const antes = { fetch: g.fetch, crear: URL.createObjectURL };
  g.fetch = async (url: string) => { pedidos.push(String(url)); return new Response('{"ok":true}', { status: 200 }); };
  URL.createObjectURL = () => 'blob:x';
  try {
    const { recordarEnviadas, fotosYaLeidas } = await import('../app/admin/operaciones/fotos-enviadas');
    const foto = new File([JPEG], 'captura.jpg', { type: 'image/jpeg' });
    const pdf = new File([PDF], 'presupuesto.pdf', { type: 'application/pdf' });
    const otra = new File([JPEG, JPEG], 'otra.jpg', { type: 'image/jpeg' });
    const sub = (ref: string, f: File, mime: string) => ({ ref, nombre: f.name, mime: mime as 'image/jpeg', bytes: f.size, sha256: 'e'.repeat(64) });
    const ID = '7a7a7a7a-1111-4111-8111-111111111111';
    // La tercera llegó con otro tamaño (no es la misma): no sube con un ref que no es el suyo.
    recordarEnviadas(ID, [pdf, foto, otra], [sub(REF_PDF, pdf, 'application/pdf'), sub(REF_FOTO, foto, 'image/jpeg'), { ...sub(REF_OTRA, otra, 'image/jpeg'), bytes: 1 }]);
    assert.equal(fotosYaLeidas(ID)?.length, 1, 'se ve en el acto, sólo la foto');
    for (let i = 0; i < 50 && !pedidos.length; i += 1) await new Promise((ok) => setTimeout(ok, 5));
    await new Promise((ok) => setTimeout(ok, 20));
    assert.deepEqual(pedidos, [`/api/operaciones/adjuntos?miniatura=${ID}&ref=${REF_FOTO}`], 'una subida, con el ref de SU original');
  } finally {
    g.fetch = antes.fetch;
    URL.createObjectURL = antes.crear;
  }
  assert.doesNotMatch(sinComentarios(leer('app/admin/operaciones/fotos-enviadas.ts')).slice(0, sinComentarios(leer('app/admin/operaciones/fotos-enviadas.ts')).indexOf('export const fotosYaLeidas')), /guardarAdjuntos\(/, 'mandar ya no escribe miniaturas en IndexedDB');
});

test('7. el barrido de IndexedDB borra sólo las miniaturas de antes sin burbuja, nunca un borrador de la caja', async () => {
  const { enviadasParaBorrar } = await import('../app/admin/operaciones/fotos-enviadas');
  const borrar = enviadasParaBorrar(['enviado:viejo', 'enviado:vigente', 'local_11111111-1111-4111-8111-111111111111', 'nombre:cerebro'], new Set(['vigente']));
  assert.deepEqual(borrar, ['enviado:viejo']);
  const motor = leer('app/admin/operaciones/fotos-enviadas.ts');
  assert.match(motor, /if \(barrida \|\| !vigentes\.length\) return;/, 'con la cola vacía (una lectura que falló) no barre');
});

test('8. el cableado: la cola dice qué adjuntos son fotos, la burbuja los recibe y sólo pregunta si hay', () => {
  assert.match(sinComentarios(leer('lib/operaciones.ts')), /fotosDeFirmado\(firmado as string \| null\)/, 'listarPedidos saca las fotos del texto firmado');
  assert.match(leer('app/admin/operaciones/useCentro.ts'), /\.\.\.\(p\.fotos\?\.length \? \{ fotos: p\.fotos \} : \{\}\)/, 'el trabajo de la conversación las lleva');
  assert.match(leer('app/admin/operaciones/Hilo.tsx'), /<AdjuntosEnBurbuja id=\{w\.id\} nombres=\{w\.adjuntos\} fotos=\{w\.fotos\} \/>/, 'la burbuja las recibe');
  const burbuja = sinComentarios(leer('app/admin/operaciones/FotosEnviadas.tsx'));
  assert.match(burbuja, /const conFotos = !!nombresDeFotos\?\.length;/);
  assert.match(burbuja, /leerFotosEnviadas\(id, conFotos\)/, 'sin fotos, no va al servidor');
  assert.match(leer('app/admin/operaciones/useCentro.ts'), /recordarEnviadas\(r\.id, archivos\.map\(\(a\) => a\.file\), subidos\)/, 'mandar pasa los refs');
});
