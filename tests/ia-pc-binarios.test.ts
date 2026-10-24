// =============================================================================
// IA1 (22/10/2026): la versión que pide el instalador tiene que estar ENTERA en el bucket, y «subido» no es «se baja»
// =============================================================================
// La 0.3.2 se desplegó el 21/10 sin sus ejecutables: el bucket privado `ia-pc` tenía 0.2.0 y 0.3.0, firmar la URL daba
// «Object not found» y la línea del tutorial contestaba «No pude preparar la descarga» con un 200, a todo cliente nuevo.
// Lo que fija este test:
//   1. `faltanEnElBucket` (lib/ia-pc-reglas.ts) dice qué archivos de una versión faltan y qué versiones hay.
//   2. publicar-binarios, en seco, mira el bucket y lo dice; al aplicar, FIRMA cada archivo subido (lo mismo que hace el
//      instalador) y sale con 1 si alguno no firma; y no hace `process.exit()` después de los pedidos (en Windows Node
//      revienta así y el código de salida miente).
//
// Probado rompiéndolo (22/10/2026): sin la firma después de subir → 2 en rojo; `faltanEnElBucket` con la versión fija →
// 1 en rojo; un `process.exit(0)` al final → 2 en rojo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARCHIVOS_PC, VERSION_PC, archivoDelInstalador, archivoDelInstaladorMac, archivoDelPrograma, faltanEnElBucket, informeDeBinarios } from '../lib/ia-pc-reglas';

const RAIZ = join(__dirname, '..');
const sinComentarios = (s: string) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('qué falta en el bucket: los archivos de la versión (desde la 0.4.0, también el instalador), y qué versiones hay', () => {
  // El bucket del 22/10 a las 12:45 UTC.
  const hoy = ['0.2.0', '0.3.0'].flatMap((v) => ARCHIVOS_PC.map((a) => `mako-pc-${v}-${a}.gz`));
  const todos = [...ARCHIVOS_PC.map(archivoDelPrograma), archivoDelInstalador(), archivoDelInstaladorMac()];
  assert.deepEqual(faltanEnElBucket(hoy), { faltan: todos, versiones: ['0.2.0', '0.3.0'] });
  assert.deepEqual(faltanEnElBucket([...hoy, ...todos]).faltan, [], `con los 4 de la ${VERSION_PC}, nada`);
  // Un archivo solo no alcanza: Windows, las dos Mac y el instalador con asistente (0.4.0: sin él, «Descargar» falla).
  // Desde la 0.4.2, también MaKo.app para la Mac (sin ella, «Descargar MaKo para Mac» falla).
  assert.equal(faltanEnElBucket([archivoDelPrograma('windows-x64')]).faltan.length, 4);
  assert.deepEqual(faltanEnElBucket([...hoy, ...ARCHIVOS_PC.map(archivoDelPrograma)]).faltan, [archivoDelInstalador(), archivoDelInstaladorMac()], 'sin los instaladores, la versión está completa');
  // Otra versión (la que pida el código de mañana).
  assert.deepEqual(faltanEnElBucket(hoy, '0.9.9').faltan, ['mako-pc-0.9.9-windows-x64.gz', 'mako-pc-0.9.9-mac-arm64.gz', 'mako-pc-0.9.9-mac-x64.gz', 'mako-pc-0.9.9-windows-setup.exe', 'mako-pc-0.9.9-mac-app.zip']);
  assert.deepEqual(faltanEnElBucket(['otro.txt', 'mako-pc-0.10.0-mac-x64.gz', 'mako-pc-0.9.0-mac-x64.gz']).versiones, ['0.9.0', '0.10.0'], 'orden numérico');
});

test('publicar-binarios: mira el bucket en seco, firma lo que sube, y no revienta al salir', () => {
  const s = sinComentarios(readFileSync(join(RAIZ, 'scripts/ia-pc/publicar-binarios.mts'), 'utf8'));
  assert.match(s, /storage\.from\('ia-pc'\)\.list\(/, 'en seco dice qué hay y qué falta');
  const subida = s.indexOf(".upload(a.nombre");
  const firma = s.indexOf(".createSignedUrl(a.nombre");
  assert.ok(subida > 0 && firma > subida, 'después de subir, firma cada archivo (como el instalador)');
  assert.match(s, /return mal \? 1 : 0;/, 'si alguno no firma, sale con 1');
  // Ningún `process.exit()` después del primer pedido a la red.
  const despues = s.slice(s.indexOf("getSupabaseServer().storage"));
  assert.doesNotMatch(despues.replace('setTimeout(() => process.exit(), 10_000).unref();', ''), /process\.exit\(/);
  assert.match(s, /existsSync\(ENV\)/, 'un worktree no trae .env.local: sin --env lo dice');
  // El instalador con asistente (0.4.0): Inno Setup con el programa de recién, y sube con los demás.
  assert.match(s, /execFileSync\(ISCC, \['\/Q', `\/DAppVersion=\$\{VERSION_PC\}`, `\/DPrograma=\$\{path\.join\(dir, 'mako-pc\.exe'\)\}`/);
  assert.match(s, /armados\.push\(\{ nombre: archivoDelInstalador\(\), datos: setup, tipo: 'application\/octet-stream' \}\);/);
  assert.ok(s.indexOf('execFileSync(ISCC') < s.indexOf("getSupabaseServer().storage"), 'el instalador se arma antes de subir');
});

// IA2 (22/10/2026): que falte el ejecutable no pase callado. Probado rompiéndolo: el instalador sin `registrarError` → «el
// instalador» en rojo; el informe con la versión fija (VERSION_PC) → «verificar-binarios» en rojo; el script sin firmar
// lo listado → «verificar-binarios» en rojo.

test('verificar-binarios: dice «falta 0.9.9» con una versión sin ejecutables, y lista y firma como el instalador', () => {
  const hoy = [...['0.2.0', '0.3.0', VERSION_PC].flatMap((v) => ARCHIVOS_PC.map((a) => `mako-pc-${v}-${a}.gz`)), archivoDelInstalador(), archivoDelInstaladorMac()];
  const r = informeDeBinarios(hoy, '0.9.9');
  assert.equal(r.completa, false);
  assert.match(r.texto, /^⛔ falta 0\.9\.9: mako-pc-0\.9\.9-windows-x64\.gz, mako-pc-0\.9\.9-mac-arm64\.gz, mako-pc-0\.9\.9-mac-x64\.gz, mako-pc-0\.9\.9-windows-setup\.exe, mako-pc-0\.9\.9-mac-app\.zip\./);
  assert.deepEqual(informeDeBinarios(hoy), { completa: true, texto: `✓ ${VERSION_PC} completa: el instalador puede bajarla.` });
  assert.equal(informeDeBinarios(hoy, VERSION_PC, [archivoDelPrograma('mac-x64')]).completa, false, 'listado pero sin firmar no es completo');
  const s = sinComentarios(readFileSync(join(RAIZ, 'scripts/ia-pc/verificar-binarios.mts'), 'utf8'));
  assert.match(s, /\.createSignedUrl\(n, 60\)/, 'firma lo listado, como el instalador');
  assert.doesNotMatch(s, /\.(upload|remove|createBucket|update|move)\(/, 'sólo lee');
  assert.match(s, /return r\.completa \? 0 : 1;/);
});

// ⚠️ CON LA MÁQUINA CARGADA ESTE TEST DA ROJO SIN UN BUG (24/10/2026): el hijo pasa los 90 s y `execFileSync` tira
// «spawnSync … ETIMEDOUT». Medido con 28 archivos de test a la vez y ~4 GB libres: rojo; solo, verde (21/21 con
// tests/ia-pc-segunda-revision). Antes de buscar el bug, correlo solo (docs/hallazgos-ia.md → «Tests que mienten con la
// máquina cargada»).
test('el instalador: sin el ejecutable contesta el aviso Y deja la fila en errores_app', () => {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_ia-pc-instalar-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 90_000, stdio: ['ignore', 'pipe', 'ignore'],
  });
  const r = JSON.parse(salida.split('@@RESULTADO@@').pop() ?? '{}');
  assert.equal(r.error, undefined, r.error);
  assert.equal(r.status, 200, 'con 200: `irm` y `curl -f` no muestran el cuerpo de un 4xx');
  assert.match(r.cuerpo, /No pude preparar la descarga/);
  assert.deepEqual(r.firmas, [`/storage/v1/object/sign/ia-pc/${archivoDelPrograma('windows-x64')}`]);
  assert.equal(r.errores.length, 1, 'la fila que ven el vigía y la Ticketera');
  assert.equal(r.errores[0].mensaje, `ia-pc: falta el ejecutable ${VERSION_PC} (${archivoDelPrograma('windows-x64')}): Object not found`);
});
