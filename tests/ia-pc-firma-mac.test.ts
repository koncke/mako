// =============================================================================
// La firma de la Mac (Developer ID + notarización con rcodesign), DESDE ESTA PC (23/10/2026)
// =============================================================================
// El Cerebro: Martín abre Apple Developer individual a su nombre; «Dejala preparada como la de Windows, con sus pasos y sin
// probar hasta tener el certificado». Lo que fija este test (scripts/ia-pc/firmar-mac.mjs, mako-pc.mjs y publicar-binarios):
//   1. cuándo se firma: con el certificado de Apple en su carpeta (fuera de OneDrive); antes, sin firmar, sin error;
//   2. la firma se LEE como la mira la Mac: cada página contra su hash, del certificado (no local), con marca de tiempo, el
//      runtime y el JIT, en las DOS rebanadas del universal (las firmas que trae Bun están vencidas: medido el 23/10);
//   3. firmar, revisar, notarizar y engrapar, en ese orden, y nada sube si algo falla;
//   4. la app firmada se copia al arranque (no hay guion), y el .zip lleva lo firmado con sus permisos;
//   5. el pedido del certificado y la clave de la API: una vez, sin pisar la clave.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, createPrivateKey } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import * as M from '../scripts/ia-pc/firmar-mac.mjs';
import { leerZip, zipConPermisos } from '../scripts/ia-pc/zip-unix.mjs';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const ARM64 = 0x0100000c;
const X86_64 = 0x01000007;
const MARCA = Buffer.from([0x06, 0x0b, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x10, 0x02, 0x0e]);
const temporal = () => mkdtempSync(path.join(tmpdir(), 'mako-firma-mac-test-'));

type Firma = { banderas?: number; cms?: 'certificado' | 'sin-marca' | 'vacia' | null; entitlements?: string | null; romper?: boolean } | null;
/**
 * Un Mach-O de 64 bits mínimo, con su firma ARMADA DE VERDAD: el CodeDirectory con el SHA-256 de cada página (la última,
 * parcial) hasta donde empieza la firma, los entitlements y la firma CMS. `romper` cambia un byte de código DESPUÉS de firmar
 * (lo que le pasa al ejecutable de Bun: la firma que trae ya no es la de lo que hay).
 */
function macho(cputype: number, firma: Firma = { banderas: 0x10000, cms: 'certificado', entitlements: M.entitlementsDeBun() }) {
  const codigo = 2 * 4096 + 700;
  const b = Buffer.alloc(codigo, 0x5a);
  b.writeUInt32LE(0xfeedfacf, 0);
  b.writeUInt32LE(cputype, 4);
  b.writeUInt32LE(cputype === X86_64 ? 3 : 0, 8);
  b.writeUInt32LE(2, 12);
  b.writeUInt32LE(firma ? 1 : 0, 16);
  b.writeUInt32LE(firma ? 16 : 0, 20);
  b.fill(0, 24, 48);
  if (!firma) return b;
  const blobs: Array<[number, Buffer]> = [];
  const nSlots = Math.ceil(codigo / 4096);
  const ident = Buffer.from('com.hola-mako.app\0');
  const cd = Buffer.alloc(88 + ident.length + nSlots * 32);
  // La firma va justo después del código: el load command dice dónde, y eso también entra en el hash.
  const superCab = 12 + 8 * (1 + (firma.entitlements != null ? 1 : 0) + (firma.cms ? 1 : 0));
  const ent = firma.entitlements != null ? Buffer.concat([Buffer.alloc(8), Buffer.from(firma.entitlements)]) : null;
  if (ent) { ent.writeUInt32BE(0xfade7171, 0); ent.writeUInt32BE(ent.length, 4); }
  const cmsCuerpo = firma.cms === 'certificado' ? Buffer.concat([Buffer.alloc(30, 1), MARCA, Buffer.alloc(30, 2)]) : firma.cms === 'sin-marca' ? Buffer.alloc(60, 3) : Buffer.alloc(0);
  const cms = firma.cms ? Buffer.concat([Buffer.alloc(8), cmsCuerpo]) : null;
  if (cms) { cms.writeUInt32BE(0xfade0b01, 0); cms.writeUInt32BE(cms.length, 4); }
  const total = superCab + cd.length + (ent?.length ?? 0) + (cms?.length ?? 0);
  b.writeUInt32LE(0x1d, 32);
  b.writeUInt32LE(16, 36);
  b.writeUInt32LE(codigo, 40);
  b.writeUInt32LE(total, 44);
  cd.writeUInt32BE(0xfade0c02, 0);
  cd.writeUInt32BE(cd.length, 4);
  cd.writeUInt32BE(0x20400, 8);
  cd.writeUInt32BE(firma.banderas ?? 0, 12);
  cd.writeUInt32BE(88 + ident.length, 16);
  cd.writeUInt32BE(88, 20);
  cd.writeUInt32BE(0, 24);
  cd.writeUInt32BE(nSlots, 28);
  cd.writeUInt32BE(codigo, 32);
  cd[36] = 32; cd[37] = 2; cd[38] = 0; cd[39] = 12;
  ident.copy(cd, 88);
  for (let s = 0; s < nSlots; s++) createHash('sha256').update(b.subarray(s * 4096, Math.min((s + 1) * 4096, codigo))).digest().copy(cd, 88 + ident.length + s * 32);
  blobs.push([0, cd]);
  if (ent) blobs.push([5, ent]);
  if (cms) blobs.push([0x10000, cms]);
  const sb = Buffer.alloc(superCab);
  sb.writeUInt32BE(0xfade0cc0, 0);
  sb.writeUInt32BE(total, 4);
  sb.writeUInt32BE(blobs.length, 8);
  let off = superCab;
  blobs.forEach(([tipo, blob], i) => { sb.writeUInt32BE(tipo, 12 + i * 8); sb.writeUInt32BE(off, 16 + i * 8); off += blob.length; });
  const out = Buffer.concat([b, sb, ...blobs.map(([, x]) => x)]);
  if (firma.romper) out[codigo - 10] ^= 0xff;
  return out;
}
const universalFirmado = (firma?: Firma) => M.machoUniversal([macho(X86_64, firma), macho(ARM64, firma)]);

test('1. cuándo se firma: con el certificado de Apple en su carpeta, fuera de OneDrive; antes, sin firmar y sin error', () => {
  const d = temporal();
  try {
    const carpeta = path.join(d, '.mako-firma-mac');
    const rc = path.join(d, 'rcodesign.exe');
    writeFileSync(rc, '');
    mkdirSync(carpeta);
    const poner = (k: keyof typeof M.ARCHIVOS_MAC) => writeFileSync(path.join(carpeta, M.ARCHIVOS_MAC[k]), 'x');
    // Sin nada, o con la clave y el pedido armados esperando a Apple: sin firmar, sin error.
    assert.equal(M.configDeFirmaMac({ FIRMA_MAC: carpeta }), null);
    poner('clave'); poner('pedido');
    assert.equal(M.configDeFirmaMac({ FIRMA_MAC: carpeta, RCODESIGN: rc }), null, 'esperar el certificado de Apple no es un error');
    // Con el certificado: todo lo demás tiene que estar, y lo que falta se dice.
    poner('certificado');
    assert.throws(() => M.configDeFirmaMac({ FIRMA_MAC: carpeta }), /^Error: para firmar la Mac faltan: RCODESIGN, api-key\.json \(en /);
    assert.throws(() => M.configDeFirmaMac({ FIRMA_MAC: carpeta, RCODESIGN: path.join(d, 'no-esta.exe') }), /faltan: rcodesign \(.*no-esta\.exe\), api-key\.json/);
    poner('api');
    const c = M.configDeFirmaMac({ FIRMA_MAC: carpeta, RCODESIGN: rc });
    assert.deepEqual(c, { herramienta: rc, carpeta, clave: path.join(carpeta, 'developer-id.key'), certificado: path.join(carpeta, 'developerID_application.cer'), api: path.join(carpeta, 'api-key.json') });
    rmSync(path.join(carpeta, M.ARCHIVOS_MAC.clave));
    assert.throws(() => M.configDeFirmaMac({ FIRMA_MAC: carpeta, RCODESIGN: rc }), /faltan: developer-id\.key/);
    poner('clave');
    // Del archivo de la firma (el mismo de Windows), que gana al entorno.
    const archivo = path.join(d, '.mako-firma.env');
    writeFileSync(archivo, `RCODESIGN=${rc}\nFIRMA_MAC=${carpeta}\n`);
    assert.equal(M.firmaMacDeEstaPc({ rutaFirma: archivo, proceso: { RCODESIGN: 'C:\\otra.exe' } as unknown as NodeJS.ProcessEnv, parse })!.herramienta, rc);
    assert.equal(M.firmaMacDeEstaPc({ rutaFirma: path.join(d, 'no.env'), proceso: { FIRMA_MAC: path.join(d, 'vacia') } as unknown as NodeJS.ProcessEnv, parse }), null);
    // Nunca en OneDrive: la clave de Martín no va a la nube.
    for (const od of ['C:\\Users\\marti\\OneDrive\\Escritorio\\firma', 'C:\\Users\\marti\\OneDrive - Elevate\\firma', '/Users/x/OneDrive/f']) {
      assert.throws(() => M.configDeFirmaMac({ FIRMA_MAC: od }), /no va en OneDrive/, od);
    }
    assert.match(M.carpetaMacPorDefecto(), /[\\/]\.mako-firma-mac$/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('2. la firma se lee como la mira la Mac: página por página, del certificado, con marca de tiempo, runtime y JIT, en las dos rebanadas', () => {
  // El universal: cada rebanada alineada a 16 KB, y vuelve idéntica.
  const x = macho(X86_64), a = macho(ARM64);
  const u = M.machoUniversal([x, a]);
  assert.equal(u.readUInt32BE(0), 0xcafebabe);
  const r = M.rebanadasDeMacho(u);
  assert.deepEqual(r.map((s: { cputype: number }) => s.cputype), [X86_64, ARM64]);
  assert.ok(r[0].datos.equals(x) && r[1].datos.equals(a), 'una rebanada no vuelve idéntica');
  for (let i = 0; i < 2; i++) assert.equal(u.readUInt32BE(8 + 20 * i + 8) % 16384, 0, 'rebanada sin alinear');
  assert.equal(u.readUInt32BE(8 + 4), 3, 'el subtipo de Intel');
  assert.throws(() => M.machoUniversal([Buffer.from('no soy un ejecutable de Mac, soy un texto bastante largo')]), /no es un ejecutable de Mac/);
  // Bien firmado (como lo deja rcodesign con Developer ID): sin problemas.
  const f = M.firmaDeMacho(x);
  assert.deepEqual({ ...f, entitlements: f.entitlements.includes('allow-jit') }, { firmada: true, local: false, runtime: true, cms: true, marcaDeTiempo: true, paginasMalas: 0, entitlements: true });
  assert.deepEqual(M.problemasParaNotarizar(u), []);
  // Lo que se midió en los ejecutables de Bun el 23/10: una firma local vencida (arm64) y la de Oven vencida (Intel).
  assert.deepEqual(M.firmaDeMacho(macho(ARM64, { banderas: 0x20002, cms: null, entitlements: null, romper: true })), { firmada: false, local: true, runtime: false, cms: false, marcaDeTiempo: false, paginasMalas: 1, entitlements: '' });
  const casos: Array<[string, Firma, RegExp]> = [
    ['una página que no es la firmada', { banderas: 0x10000, cms: 'certificado', entitlements: M.entitlementsDeBun(), romper: true }, /sin firma válida \(1 páginas no coinciden\)/],
    ['sin firma', null, /sin firma válida$/],
    ['firma local', { banderas: 0x10002, cms: 'certificado', entitlements: M.entitlementsDeBun() }, /firma local, no la del certificado/],
    ['CMS vacía (local)', { banderas: 0x10000, cms: 'vacia', entitlements: M.entitlementsDeBun() }, /firma local/],
    ['sin CMS', { banderas: 0x10000, cms: null, entitlements: M.entitlementsDeBun() }, /firma local/],
    ['sin marca de tiempo', { banderas: 0x10000, cms: 'sin-marca', entitlements: M.entitlementsDeBun() }, /sin marca de tiempo/],
    ['sin hardened runtime', { banderas: 0, cms: 'certificado', entitlements: M.entitlementsDeBun() }, /sin el hardened runtime/],
    ['sin el JIT', { banderas: 0x10000, cms: 'certificado', entitlements: '<plist><dict></dict></plist>' }, /sin el permiso del JIT/],
  ];
  for (const [nombre, firma, espera] of casos) {
    // Mal en UNA rebanada (la de Apple): se ve igual.
    const p = M.problemasParaNotarizar(M.machoUniversal([macho(X86_64), macho(ARM64, firma)]));
    assert.equal(p.length, 1, `${nombre}: ${p.join('; ')}`);
    assert.match(p[0], new RegExp(`^arm64: ${espera.source.replace(/^\^/, '')}`), nombre);
  }
  assert.deepEqual(M.problemasParaNotarizar(macho(ARM64)), ['no trae las dos (Intel y Apple)']);
  // Los entitlements de Bun (bun.com/docs/guides/runtime/codesign-macos-executable).
  for (const k of ['allow-jit', 'allow-unsigned-executable-memory', 'disable-executable-page-protection', 'allow-dyld-environment-variables', 'disable-library-validation']) {
    assert.ok(M.entitlementsDeBun().includes(`<key>com.apple.security.cs.${k}</key><true/>`), k);
  }
});

/** Una rcodesign de mentira: `firma` es lo que deja al firmar; `ticket`, si engrapa. */
function rcodesign({ firma = universalFirmado(), estadoFirma = 0, codeResources = true, ticket = true }: { firma?: Buffer; estadoFirma?: number; codeResources?: boolean; ticket?: boolean } = {}) {
  const llamadas: Array<{ args: string[]; opts: Record<string, any>; entitlements?: string }> = [];
  const correr = (_h: string, args: string[], opts: Record<string, any>) => {
    const app = args.at(-1)!;
    const ll: { args: string[]; opts: Record<string, any>; entitlements?: string } = { args, opts };
    llamadas.push(ll);
    if (args[0] === 'sign') {
      ll.entitlements = readFileSync(args[args.indexOf('--entitlements-xml-file') + 1], 'utf8');
      if (estadoFirma !== 0) return { status: estadoFirma, stdout: '', stderr: 'error: certificate not trusted' };
      writeFileSync(path.join(app, 'Contents', 'MacOS', 'MaKo'), firma);
      if (codeResources) { mkdirSync(path.join(app, 'Contents', '_CodeSignature'), { recursive: true }); writeFileSync(path.join(app, 'Contents', '_CodeSignature', 'CodeResources'), '<plist/>'); }
      return { status: 0, stdout: 'signing complete', stderr: '' };
    }
    if (args[0] === 'notary-submit') {
      if (ticket) writeFileSync(path.join(app, 'Contents', 'CodeResources'), Buffer.alloc(900, 7));
      return { status: 0, stdout: 'Accepted', stderr: '' };
    }
    return { status: 1, stdout: '', stderr: 'comando desconocido' };
  };
  return { correr, llamadas };
}
function appSinFirmar(d: string) {
  const app = path.join(d, 'MaKo.app');
  mkdirSync(path.join(app, 'Contents', 'MacOS'), { recursive: true });
  writeFileSync(path.join(app, 'Contents', 'Info.plist'), '<plist/>');
  writeFileSync(path.join(app, 'Contents', 'MacOS', 'MaKo'), M.machoUniversal([macho(X86_64, null), macho(ARM64, null)]));
  return app;
}
const CFG = { herramienta: 'C:\\h\\rcodesign.exe', carpeta: 'C:\\Users\\m\\.mako-firma-mac', clave: 'C:\\Users\\m\\.mako-firma-mac\\developer-id.key', certificado: 'C:\\Users\\m\\.mako-firma-mac\\developerID_application.cer', api: 'C:\\Users\\m\\.mako-firma-mac\\api-key.json' };

test('3. firmar, revisar, notarizar y engrapar, en ese orden; si algo falla, corta', () => {
  {
    const d = temporal();
    try {
      const app = appSinFirmar(d);
      const r = rcodesign();
      M.firmarAppMac(CFG, app, r);
      assert.deepEqual(r.llamadas.map((l) => l.args[0]), ['sign', 'notary-submit']);
      const [firma, notario] = r.llamadas;
      assert.deepEqual(firma.args, ['sign', '--for-notarization', '--pem-file', CFG.clave, '--certificate-der-file', CFG.certificado, '--entitlements-xml-file', firma.args[7], app]);
      assert.equal(firma.entitlements, M.entitlementsDeBun(), 'sin los entitlements de Bun, no arranca con el runtime');
      assert.equal(existsSync(firma.args[7]), false, 'el archivo de los entitlements quedó');
      assert.deepEqual(notario.args, ['notary-submit', '--api-key-file', CFG.api, '--staple', '--max-wait-seconds', '1800', app]);
      for (const l of r.llamadas) { assert.equal(l.opts.input, '', 'con la entrada abierta, si pregunta algo se queda esperando'); assert.ok(l.opts.timeout > 0); }
    } finally { rmSync(d, { recursive: true, force: true }); }
  }
  const malos: Array<[string, Parameters<typeof rcodesign>[0], RegExp, string[]]> = [
    ['rcodesign sale con error', { estadoFirma: 1 }, /rcodesign sign salió con 1: .*certificate not trusted/, ['sign']],
    ['sale con 0 y deja la firma local', { firma: M.machoUniversal([macho(X86_64, { banderas: 0x20002, cms: null, entitlements: null }), macho(ARM64)]) }, /no sirve para notarizar: x86_64: firma local/, ['sign']],
    ['sale con 0 y no firma', { firma: M.machoUniversal([macho(X86_64, null), macho(ARM64, null)]) }, /no sirve para notarizar: x86_64: sin firma válida; arm64: sin firma válida/, ['sign']],
    ['sin el sello del paquete', { codeResources: false }, /sin Contents\/_CodeSignature\/CodeResources/, ['sign']],
    ['Apple no devuelve el ticket', { ticket: false }, /no devolvió el ticket/, ['sign', 'notary-submit']],
  ];
  for (const [nombre, op, espera, corridas] of malos) {
    const d = temporal();
    try {
      const r = rcodesign(op);
      assert.throws(() => M.firmarAppMac(CFG, appSinFirmar(d), r), espera, nombre);
      assert.deepEqual(r.llamadas.map((l) => l.args[0]), corridas, `${nombre}: notarizó lo que no estaba bien firmado`);
    } finally { rmSync(d, { recursive: true, force: true }); }
  }
});

test('4. la app firmada se copia al arranque (no hay guion) y el .zip lleva lo firmado con sus permisos', () => {
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('./_ia-pc-firma-mac-hijo.mjs', import.meta.url))], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 60_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@FIRMAMAC@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  const h = JSON.parse(linea.slice('@@FIRMAMAC@@'.length));
  assert.deepEqual(h.esLaApp, [true, true, false, false, false], 'confunde la app firmada con la copia del arranque o con el programa de la app sin firmar');
  assert.equal(h.primera, true);
  assert.equal(h.contenido, 'el programa firmado, versión nueva');
  assert.deepEqual(h.cuarentena, [true], 'no le sacó la cuarentena a la copia');
  assert.equal(h.sinNuevo, true);
  if (h.modo !== 'windows') assert.equal(h.modo, '755');
  assert.equal(h.pisada, 'el programa firmado, otra versión');
  // El programa: abierta desde Finder (sin nada, o con -psn_), se copia ANTES de conectar; la copia del arranque sigue con `correr`.
  const p = sinComentarios(leer('scripts/ia-pc/mako-pc.mjs'));
  assert.match(p, /const cmd = esLaAppDeMac\(\) && \(primero == null \|\| primero\.startsWith\('-psn_'\)\) \? 'app-firmada' : primero \?\? 'correr';/);
  assert.match(p, /else if \(cmd === 'app-firmada'\) Promise\.resolve\(\)\.then\(\(\) => \{ copiarLaAppAlArranque\(\); return abrirLaApp\(\); \}\)\.then\(salir, fallar\);/);
  const copiar = p.slice(p.indexOf('export function copiarLaAppAlArranque'), p.indexOf('export function instalarClaudeCode'));
  assert.doesNotMatch(copiar, /codesign/, 'la firma local pisaría la de Apple');
  // El .zip: el ejecutable con 0755, lo demás 0644, con el sello y el ticket adentro.
  const d = temporal();
  try {
    const app = appSinFirmar(d);
    M.firmarAppMac(CFG, app, rcodesign());
    const z = leerZip(zipConPermisos(M.entradasDeLaApp(app)));
    assert.deepEqual(z.map((e: { nombre: string; modo: number }) => [e.nombre, e.modo.toString(8)]), [
      ['MaKo.app/', '40755'],
      ['MaKo.app/Contents/', '40755'],
      ['MaKo.app/Contents/CodeResources', '100644'],
      ['MaKo.app/Contents/Info.plist', '100644'],
      ['MaKo.app/Contents/MacOS/', '40755'],
      ['MaKo.app/Contents/MacOS/MaKo', '100755'],
      ['MaKo.app/Contents/_CodeSignature/', '40755'],
      ['MaKo.app/Contents/_CodeSignature/CodeResources', '100644'],
    ]);
    assert.deepEqual(M.problemasParaNotarizar(z.find((e: { nombre: string }) => e.nombre === 'MaKo.app/Contents/MacOS/MaKo')!.datos), [], 'el .zip no lleva lo firmado');
  } finally { rmSync(d, { recursive: true, force: true }); }
  // publicar-binarios: la firmada con el universal, firmada ANTES de zipear; la de siempre, sin firmar.
  const s = sinComentarios(leer('scripts/ia-pc/publicar-binarios.mts'));
  const en = (t: string) => { const i = s.indexOf(t); assert.ok(i >= 0, `falta: ${t}`); return i; };
  assert.ok(en("writeFileSync(path.join(app, 'Contents', 'MacOS', 'MaKo'), machoUniversal([crudos['mac-x64'], crudos['mac-arm64']]));") < en('firmarAppMac(FIRMA_MAC, app);'));
  assert.ok(en('firmarAppMac(FIRMA_MAC, app);') < en('appMac = zipConPermisos(entradasDeLaApp(app));'));
  assert.ok(en('if (FIRMAR_MAC) {') < en("{ nombre: 'MaKo.app/Contents/MacOS/MaKo', datos: lanzadorDeLaAppMac(), modo: 0o755 }"));
  assert.match(s, /const FIRMAR_MAC = FIRMA_MAC != null && \(APLICAR \|\| process\.argv\.includes\('--probar-firma'\)\);/);
  assert.ok(en('firmaMacDeEstaPc({') < en('for (const o of OBJETIVOS)'), 'la firma de la Mac se lee después de armar todo');
});

test('5. el pedido del certificado y la clave de la API: una vez, sin pisar la clave', () => {
  const d = temporal();
  try {
    const carpeta = path.join(d, '.mako-firma-mac');
    const rc = path.join(d, 'rcodesign.exe');
    writeFileSync(rc, '');
    const llamadas: string[][] = [];
    const bien = (_h: string, args: string[]) => { llamadas.push(args); writeFileSync(args[args.indexOf('--csr-pem-file') + 1], '-----BEGIN CERTIFICATE REQUEST-----'); return { status: 0 }; };
    const pedido = M.armarPedido({ carpeta, herramienta: rc, correr: bien });
    assert.equal(pedido, path.join(carpeta, 'developer-id.csr'));
    const clave = path.join(carpeta, 'developer-id.key');
    assert.deepEqual(llamadas[0], ['generate-certificate-signing-request', '--pem-file', clave, '--csr-pem-file', pedido]);
    const k = createPrivateKey(readFileSync(clave, 'utf8'));
    assert.equal(k.asymmetricKeyType, 'rsa');
    assert.equal(k.asymmetricKeyDetails?.modulusLength, 2048, 'Apple pide RSA 2048');
    assert.match(readFileSync(clave, 'utf8'), /^-----BEGIN PRIVATE KEY-----/);
    const antes = readFileSync(clave, 'utf8');
    assert.throws(() => M.armarPedido({ carpeta, herramienta: rc, correr: bien }), /no la piso/);
    assert.equal(readFileSync(clave, 'utf8'), antes, 'pisó la clave: el certificado de Apple ya no serviría');
    // Si rcodesign falla, la clave sin pedido se saca (se puede volver a intentar).
    const otra = path.join(d, 'otra');
    assert.throws(() => M.armarPedido({ carpeta: otra, herramienta: rc, correr: () => ({ status: 2, stderr: 'boom' }) }), /salió con 2/);
    assert.equal(existsSync(path.join(otra, 'developer-id.key')), false);
    // En OneDrive, ni se crea la carpeta (una carpeta temporal con OneDrive en el camino: sin la guarda, se armaría ahí).
    const od = path.join(d, 'OneDrive', 'firma');
    assert.throws(() => M.armarPedido({ carpeta: od, herramienta: rc, correr: bien }), /la firma de la Mac no va en OneDrive/);
    assert.equal(existsSync(od), false, 'armó la clave en OneDrive');
    assert.throws(() => M.armarPedido({ carpeta: path.join(d, 'z'), herramienta: path.join(d, 'no.exe'), correr: bien }), /falta rcodesign/);
    // La clave de la API: el .p8 de Apple, su Key ID y el Issuer ID, al JSON que lee rcodesign.
    const p8 = path.join(d, 'AuthKey_ABC123.p8');
    writeFileSync(p8, 'k');
    const api: string[][] = [];
    assert.equal(M.armarClaveApi({ carpeta, herramienta: rc, emisor: 'uuid-emisor', idDeClave: 'ABC123', p8, correr: (_h: string, a: string[]) => { api.push(a); return { status: 0 }; } }), path.join(carpeta, 'api-key.json'));
    assert.deepEqual(api[0], ['encode-app-store-connect-api-key', '-o', path.join(carpeta, 'api-key.json'), 'uuid-emisor', 'ABC123', p8]);
    assert.throws(() => M.armarClaveApi({ carpeta, herramienta: rc, emisor: 'u', idDeClave: '', p8 }), /uso: clave-api/);
    const odApi = path.join(d, 'OneDrive', 'api');
    assert.throws(() => M.armarClaveApi({ carpeta: odApi, herramienta: rc, emisor: 'u', idDeClave: 'k', p8, correr: () => ({ status: 0 }) }), /la firma de la Mac no va en OneDrive/);
    assert.equal(existsSync(odApi), false, 'armó la clave de la API en OneDrive');
  } finally { rmSync(d, { recursive: true, force: true }); }
});
