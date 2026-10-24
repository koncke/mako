// =============================================================================
// La firma de Windows con CodeSignTool (SSL.com eSigner), DESDE ESTA PC (23/10/2026)
// =============================================================================
// El Cerebro: «Del lado nuestro: la firma con CodeSignTool desde esta PC, sin Actions. Así cuando le aprueben el certificado,
// la 0.4.x sale firmada sin más trabajo». Martín compra el IV de SSL.com a su nombre (docs/plan-instalador-escritorio.md ›
// Firmar). Lo que fija este test (scripts/ia-pc/firmar-windows.mjs y publicar-binarios.mts):
//   1. de dónde salen las claves: un archivo fuera de OneDrive; NUNCA el .env.local; a medio cargar, no se arma;
//   2. firmado es que el .exe que vuelve TENGA la firma y la marca de tiempo (CodeSignTool no documenta sus códigos de salida);
//   3. la herramienta corre sin consola, sin poder quedarse esperando, sin pisar el archivo, y sin las claves en ningún mensaje;
//   4. publicar-binarios firma el programa DESPUÉS de marcarlo «de ventana» y ANTES de Inno, y el setup antes de subirlo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse } from 'dotenv';

import * as F from '../scripts/ia-pc/firmar-windows.mjs';
const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const SECRETOS = { CODESIGNTOOL: 'C:\\herramientas\\CodeSignTool', SSL_COM_USUARIO: 'martin.koncke', SSL_COM_CLAVE: 'Cl4ve$ecreta&"x', SSL_COM_TOTP: 'T0TPSECRET0base64==' };
const CFG = F.configDeFirma(SECRETOS)!;
const conSecretos = (t: string) => [SECRETOS.SSL_COM_CLAVE, SECRETOS.SSL_COM_TOTP, SECRETOS.SSL_COM_USUARIO].filter((s) => t.includes(s));

/** Un PE mínimo: «MZ», «PE\0\0», la cabecera opcional (PE32+ o PE32) y, si se pasa, la tabla de certificados. */
function pe({ magia = 0x20b, tabla = null as Buffer | null } = {}) {
  const dondePe = 0x80;
  const opcional = dondePe + 24;
  const dirs = opcional + (magia === 0x20b ? 112 : 96);
  const cuerpo = dirs + 16 * 8 + 64;
  const b = Buffer.alloc(cuerpo + (tabla?.length ?? 0));
  b.write('MZ', 0, 'latin1');
  b.writeUInt32LE(dondePe, 0x3c);
  b.write('PE\0\0', dondePe, 'latin1');
  b.writeUInt16LE(magia, opcional);
  b.writeUInt16LE(2, opcional + 68);
  if (tabla) {
    tabla.copy(b, cuerpo);
    b.writeUInt32LE(cuerpo, dirs + 32);
    b.writeUInt32LE(tabla.length, dirs + 36);
  }
  return b;
}
const RFC3161 = Buffer.from([0x06, 0x0a, 0x2b, 0x06, 0x01, 0x04, 0x01, 0x82, 0x37, 0x03, 0x03, 0x01]);
const CONTRAFIRMA = Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x06]);
const certificado = (marca: Buffer | null) => {
  const pkcs7 = Buffer.concat([Buffer.from([0x30, 0x82, 0x01, 0x00]), Buffer.alloc(40, 7), ...(marca ? [marca] : []), Buffer.alloc(12, 9)]);
  const h = Buffer.alloc(8);
  h.writeUInt32LE(8 + pkcs7.length, 0);
  h.writeUInt16LE(0x0200, 4);
  h.writeUInt16LE(0x0002, 6);
  return Buffer.concat([h, pkcs7]);
};

/** Una CodeSignTool de mentira: `hace` recibe el archivo de entrada y la carpeta de salida. */
function deMentira(hace: (entrada: string, salida: string) => Record<string, unknown> | void) {
  const llamadas: Array<{ java: string; args: string[]; opts: Record<string, any>; salida: string }> = [];
  const correr = (java: string, args: string[], opts: Record<string, any>) => {
    const entrada = args.find((a) => a.startsWith('-input_file_path='))!.slice('-input_file_path='.length);
    const salida = args.find((a) => a.startsWith('-output_dir_path='))!.slice('-output_dir_path='.length);
    llamadas.push({ java, args, opts, salida });
    return { stdout: '', stderr: '', status: 0, ...(hace(entrada, salida) ?? {}) };
  };
  return { correr, llamadas, herramienta: { dir: 'C:\\herramientas\\CodeSignTool', java: 'C:\\herramientas\\CodeSignTool\\jdk-11.0.2\\bin\\java.exe', jar: 'C:\\herramientas\\CodeSignTool\\jar\\code_sign_tool-1.3.2.jar' } };
}
function exeSinFirmar() {
  const d = mkdtempSync(path.join(tmpdir(), 'mako-firma-test-'));
  const archivo = path.join(d, 'mako-pc.exe');
  writeFileSync(archivo, Buffer.concat([pe(), Buffer.from('el programa de antes')]));
  return { d, archivo };
}

test('1. de dónde salen las claves: un archivo fuera de OneDrive, nunca el .env.local; a medio cargar, no se arma', () => {
  assert.equal(F.configDeFirma({}), null, 'sin nada, se sube sin firmar como hasta ahora');
  assert.equal(F.configDeFirma({ SSL_COM_USUARIO: '   ' }), null);
  assert.deepEqual(CFG, { herramienta: SECRETOS.CODESIGNTOOL, usuario: 'martin.koncke', clave: SECRETOS.SSL_COM_CLAVE, totp: SECRETOS.SSL_COM_TOTP, credencial: null });
  assert.equal(F.configDeFirma({ ...SECRETOS, SSL_COM_CREDENCIAL: 'abc-123' })!.credencial, 'abc-123');
  // A medio cargar: los NOMBRES que faltan, nunca un valor.
  assert.throws(() => F.configDeFirma({ SSL_COM_CLAVE: SECRETOS.SSL_COM_CLAVE }), (e: Error) =>
    e.message === 'para firmar faltan: CODESIGNTOOL, SSL_COM_USUARIO, SSL_COM_TOTP' && !conSecretos(e.message).length);
  assert.throws(() => F.configDeFirma({ SSL_COM_CREDENCIAL: 'abc' }), /para firmar faltan/);

  const d = mkdtempSync(path.join(tmpdir(), 'mako-firma-env-'));
  try {
    const ruta = path.join(d, '.mako-firma.env');
    // La clave o el TOTP en el .env.local (que OneDrive sube): no se arma, aunque esté el archivo bueno.
    writeFileSync(ruta, Object.entries(SECRETOS).map(([k, v]) => `${k}='${v}'`).join('\n'));
    for (const v of ['SSL_COM_CLAVE', 'SSL_COM_TOTP']) {
      assert.throws(() => F.firmaDeEstaPc({ envLocal: `NEXT_PUBLIC_X=1\n${v}=algo\n`, rutaFirma: ruta, proceso: {} as unknown as NodeJS.ProcessEnv, parse }), (e: Error) =>
        e.message.startsWith(`${v} no van en el .env.local`) && !e.message.includes('algo'), `${v} en el .env.local pasó`);
    }
    // Del archivo de la firma; lo del archivo gana a lo del entorno.
    const c = F.firmaDeEstaPc({ envLocal: 'CODESIGNTOOL=C:\\otra\n', rutaFirma: ruta, proceso: { CODESIGNTOOL: 'C:\\otra', SSL_COM_CLAVE: 'vieja' } as unknown as NodeJS.ProcessEnv, parse });
    assert.equal(c!.clave, SECRETOS.SSL_COM_CLAVE);
    assert.equal(c!.herramienta, SECRETOS.CODESIGNTOOL);
    // Sin el archivo y sin nada en el entorno: sin firma. Pedido con --firma y no está: no se arma.
    assert.equal(F.firmaDeEstaPc({ envLocal: '', rutaFirma: path.join(d, 'no-esta.env'), proceso: {} as unknown as NodeJS.ProcessEnv, parse }), null);
    assert.throws(() => F.firmaDeEstaPc({ envLocal: '', rutaFirma: path.join(d, 'no-esta.env'), pedida: true, proceso: {} as unknown as NodeJS.ProcessEnv, parse }), /no está .*no-esta\.env \(--firma\)/);
    // Archivo a medio cargar: qué falta y dónde, sin los valores.
    writeFileSync(ruta, `CODESIGNTOOL=C:\\x\nSSL_COM_CLAVE='${SECRETOS.SSL_COM_CLAVE}'\n`);
    assert.throws(() => F.firmaDeEstaPc({ envLocal: '', rutaFirma: ruta, proceso: {} as unknown as NodeJS.ProcessEnv, parse }), (e: Error) =>
      e.message.startsWith('para firmar faltan: SSL_COM_USUARIO, SSL_COM_TOTP (en ') && !conSecretos(e.message).length);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('2. firmado es que el .exe TENGA la firma y la marca de tiempo (PE32+ y PE32)', () => {
  for (const magia of [0x20b, 0x10b]) {
    assert.equal(F.peFirmado(pe({ magia })), false);
    assert.equal(F.peFirmado(pe({ magia, tabla: certificado(RFC3161) })), true, `PE ${magia.toString(16)} firmado no se ve`);
    assert.equal(F.peConMarcaDeTiempo(pe({ magia, tabla: certificado(RFC3161) })), true);
    assert.equal(F.peConMarcaDeTiempo(pe({ magia, tabla: certificado(CONTRAFIRMA) })), true);
    assert.equal(F.peConMarcaDeTiempo(pe({ magia, tabla: certificado(null) })), false, 'firma sin marca de tiempo pasó');
  }
  // Una tabla que apunta afuera del archivo, o algo que no es un PE: sin firma.
  const corto = pe({ tabla: certificado(RFC3161) }).subarray(0, -10);
  assert.equal(F.peFirmado(corto), false);
  assert.equal(F.peFirmado(Buffer.from('no soy un exe, soy un texto largo de más de sesenta y cuatro bytes de largo, sí')), false);
  // Si la marca de tiempo está FUERA de la tabla (en el programa), no cuenta.
  assert.equal(F.peConMarcaDeTiempo(Buffer.concat([pe({ tabla: certificado(null) }).subarray(0, 0x40), RFC3161, pe({ tabla: certificado(null) }).subarray(0x40 + RFC3161.length)])), false);
});

test('3. la herramienta: su Java con su .jar, sin consola, sin esperar, sin pisar el archivo y sin las claves en ningún mensaje', () => {
  // Bien: devuelve el firmado, lo deja en su lugar, y la carpeta de salida se borra.
  {
    const { d, archivo } = exeSinFirmar();
    const m = deMentira((e, s) => { writeFileSync(path.join(s, path.basename(e)), pe({ tabla: certificado(RFC3161) })); return { stdout: 'Code signed successfully: ' + e }; });
    try {
      const bytes = F.firmarExe(CFG, archivo, m);
      assert.ok(F.peFirmado(bytes) && F.peFirmado(readFileSync(archivo)), 'no quedó firmado en su lugar');
      const [ll] = m.llamadas;
      assert.equal(ll.java, m.herramienta.java);
      assert.deepEqual(ll.args.slice(0, 3), ['-jar', m.herramienta.jar, 'sign']);
      assert.equal(ll.opts.cwd, m.herramienta.dir, 'CodeSignTool lee conf/ de su carpeta');
      assert.equal(ll.opts.input, '', 'con la entrada abierta, si pregunta algo se queda esperando');
      assert.ok(ll.opts.timeout > 0 && ll.opts.timeout <= 600_000);
      assert.equal(ll.opts.windowsHide, true);
      assert.notEqual(path.resolve(ll.salida), path.resolve(d), 'sin una carpeta de salida aparte, pisa el archivo y pregunta');
      assert.ok(ll.args.includes(`-password=${SECRETOS.SSL_COM_CLAVE}`) && ll.args.includes(`-totp_secret=${SECRETOS.SSL_COM_TOTP}`));
      assert.ok(!ll.args.some((a) => a.startsWith('-credential_id=')), 'sin credencial cargada, no se manda');
      assert.equal(existsSync(ll.salida), false, 'la carpeta de salida quedó');
    } finally { rmSync(d, { recursive: true, force: true }); }
  }
  // Mal, de cinco maneras: siempre falla, el archivo queda como estaba, y ninguna clave en el mensaje.
  const casos: Array<[string, (e: string, s: string) => Record<string, unknown> | void, RegExp]> = [
    ['«Error: invalid otp» saliendo con 0', () => ({ stdout: 'Error: invalid otp' }), /no devolvió mako-pc\.exe \(salió con 0\): Error: invalid otp/],
    ['devuelve el archivo sin firma', (e, s) => { writeFileSync(path.join(s, path.basename(e)), pe()); }, /mako-pc\.exe volvió SIN firma/],
    ['firma sin marca de tiempo', (e, s) => { writeFileSync(path.join(s, path.basename(e)), pe({ tabla: certificado(null) })); }, /SIN marca de tiempo/],
    ['repite las claves al fallar', () => ({ status: 1, stderr: `bad credentials ${SECRETOS.SSL_COM_USUARIO} / ${SECRETOS.SSL_COM_CLAVE} / ${SECRETOS.SSL_COM_TOTP}` }), /bad credentials \*\*\* \/ \*\*\* \/ \*\*\*/],
    ['no corre', () => ({ status: null, error: new Error(`spawnSync java ENOENT -password=${SECRETOS.SSL_COM_CLAVE}`) }), /CodeSignTool no corrió para mako-pc\.exe: spawnSync java ENOENT -password=\*\*\*/],
  ];
  for (const [nombre, hace, espera] of casos) {
    const { d, archivo } = exeSinFirmar();
    const antes = readFileSync(archivo);
    try {
      assert.throws(() => F.firmarExe(CFG, archivo, deMentira(hace)), (e: Error) => espera.test(e.message) && !conSecretos(e.message).length, `${nombre}: ${espera}`);
      assert.deepEqual(readFileSync(archivo), antes, `${nombre}: tocó el archivo`);
    } finally { rmSync(d, { recursive: true, force: true }); }
  }
  // Con credencial, va.
  {
    const { d, archivo } = exeSinFirmar();
    const m = deMentira((e, s) => { writeFileSync(path.join(s, path.basename(e)), pe({ tabla: certificado(RFC3161) })); });
    try { F.firmarExe({ ...CFG, credencial: 'abc-123' }, archivo, m); assert.ok(m.llamadas[0].args.includes('-credential_id=abc-123')); } finally { rmSync(d, { recursive: true, force: true }); }
  }
  // Dónde está: la carpeta del .zip de SSL.com o su CodeSignTool.bat; su Java si lo trae, si no el de la PC.
  const d = mkdtempSync(path.join(tmpdir(), 'mako-codesigntool-'));
  try {
    mkdirSync(path.join(d, 'jar'));
    assert.throws(() => F.buscarCodeSignTool(d), /no encontré jar\/code_sign_tool-\*\.jar/);
    writeFileSync(path.join(d, 'jar', 'code_sign_tool-1.3.2.jar'), '');
    writeFileSync(path.join(d, 'CodeSignTool.bat'), '@echo off');
    assert.equal(F.buscarCodeSignTool(d).java, 'java');
    const java = path.join(d, 'jdk-11.0.2', 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
    mkdirSync(path.dirname(java), { recursive: true });
    writeFileSync(java, '');
    for (const h of [d, path.join(d, 'CodeSignTool.bat')]) {
      assert.deepEqual(F.buscarCodeSignTool(h), { dir: d, java, jar: path.join(d, 'jar', 'code_sign_tool-1.3.2.jar') });
    }
    assert.throws(() => F.buscarCodeSignTool(path.join(d, 'no-esta')), /no está CodeSignTool/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('4. publicar-binarios: el programa se firma después de marcarlo y antes de Inno; el setup, antes de subirlo', () => {
  const s = sinComentarios(leer('scripts/ia-pc/publicar-binarios.mts'));
  const en = (t: string) => { const i = s.indexOf(t); assert.ok(i >= 0, `falta: ${t}`); return i; };
  const marcar = en('bytes = marcarDeVentana(bytes);');
  const firmarPrograma = en('bytes = firmar(salida);');
  const inno = en('execFileSync(ISCC, [');
  const firmarSetup = en('firmar(rutaDelSetup);');
  const leerSetup = en('const setup = readFileSync(rutaDelSetup);');
  const control = en("if (FIRMAR && !(peFirmado(crudos['windows-x64']) && peFirmado(setup)))");
  const subirSetup = en("armados.push({ nombre: archivoDelInstalador(), datos: setup, tipo: 'application/octet-stream' });");
  assert.ok(marcar < firmarPrograma && firmarPrograma < inno, 'el programa se firma antes de marcarlo (la firma se rompe) o después de Inno (el setup lleva el programa sin firmar)');
  assert.ok(inno < firmarSetup && firmarSetup < leerSetup && leerSetup < control && control < subirSetup, 'el setup sube sin firmar');
  assert.ok(firmarPrograma < en("crudos[o.archivo] = bytes;"), 'el programa comprimido no es el firmado');
  // Las claves se leen ANTES de armar nada (a medio cargar, no se gasta el armado), y en seco no se gasta una firma.
  assert.ok(en('firmaDeEstaPc({') < en('for (const o of OBJETIVOS)'));
  assert.match(s, /const ARCHIVO_FIRMA = arg\('--firma'\) \?\? path\.join\(homedir\(\), '\.mako-firma\.env'\);/);
  assert.match(s, /const FIRMAR = FIRMA != null && \(APLICAR \|\| process\.argv\.includes\('--probar-firma'\)\);/);
  assert.match(s, /envLocal: readFileSync\(ENV, 'utf8'\)/, 'no mira si las claves están en el .env.local');
  // Ni una clave a la consola.
  assert.doesNotMatch(s, /console\.\w+\([^\n]*(clave|totp|usuario|SSL_COM_)/i);
});
