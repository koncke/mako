// =============================================================================
// Los adjuntos de un trabajo del Ops Center: de la caja a la PC, sólo lo firmado (17/10/2026)
// =============================================================================
// Martín: adjuntar fotos y PDF en la caja (también pegar una captura con Ctrl+V), en la computadora y en el teléfono, y que
// le lleguen al chat. Dio el OK de que un archivo baje a la PC con condiciones que no se negocian: sólo con un trabajo
// firmado, a una carpeta fija por trabajo, con tipo y tamaño validados, nunca un ejecutable, y el chat recibe la RUTA.
// Lo que se fija acá es lo que, roto, NO da error: un archivo que baja sin coincidir con lo firmado, un ejecutable que
// entra con nombre de foto, la extensión que elige quien sube, el servidor y la PC leyendo distinto un trabajo con
// adjuntos, y una caja que deja de firmar el hash que calculó ella.
//
// ⚠️ Probado ROMPIÉNDOLO (17/10/2026), una rotura por vez contra la base en verde de 8 pases:
//   · bajarAdjuntos sin comparar el sha256 → 1 fallo (el de la PC que baja);
//   · bajarAdjuntos sin mirar los primeros bytes → 1 fallo (el ejecutable con el hash bien firmado);
//   · nombreEnDisco con el nombre que trajo, extensión incluida → 2 fallos (el del nombre y el de la PC que baja);
//   · el cartero sin validar los adjuntos en leerFirmable → 1 fallo (el diferencial);
//   · subirAdjuntos firmando el sha256 que devolvió MaKo → 1 fallo;
//   · el ciclo sin pasarle las rutas al mensaje → 1 fallo (el de punta a punta).
//   Restaurado de memoria (no con git checkout): 8 pases.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import {
  MAX_ADJUNTOS, MAX_BYTES_ADJUNTOS, MIMES_ADJUNTO, VERSION_ADJUNTOS, aceptaAdjuntos, armarFirmable, leerFirmable, nombresDeAdjuntos,
  nuevoPayload, problemaDeAdjuntos, type AdjuntoPedido,
} from '../lib/operaciones-reglas';
import { tipoPorFirma } from '../lib/mako-adjuntos';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

// Los primeros bytes de cada cosa: lo que se acepta, y lo que NO tiene que bajar nunca.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('una captura')]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('foto')]);
const GIF = Buffer.from('GIF89a…');
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
const PDF = Buffer.from('%PDF-1.7\n…');
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64)]);
const SCRIPT = Buffer.from('#!/bin/sh\nrm -rf ~\n');
const PS1 = Buffer.from('Remove-Item -Recurse C:\\');

const REF1 = '11111111-1111-4111-8111-111111111111';
const REF2 = '22222222-2222-4222-8222-222222222222';
const adj = (ref: string, b: Uint8Array, mime: AdjuntoPedido['mime'], nombre = 'captura.png'): AdjuntoPedido => ({ ref, nombre, mime, bytes: b.length, sha256: sha(b) });

test('sin adjuntos el texto firmado es el de siempre; con ellos, van adentro de la firma', () => {
  const AHORA = Date.parse('2026-10-17T12:00:00Z');
  const base = { id: '6b2b7d32-9a51-4e43-9a43-2f3a4b5c6d7e', texto: 'mirá esto', destino: 'local_0b1c2d3e-4f50-4a61-8b72-9c83d4e5f601', cuenta: 'claude4', titulo: 'CRM', alcance: 'solo_esto' as const };
  assert.ok(!('adjuntos' in JSON.parse(armarFirmable(nuevoPayload(base, AHORA)))), 'un trabajo sin adjuntos firma lo mismo que antes del 17/10');
  assert.ok(!('adjuntos' in JSON.parse(armarFirmable(nuevoPayload({ ...base, adjuntos: [] }, AHORA)))), 'una lista vacía no se firma');
  const con = armarFirmable(nuevoPayload({ ...base, adjuntos: [adj(REF1, PNG, 'image/png')] }, AHORA));
  const l = leerFirmable(con, AHORA);
  assert.ok(l.ok && l.p.adjuntos?.[0].sha256 === sha(PNG), 'el hash viaja firmado');
  assert.deepEqual(nombresDeAdjuntos(con), ['captura.png'], 'la conversación dice qué se adjuntó');
  assert.deepEqual(nombresDeAdjuntos('{roto'), []);
});

test('el servidor y el cartero dan el MISMO veredicto sobre los adjuntos de un trabajo', async () => {
  const cartero = await import('../scripts/operaciones/cartero.mjs');
  assert.deepEqual(cartero.MIMES_ADJUNTO, [...MIMES_ADJUNTO]);
  assert.equal(cartero.MAX_ADJUNTOS, MAX_ADJUNTOS);
  assert.equal(cartero.MAX_BYTES_ADJUNTOS, MAX_BYTES_ADJUNTOS);
  const bien = adj(REF1, PNG, 'image/png');
  const BATERIA: Array<[string, unknown]> = [
    ['uno bueno', [bien]],
    ['dos buenos', [bien, adj(REF2, PDF, 'application/pdf', 'informe.pdf')]],
    ['vacío', []],
    ['no es lista', { ref: REF1 }],
    ['cinco', [1, 2, 3, 4, 5].map((i) => adj(`${i}1111111-1111-4111-8111-111111111111`, PNG, 'image/png'))],
    ['ref repetido', [bien, bien]],
    ['ref raro', [{ ...bien, ref: '../../x' }]],
    ['un .exe', [{ ...bien, mime: 'application/x-msdownload' }]],
    ['un script', [{ ...bien, mime: 'text/x-sh' }]],
    ['sin hash', [{ ...bien, sha256: '' }]],
    ['hash en mayúsculas', [{ ...bien, sha256: bien.sha256.toUpperCase() }]],
    ['pesa cero', [{ ...bien, bytes: 0 }]],
    ['pesa de más', [{ ...bien, bytes: MAX_BYTES_ADJUNTOS + 1 }]],
    ['entre los dos pesan de más', [{ ...bien, bytes: MAX_BYTES_ADJUNTOS - 10 }, { ...adj(REF2, PDF, 'application/pdf'), bytes: 11 }]],
    ['bytes con coma', [{ ...bien, bytes: 1.5 }]],
    ['nombre vacío', [{ ...bien, nombre: '  ' }]],
    ['nombre con salto', [{ ...bien, nombre: 'a\nb.png' }]],
    ['nombre largo', [{ ...bien, nombre: 'x'.repeat(121) }]],
  ];
  let buenos = 0;
  for (const [nombre, x] of BATERIA) {
    const a = problemaDeAdjuntos(x);
    assert.equal(cartero.problemaDeAdjuntos(x), a, `${nombre}: el servidor dice ${a}, el cartero otra cosa`);
    if (a === null) buenos++;
  }
  assert.equal(buenos, 2, 'la batería tiene dos listas válidas');
  // Y adentro del texto firmado, los dos lo leen igual (un adjunto roto invalida el trabajo entero).
  const AHORA = Date.now();
  const p = nuevoPayload({ id: '6b2b7d32-9a51-4e43-9a43-2f3a4b5c6d7e', texto: 'x', destino: 'local_0b1c2d3e-4f50-4a61-8b72-9c83d4e5f601', cuenta: null, titulo: null, alcance: 'solo_esto' }, AHORA);
  for (const [nombre, x] of BATERIA) {
    const texto = JSON.stringify({ ...JSON.parse(armarFirmable(p)), adjuntos: x });
    const a = leerFirmable(texto, AHORA);
    const b = cartero.leerFirmable(texto, AHORA) as { ok: boolean; motivo?: string };
    assert.equal(b.ok, a.ok, `${nombre}: servidor ${a.ok}, cartero ${b.ok}`);
    if (!a.ok) assert.equal(b.motivo, a.motivo);
  }
});

test('la PC reconoce el tipo por los PRIMEROS BYTES, igual que MaKo, y un ejecutable no es ninguno', async () => {
  const cartero = await import('../scripts/operaciones/cartero.mjs');
  for (const b of [PNG, JPG, GIF, WEBP, PDF, EXE, SCRIPT, PS1, Buffer.alloc(0)]) {
    assert.equal(cartero.mimePorFirma(b), tipoPorFirma(b)?.mime ?? null, `los bytes ${b.subarray(0, 4).toString('hex')}`);
  }
  for (const b of [EXE, SCRIPT, PS1]) assert.equal(cartero.mimePorFirma(b), null);
});

test('el nombre en disco lo arma la PC: la extensión es la del TIPO, nunca la que trajo', async () => {
  const { nombreEnDisco } = await import('../scripts/operaciones/cartero.mjs');
  assert.equal(nombreEnDisco(0, 'Captura de pantalla 2026-10-17.png', 'image/png'), '1-Captura-de-pantalla-2026-10-17.png');
  assert.equal(nombreEnDisco(1, 'virus.exe', 'image/png'), '2-virus.png');
  assert.equal(nombreEnDisco(0, 'factura.pdf.bat', 'application/pdf'), '1-factura-pdf.pdf');
  assert.equal(nombreEnDisco(0, '..\\..\\Windows\\system32\\x.dll', 'image/jpeg'), '1-Windows-system32-x.jpg');
  assert.equal(nombreEnDisco(0, 'CON', 'image/gif'), '1-CON.gif', 'con el número adelante, un nombre reservado de Windows no lo es');
  assert.equal(nombreEnDisco(0, 'año ñandú.webp', 'image/webp'), '1-ano-nandu.webp');
  assert.equal(nombreEnDisco(0, '....', 'image/png'), '1-adjunto.png');
});

/** Un MaKo de mentira: `archivos` es lo que contesta a cada `?adjunto=`; `pedidos`, lo que da la vuelta. */
function servidor(archivos: Record<string, Buffer>, pedidos: unknown[] = []) {
  const pedidosVistos: string[] = [];
  const srv = createServer((req: IncomingMessage, res: ServerResponse) => {
    const u = new URL(req.url ?? '/', 'http://x');
    if (req.method === 'GET') {
      pedidosVistos.push(`${u.searchParams.get('pedido')}/${u.searchParams.get('adjunto')}`);
      const b = archivos[u.searchParams.get('adjunto') ?? ''];
      if (req.headers.authorization !== `Bearer mkop_${'x'.repeat(30)}` || !b) { res.statusCode = 404; res.end('{}'); return; }
      res.setHeader('content-type', 'application/octet-stream');
      res.end(b);
      return;
    }
    req.resume().on('end', () => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ pedidos, vencidos: 0, acuses: 0, cierres: 0 })); });
  });
  return { srv, pedidosVistos };
}
const escuchar = async (srv: ReturnType<typeof createServer>) => {
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', () => ok()));
  return `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
};

test('la PC baja sólo lo que coincide con lo firmado (tamaño, hash y tipo), a una carpeta por trabajo', async () => {
  const { bajarAdjuntos } = await import('../scripts/operaciones/cartero.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'adjuntos-test-'));
  const ID = 'aaaaaaaa-0000-4000-8000-0000000000a1';
  const otraCaptura = Buffer.concat([PNG, Buffer.from('?')]);
  const exeComoPng = EXE;
  const { srv } = servidor({ [REF1]: PNG, [REF2]: otraCaptura, '33333333-3333-4333-8333-333333333333': exeComoPng });
  const url = await escuchar(srv);
  const token = `mkop_${'x'.repeat(30)}`;
  try {
    const rutas = await bajarAdjuntos(url, token, ID, [adj(REF1, PNG, 'image/png', 'Mi captura.png')], dir);
    assert.deepEqual(rutas, [join(dir, ID, '1-Mi-captura.png')]);
    assert.deepEqual(readFileSync(rutas[0]), PNG, 'los bytes, tal cual');

    // MaKo da OTRO archivo que el firmado (mismo tamaño no alcanza: el hash no coincide).
    const ID2 = 'aaaaaaaa-0000-4000-8000-0000000000a2';
    const firmado = { ...adj(REF2, PNG, 'image/png'), bytes: otraCaptura.length };
    await assert.rejects(bajarAdjuntos(url, token, ID2, [firmado], dir), /no es el archivo firmado/);
    assert.equal(existsSync(join(dir, ID2)), false, 'si algo no coincide, no queda nada');

    // Un ejecutable con el hash BIEN firmado y el tipo de una foto: los bytes lo delatan.
    const ID3 = 'aaaaaaaa-0000-4000-8000-0000000000a3';
    await assert.rejects(bajarAdjuntos(url, token, ID3, [adj('33333333-3333-4333-8333-333333333333', exeComoPng, 'image/png', 'foto.png')], dir), /no es una foto ni un PDF/);
    assert.equal(existsSync(join(dir, ID3)), false);

    // Lo que no está o pesa distinto, tampoco.
    await assert.rejects(bajarAdjuntos(url, token, ID3, [{ ...adj(REF1, PNG, 'image/png'), bytes: PNG.length + 1 }], dir), /no pesa lo firmado/);
    await assert.rejects(bajarAdjuntos(url, token, ID3, [adj('44444444-4444-4444-8444-444444444444', PNG, 'image/png')], dir), /MaKo no lo dio \(404\)/);
    await assert.rejects(bajarAdjuntos(url, token, '../fuera', [adj(REF1, PNG, 'image/png')], dir), /id inválido/);
  } finally {
    srv.close();
  }
});

test('de punta a punta: el ciclo baja el adjunto de un trabajo firmado y el chat recibe su RUTA', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cartero-adj-'));
  const cfgDir = join(dir, 'cfg');
  const destino = 'cli_11111111-2222-4333-8444-555555555555';
  mkdirSync(join(cfgDir, 'sessions'), { recursive: true });
  writeFileSync(join(cfgDir, 'sessions', `${process.pid}.json`), JSON.stringify({
    pid: process.pid, sessionId: destino.slice(4), cwd: 'C:\\dev\\x', entrypoint: 'cli', status: 'idle',
    messagingSocketPath: '\\\\.\\pipe\\LOCAL\\cc-msg-prueba',
  }));
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const spki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const firmar = (t: string) => sign('sha256', Buffer.from(t, 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64');
  const mk = (id: string, adjuntos: AdjuntoPedido[]) => armarFirmable(nuevoPayload({ id, texto: 'mirá la captura', destino, cuenta: 'claude2', titulo: 'x', alcance: 'solo_esto', adjuntos }, Date.now()));
  const BUENO = 'aaaaaaaa-0000-4000-8000-0000000000b1';
  const TRUCHO = 'aaaaaaaa-0000-4000-8000-0000000000b2';
  const bueno = mk(BUENO, [adj(REF1, PNG, 'image/png', 'captura.png')]);
  // El servidor sirve otra cosa para el segundo: la firma dice un hash, los bytes son otros.
  const trucho = mk(TRUCHO, [{ ...adj(REF2, PNG, 'image/png'), bytes: EXE.length }]);
  const { srv } = servidor({ [REF1]: PNG, [REF2]: EXE }, [
    { id: BUENO, firmado: bueno, firma: firmar(bueno) },
    { id: TRUCHO, firmado: trucho, firma: firmar(trucho) },
  ]);
  const url = await escuchar(srv);
  try {
    writeFileSync(join(dir, 'config.json'), JSON.stringify({
      url, token: `mkop_${'x'.repeat(30)}`, cwds: ['C:\\dev\\'], carteros: { claude2: { fuente: 'cli', configDir: cfgDir } }, carpetas: {},
    }));
    writeFileSync(join(dir, 'claves.txt'), `${spki}\n`);
    const salida = await new Promise<string>((ok, mal) => execFile(process.execPath,
      [join(RAIZ, 'scripts/operaciones/cartero.mjs'), 'ciclo', '--cuenta', 'claude2'],
      { env: { ...process.env, CARTERO_DIR: dir, CARTERO_APP_DIR: join(dir, 'app'), CARTERO_CONFIG_DIR: cfgDir } },
      (e, so, se) => (e ? mal(new Error(se || e.message)) : ok(so))));
    const o = JSON.parse(salida) as { entregar: Array<{ id: string; mensaje: string }> };
    assert.deepEqual(o.entregar.map((e) => e.id), [BUENO], 'sale sólo el que coincide');
    const ruta = join(dir, 'adjuntos', BUENO, '1-captura.png');
    assert.ok(o.entregar[0].mensaje.includes(`- ${ruta}`), 'el chat recibe la ruta local');
    assert.deepEqual(readFileSync(ruta), PNG);
    assert.deepEqual(readdirSync(join(dir, 'adjuntos')), [BUENO], 'del trucho no queda carpeta');
    const acuse = JSON.parse(readFileSync(join(dir, 'claude2', 'acuses', `${TRUCHO}.json`), 'utf8')) as { estado: string; motivo: string };
    assert.equal(acuse.estado, 'no_entregado');
    assert.match(acuse.motivo, /No pude bajar un adjunto/);
  } finally {
    srv.close();
  }
});

test('la caja firma el hash que calculó ELLA, y no ofrece adjuntar hasta el cartero 1.9.0', async () => {
  const cartero = await import('../scripts/operaciones/cartero.mjs');
  assert.ok(aceptaAdjuntos(cartero.VERSION), `el cartero ${cartero.VERSION} baja adjuntos (${VERSION_ADJUNTOS})`);
  assert.equal(aceptaAdjuntos('1.8.1'), false, 'el instalado hoy no los baja: el trabajo saldría sin sus archivos');
  assert.equal(aceptaAdjuntos(null), false);
  assert.ok(aceptaAdjuntos('1.10.0') && aceptaAdjuntos('2.0.0'), 'la versión se compara por número, no por texto');

  const mandar = sinComentarios(leer('app/admin/operaciones/mandar.ts'));
  const subir = mandar.slice(mandar.indexOf('export async function subirAdjuntos'), mandar.indexOf('export async function copiar'));
  assert.match(subir, /crypto\.subtle\.digest\('SHA-256'/, 'el navegador calcula el hash de lo que sube');
  assert.match(subir, /sha256: propios\[i\]\.sha256/, 'y firma ESE, no el que devolvió MaKo');
  const motor = sinComentarios(leer('app/admin/operaciones/useCentro.ts'));
  assert.match(motor, /aceptaAdjuntos\(k\.version\)/, 'la caja mira la versión del Runner');
  for (const f of ['app/admin/operaciones/Conversacion.tsx', 'app/m/operaciones/ChatsMovil.tsx']) {
    const s = sinComentarios(leer(f));
    assert.match(s, /onPaste=\{\(e\) => alPegar\(e, adjuntos\)\}/, `${f}: pegar una captura`);
    assert.match(s, /<BotonAdjuntar a=\{adjuntos\}/, `${f}: el botón de adjuntar`);
  }
});

test('MaKo da un adjunto sólo al cartero, sólo de un trabajo en vuelo, y lo sube sólo con la guarda del Centro', () => {
  const lib = sinComentarios(leer('lib/operaciones-adjuntos.ts'));
  const dar = lib.slice(lib.indexOf('export async function adjuntoParaElCartero'), lib.indexOf('export function refsDe'));
  assert.match(dar, /\.eq\('estado', 'tomado'\)/, 'sólo de un trabajo que la PC está por entregar');
  assert.match(dar, /refsDe\(data\.firmado as string\)\.includes\(ref\)/, 'y que su texto firmado lo nombre');
  const ruta = sinComentarios(leer('app/api/operaciones/cartero/route.ts'));
  const get = ruta.slice(ruta.indexOf('export async function GET'), ruta.indexOf('export async function POST'));
  assert.ok(get.indexOf('tokenDelCarteroValido') < get.indexOf('adjuntoParaElCartero'), 'el token antes de leer');
  const subir = sinComentarios(leer('app/api/operaciones/adjuntos/route.ts'));
  assert.ok(subir.indexOf('puedeOperar(') > 0 && subir.indexOf('puedeOperar(') < subir.indexOf('formData()'), 'la guarda del Centro antes de leer el cuerpo');
});
