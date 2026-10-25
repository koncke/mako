// =============================================================================
// «Conectar mi computadora» en Windows SIN terminal: el instalador con asistente y el enlace mako:// (0.4.0, 23/10/2026)
// =============================================================================
// Martín (22/10/2026): «el proceso de instalación jamás sea por Powershell, ni siquiera que se tenga que abrir, que sea una
// app de escritorio con el típico panel de "avanzar"... Que al darle conectar si no tenes instalada la app, te deje
// descargarla». Y el 22/10 a las 23:21, por el Cerebro: «la 0.4.0 sin firmar», con UNA línea para el aviso de Windows, y la
// línea de PowerShell sólo como respaldo escondido. Lo que fija este test:
//   1. (25/10/2026, Martín: «rediseña eso, que se vea facil, mira la cantidad de texto») dos pantallas, un botón grande cada
//      una, y ninguna con un comando ni un código a la vista: descargar (con la línea del aviso), conectar (el botón abre la app
//      con mako://) y la sesión de Claude con mako://iniciar-sesion; la línea de comandos, SÓLO para una PC de la 0.3.x;
//   2. «Descargar» pide la sesión, baja el instalador con su nombre, y si falta lo dice (no pasa callado);
//   3. el instalador: por usuario, registra mako://, instala Claude Code oculto y sin la barra lenta, vuelve a arrancar la
//      app, y al terminar abre «Tus cuentas de IA» directo en «Conecta MaKo» (con las PC de antes ya leídas).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AVISO_PC_SIN_SESION, AVISO_SMARTSCREEN, RUTA_TRAS_INSTALAR, abreEnlacesMako, VERSION_PC, archivoDelInstalador, nombreDelInstalador,
} from '../lib/ia-pc-reglas';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. conectar sin terminal ni código a la vista: dos pantallas, un botón cada una (25/10/2026)', () => {
  assert.equal(AVISO_SMARTSCREEN, 'Si Windows dice «protegió su PC»: Más información › Ejecutar de todas formas.');
  const ui = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  const tut = ui.slice(ui.indexOf('function Tutorial('), ui.indexOf('const LogoIA'));
  assert.ok(tut.length > 1000, 'no encontré el tutorial');
  // Dos pantallas: 2 (descargar) y 4 (conectar). El instalador vuelve al 4; «Nuevo dispositivo» abre el 2.
  assert.match(tut, /const [paso, setPaso] = useState(pasoInicial >= 4 ? 4 : 2);/);
  assert.doesNotMatch(tut, /Paso ${/, 'volvió el «Paso 3 de 3»');
  // Paso 2: descargar el de esta computadora, con la UNA línea del aviso recién después de tocar.
  assert.match(tut, /<a className="tci-instalar__boton" href={descarga} onClick={() => setBajado(true)}>/);
  assert.equal((tut.match(/AVISO_SMARTSCREEN/g) ?? []).length, 1);
  // Paso 4: UN botón, «Conectar», que acepta y abre la app con el código (el enlace sale solo, no es otro botón).
  assert.match(tut, /className="tci-instalar__boton" onClick={conectar}>Conectar</button>/);
  assert.match(tut, /const abrirEnWindows = (c: string) => { window.location.href = `mako://conectar?codigo=${c}`; };/);
  // Cada pantalla, un solo botón grande.
  for (const bloque of tut.split(/{paso === /).slice(1)) {
    assert.ok((bloque.match(/className="tci-instalar__boton"/g) ?? []).length <= 1, `dos botones grandes en una pantalla: ${bloque.slice(0, 60)}`);
  }
  // Nada de terminal en el tutorial: ni la línea de PowerShell, ni la de la Terminal, ni el login, ni un respaldo plegado.
  assert.doesNotMatch(tut, /DONDE_PEGAR|lineaDeInstalacion|COMANDO_CLAUDE|LOGIN_CLAUDE|<details/, 'el tutorial muestra un comando');
  // El código no se ve en Windows: sólo en la Mac, y sólo si no se pudo copiar solo.
  assert.equal((tut.match(/<Copiar texto={codigo} />/g) ?? []).length, 1);
  assert.match(tut, /{sistema === 'mac' && copiado === false && codigo && <Copiar texto={codigo} />}/);
  // Sin la sesión de Claude: en Windows, el enlace que la inicia sin terminal.
  assert.match(tut, /<a className="tci-instalar__boton" href={conClaude ? 'mako://iniciar-sesion' : 'mako://iniciar-sesion?ia=chatgpt'}>Iniciar sesión</a>/);
  // El aviso del chat sin la sesión de Claude no manda a un paso: en Windows el «paso 3» ya no existe (revisión de la 0.4.0).
  assert.doesNotMatch(AVISO_PC_SIN_SESION, /paso d/, 'el aviso manda a un paso que no existe');
  // SÓLO una PC de la 0.3.x (instalada con la línea de comandos, como la del ws1) no abre mako://: ésa, y nadie más, ve la
  // línea plegada, en su fila de las cuentas.
  assert.match(ui, /{!abreEnlacesMako(d.version) && (s*<details className="tci-respaldo">s*<summary>¿No funciona? Con la línea de comandos</summary>s*<p>{DONDE_PEGAR.windows}</p>s*<Copiar texto={LOGIN_CLAUDE.windows} />/);
  for (const [v, abre] of [['0.3.2', false], ['0.3.2+windows', false], ['0.4.0', true], ['0.4.2+mac', true], ['1.0.0', true], [null, true]] as const) {
    assert.equal(abreEnlacesMako(v), abre, `abreEnlacesMako(${v})`);
  }
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
