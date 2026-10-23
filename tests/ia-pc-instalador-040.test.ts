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
  AVISO_SMARTSCREEN, RUTA_TRAS_INSTALAR, VERSION_PC, archivoDelInstalador, nombreDelInstalador,
} from '../lib/ia-pc-reglas';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. Windows: tres pasos sin terminal; la línea de comandos sólo plegada; la Mac como siempre', () => {
  assert.equal(AVISO_SMARTSCREEN, 'Si Windows dice «protegió su PC»: Más información › Ejecutar de todas formas.');
  const ui = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  const tut = ui.slice(ui.indexOf('function Tutorial('), ui.indexOf('function SusClaves('));
  assert.match(tut, /const pasos = sistema === 'windows' \? \[1, 2, 4\] : \[1, 2, 3, 4\];/);
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
  // Lo de la terminal (instalar Claude Code, el login) es SÓLO de la Mac: el paso 2 de la Mac y el 3, que Windows no tiene.
  assert.equal((tut.match(/COMANDO_CLAUDE\[sistema\]/g) ?? []).length, 1);
  assert.ok(tut.indexOf('COMANDO_CLAUDE[sistema]') > tut.indexOf("{paso === 2 && sistema === 'mac' && ("));
  // Sin la sesión de Claude: en Windows, el enlace que la inicia sin terminal.
  assert.match(tut, /<a className="tci-boton" href="mako:\/\/iniciar-sesion">Iniciar sesión en Claude<\/a>/);
});

test('2. «Descargar» pide la sesión, baja el instalador con su nombre, y si falta lo dice', () => {
  assert.equal(VERSION_PC, '0.4.0');
  assert.equal(archivoDelInstalador(), 'mako-pc-0.4.0-windows-setup.exe');
  assert.equal(nombreDelInstalador(), 'MaKo-Setup-0.4.0.exe');
  const r = sinComentarios(leer('app/api/ia-pc/descargar/route.ts'));
  const get = r.slice(r.indexOf('export async function GET('));
  assert.ok(get.indexOf('await personaDelRequest()') > 0 && get.indexOf('await personaDelRequest()') < get.indexOf('createSignedUrl'), 'firma sin mirar la sesión');
  assert.match(get, /if \('error' in persona\) return texto\(persona\.error, persona\.status\);/);
  assert.match(get, /\.createSignedUrl\(archivoDelInstalador\(\), 600, \{ download: nombreDelInstalador\(\) \}\)/);
  assert.match(get, /nombre: 'IaPcFaltaInstalador'/, 'que falte el instalador pasa callado');
  assert.match(get, /return NextResponse\.redirect\(data\.signedUrl, 302\);/);
  assert.doesNotMatch(leer('lib/rutas-publicas.ts'), /ia-pc\/descargar/, 'la descarga quedó pública');
});

test('3. el instalador: por usuario, mako://, Claude Code oculto y sin la barra lenta, la app de nuevo, y vuelve a «Conecta MaKo»', () => {
  const iss = leer('installer/windows/mako.iss');
  assert.match(iss, /^PrivilegesRequired=lowest$/m, 'pide administrador');
  assert.match(iss, /^OutputBaseFilename=MaKo-Setup-\{#AppVersion\}$/m, 'el nombre no es el que baja la ruta');
  assert.match(iss, /Subkey: "Software\\Classes\\mako\\shell\\open\\command"; ValueType: string; ValueName: ""; ValueData: """\{app\}\\mako-pc\.exe"" ""%1"""/);
  const claude = iss.split('\n').find((l) => l.includes('install.ps1')) ?? '';
  assert.match(claude, /-WindowStyle Hidden/);
  assert.match(claude, /Flags: runhidden waituntilterminated/);
  assert.ok(claude.indexOf("$ProgressPreference = 'SilentlyContinue'") > 0 && claude.indexOf("$ProgressPreference = 'SilentlyContinue'") < claude.indexOf('irm '), 'la barra de progreso hace lentísima la bajada (AGENTS.md)');
  assert.match(iss, /^Filename: "\{app\}\\mako-pc\.exe"; Flags: nowait$/m, 'al actualizar, la app queda cerrada hasta el próximo inicio de sesión');
  assert.equal(RUTA_TRAS_INSTALAR, '/perfil/ia?computadora=1');
  assert.match(iss, new RegExp(`^Filename: "https://hola-mako\\.com${RUTA_TRAS_INSTALAR.replace(/[?.]/g, '\\$&')}"; Description: "Conectar con MaKo"; Flags: postinstall shellexec nowait$`, 'm'));
  // «Tus cuentas de IA» directo en «Conecta MaKo», con las PC de antes YA leídas (si no, una que ya estaba se tomaba por la nueva).
  const ui = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  assert.match(ui, /if \(!computadora \|\| !estado \|\| abiertoDesdeElInstalador\.current\) return;\n\s*abiertoDesdeElInstalador\.current = true;\n\s*antes\.current = estado\.pcs\.map\(\(p\) => p\.id\);\n\s*setPasoInicial\(4\);/);
});
