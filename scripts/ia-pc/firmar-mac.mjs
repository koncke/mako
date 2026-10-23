// =============================================================================
// firmar-mac — MaKo.app firmada (Developer ID) y notarizada, DESDE ESTA PC con rcodesign
// =============================================================================
// El Cerebro, 23/10/2026: Martín abre Apple Developer individual a su nombre (US$99/año); «Dejala preparada como la de
// Windows, con sus pasos y sin probar hasta tener el certificado». Los pasos de Martín: docs/plan-instalador-escritorio.md ›
// «Firmar la Mac: lo que hace Martín». publicar-binarios.mts llama a esto ANTES de armar el .zip de la Mac.
//
// No hay Mac acá: `codesign` y `notarytool` son de macOS. rcodesign (github.com/indygreg/apple-platform-rs, 0.29.0 trae el
// .exe de Windows) firma, notariza y engrapa desde Windows con el certificado y la clave de la API de App Store Connect.
//
// Medido el 23/10/2026 sobre ejecutables de Bun 1.2.21 armados en esta PC (scratchpad bunmac):
//   - Bun guarda el programa en una sección propia (`__BUN,__bun`): firmarlo DESPUÉS no lo rompe.
//   - Las firmas que traen están vencidas: la de arm64 (local, del linker) no coincide en la última página, y la de Intel es
//     la de Oven con dos páginas que ya no son (la cabecera y la de `__BUN`). Sin firma nueva, el chip de Apple no lo corre: por
//     eso el lanzador de la app SIN firmar le pone la firma local en esa Mac.
//   - Firmada, la app NO puede tener un guion como ejecutable: la firma de un guion vive en atributos extendidos, que un .zip
//     no guarda. Va UN Mach-O universal (Intel y Apple) en Contents/MacOS/MaKo, que al abrirse se copia a ~/.mako-pc/bin
//     (scripts/ia-pc/mako-pc.mjs → copiarLaAppAlArranque).
//   - El ticket de la notarización queda en Contents/CodeResources (rcodesign, stapling.rs): se zipea con lo demás.
// =============================================================================

import { spawnSync } from 'node:child_process';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** La carpeta de la firma de la Mac: FUERA de OneDrive (el Escritorio lo está). */
export const carpetaMacPorDefecto = () => path.join(homedir(), '.mako-firma-mac');
/** Lo que hay en esa carpeta. La clave y el pedido los arma `pedido`; el certificado lo baja Martín de Apple. */
export const ARCHIVOS_MAC = {
  clave: 'developer-id.key',
  pedido: 'developer-id.csr',
  certificado: 'developerID_application.cer',
  api: 'api-key.json',
};

/**
 * Lo que necesita el ejecutable de Bun con el «hardened runtime» que pide la notarización (bun.com/docs/guides/runtime/
 * codesign-macos-executable): sin el JIT, JavaScriptCore no arranca.
 */
export const ENTITLEMENTS_DE_BUN = [
  'com.apple.security.cs.allow-jit',
  'com.apple.security.cs.allow-unsigned-executable-memory',
  'com.apple.security.cs.disable-executable-page-protection',
  'com.apple.security.cs.allow-dyld-environment-variables',
  'com.apple.security.cs.disable-library-validation',
];
export function entitlementsDeBun() {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0"><dict>',
    ...ENTITLEMENTS_DE_BUN.map((k) => `<key>${k}</key><true/>`),
    '</dict></plist>',
    '',
  ].join('\n');
}

const puesta = (env, v) => typeof env[v] === 'string' && env[v].trim() !== '';
const enOneDrive = (p) => /[\\/]OneDrive[^\\/]*[\\/]/i.test(`${p}${path.sep}`);

/**
 * La firma de la Mac de ESTA PC. null mientras no esté el certificado de Apple en la carpeta (con la clave y el pedido ya
 * armados, esperar a Apple es lo normal). Con el certificado, falta algo = error con lo que falta. La carpeta nunca en OneDrive.
 * Variables (del archivo de la firma, %USERPROFILE%\.mako-firma.env, o del entorno): RCODESIGN y, si no es la de siempre,
 * FIRMA_MAC (la carpeta).
 */
export function configDeFirmaMac(env, { existe = existsSync } = {}) {
  const carpeta = puesta(env, 'FIRMA_MAC') ? env.FIRMA_MAC.trim() : carpetaMacPorDefecto();
  if (enOneDrive(carpeta)) throw new Error(`la firma de la Mac no va en OneDrive (${carpeta}): lo sube a la nube`);
  const en = (k) => path.join(carpeta, ARCHIVOS_MAC[k]);
  if (!existe(en('certificado'))) return null;
  const herramienta = puesta(env, 'RCODESIGN') ? env.RCODESIGN.trim() : null;
  const faltan = [];
  if (!herramienta) faltan.push('RCODESIGN');
  else if (!existe(herramienta)) faltan.push(`rcodesign (${herramienta})`);
  for (const k of ['clave', 'api']) if (!existe(en(k))) faltan.push(ARCHIVOS_MAC[k]);
  if (faltan.length) throw new Error(`para firmar la Mac faltan: ${faltan.join(', ')} (en ${carpeta})`);
  return { herramienta, carpeta, clave: en('clave'), certificado: en('certificado'), api: en('api') };
}

/** Para publicar-binarios: las variables del archivo de la firma (si está) y, si no, del entorno. */
export function firmaMacDeEstaPc({ rutaFirma, proceso = process.env, parse, existe = existsSync }) {
  const delArchivo = rutaFirma && existe(rutaFirma) ? parse(readFileSync(rutaFirma, 'utf8')) : {};
  return configDeFirmaMac({ RCODESIGN: proceso.RCODESIGN, FIRMA_MAC: proceso.FIRMA_MAC, ...delArchivo }, { existe });
}

// ── Mach-O: el universal y su firma ──────────────────────────────────────────

const MH_MAGIC_64 = 0xfeedfacf;
const FAT_MAGIC = 0xcafebabe;
const LC_CODE_SIGNATURE = 0x1d;
const CS_ADHOC = 0x2;
const CS_RUNTIME = 0x10000;
/** El OID de la marca de tiempo dentro de la firma CMS (id-smime-aa-timeStampToken), en DER. */
const OID_MARCA_DE_TIEMPO = Buffer.from([0x06, 0x0b, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x10, 0x02, 0x0e]);

const comoBuffer = (b) => (Buffer.isBuffer(b) ? b : Buffer.from(b.buffer, b.byteOffset, b.byteLength));

/** Un Mach-O de 64 bits (los de Bun): su procesador. */
export function cpuDeMacho(macho) {
  const b = comoBuffer(macho);
  if (b.length < 32 || b.readUInt32LE(0) !== MH_MAGIC_64) throw new Error('no es un ejecutable de Mac de 64 bits');
  return { cputype: b.readUInt32LE(4), cpusubtype: b.readUInt32LE(8) };
}

/** Un ejecutable universal con los de Intel y Apple (lo que hace `lipo -create`), cada uno alineado a 16 KB. */
export function machoUniversal(rebanadas) {
  const ALINEA = 14;
  const paso = 2 ** ALINEA;
  const cab = Buffer.alloc(8 + 20 * rebanadas.length);
  cab.writeUInt32BE(FAT_MAGIC, 0);
  cab.writeUInt32BE(rebanadas.length, 4);
  const partes = [cab];
  let off = cab.length;
  rebanadas.forEach((r, i) => {
    const b = comoBuffer(r);
    const { cputype, cpusubtype } = cpuDeMacho(b);
    const ini = Math.ceil(off / paso) * paso;
    partes.push(Buffer.alloc(ini - off), b);
    const e = 8 + 20 * i;
    cab.writeUInt32BE(cputype, e);
    cab.writeUInt32BE(cpusubtype, e + 4);
    cab.writeUInt32BE(ini, e + 8);
    cab.writeUInt32BE(b.length, e + 12);
    cab.writeUInt32BE(ALINEA, e + 16);
    off = ini + b.length;
  });
  return Buffer.concat(partes);
}

/** Las rebanadas de un universal (o el ejecutable entero, si no lo es). */
export function rebanadasDeMacho(macho) {
  const b = comoBuffer(macho);
  if (b.length >= 8 && b.readUInt32BE(0) === FAT_MAGIC) {
    const n = b.readUInt32BE(4);
    return Array.from({ length: n }, (_, i) => {
      const e = 8 + 20 * i;
      return { cputype: b.readUInt32BE(e), datos: b.subarray(b.readUInt32BE(e + 8), b.readUInt32BE(e + 8) + b.readUInt32BE(e + 12)) };
    });
  }
  return [{ cputype: cpuDeMacho(b).cputype, datos: b }];
}

/**
 * La firma de UN Mach-O, leída como la mira el sistema: el CodeDirectory (sus banderas y el hash de CADA página contra el
 * archivo), la firma CMS (la del certificado; una local no la trae o la trae vacía), su marca de tiempo y los entitlements.
 */
export function firmaDeMacho(macho) {
  const b = comoBuffer(macho);
  cpuDeMacho(b);
  const ncmds = b.readUInt32LE(16);
  let p = 32;
  let lc = null;
  for (let i = 0; i < ncmds && p + 8 <= b.length; i++) {
    if (b.readUInt32LE(p) === LC_CODE_SIGNATURE) lc = { off: b.readUInt32LE(p + 8), tam: b.readUInt32LE(p + 12) };
    p += b.readUInt32LE(p + 4);
  }
  const sin = { firmada: false, local: false, runtime: false, cms: false, marcaDeTiempo: false, paginasMalas: 0, entitlements: '' };
  if (!lc || lc.off + lc.tam > b.length) return sin;
  const sb = b.subarray(lc.off, lc.off + lc.tam);
  if (sb.length < 12 || sb.readUInt32BE(0) !== 0xfade0cc0) return sin;
  const r = { ...sin };
  let cd = null;
  for (let i = 0; i < sb.readUInt32BE(8); i++) {
    const tipo = sb.readUInt32BE(12 + i * 8);
    const blob = sb.subarray(sb.readUInt32BE(16 + i * 8));
    const largo = blob.readUInt32BE(4);
    if (tipo === 0) cd = blob;
    if (tipo === 5) r.entitlements = blob.subarray(8, largo).toString('utf8');
    if (tipo === 0x10000 && largo > 8) { r.cms = true; r.marcaDeTiempo = blob.subarray(8, largo).includes(OID_MARCA_DE_TIEMPO); }
  }
  if (!cd || cd.readUInt32BE(0) !== 0xfade0c02) return sin;
  const banderas = cd.readUInt32BE(12);
  const hashOffset = cd.readUInt32BE(16);
  const slots = cd.readUInt32BE(28);
  const limite = cd.readUInt32BE(32);
  const tamHash = cd[36];
  const algoritmo = cd[37] === 2 ? 'sha256' : cd[37] === 1 ? 'sha1' : null;
  const pagina = 2 ** cd[39];
  if (!algoritmo || limite > b.length) return sin;
  for (let s = 0; s < slots; s++) {
    const h = createHash(algoritmo).update(b.subarray(s * pagina, Math.min((s + 1) * pagina, limite))).digest().subarray(0, tamHash);
    if (!h.equals(cd.subarray(hashOffset + s * tamHash, hashOffset + (s + 1) * tamHash))) r.paginasMalas++;
  }
  r.firmada = r.paginasMalas === 0;
  r.local = (banderas & CS_ADHOC) !== 0;
  r.runtime = (banderas & CS_RUNTIME) !== 0;
  return r;
}

/** Lo que pide la notarización, rebanada por rebanada: firma válida, del certificado (no local), con marca de tiempo, el runtime y el JIT. */
export function problemasParaNotarizar(macho) {
  const out = [];
  const rebanadas = rebanadasDeMacho(macho);
  for (const { cputype, datos } of rebanadas) {
    const cpu = cputype === 0x0100000c ? 'arm64' : cputype === 0x01000007 ? 'x86_64' : cputype.toString(16);
    const f = firmaDeMacho(datos);
    if (!f.firmada) out.push(`${cpu}: sin firma válida${f.paginasMalas ? ` (${f.paginasMalas} páginas no coinciden)` : ''}`);
    else if (f.local || !f.cms) out.push(`${cpu}: firma local, no la del certificado`);
    else {
      if (!f.marcaDeTiempo) out.push(`${cpu}: sin marca de tiempo`);
      if (!f.runtime) out.push(`${cpu}: sin el hardened runtime`);
      if (!f.entitlements.includes('com.apple.security.cs.allow-jit')) out.push(`${cpu}: sin el permiso del JIT (Bun no arranca)`);
    }
  }
  if (!rebanadas.some((x) => x.cputype === 0x0100000c) || !rebanadas.some((x) => x.cputype === 0x01000007)) out.push('no trae las dos (Intel y Apple)');
  return out;
}

// ── La app firmada ───────────────────────────────────────────────────────────

/** Los archivos de MaKo.app firmada, para el .zip «hecho en Unix»: el ejecutable con 0755, lo demás 0644 (scripts/ia-pc/zip-unix.mjs). */
export function entradasDeLaApp(app, nombre = 'MaKo.app') {
  const out = [{ nombre, dir: true }];
  const recorrer = (abs, rel) => {
    for (const f of readdirSync(abs).sort()) {
      const a = path.join(abs, f);
      const r = `${rel}/${f}`;
      if (statSync(a).isDirectory()) { out.push({ nombre: r, dir: true }); recorrer(a, r); }
      else out.push({ nombre: r, datos: readFileSync(a), modo: r === `${nombre}/Contents/MacOS/MaKo` ? 0o755 : 0o644 });
    }
  };
  recorrer(app, nombre);
  return out;
}

/** @typedef {(comando: string, args: string[], opts: Record<string, any>) => { stdout?: string | null; stderr?: string | null; status: number | null; error?: Error }} Correr */

/** @param {Correr} correr @param {string} herramienta @param {string[]} args @param {number} plazo */
const corrida = (correr, herramienta, args, plazo) => {
  const r = correr(herramienta, args, { input: '', encoding: 'utf8', timeout: plazo, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  const dijo = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.trim().split('\n').slice(-8).join(' · ');
  if (r.error) throw new Error(`rcodesign no corrió (${args[0]}): ${r.error.message}`);
  if (r.status !== 0) throw new Error(`rcodesign ${args[0]} salió con ${r.status}: ${dijo}`);
  return dijo;
};

/**
 * Firma (Developer ID, hardened runtime, marca de tiempo, los entitlements de Bun), revisa la firma ella misma, notariza y
 * engrapa la app en `app` (una carpeta MaKo.app con Contents/MacOS/MaKo universal). Falla si algo de eso no quedó.
 * `correr` es spawnSync (los tests le pasan uno de mentira).
 * @param {{ herramienta: string; carpeta: string; clave: string; certificado: string; api: string }} cfg
 * @param {string} app
 * @param {{ correr?: Correr }} [opciones]
 */
export function firmarAppMac(cfg, app, { correr = spawnSync } = {}) {
  const tmp = mkdtempSync(path.join(tmpdir(), 'mako-firma-mac-'));
  try {
    const ent = path.join(tmp, 'mako.entitlements');
    writeFileSync(ent, entitlementsDeBun());
    corrida(correr, cfg.herramienta, [
      'sign', '--for-notarization', '--pem-file', cfg.clave, '--certificate-der-file', cfg.certificado,
      '--entitlements-xml-file', ent, app,
    ], 600_000);
    const ejecutable = path.join(app, 'Contents', 'MacOS', 'MaKo');
    const mal = problemasParaNotarizar(readFileSync(ejecutable));
    if (mal.length) throw new Error(`MaKo.app firmada no sirve para notarizar: ${mal.join('; ')}`);
    if (!existsSync(path.join(app, 'Contents', '_CodeSignature', 'CodeResources'))) throw new Error('MaKo.app firmada sin Contents/_CodeSignature/CodeResources');
    corrida(correr, cfg.herramienta, ['notary-submit', '--api-key-file', cfg.api, '--staple', '--max-wait-seconds', '1800', app], 2_000_000);
    const ticket = path.join(app, 'Contents', 'CodeResources');
    if (!existsSync(ticket) || statSync(ticket).size === 0) throw new Error('Apple no devolvió el ticket de la notarización (Contents/CodeResources)');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ── Lo que se corre una vez, cuando Martín tenga la cuenta ───────────────────

/**
 * `pedido`: la clave privada (RSA 2048, lo que pide Apple) y el pedido del certificado (.csr) que Martín sube en
 * developer.apple.com. Nunca pisa una clave que ya está: con otra, el certificado de Apple no sirve.
 * @param {{ carpeta?: string; herramienta?: string; correr?: Correr }} [opciones]
 */
export function armarPedido({ carpeta = carpetaMacPorDefecto(), herramienta, correr = spawnSync } = {}) {
  if (enOneDrive(carpeta)) throw new Error(`la firma de la Mac no va en OneDrive (${carpeta})`);
  if (!herramienta || !existsSync(herramienta)) throw new Error('falta rcodesign (RCODESIGN)');
  const clave = path.join(carpeta, ARCHIVOS_MAC.clave);
  const pedido = path.join(carpeta, ARCHIVOS_MAC.pedido);
  if (existsSync(clave)) throw new Error(`ya está ${clave}: no la piso (el certificado de Apple va con ESA clave)`);
  mkdirSync(carpeta, { recursive: true });
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  writeFileSync(clave, privateKey, { mode: 0o600 });
  try {
    corrida(correr, herramienta, ['generate-certificate-signing-request', '--pem-file', clave, '--csr-pem-file', pedido], 60_000);
    if (!existsSync(pedido)) throw new Error('rcodesign no dejó el pedido del certificado');
  } catch (e) {
    // Sin pedido, la clave no sirve para nada: se saca, así se puede volver a intentar.
    rmSync(clave, { force: true });
    throw e;
  }
  return pedido;
}

/**
 * `clave-api`: la clave de la API de App Store Connect (el .p8, su Key ID y el Issuer ID) en el JSON que lee rcodesign.
 * @param {{ carpeta?: string; herramienta?: string; emisor?: string; idDeClave?: string; p8?: string; correr?: Correr }} opciones
 */
export function armarClaveApi({ carpeta = carpetaMacPorDefecto(), herramienta, emisor, idDeClave, p8, correr = spawnSync }) {
  if (enOneDrive(carpeta)) throw new Error(`la firma de la Mac no va en OneDrive (${carpeta})`);
  if (!herramienta || !existsSync(herramienta)) throw new Error('falta rcodesign (RCODESIGN)');
  if (!emisor || !idDeClave || !p8 || !existsSync(p8)) throw new Error('uso: clave-api <Issuer ID> <Key ID> <ruta del AuthKey_….p8>');
  mkdirSync(carpeta, { recursive: true });
  const api = path.join(carpeta, ARCHIVOS_MAC.api);
  corrida(correr, herramienta, ['encode-app-store-connect-api-key', '-o', api, emisor, idDeClave, p8], 60_000);
  return api;
}

// node scripts/ia-pc/firmar-mac.mjs pedido | clave-api <Issuer ID> <Key ID> <AuthKey.p8> (con RCODESIGN en el entorno o en
// %USERPROFILE%\.mako-firma.env).
const esPrincipal = (() => { try { return import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href; } catch { return false; } })();
// Sin `await` arriba: los tests lo importan con require, que no acepta un módulo con await de primer nivel.
if (esPrincipal) {
  import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'node_modules', 'dotenv', 'lib', 'main.js')).href).then((dotenv) => {
    const archivo = path.join(homedir(), '.mako-firma.env');
    const leidas = existsSync(archivo) ? (dotenv.default ?? dotenv).parse(readFileSync(archivo, 'utf8')) : {};
    const herramienta = (leidas.RCODESIGN ?? process.env.RCODESIGN ?? '').trim();
    const carpeta = (leidas.FIRMA_MAC ?? process.env.FIRMA_MAC ?? '').trim() || carpetaMacPorDefecto();
    const [cmd, ...resto] = process.argv.slice(2);
    try {
      if (cmd === 'pedido') console.log(`✓ el pedido del certificado: ${armarPedido({ carpeta, herramienta })} (súbelo en developer.apple.com › Certificates › Developer ID Application)`);
      else if (cmd === 'clave-api') console.log(`✓ ${armarClaveApi({ carpeta, herramienta, emisor: resto[0], idDeClave: resto[1], p8: resto[2] })}`);
      else { console.error('uso: firmar-mac.mjs pedido | clave-api <Issuer ID> <Key ID> <AuthKey_….p8>'); process.exitCode = 1; }
    } catch (e) { console.error(`⛔ ${e.message}`); process.exitCode = 1; }
  });
}
