// =============================================================================
// firmar-windows — firma el programa y el instalador de Windows con CodeSignTool (SSL.com eSigner), DESDE ESTA PC
// =============================================================================
// El Cerebro, 23/10/2026: «la firma con CodeSignTool desde esta PC, sin Actions. Así cuando le aprueben el certificado, la
// 0.4.x sale firmada sin más trabajo». Martín compra el certificado IV de SSL.com a su nombre y activa eSigner
// (docs/plan-instalador-escritorio.md › Firmar); publicar-binarios.mts llama a esto ANTES de subir cada .exe.
//
// Las claves van en un archivo FUERA de OneDrive (%USERPROFILE%\.mako-firma.env), nunca en el .env.local del clon (el
// Escritorio está en OneDrive y lo sube a la nube): con el usuario, la clave y el secreto TOTP cualquiera firma a nombre de
// Martín. Ninguna se escribe en la consola: el error de execFileSync trae la línea de comandos entera, por eso se corre con
// spawnSync y se tapan en lo que conteste la herramienta.
//
// Trampas de CodeSignTool (ssl.com/guide/esigner-codesigntool-command-guide, 23/10/2026):
//   - Sin -output_dir_path, PISA el archivo y PREGUNTA antes: se le da una carpeta aparte y la entrada cerrada (si pregunta
//     algo, falla en vez de quedarse esperando).
//   - Los códigos de salida no están documentados («Error: invalid otp» puede salir igual): firmado es que el archivo que
//     devuelve TENGA la firma (la tabla de certificados del PE), no que la herramienta salga con 0.
//   - En Windows es un .bat, y Node no corre un .bat sin una consola de por medio (que rompe las claves con símbolos): se
//     corre su Java con su .jar, desde su carpeta (lee conf/ de ahí).
//   - Cada archivo firmado gasta UNA firma del plan de eSigner (el de US$180/año trae 240): una versión gasta dos (el
//     programa y el setup). Por eso en seco no se firma, salvo con --probar-firma.
// =============================================================================

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Las que hacen falta para firmar. SSL_COM_CREDENCIAL, sólo si la cuenta tiene más de un certificado. */
export const VARIABLES_DE_FIRMA = ['CODESIGNTOOL', 'SSL_COM_USUARIO', 'SSL_COM_CLAVE', 'SSL_COM_TOTP'];
/** Las que firman a nombre de Martín: nunca en un archivo que se sincroniza ni en la consola. */
export const VARIABLES_SECRETAS = ['SSL_COM_CLAVE', 'SSL_COM_TOTP'];

const puesta = (env, v) => typeof env[v] === 'string' && env[v].trim() !== '';

/**
 * null sin ninguna variable (se sube sin firmar, como hasta ahora). Con algunas y no todas, error con los NOMBRES que faltan
 * (nunca un valor): a medio cargar es un error de tipeo, no una decisión de subir sin firma.
 */
export function configDeFirma(env) {
  const todas = [...VARIABLES_DE_FIRMA, 'SSL_COM_CREDENCIAL'];
  if (!todas.some((v) => puesta(env, v))) return null;
  const faltan = VARIABLES_DE_FIRMA.filter((v) => !puesta(env, v));
  if (faltan.length) throw new Error(`para firmar faltan: ${faltan.join(', ')}`);
  return {
    herramienta: env.CODESIGNTOOL.trim(),
    usuario: env.SSL_COM_USUARIO.trim(),
    clave: env.SSL_COM_CLAVE,
    totp: env.SSL_COM_TOTP.trim(),
    credencial: puesta(env, 'SSL_COM_CREDENCIAL') ? env.SSL_COM_CREDENCIAL.trim() : null,
  };
}

/**
 * La firma de ESTA PC, para publicar-binarios: del archivo de la firma (fuera de OneDrive) y, si no, del entorno. Falla si
 * la clave o el secreto TOTP están en el .env.local (`envLocal`, su texto), si se pidió un archivo que no está, o a medio
 * cargar. `parse` es el de dotenv.
 */
export function firmaDeEstaPc({ envLocal, rutaFirma, pedida = false, proceso = process.env, parse }) {
  const enElEnvLocal = Object.keys(parse(envLocal ?? ''));
  const mal = VARIABLES_SECRETAS.filter((v) => enElEnvLocal.includes(v));
  if (mal.length) throw new Error(`${mal.join(' y ')} no van en el .env.local (OneDrive lo sube a la nube): van en ${rutaFirma}`);
  if (pedida && !existsSync(rutaFirma)) throw new Error(`no está ${rutaFirma} (--firma)`);
  const delArchivo = existsSync(rutaFirma) ? parse(readFileSync(rutaFirma, 'utf8')) : {};
  const delProceso = Object.fromEntries([...VARIABLES_DE_FIRMA, 'SSL_COM_CREDENCIAL'].map((v) => [v, proceso[v]]));
  try {
    return configDeFirma({ ...delProceso, ...delArchivo });
  } catch (e) {
    throw new Error(`${e.message} (en ${rutaFirma})`);
  }
}

/** Los argumentos de `CodeSignTool sign`, con la salida en una carpeta aparte (sin ella, pisa y pregunta). */
export function argumentosDeFirma(cfg, archivo, carpetaDeSalida) {
  return [
    'sign',
    `-username=${cfg.usuario}`,
    `-password=${cfg.clave}`,
    ...(cfg.credencial ? [`-credential_id=${cfg.credencial}`] : []),
    `-totp_secret=${cfg.totp}`,
    `-input_file_path=${archivo}`,
    `-output_dir_path=${carpetaDeSalida}`,
  ];
}

/**
 * El Java y el .jar de CodeSignTool. CODESIGNTOOL es su carpeta (la del .zip de SSL.com) o su CodeSignTool.bat. El de Windows
 * trae su propio Java (jdk-*\bin\java.exe); si no está, el `java` de la PC.
 */
export function buscarCodeSignTool(herramienta) {
  const dir = existsSync(herramienta) && statSync(herramienta).isFile() ? path.dirname(herramienta) : herramienta;
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`no está CodeSignTool en ${dir} (CODESIGNTOOL)`);
  const jars = existsSync(path.join(dir, 'jar')) ? readdirSync(path.join(dir, 'jar')).filter((f) => /^code_sign_tool-.*\.jar$/i.test(f)).sort() : [];
  if (!jars.length) throw new Error(`no encontré jar/code_sign_tool-*.jar en ${dir}`);
  const jdk = readdirSync(dir).filter((f) => /^jdk/i.test(f)).sort().reverse()
    .map((f) => path.join(dir, f, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')).find((j) => existsSync(j));
  return { dir, java: jdk ?? 'java', jar: path.join(dir, 'jar', jars.at(-1)) };
}

const leer32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

/**
 * ¿El ejecutable trae una firma Authenticode? La tabla de certificados (directorio 4 del PE), con tamaño y DENTRO del archivo:
 * a 144 de la cabecera opcional en un PE32+ (64 bits) y a 128 en un PE32 (los directorios empiezan a 112 o 96; 8 bytes c/u).
 */
export function peFirmado(exe) {
  return tablaDeCertificados(exe) != null;
}
function tablaDeCertificados(exe) {
  const b = exe instanceof Uint8Array ? exe : new Uint8Array(exe);
  if (b.length < 0x40 || b[0] !== 0x4d || b[1] !== 0x5a) return null;
  const pe = leer32(b, 0x3c);
  if (pe + 24 + 2 > b.length || b[pe] !== 0x50 || b[pe + 1] !== 0x45 || b[pe + 2] !== 0 || b[pe + 3] !== 0) return null;
  const opcional = pe + 24;
  const magia = b[opcional] | (b[opcional + 1] << 8);
  const dir = opcional + (magia === 0x20b ? 112 : magia === 0x10b ? 96 : NaN) + 4 * 8;
  if (!Number.isFinite(dir) || dir + 8 > b.length) return null;
  const donde = leer32(b, dir);
  const tam = leer32(b, dir + 4);
  return tam >= 8 && donde > 0 && donde + tam <= b.length ? b.subarray(donde, donde + tam) : null;
}

/** Los OID (en DER) de una marca de tiempo: la RFC 3161 de Microsoft y la contrafirma de PKCS #9. */
const OID_MARCA_DE_TIEMPO = [
  [0x06, 0x0a, 0x2b, 0x06, 0x01, 0x04, 0x01, 0x82, 0x37, 0x03, 0x03, 0x01], // 1.3.6.1.4.1.311.3.3.1
  [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x06], // 1.2.840.113549.1.9.6
].map((o) => Buffer.from(o));

/**
 * ¿La firma trae marca de tiempo? Sin ella, la firma VENCE con el certificado (un año) y el instalador que ya está en el
 * bucket pasa a «editor desconocido». Se busca el OID dentro de la tabla de certificados.
 */
export function peConMarcaDeTiempo(exe) {
  const t = tablaDeCertificados(exe);
  return t != null && OID_MARCA_DE_TIEMPO.some((o) => Buffer.from(t.buffer, t.byteOffset, t.byteLength).includes(o));
}

/**
 * La firma COMO LA VE WINDOWS (25/10/2026): `Get-AuthenticodeSignature`. `peFirmado` mira que haya una tabla de certificados;
 * esto mira que Windows la acepte entera (la cadena hasta una raíz de confianza, el archivo sin tocar), que es lo que decide si
 * SmartScreen dice «Editor: Martín Koncke» o «Editor desconocido». `editor` es el nombre del certificado (con un IV, el de la
 * persona). La ruta va por el entorno: con comillas o espacios en la línea de comandos se rompía. `correr` es para los tests.
 * @returns {{ valida: boolean; estado: string; editor: string | null; conMarca: boolean }}
 */
export function verificarFirmaWindows(archivo, { correr = spawnSync } = {}) {
  const ps = [
    '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
    '$s = Get-AuthenticodeSignature -LiteralPath $env:MAKO_ARCHIVO',
    "$e = if ($s.SignerCertificate) { $s.SignerCertificate.GetNameInfo('SimpleName', $false) } else { $null }",
    '[pscustomobject]@{ estado = [string]$s.Status; editor = $e; marca = [bool]$s.TimeStamperCertificate } | ConvertTo-Json -Compress',
  ].join('; ');
  const r = correr('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
    encoding: 'utf8', env: { ...process.env, MAKO_ARCHIVO: archivo }, windowsHide: true, timeout: 60_000,
  });
  let j = null;
  try { j = JSON.parse(String(r.stdout ?? '').trim()); } catch { /* sin respuesta */ }
  return { valida: j?.estado === 'Valid', estado: j?.estado ?? 'sin respuesta', editor: j?.editor ?? null, conMarca: !!j?.marca };
}

/** Lo que conteste la herramienta, sin las claves (por si alguna versión las repite). */
export function sinSecretos(texto, cfg) {
  let t = String(texto ?? '');
  for (const s of [cfg.clave, cfg.totp, cfg.usuario]) if (s && s.length >= 3) t = t.split(s).join('***');
  return t;
}

/**
 * Firma `archivo` en su lugar y devuelve los bytes firmados. Falla (sin las claves en el mensaje) si la herramienta no
 * devuelve el archivo o lo devuelve sin firma. `correr` es spawnSync (los tests le pasan uno de mentira).
 * @param {{ herramienta: string; usuario: string; clave: string; totp: string; credencial: string | null }} cfg
 * @param {string} archivo
 * @param {{ correr?: (comando: string, args: string[], opts: Record<string, any>) => { stdout?: string | null; stderr?: string | null; status: number | null; error?: Error }; herramienta?: { dir: string; java: string; jar: string } }} [opciones]
 */
export function firmarExe(cfg, archivo, { correr = spawnSync, herramienta = buscarCodeSignTool(cfg.herramienta) } = {}) {
  const salida = mkdtempSync(path.join(tmpdir(), 'mako-firma-'));
  try {
    const r = correr(herramienta.java, ['-jar', herramienta.jar, ...argumentosDeFirma(cfg, archivo, salida)], {
      cwd: herramienta.dir, input: '', encoding: 'utf8', timeout: 300_000, windowsHide: true, maxBuffer: 16 * 1024 * 1024,
    });
    const dijo = sinSecretos(`${r.stdout ?? ''}\n${r.stderr ?? ''}`, cfg).trim().split('\n').slice(-6).join(' · ');
    const firmado = path.join(salida, path.basename(archivo));
    const nombre = path.basename(archivo);
    if (r.error) throw new Error(`CodeSignTool no corrió para ${nombre}: ${sinSecretos(r.error.message, cfg)}`);
    if (!existsSync(firmado)) throw new Error(`CodeSignTool no devolvió ${nombre} (salió con ${r.status}): ${dijo}`);
    const bytes = readFileSync(firmado);
    if (!peFirmado(bytes)) throw new Error(`${nombre} volvió SIN firma (salió con ${r.status}): ${dijo}`);
    if (!peConMarcaDeTiempo(bytes)) throw new Error(`${nombre} volvió firmado SIN marca de tiempo: la firma vencería con el certificado`);
    writeFileSync(archivo, bytes);
    return bytes;
  } finally {
    rmSync(salida, { recursive: true, force: true });
  }
}

// A mano, sobre cualquier .exe (el que se bajó de MaKo, o el de publicar-binarios en seco con --probar-firma):
//   node scripts/ia-pc/firmar-windows.mjs verificar <archivo.exe>
// Dice si Windows acepta la firma, a nombre de quién, y si tiene marca de tiempo. Sale con 0 sólo si las dos están.
if (process.argv[2] === 'verificar' && process.argv[3] && import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href) {
  const v = verificarFirmaWindows(path.resolve(process.argv[3]));
  console.log(v.valida
    ? `✓ firmado por «${v.editor}»${v.conMarca ? ', con marca de tiempo' : ' ⛔ SIN marca de tiempo: vence con el certificado'}`
    : `⛔ sin una firma que Windows acepte (${v.estado}): SmartScreen dice «Editor desconocido»`);
  process.exitCode = v.valida && v.conMarca ? 0 : 1;
}
