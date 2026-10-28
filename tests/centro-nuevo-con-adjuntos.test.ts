// =============================================================================
// El chat NUEVO lleva sus adjuntos: la PC los baja antes de abrirlo y los nombra en el primer mensaje (cartero 1.22.0, 28/10/2026)
// =============================================================================
// Martín (28/10): «que se pueda utilizar el chat de la misma manera en todos lados». Hasta acá el primer mensaje de un chat
// nuevo del Ops Center iba sin archivos: el trabajo que lo abre no los llevaba («un chat nuevo no lleva adjuntos», en los dos
// lados). Ahora:
//   1. el texto firmado de un chat nuevo puede traer adjuntos, con las MISMAS reglas que cualquier trabajo (servidor y PC);
//   2. `ciclo` los baja con sus tres llaves (tamaño, sha256 firmado y tipo por los bytes) y, si algo no coincide, no lo encola;
//   3. `abrir` los vuelve a mirar contra lo firmado antes de nombrarlos (entre la vuelta y la apertura, la carpeta es de la PC)
//      y el primer mensaje lleva sus rutas, debajo del texto de Martín;
//   4. la pantalla los sube y los firma con el trabajo sólo con un cartero que los lleva, y la caja del chat nuevo es la única.
// Probado ROMPIÉNDOLO (28/10/2026), una rotura por vez contra la base en verde de 44 (este test, centro-abrir, centro-nuevo-chat,
// centro-abrir-pantalla, cajas-de-chat-unificadas y chat-nota-de-voz), restaurado por el script después de cada una:
//   · la PC rechaza otra vez un chat nuevo con adjuntos → 4 fallos; el servidor → 1 (el diferencial de centro-abrir);
//   · `ciclo` no los baja → 3; `abrir` sin mirar el sha256 → 1 (el 3); sin volver a mirarlos → 2; el .txt sin las rutas → 1;
//   · `abrirChat` firma archivos con un Runner que no los lleva → 1 (el 5); la caja ofrece adjuntar siempre → 1 (el 5);
//   · con archivos, cualquier cuenta que abre → 2 (el 7 y centro-abrir-pantalla); al chat que existe sin archivos → 3;
//   · sólo con archivos no sale → 1 (el 6); la nota se lleva los archivos antes de entenderse → 1 (el 8);
//   · los archivos no pasan de la caja al mensaje → 2 (el 6 y el 7);
//   · las piezas importan un VALOR de AdjuntosCaja (con su CSS) → centro-nuevo-chat entero no carga, y el 5;
//   · la caja del chat nuevo sin `adjuntos` → 2 (el 5 y el barrido); `mandarTextoA` sin firmar los archivos → 1 (el 5).
// Y la revisión de 0453923ab (28/10/2026, base de 31 con chat-formatos, chat-unico y el barrido): el 9 da ROJO con el
// ChatNuevo.tsx de 0453923ab tal cual. Roturas: la nota sin tomar los archivos antes → 2 (el 8 y el 9); sin devolverlos si no se
// entendió → 1 (el 8); la caja quieta deja tocar lo adjuntado → 2 (el 10 y chat-formatos); `adjuntosQuietos` deja pasar todo
// → 1; la cruz de quitar sin apagarse → 1; la lista sin saber que la caja está quieta → 2.
// Y la verificación de tren-t (28/10/2026, base de 43 con ticketera-subidas): con ChatNuevo.tsx, juntar-adjuntos.ts, CajaChat.tsx,
// PanelChat.tsx o centro.css de e4d04e7fa, rojo (el 10 o el 11); y lo devuelto sin vista previa nueva → el 11; la caja quieta
// que dice que toma, sin avisar lo soltado o descartando la captura → el 10.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { DESTINO_NUEVO, aceptaAdjuntosEnNuevo, armarFirmable, nuevoPayload, type AdjuntoPedido } from '../lib/operaciones-reglas';
import { armarHook, dibujador } from './hook-en-node';

const RAIZ = join(import.meta.dirname, '..');
const CARTERO = join(RAIZ, 'scripts/operaciones/cartero.mjs');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
// `abrir` arma la ruta del primer mensaje con forma de Windows (como en tests/centro-abrir.test.ts): sólo en la PC.
const SOLO_WINDOWS = process.platform === 'win32' ? false : 'la apertura arma rutas de Windows y sólo corre en la PC de Martín';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('una captura del CRM')]);
const PDF = Buffer.from('%PDF-1.4\nel informe\n%%EOF');
const REF_PNG = '11111111-1111-4111-8111-111111111111';
const REF_PDF = '22222222-2222-4222-8222-222222222222';
const adj = (ref: string, b: Buffer, mime: string, nombre: string): AdjuntoPedido => ({ ref, nombre, mime, bytes: b.length, sha256: createHash('sha256').update(b).digest('hex') } as AdjuntoPedido);

/** Una PC de prueba con un MaKo de mentira: da los trabajos en la vuelta, la URL firmada de cada adjunto y sus bytes. */
async function pc() {
  const dir = mkdtempSync(join(tmpdir(), 'cartero-nuevo-adj-'));
  const cfgDir = join(dir, 'cfg');
  mkdirSync(join(cfgDir, 'sessions'), { recursive: true });
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const spki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const firmar = (t: string) => sign('sha256', Buffer.from(t, 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64');
  const registro = join(dir, 'abiertos.jsonl');
  const registrador = join(dir, 'registrador.mjs');
  writeFileSync(registrador, "import fs from 'node:fs'; fs.appendFileSync(process.argv[2], JSON.stringify(process.argv.slice(3)) + '\\n');\n");
  let pedidos: unknown[] = [];
  /** Lo que el storage de mentira da por cada `ref` (se puede cambiar para que dé OTRO archivo que el firmado). */
  const almacen: Record<string, Buffer> = { [REF_PNG]: PNG, [REF_PDF]: PDF };
  const srv = createServer((req: IncomingMessage, res: ServerResponse) => {
    const u = new URL(req.url ?? '/', 'http://x');
    if (req.method === 'GET' && u.pathname.startsWith('/almacen/')) {
      const b = almacen[u.pathname.slice('/almacen/'.length)];
      if (!b) { res.statusCode = 404; res.end(); return; }
      res.end(b);
      return;
    }
    if (req.method === 'GET') {
      const ref = u.searchParams.get('adjunto') ?? '';
      if (u.searchParams.get('firmada') !== '1' || !almacen[ref]) { res.statusCode = 404; res.end('{}'); return; }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ url: `http://${req.headers.host}/almacen/${ref}` }));
      return;
    }
    req.resume().on('end', () => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ pedidos, vencidos: 0, acuses: 0, cierres: 0 }));
      pedidos = [];
    });
  });
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', () => ok()));
  writeFileSync(join(dir, 'config.json'), JSON.stringify({
    url: `http://127.0.0.1:${(srv.address() as { port: number }).port}`, token: `mkop_${'x'.repeat(30)}`, cwds: ['C:\\dev\\'],
    carteros: { claude2: { fuente: 'cli', configDir: cfgDir } }, carpetas: {}, abrir: true,
  }));
  writeFileSync(join(dir, 'claves.txt'), `${spki}\n`);
  const correr = (args: string[]) => new Promise<string>((ok, mal) => execFile(process.execPath, [CARTERO, ...args], {
    env: { ...process.env, CARTERO_DIR: dir, CARTERO_APP_DIR: join(dir, 'app'), CARTERO_CONFIG_DIR: cfgDir, CARTERO_ABRIDOR: JSON.stringify([process.execPath, registrador, registro]) },
  }, (e, so, se) => (e ? mal(new Error(se || e.message)) : ok(so))));
  const trabajo = (id: string, texto: string, adjuntos: AdjuntoPedido[]) => {
    const firmado = armarFirmable(nuevoPayload({ id, texto, destino: DESTINO_NUEVO, cuenta: 'claude2', titulo: 'CRM › Funnels', alcance: 'solo_esto', adjuntos }, Date.now()));
    return { id, firmado, firma: firmar(firmado) };
  };
  return {
    dir, almacen, correr, trabajo, cerrar: () => srv.close(),
    dar: (xs: unknown[]) => { pedidos = xs; },
    abiertos: () => (existsSync(registro) ? readFileSync(registro, 'utf8').trim().split('\n').filter(Boolean) : []),
    acuse: (id: string) => JSON.parse(readFileSync(join(dir, 'claude2', 'acuses', `${id}.json`), 'utf8')) as { estado: string; motivo: string },
    enCola: (id: string) => existsSync(join(dir, 'aperturas', `${id}.json`)),
    bajado: (id: string, nombre: string) => join(dir, 'adjuntos', id, nombre),
  };
}

test('1. un chat nuevo con adjuntos: la PC los baja en la vuelta, y el primer mensaje nombra sus rutas debajo del texto', { skip: SOLO_WINDOWS }, async () => {
  const x = await pc();
  try {
    const ID = 'aaaaaaaa-0000-4000-8000-00000000ad01';
    x.dar([x.trabajo(ID, 'Mirá esta captura y el informe', [adj(REF_PNG, PNG, 'image/png', 'Captura CRM.png'), adj(REF_PDF, PDF, 'application/pdf', 'informe.pdf')])]);
    await x.correr(['ciclo', '--cuenta', 'claude2']);
    assert.ok(x.enCola(ID), '`ciclo` lo deja en la cola de aperturas');
    const png = x.bajado(ID, '1-Captura-CRM.png');
    const pdf = x.bajado(ID, '2-informe.pdf');
    assert.deepEqual(readFileSync(png), PNG, 'los bytes, tal cual');
    assert.deepEqual(readFileSync(pdf), PDF);

    const salida = JSON.parse(await x.correr(['abrir'])) as Array<{ id: string; estado: string }>;
    assert.equal(salida[0].estado, 'entregado');
    assert.equal(x.abiertos().length, 1, 'se abrió una ventana');
    const primero = readFileSync(join(x.dir, 'aperturas', `${ID}.txt`), 'utf8');
    assert.equal(primero, ['Mirá esta captura y el informe', '', 'Adjuntos (los bajó el Runner a esta PC; ábrelos con Read):', `- ${png}`, `- ${pdf}`].join('\n'),
      'el texto de Martín tal cual, y debajo las rutas que armó la PC');
  } finally {
    x.cerrar();
  }
});

test('2. lo que MaKo da distinto de lo firmado no baja, y el chat no se encola', async () => {
  const x = await pc();
  try {
    const ID = 'aaaaaaaa-0000-4000-8000-00000000ad02';
    // MaKo (o quien la tome) da OTRO archivo que el firmado.
    x.almacen[REF_PNG] = Buffer.concat([PNG, Buffer.from('!')]);
    x.dar([x.trabajo(ID, 'hola', [adj(REF_PNG, PNG, 'image/png', 'captura.png')])]);
    await x.correr(['ciclo', '--cuenta', 'claude2']);
    assert.equal(x.enCola(ID), false, 'sin sus archivos, no se abre');
    assert.match(x.acuse(ID).motivo, /^No pude bajar un adjunto \(pesa más de lo firmado\): vuelve a mandarlo$/);
    assert.equal(existsSync(join(x.dir, 'adjuntos', ID)), false, 'y no queda nada bajado');
  } finally {
    x.cerrar();
  }
});

test('3. `abrir` vuelve a mirar los archivos contra lo firmado: cambiado o borrado en la PC, no se abre', { skip: SOLO_WINDOWS }, async () => {
  const x = await pc();
  try {
    const CAMBIADO = 'aaaaaaaa-0000-4000-8000-00000000ad03';
    const BORRADO = 'aaaaaaaa-0000-4000-8000-00000000ad04';
    x.dar([x.trabajo(CAMBIADO, 'uno', [adj(REF_PNG, PNG, 'image/png', 'captura.png')]), x.trabajo(BORRADO, 'dos', [adj(REF_PDF, PDF, 'application/pdf', 'informe.pdf')])]);
    await x.correr(['ciclo', '--cuenta', 'claude2']);
    // Alguien con acceso a la carpeta cambia el archivo bajado por otro del mismo tamaño, y borra el otro.
    const png = x.bajado(CAMBIADO, '1-captura.png');
    writeFileSync(png, Buffer.concat([PNG.subarray(0, PNG.length - 1), Buffer.from('?')]));
    rmSync(x.bajado(BORRADO, '1-informe.pdf'));
    await x.correr(['abrir']);
    assert.deepEqual(x.abiertos(), [], 'no se abrió ninguno');
    assert.equal(x.acuse(CAMBIADO).motivo, 'Vuelve a mandarlo (un adjunto no es el firmado)');
    assert.equal(x.acuse(BORRADO).motivo, 'Vuelve a mandarlo (falta un adjunto en la PC)');
    assert.deepEqual(readdirSync(join(x.dir, 'aperturas')).filter((n) => /\.(cmd|txt)$/.test(n)), [], 'ni el .cmd ni el .txt se escribieron');
  } finally {
    x.cerrar();
  }
});

test('4. lo que ve `abrir` en la PC: el id validado, el archivo firmado, y sin adjuntos el texto tal cual', async () => {
  const { adjuntosEnLaPc, primerMensaje } = await import('../scripts/operaciones/cartero.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'cartero-en-la-pc-'));
  const ID = 'aaaaaaaa-0000-4000-8000-00000000ad05';
  assert.throws(() => adjuntosEnLaPc('../fuera', [adj(REF_PNG, PNG, 'image/png', 'captura.png')], dir), /id inválido/);
  mkdirSync(join(dir, ID));
  writeFileSync(join(dir, ID, '1-captura.png'), PNG);
  assert.deepEqual(adjuntosEnLaPc(ID, [adj(REF_PNG, PNG, 'image/png', 'captura.png')], dir), [join(dir, ID, '1-captura.png')]);
  assert.equal(primerMensaje('Hola " $(calc)'), 'Hola " $(calc)', 'sin adjuntos, el texto firmado tal cual');
});

test('5. la pantalla: sube y firma los archivos con el trabajo que abre, sólo con un cartero que los lleva', async () => {
  const cartero = await import('../scripts/operaciones/cartero.mjs');
  assert.ok(aceptaAdjuntosEnNuevo(cartero.VERSION), `el cartero ${cartero.VERSION} lleva adjuntos a un chat nuevo`);
  assert.equal(aceptaAdjuntosEnNuevo('1.21.0'), false, 'uno de antes los rechaza: la caja no los ofrece');
  const motor = sinComentarios(leer('app/admin/operaciones/useCentro.ts'));
  const abrir = motor.slice(motor.indexOf('async function abrirChat'), motor.indexOf('async function mandarTextoA'));
  assert.match(abrir, /if \(archivos\.length && !adjuntaEnNuevo\(b\.cuenta\)\) \{ avisar\(/, 'con un Runner de antes, lo dice y no sale');
  assert.match(abrir, /const s = await subirAdjuntos\(archivos, /);
  assert.match(abrir, /firma\.mandar\(\{ sesion: DESTINO_NUEVO, cuenta: b\.cuenta, titulo: nombre \}, texto, 'solo_esto', \{\}, subidos\)/, 'firmados con el trabajo');
  const existente = motor.slice(motor.indexOf('async function mandarTextoA'));
  assert.match(existente, /puedeAdjuntar\(c\) \? problemaDeAdjuntosCaja\(archivos\.map\(\(f\) => f\.size\), grandes\) : 'Ese chat todavía no recibe archivos'/,
    'a un chat que ya existe, con los topes de SU Runner');
  assert.match(existente, /firma\.mandar\(\{ sesion: d\.sesion, cuenta: d\.cuenta, titulo: c\.titulo, tope: topeDe\(c\) \}, texto, 'solo_esto', \{\}, subidos\)/);
  const nuevo = sinComentarios(leer('app/admin/operaciones/ChatNuevo.tsx'));
  assert.match(nuevo, /items: enLaCaja, puede: k\.adjuntaEnNuevo\(\),/, 'la caja ofrece adjuntar sólo con un cartero que los lleva');
  // La caja del chat nuevo es la única de la app (y sus piezas, que se dibujan en un test, no traen CSS).
  assert.match(sinComentarios(leer('app/admin/operaciones/CajaChatNuevo.tsx')), /<CajaChat [\s\S]*?adjuntos=\{n\.adjuntos\}[\s\S]*?\/>/);
  assert.doesNotMatch(sinComentarios(leer('app/admin/operaciones/ChatNuevoPiezas.tsx')), /^import (?!type)[^;]*from '\.\/AdjuntosCaja'/m);
});

// ── El motor del chat nuevo (ChatNuevo.tsx → useChatNuevo), de verdad: con el React de mentira de tests/hook-en-node.ts ──
type Archivo = { id: string; file: File; tipo: 'image' | 'document'; url: string };
type Motor = {
  fase: string; enviado: string | null; archivos: Archivo[]; adjuntos: { items: Archivo[]; puede: boolean };
  setTexto: (t: string) => void; mandar: () => Promise<void>; mandarNota: (g: { audio: Blob; segundos: number }) => void;
};
let useChatNuevo: ((k: unknown, onAbrir: (c: string) => void) => Motor) | null = null;
const g = globalThis as unknown as {
  window: unknown; __decidir: (t: string) => Promise<unknown>; __preparar: () => Promise<{ texto: string } | { error: string }>;
};
async function motor() {
  useChatNuevo ??= (await armarHook(RAIZ, 'app/admin/operaciones/ChatNuevo.tsx', {
    'react/jsx-runtime': 'export const jsx = () => null; export const jsxs = () => null; export const Fragment = "f";',
    '@/app/_components/icons': 'export const Icon = () => null;',
    './acciones': 'export function decidirChatNuevoAction(t) { return globalThis.__decidir(t); }',
    './ChatNuevoPiezas': 'export const CriaturaChatNuevo = () => null; export const CuerpoChatNuevo = () => null; export const TituloChatNuevo = () => null;',
    './CajaChatNuevo': 'export const CajaChatNuevo = () => null;',
    '@/app/_chat/preparar-nota': 'export function prepararNota() { return globalThis.__preparar(); }',
  })).useChatNuevo as typeof useChatNuevo;
  return useChatNuevo!;
}
const vuelta = () => new Promise((x) => setImmediate(x));

/** Un Centro de mentira: la caja del chat nuevo, quién abre, quién lleva archivos, y lo que salió. */
function centro(o: { abre: string[]; llevaArchivos: string[] }) {
  const cajas: Record<string, Archivo[]> = {};
  const salio: Array<{ a: string; cuenta?: string; texto: string; archivos: string[] }> = [];
  const k = {
    tabs: ['CRM'], chats: [{ clave: 'nombre:crm', titulo: 'CRM' }], carteros: [], ahora: Date.now(), apertura: null,
    adjuntosDe: (c: string) => cajas[c] ?? [], vaciarAdjuntos: (c: string) => { cajas[c] = []; },
    devolverAdjuntos: (c: string, xs: Archivo[]) => { cajas[c] = [...xs, ...(cajas[c] ?? [])]; },
    sumarAdjuntos: async () => {}, quitarAdjunto: () => {}, sinAdjuntos: () => {}, sinImagen: () => {}, copiarConAviso: () => {},
    puedeAbrirEn: (c: string) => o.abre.includes(c),
    adjuntaEnNuevo: (c?: string) => (c ? o.llevaArchivos.includes(c) : o.llevaArchivos.length > 0),
    mandarTextoA: async (c: { clave: string }, texto: string, fs: File[] = []) => { salio.push({ a: c.clave, texto, archivos: fs.map((f) => f.name) }); return true; },
    abrirChat: async (b: { cuenta: string; texto: string; archivos?: File[] }) => { salio.push({ a: 'nuevo', cuenta: b.cuenta, texto: b.texto, archivos: (b.archivos ?? []).map((f) => f.name) }); return true; },
  };
  const poner = (...nombres: string[]) => { cajas[':chat-nuevo'] = nombres.map((n, i) => ({ id: `a${i}`, file: new File([PNG], n, { type: 'image/png' }), tipo: 'image', url: `blob:${n}` })); };
  return { k, cajas, salio, poner };
}
/** El reloj de la decisión (4 s): se corre a mano. */
function reloj() {
  const pendientes: Array<() => void> = [];
  g.window = { setTimeout: (f: () => void) => pendientes.push(f), clearTimeout: () => {} };
  return { correr: () => { for (const f of pendientes.splice(0)) f(); } };
}

test('6. sólo con archivos: pasan de la caja al mensaje, MaKo decide por sus nombres, y salen con él al chat que ya existe', async () => {
  const hook = await motor();
  const { dibujar } = dibujador((k: unknown) => hook(k, () => {}));
  const c = centro({ abre: ['claude1'], llevaArchivos: ['claude1'] });
  const r = reloj();
  const decididos: string[] = [];
  g.__decidir = async (t) => { decididos.push(t); return { ok: true, decision: { accion: 'existente', nombre: 'CRM', jefe: 'CRM', clave: 'nombre:crm', origen: 'ia' } }; };
  c.poner('captura-funnel.png', 'otra.png');
  let s = dibujar(c.k);
  assert.equal(s.adjuntos.items.length, 2);
  assert.equal(s.adjuntos.puede, true, 'con un Runner que los lleva, la caja ofrece adjuntar');
  await s.mandar();
  s = dibujar(c.k);
  assert.deepEqual(s.archivos.map((a) => a.file.name), ['captura-funnel.png', 'otra.png'], 'se ven en el mensaje');
  assert.deepEqual(c.cajas[':chat-nuevo'], [], 'y la caja queda vacía');
  assert.equal(s.enviado, 'Te mando estos adjuntos.');
  assert.match(decididos[0], /captura-funnel\.png, otra\.png/, 'sin texto, MaKo decide por los nombres');
  r.correr();
  await vuelta();
  assert.deepEqual(c.salio, [{ a: 'nombre:crm', texto: 'Te mando estos adjuntos.', archivos: ['captura-funnel.png', 'otra.png'] }], 'al chat que existe, CON los archivos');
});

test('7. a un chat nuevo: con archivos, en la cuenta cuyo Runner los lleva (aunque otra abra); sin archivos, como siempre', async () => {
  const hook = await motor();
  g.__decidir = async () => ({ ok: true, decision: { accion: 'jefe', nombre: 'Pagos', jefe: null, clave: null, origen: 'ia' } });
  for (const conArchivos of [true, false]) {
    const { dibujar } = dibujador((k: unknown) => hook(k, () => {}));
    const c = centro({ abre: ['claude1', 'claude2'], llevaArchivos: ['claude2'] });
    const r = reloj();
    if (conArchivos) c.poner('factura.png');
    let s = dibujar(c.k);
    s.setTexto('Revisá los pagos de Nadia');
    s = dibujar(c.k);
    await s.mandar();
    dibujar(c.k);
    r.correr();
    await vuelta();
    assert.deepEqual(c.salio, [{ a: 'nuevo', cuenta: conArchivos ? 'claude2' : 'claude1', texto: 'Revisá los pagos de Nadia', archivos: conArchivos ? ['factura.png'] : [] }]);
  }
});

test('8. con una nota de voz: lo adjuntado sale con ella; si la nota no se entendió, se queda en la caja', async () => {
  const hook = await motor();
  g.__decidir = async () => ({ ok: true, decision: { accion: 'existente', nombre: 'CRM', jefe: 'CRM', clave: 'nombre:crm', origen: 'ia' } });
  const { dibujar } = dibujador((k: unknown) => hook(k, () => {}));
  const c = centro({ abre: ['claude1'], llevaArchivos: ['claude1'] });
  const r = reloj();
  c.poner('pantalla.png');
  g.__preparar = async () => ({ error: 'No te escuché' });
  let s = dibujar(c.k);
  s.mandarNota({ audio: new Blob(['x']), segundos: 3 });
  await vuelta();
  s = dibujar(c.k);
  assert.equal(s.fase, 'escribiendo');
  assert.deepEqual(c.cajas[':chat-nuevo'].map((a) => a.file.name), ['pantalla.png'], 'la nota que no se entendió devuelve los archivos a la caja');
  assert.deepEqual(s.archivos, [], 'y ya no se ven como mandados');
  g.__preparar = async () => ({ texto: 'Mirá esta pantalla' });
  s.mandarNota({ audio: new Blob(['x']), segundos: 3 });
  await vuelta(); await vuelta();
  dibujar(c.k);
  r.correr();
  await vuelta();
  assert.deepEqual(c.salio, [{ a: 'nombre:crm', texto: 'Mirá esta pantalla', archivos: ['pantalla.png'] }]);
});

test('9. la nota se lleva lo adjuntado ANTES de pasarse a texto: lo que cambia en la caja en esos segundos no sale ni se borra', async () => {
  // La revisión de 0453923ab: tomado DESPUÉS del `await` (con la lista del dibujo en que arrancó), salía firmado lo quitado en
  // esos segundos y `vaciarAdjuntos` borraba lo sumado.
  const hook = await motor();
  g.__decidir = async () => ({ ok: true, decision: { accion: 'existente', nombre: 'CRM', jefe: 'CRM', clave: 'nombre:crm', origen: 'ia' } });
  const { dibujar } = dibujador((k: unknown) => hook(k, () => {}));
  const c = centro({ abre: ['claude1'], llevaArchivos: ['claude1'] });
  const r = reloj();
  c.poner('a.png', 'b.png');
  let entendida: (x: { texto: string }) => void = () => {};
  g.__preparar = () => new Promise((ok) => { entendida = ok; });
  let s = dibujar(c.k);
  s.mandarNota({ audio: new Blob(['x']), segundos: 3 });
  s = dibujar(c.k);
  assert.equal(s.fase, 'pasando');
  assert.deepEqual(c.cajas[':chat-nuevo'], [], 'mientras se pasa a texto, la caja ya no tiene lo de la nota: no hay qué quitar');
  assert.deepEqual(s.archivos.map((a) => a.file.name), ['a.png', 'b.png'], 'se ven con la nota');
  // Algo cae en la caja en esos segundos (la caja quieta no lo toma: si igual entrara, no es de esta nota).
  c.cajas[':chat-nuevo'] = [{ id: 'c', file: new File([PNG], 'c.png', { type: 'image/png' }), tipo: 'image', url: 'blob:c' }];
  dibujar(c.k);
  entendida({ texto: 'Mirá' });
  await vuelta(); await vuelta();
  dibujar(c.k);
  r.correr();
  await vuelta();
  assert.deepEqual(c.salio, [{ a: 'nombre:crm', texto: 'Mirá', archivos: ['a.png', 'b.png'] }], 'sale lo que tenía la caja al grabar');
  assert.deepEqual(c.cajas[':chat-nuevo'].map((a) => a.file.name), ['c.png'], 'y lo que cayó después no se borra');
});

test('10. la caja QUIETA (saliendo, apagada o bloqueada) no deja quitar ni toma lo soltado, y lo sigue mostrando', async () => {
  const { adjuntosQuietos } = await import('../app/_chat/juntar-adjuntos');
  const tocados: string[] = [];
  const a = { items: [{ id: 'x' }], puede: true, onSumar: () => { tocados.push('sumar'); }, onQuitar: () => { tocados.push('quitar'); } } as unknown as Parameters<typeof adjuntosQuietos>[0] & object;
  const enEspera: string[] = [];
  const quieta = adjuntosQuietos(a, true, () => enEspera.push('espera'))!;
  quieta.onSumar([new File([PNG], 'nuevo.png')]);
  quieta.onQuitar('x');
  assert.deepEqual(tocados, [], 'ni entra ni se quita nada');
  assert.equal(quieta.items, a.items, 'lo adjuntado se sigue viendo');
  assert.equal(adjuntosQuietos(a, false), a, 'con la caja libre, los de siempre');
  assert.equal(adjuntosQuietos(undefined, true), undefined);
  // No se traga nada callada (la verificación de tren-t): dice que no toma y por qué, y lo soltado avisa.
  const { ESPERA_PARA_ADJUNTAR } = await import('../app/_chat/juntar-adjuntos');
  assert.equal(quieta.puede, false, 'el panel no ofrece «Suelta para adjuntar»');
  assert.equal(quieta.espera, ESPERA_PARA_ADJUNTAR);
  const { alSoltar } = await import('../app/admin/operaciones/pegar');
  let frenado = false;
  const soltado = { dataTransfer: { types: ['Files'], files: [new File([PNG], 'soltado.png', { type: 'image/png' })], items: [] }, preventDefault: () => { frenado = true; } };
  alSoltar(soltado as unknown as Parameters<typeof alSoltar>[0], quieta);
  assert.ok(frenado, 'el navegador no abre lo soltado');
  assert.deepEqual(enEspera, ['espera'], 'lo soltado con la caja quieta avisa');
  assert.deepEqual(tocados, [], 'y no entra');
  // La caja única la usa con su `quieto` (el soltar y el aviso al panel pasan por `adjuntos`), y la ✕ se apaga.
  const caja = sinComentarios(leer('app/_chat/CajaChat.tsx'));
  assert.match(caja, /const quieto = enviando \|\| apagado \|\| !!p\.bloqueo;[\s\S]{0,400}?const adjuntos = adjuntosQuietos\(deLaCaja, quieto, avisarEspera\);\s*useAvisarAdjuntos\(adjuntos\);/);
  assert.match(caja, /const avisarEspera = \(\) => \{ if \(p\.onErrorMic\) p\.onErrorMic\(ESPERA_PARA_ADJUNTAR\); else setEnEspera\(true\); \};/, 'lo dice la pantalla, o la caja');
  assert.match(caja, /\{enEspera && <p className="co-caja__estado" aria-live="polite">\{ESPERA_PARA_ADJUNTAR\}<\/p>\}/);
  assert.match(caja, /<ListaAdjuntos a=\{adjuntos\} apagado=\{quieto\} \/>/);
  assert.match(caja, /onDrop=\{\(e\) => \{ if \(!adjuntos \|\| !traeArchivos\(e\.dataTransfer\)\) return; e\.stopPropagation\(\); alSoltar\(e, adjuntos\); \}\}/);
  assert.match(sinComentarios(leer('app/admin/operaciones/AdjuntosCaja.tsx')), /className="co-miniatura__quitar" onClick=\{\(\) => a\.onQuitar\(x\.id\)\} disabled=\{apagado\}/);
  // El panel, al arrastrar, dice por qué no toma (y no «Suelta para adjuntar»).
  assert.match(sinComentarios(leer('app/admin/operaciones/PanelChat.tsx')), /destino\(\)\?\.puede \? 'Suelta para adjuntar' : destino\(\)\?\.espera \?\? 'Este chat no recibe archivos'/);
  // La ✕ apagada no se ofrece (ni al pasar el mouse ni en el teléfono): se veía igual que la activa.
  assert.match(leer('app/admin/operaciones/centro.css'), /\.co-miniatura__quitar:disabled, \.co-miniatura:hover \.co-miniatura__quitar:disabled \{ opacity: 0; pointer-events: none; \}/);
  // «Pegar la captura» espera con la caja quieta: ni se dibuja ni se descarta (anotarla como vista la perdía para siempre).
  assert.match(caja, /\{captura && !quieto && \(/);
  assert.match(caja, /const resolverCaptura = \(pegar: boolean\) => \{\s*if \(!captura \|\| quieto\) return;/);
});

test('11. salir del chat nuevo con la nota pasándose a texto, y que no se entienda: los archivos vuelven con su vista previa VIVA', async () => {
  const hook = await motor();
  const { dibujar, desmontar } = dibujador((k: unknown) => hook(k, () => {}));
  const c = centro({ abre: ['claude1'], llevaArchivos: ['claude1'] });
  reloj();
  const revocadas = new Set<string>();
  const revocar = URL.revokeObjectURL;
  URL.revokeObjectURL = (u: string) => { revocadas.add(u); revocar(u); };
  try {
    c.poner('foto.png');
    let fallo: (x: { error: string }) => void = () => {};
    g.__preparar = () => new Promise((ok) => { fallo = ok; });
    let s = dibujar(c.k);
    s.mandarNota({ audio: new Blob(['x']), segundos: 3 });
    s = dibujar(c.k);
    const enLaNota = s.archivos.map((a) => a.url);
    desmontar();
    assert.ok(enLaNota.every((u) => revocadas.has(u)), 'al salir, las vistas previas de la burbuja se sueltan');
    fallo({ error: 'No te escuché' });
    await vuelta();
    const vuelta1 = c.cajas[':chat-nuevo'];
    assert.deepEqual(vuelta1.map((a) => a.file.name), ['foto.png'], 'la foto vuelve a la caja');
    assert.ok(!revocadas.has(vuelta1[0].url), 'con una vista previa que sirve (no la revocada al salir)');
  } finally {
    URL.revokeObjectURL = revocar;
  }
});
