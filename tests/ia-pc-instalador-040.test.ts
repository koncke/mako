// =============================================================================
// «Conectar mi computadora» en Windows SIN terminal: el instalador con asistente y el enlace mako:// (0.4.0, 23/10/2026)
// =============================================================================
// Martín (22/10/2026): «el proceso de instalación jamás sea por Powershell, ni siquiera que se tenga que abrir, que sea una
// app de escritorio con el típico panel de "avanzar"... Que al darle conectar si no tenes instalada la app, te deje
// descargarla». Y el 22/10 a las 23:21, por el Cerebro: «la 0.4.0 sin firmar», con UNA línea para el aviso de Windows, y la
// línea de PowerShell sólo como respaldo escondido. Lo que fija este test:
//   1. en Windows son tres pasos y ninguno pide una terminal: descargar (con la línea del aviso), conectar con mako://, y la
//      sesión de Claude con mako://iniciar-sesion; la línea de comandos, SÓLO plegada como respaldo; la Mac, como siempre;
//   2. «Descargar» pide la sesión, baja el instalador con su nombre, y si falta lo dice (no pasa callado);
//   3. el instalador: por usuario, registra mako://, instala Claude Code oculto y sin la barra lenta, vuelve a arrancar la
//      app, y al terminar abre «Tus cuentas de IA» directo en «Conecta MaKo» (con las PC de antes ya leídas).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AVISO_PC_SIN_SESION, AVISO_SMARTSCREEN, RUTA_TRAS_INSTALAR, VERSION_PC, archivoDelInstalador, nombreDelInstalador,
} from '../lib/ia-pc-reglas';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. Windows y Mac: tres pasos sin terminal; la línea de comandos sólo plegada', () => {
  assert.equal(AVISO_SMARTSCREEN, 'Si Windows dice «protegió su PC»: Más información › Ejecutar de todas formas.');
  const ui = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  const tut = ui.slice(ui.indexOf('function Tutorial('), ui.indexOf('function SusClaves('));
  // Desde la 0.4.2 también la Mac (MaKo.app): tres pasos, y la Terminal plegada.
  assert.match(tut, /const pasos = \[1, 2, 4\];/);
  // Paso 2: descargar, con la UNA línea del aviso.
  const descargar = tut.slice(tut.indexOf("{paso === 2 && sistema === 'windows' && ("), tut.indexOf("{paso === 2 && sistema === 'mac' && ("));
  assert.match(descargar, /<a className="tci-boton" href="\/api\/ia-pc\/descargar\?os=windows">Descargar MaKo para Windows<\/a>/);
  assert.equal((descargar.match(/\{AVISO_SMARTSCREEN\}/g) ?? []).length, 1);
  // Paso 4: el botón abre el enlace con el código; la línea de PowerShell, sólo en el respaldo plegado.
  const conectar = tut.slice(tut.indexOf("{sistema === 'windows' ? ("), tut.indexOf(') : (', tut.indexOf("{sistema === 'windows' ? (")));
  assert.match(conectar, /<a className="tci-boton" href=\{`mako:\/\/conectar\?codigo=\$\{codigo\}`\}>Conectar esta computadora<\/a>/);
  const respaldo = conectar.slice(conectar.indexOf('<details className="tci-respaldo">'), conectar.indexOf('</details>'));
  assert.ok(respaldo.length > 0, 'falta el respaldo plegado');
  const fueraDelRespaldo = conectar.replace(respaldo, '');
  assert.doesNotMatch(fueraDelRespaldo, /DONDE_PEGAR|lineaDeInstalacion|COMANDO_CLAUDE|LOGIN_CLAUDE/, 'Windows pide abrir PowerShell fuera del respaldo');
  assert.match(respaldo, /<Copiar texto=\{lineaDeInstalacion\(window\.location\.origin, 'windows', codigo\)\} \/>/);
  // Lo de la terminal (instalar Claude Code, el login, la línea de conectar) sólo dentro de un respaldo plegado: en Windows
  // y en la Mac.
  const sinRespaldos = tut.replace(/<details className="tci-respaldo">[\s\S]*?<\/details>/g, '');
  assert.doesNotMatch(sinRespaldos, /COMANDO_CLAUDE|LOGIN_CLAUDE|lineaDeInstalacion|DONDE_PEGAR/, 'el tutorial pide abrir una terminal fuera de un respaldo');
  // Sin la sesión de Claude: en Windows, el enlace que la inicia sin terminal.
  assert.match(tut, /<a className="tci-boton" href="mako:\/\/iniciar-sesion">Iniciar sesión en Claude<\/a>/);
  // El aviso del chat sin la sesión de Claude no manda a un paso: en Windows el «paso 3» ya no existe (revisión de la 0.4.0).
  assert.doesNotMatch(AVISO_PC_SIN_SESION, /paso \d/, 'el aviso manda a un paso que no existe');
  // Una PC de la 0.3.2 (instalada con la línea de comandos, como la del ws1) no abre mako://: plegada, la línea de siempre.
  assert.match(tut, /<summary>¿No funciona\? Con la línea de comandos<\/summary>\s*<p>\{DONDE_PEGAR\.windows\}<\/p>\s*<Copiar texto=\{LOGIN_CLAUDE\.windows\} \/>/);
});

test('2. «Descargar» pide la sesión, baja el instalador con su nombre, y si falta lo dice', () => {
  assert.equal(VERSION_PC, '0.4.2');
  assert.equal(archivoDelInstalador(), 'mako-pc-0.4.2-windows-setup.exe');
  assert.equal(nombreDelInstalador(), 'MaKo-Setup-0.4.2.exe');
  const r = sinComentarios(leer('app/api/ia-pc/descargar/route.ts'));
  const get = r.slice(r.indexOf('export async function GET('));
  assert.ok(get.indexOf('await personaDelRequest()') > 0 && get.indexOf('await personaDelRequest()') < get.indexOf('createSignedUrl'), 'firma sin mirar la sesión');
  assert.match(get, /if \('error' in persona\) return texto\(persona\.error, persona\.status\);/);
  // Windows, el instalador; la Mac (0.4.2), MaKo.app: cada uno con su nombre.
  assert.match(get, /const archivo = os === 'mac' \? archivoDelInstaladorMac\(\) : archivoDelInstalador\(\);/);
  assert.match(get, /\.createSignedUrl\(archivo, 600, \{ download: os === 'mac' \? nombreDelInstaladorMac\(\) : nombreDelInstalador\(\) \}\)/);
  assert.match(get, /if \(os !== 'windows' && os !== 'mac'\) return texto\(/);
  assert.match(get, /nombre: 'IaPcFaltaInstalador'/, 'que falte el instalador pasa callado');
  assert.match(get, /return NextResponse\.redirect\(data\.signedUrl, 302\);/);
  assert.doesNotMatch(leer('lib/rutas-publicas.ts'), /ia-pc\/descargar/, 'la descarga quedó pública');
});

test('3. el instalador: por usuario, mako://, Claude Code oculto y sin la barra lenta, la app de nuevo, y vuelve a «Conecta MaKo»', () => {
  const iss = leer('installer/windows/mako.iss');
  assert.match(iss, /^PrivilegesRequired=lowest$/m, 'pide administrador');
  assert.match(iss, /^OutputBaseFilename=MaKo-Setup-\{#AppVersion\}$/m, 'el nombre no es el que baja la ruta');
  assert.match(iss, /Subkey: "Software\\Classes\\mako\\shell\\open\\command"; ValueType: string; ValueName: ""; ValueData: """\{app\}\\mako-pc\.exe"" ""%1"""/);
  const claude = iss.split('\n').find((l) => l.startsWith('Filename: "powershell.exe"') && l.includes('install.ps1')) ?? '';
  assert.match(claude, /-WindowStyle Hidden/);
  assert.match(claude, /Flags: runhidden waituntilterminated/);
  assert.ok(claude.indexOf("$ProgressPreference = 'SilentlyContinue'") > 0 && claude.indexOf("$ProgressPreference = 'SilentlyContinue'") < claude.indexOf('irm '), 'la barra de progreso hace lentísima la bajada (AGENTS.md)');
  assert.match(iss, /^Filename: "\{app\}\\mako-pc\.exe"; Flags: nowait$/m, 'al actualizar, la app queda cerrada hasta el próximo inicio de sesión');
  // 0.4.1 (revisión de la 0.4.0): de 64 bits (install.ps1 corta en un PowerShell de 32), sin preguntar, y la app ANTES de Claude.
  assert.match(iss, /^ArchitecturesAllowed=x64compatible$/m);
  assert.match(iss, /^ArchitecturesInstallIn64BitMode=x64compatible$/m, 'el PowerShell oculto sale de SysWOW64 y Claude Code no se instala');
  assert.match(claude, /-NonInteractive/);
  assert.match(claude, /Flags: runhidden waituntilterminated 64bit$/);
  assert.ok(iss.indexOf('Filename: "{app}\\mako-pc.exe"; Flags: nowait') < iss.indexOf(claude), 'la app vuelve recién después de instalar Claude Code');
  assert.equal(RUTA_TRAS_INSTALAR, '/perfil/ia?computadora=1');
  assert.match(iss, new RegExp(`^Filename: "https://hola-mako\\.com${RUTA_TRAS_INSTALAR.replace(/[?.]/g, '\\$&')}"; Description: "Conectar con MaKo"; Flags: postinstall shellexec nowait$`, 'm'));
  // «Tus cuentas de IA» directo en «Conecta MaKo», con las PC de antes YA leídas (si no, una que ya estaba se tomaba por la nueva).
  const ui = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  assert.match(ui, /if \(!computadora \|\| !estado \|\| abiertoDesdeElInstalador\.current\) return;\n\s*abiertoDesdeElInstalador\.current = true;\n\s*antes\.current = estado\.pcs\.map\(\(p\) => p\.id\);\n\s*setPasoInicial\(4\);/);
});
