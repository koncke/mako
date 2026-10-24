// =============================================================================
// MaKo.app para la Mac, SIN Terminal (0.4.2, 23/10/2026)
// =============================================================================
// En la llamada del 23/10 (Fathom 195591907), Mauricio conectó su MacBook por la Terminal y le costó («No abrió nada», «escribí S y
// apretá Enter»). El Cerebro: «Mismo criterio que Windows: "Descargar MaKo para Mac", el asistente y "Conectar esta
// computadora"... Sin firmar por ahora, con la línea de cómo abrirlo si macOS lo frena». Un .pkg o un .dmg no se arman en Windows,
// y en la Mac un enlace mako:// no le llega al programa (es un evento de macOS): MaKo.app en un .zip, que toma el código del
// portapapeles. Lo que fija este test (el programa REAL en tests/_ia-pc-mac-hijo.mjs):
//   1. la app: el código del portapapeles (sólo el código), si no escrito; Claude Code primero; ya conectada, sigue andando;
//   2. el arranque es el MISMO que deja la línea de la Terminal (una Mac conectada así no cambia);
//   3. MaKo.app: el lanzador (el programa de esa Mac, la firma local, sin cuarentena), el Info.plist y el .zip CON permisos;
//   4. la descarga, el bucket y el tutorial: «Descargar MaKo para Mac», la línea de macOS, y la Terminal sólo plegada.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  AVISO_GATEKEEPER, archivoDelInstaladorMac, infoPlistDeLaAppMac, lanzadorDeLaAppMac, nombreDelInstaladorMac, scriptDeInstalacion,
} from '../lib/ia-pc-reglas';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
let cache: Record<string, any> | null = null;
function correr(): Record<string, any> {
  if (cache) return cache;
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('./_ia-pc-mac-hijo.mjs', import.meta.url))], { encoding: 'utf8', timeout: 60_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@MAC@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  cache = JSON.parse(linea.slice('@@MAC@@'.length));
  return cache!;
}

test('1. la app: el código del portapapeles (sólo el código), si no escrito; Claude Code primero; ya conectada, sigue andando', () => {
  const r = correr();
  assert.deepEqual(r.codigos, ['ABCD2345', 'ABCD2345', 'ABCD2345', null, null, null, null], 'acepta otra cosa que el código');
  assert.equal(r.delPortapapeles.conecto.enlace, 'mako://conectar?codigo=ABCD2345');
  assert.equal(r.delPortapapeles.pidio, 0, 'con el código copiado, igual lo pidió');
  assert.ok(r.delPortapapeles.conecto.conArranque && r.delPortapapeles.conecto.conSesion, 'la conexión sin el arranque o sin la sesión de Claude');
  assert.equal(r.escrito.conecto.enlace, 'mako://conectar?codigo=WXYZ6789');
  assert.equal(r.escrito.pidio, 1);
  assert.equal(r.nada.salida, 1);
  assert.equal(r.nada.conecto, null);
  assert.match(r.nada.ventanas.at(-1).texto, /^No encontré el código\./);
  // Sin Claude Code: lo instala ANTES de conectar, y si no puede, lo dice y no conecta.
  assert.equal(r.sinClaude.instalo, 1);
  assert.match(r.sinClaude.avisos[0], /Instalo Claude Code/);
  assert.equal(r.sinClaude.conecto.enlace, 'mako://conectar?codigo=ABCD2345');
  assert.equal(r.noInstala.salida, 1);
  assert.equal(r.noInstala.conecto, null, 'conectó sin Claude Code');
  // Ya conectada y sin un código nuevo: sigue andando (con el programa recién copiado), sin volver a conectar.
  assert.equal(r.yaConectada.conecto, null);
  assert.equal(r.yaConectada.arranco, 1);
  assert.match(r.yaConectada.ventanas.at(-1).texto, /^Esta Mac está conectada a «Mauricio» y andando\./);
  assert.equal(r.yaConectadaSinSesion.inicio, 1, 'sin la sesión de Claude, no la ofreció');
  // Con un código nuevo copiado: la conexión (que avisa que cambia de negocio).
  assert.equal(r.otroNegocio.conecto.enlace, 'mako://conectar?codigo=MNPQ2345');
});

test('2. el arranque es el MISMO que deja la línea de la Terminal: una Mac conectada así no cambia', () => {
  const r = correr();
  const consola = scriptDeInstalacion({ sistema: 'mac', codigo: 'ABCD2345', servidor: 'https://hola-mako.com', urls: { 'mac-arm64': 'https://bucket.test/arm64', 'mac-x64': 'https://bucket.test/x64' } });
  for (const pieza of ['<key>Label</key><string>com.hola-mako.pc</string>', '<key>RunAtLoad</key><true/><key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>']) {
    assert.ok(consola.includes(pieza) && r.plist.includes(pieza), `el arranque de la app no es el de la Terminal: ${pieza}`);
  }
  assert.match(consola, /<key>ProgramArguments<\/key><array><string>\$D\/mako-pc<\/string><\/array>/);
  assert.match(consola, /D="\$HOME\/\.mako-pc\/bin"/);
  assert.match(r.plist, /<key>ProgramArguments<\/key><array><string>\/Users\/mau\/\.mako-pc\/bin\/mako-pc<\/string><\/array>/, 'otro programa que el de la Terminal');
  assert.match(r.plist, /<string>\/Users\/mau\/\.local\/bin:\/opt\/homebrew\/bin:\/usr\/local\/bin:\/usr\/bin:\/bin<\/string>/);
  // La app no se abre por un enlace en la Mac: el programa lo dice, y el nombre es el de la Mac.
  const p = sinComentarios(leer('scripts/ia-pc/mako-pc.mjs'));
  assert.match(p, /else if \(cmd === 'app'\) abrirLaApp\(\)\.then\(salir, fallar\);/);
  assert.match(p, /spawnSync\('scutil', \['--get', 'ComputerName'\]/);
  assert.match(p, /'curl -fsSL https:\/\/claude\.ai\/install\.sh \| bash'/, 'Claude Code no sale del instalador oficial');
});

test('3. MaKo.app: el lanzador, el Info.plist y el .zip CON permisos', async () => {
  const l = lanzadorDeLaAppMac();
  assert.match(l, /^#!\/bin\/sh\n/);
  assert.match(l, /if \[ "\$\(uname -m\)" = "arm64" \]; then B="\$R\/mako-pc-arm64"; else B="\$R\/mako-pc-x64"; fi/, 'el programa de otra Mac');
  assert.match(l, /xattr -d com\.apple\.quarantine "\$D\/mako-pc\.nuevo"/);
  assert.match(l, /codesign --force --sign - "\$D\/mako-pc\.nuevo"/, 'sin la firma local, el chip de Apple no lo corre');
  assert.match(l, /mv -f "\$D\/mako-pc\.nuevo" "\$D\/mako-pc"\nexec "\$D\/mako-pc" app\n$/);
  const i = infoPlistDeLaAppMac('0.4.2');
  assert.match(i, /<key>CFBundleExecutable<\/key><string>MaKo<\/string>/);
  assert.match(i, /<key>CFBundleShortVersionString<\/key><string>0\.4\.2<\/string>/);
  assert.match(i, /<key>LSUIElement<\/key><true\/>/);
  // El .zip, «hecho en Unix», con el lanzador y los programas ejecutables.
  const { zipConPermisos, leerZip } = await import('../scripts/ia-pc/zip-unix.mjs');
  const z = leerZip(zipConPermisos([
    { nombre: 'MaKo.app', dir: true },
    { nombre: 'MaKo.app/Contents/MacOS/MaKo', datos: l, modo: 0o755 },
    { nombre: 'MaKo.app/Contents/Info.plist', datos: i, modo: 0o644 },
  ]));
  assert.deepEqual(z.map((e: { nombre: string; hechoEnUnix: boolean; modo: number }) => [e.nombre, e.hechoEnUnix, e.modo.toString(8)]), [
    ['MaKo.app/', true, '40755'], ['MaKo.app/Contents/MacOS/MaKo', true, '100755'], ['MaKo.app/Contents/Info.plist', true, '100644'],
  ]);
  assert.equal(z[1].datos.toString('utf8'), l);
  // publicar-binarios la arma con eso, la sube, y no pasa los 50 MB.
  const s = sinComentarios(leer('scripts/ia-pc/publicar-binarios.mts'));
  for (const e of ["{ nombre: 'MaKo.app/Contents/MacOS/MaKo', datos: lanzadorDeLaAppMac(), modo: 0o755 }", "{ nombre: 'MaKo.app/Contents/Resources/mako-pc-arm64', datos: crudos['mac-arm64'], modo: 0o755 }", "{ nombre: 'MaKo.app/Contents/Resources/mako-pc-x64', datos: crudos['mac-x64'], modo: 0o755 }", "{ nombre: 'MaKo.app/Contents/Info.plist', datos: infoPlistDeLaAppMac(), modo: 0o644 }"]) {
    assert.ok(s.includes(e), `falta en la app: ${e}`);
  }
  assert.match(s, /armados\.push\(\{ nombre: archivoDelInstaladorMac\(\), datos: appMac, tipo: 'application\/zip' \}\);/);
  assert.match(s, /if \(appMac\.length > 50e6\)/);
});

test('4. la descarga, el bucket y el tutorial: «Descargar MaKo para Mac», la línea de macOS, y la Terminal sólo plegada', () => {
  assert.equal(archivoDelInstaladorMac('0.4.2'), 'mako-pc-0.4.2-mac-app.zip');
  assert.equal(nombreDelInstaladorMac('0.4.2'), 'MaKo-0.4.2-Mac.zip');
  assert.equal(AVISO_GATEKEEPER, 'Si macOS dice que no puede comprobarla: Ajustes del Sistema › Privacidad y seguridad › Abrir igualmente.');
  const ui = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  const mac = ui.slice(ui.indexOf("{paso === 2 && sistema === 'mac' && ("), ui.indexOf('{paso === 4 && ('));
  assert.match(mac, /<a className="tci-boton" href="\/api\/ia-pc\/descargar\?os=mac">Descargar MaKo para Mac<\/a>\s*<p className="tci-nota">\{AVISO_GATEKEEPER\}<\/p>/);
  // Conectar: copiar el código; MaKo lo toma solo.
  assert.match(ui, /<p>Copia el código y abre MaKo: lo toma solo[^<]*<\/p>\s*\{codigo && !vencido && delCodigo !== 'gastado' \? <Copiar texto=\{codigo\} \/>/);
  // La descarga de MaKo (el cartel del chat sin la app, app/_chat/AppPrimero.tsx): la Mac también, y su aviso.
  const nd = sinComentarios(leer('app/integraciones/CuentasYDispositivos.tsx'));
  assert.match(nd, /href=\{`\/api\/ia-pc\/descargar\?os=\$\{sistemas\[0\]\}`\}/);
  assert.match(nd, /return sistemas\[0\] === 'mac' \? AVISO_GATEKEEPER : AVISO_SMARTSCREEN;/);
  assert.match(nd, /href=\{`\/api\/ia-pc\/descargar\?os=\$\{sistemas\[1\]\}`\}/, 'el otro sistema, a un toque');
});
