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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARCHIVOS_PC, VERSION_PC, archivoDelPrograma, faltanEnElBucket } from '../lib/ia-pc-reglas';

const RAIZ = join(__dirname, '..');
const sinComentarios = (s: string) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('qué falta en el bucket: los 3 archivos de la versión, y qué versiones hay', () => {
  // El bucket del 22/10 a las 12:45 UTC.
  const hoy = ['0.2.0', '0.3.0'].flatMap((v) => ARCHIVOS_PC.map((a) => `mako-pc-${v}-${a}.gz`));
  assert.deepEqual(faltanEnElBucket(hoy), { faltan: ARCHIVOS_PC.map(archivoDelPrograma), versiones: ['0.2.0', '0.3.0'] });
  assert.deepEqual(faltanEnElBucket([...hoy, ...ARCHIVOS_PC.map(archivoDelPrograma)]).faltan, [], `con los 3 de la ${VERSION_PC}, nada`);
  // Un archivo solo no alcanza: Windows y las dos Mac.
  assert.equal(faltanEnElBucket([archivoDelPrograma('windows-x64')]).faltan.length, 2);
  // Otra versión (la que pida el código de mañana).
  assert.deepEqual(faltanEnElBucket(hoy, '0.9.9').faltan, ['mako-pc-0.9.9-windows-x64.gz', 'mako-pc-0.9.9-mac-arm64.gz', 'mako-pc-0.9.9-mac-x64.gz']);
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
});
