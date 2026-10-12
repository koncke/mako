// =============================================================================
// El motor del Video Editor se carga desde public/ve/wasm/, nunca por el bundler
// =============================================================================
// En producción (12/10/2026) el editor entero cayó con «Failed to execute
// 'compile' on 'WebAssembly': HTTP status code is not ok»: el cargador de wasm de
// Turbopack codifica el `?dpl=` de Vercel ADENTRO del nombre del archivo y pide
// un .wasm que no existe (404). En local no hay deploy id y no se ve. Por eso el
// motor se carga a mano (app/video-editor/_opencut/wasm/opencut.ts). Este test
// cuida las tres cosas que lo sostienen:
//   1. nadie importa `opencut-wasm` directo (eso vuelve a meter el cargador roto);
//   2. la copia de public/ve/wasm/ es byte a byte el binario del paquete instalado
//      (si no, el pegamento JS y el .wasm no se hablan);
//   3. el nombre versionado del archivo es el de la versión instalada.
//
// Probado rompiéndolo (12/10):
//   R1 un `from "opencut-wasm"` en timeline-ruler.tsx      → 2/1 (de 3)
//   R2 un byte cambiado en la copia de public/ve/wasm/     → 2/1 (de 3)
//   R3 la versión del package.json del paquete en 0.2.11   → 1/2 (de 3: cambia el nombre esperado y no existe el archivo)
//   restaurado                                             → 3/0

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RAIZ = process.cwd();
const VERSION = JSON.parse(fs.readFileSync(path.join(RAIZ, 'node_modules/opencut-wasm/package.json'), 'utf8')).version as string;
const COPIA = path.join(RAIZ, `public/ve/wasm/opencut-wasm-${VERSION}.wasm`);
const CARGADOR = path.join(RAIZ, 'app/video-editor/_opencut/wasm/opencut.ts');

function archivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return archivos(p);
    return /\.(ts|tsx|js|mjs)$/.test(e.name) ? [p] : [];
  });
}

test('nadie importa opencut-wasm directo: todo pasa por el cargador propio', () => {
  const directos = archivos(path.join(RAIZ, 'app'))
    .filter((p) => p !== CARGADOR && !p.endsWith('.d.ts'))
    .filter((p) => /from\s+["']opencut-wasm["']|import\(\s*["']opencut-wasm["']\s*\)/.test(fs.readFileSync(p, 'utf8')))
    .map((p) => path.relative(RAIZ, p));
  assert.deepEqual(directos, [], 'estos archivos vuelven a meter el cargador de wasm de Turbopack, que en Vercel da 404');
});

test('la copia de public/ve/wasm/ es el binario del paquete instalado', () => {
  const hash = (p: string) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  assert.ok(fs.existsSync(COPIA), `falta ${path.relative(RAIZ, COPIA)}: copiá node_modules/opencut-wasm/opencut_wasm_bg.wasm con ese nombre`);
  assert.equal(hash(COPIA), hash(path.join(RAIZ, 'node_modules/opencut-wasm/opencut_wasm_bg.wasm')));
});

test('el cargador pide el archivo de la versión instalada', () => {
  assert.ok(fs.readFileSync(CARGADOR, 'utf8').includes(`"/ve/wasm/opencut-wasm-${VERSION}.wasm"`), 'URL_WASM_OPENCUT no es la de la versión instalada');
});
