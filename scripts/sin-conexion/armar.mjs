#!/usr/bin/env node
// =============================================================================
// armar — el JS del cascarón de MaKo sin conexión: lib/sin-conexion/cascaron.ts → public/sin-conexion/app.js (28/10/2026)
// =============================================================================
// El cascarón no puede ser una página de Next: el layout raíz lee la sesión y toda página sale con datos de quien la pidió
// (docs/diseno-mako-desktop-sin-conexion.md, punto 1). Es un archivo estático, armado con esbuild y COMMITEADO: el build de
// Vercel no lo arma. tests/sin-conexion.test.ts lo vuelve a armar y frena si el commiteado quedó viejo.
//
//   node scripts/sin-conexion/armar.mjs            ← escribe public/sin-conexion/app.js
//   node scripts/sin-conexion/armar.mjs --revisar  ← sale 1 si el commiteado no es el que sale del código
// Sin minificar, a propósito: el diff del commit se tiene que poder leer.
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SALIDA = join(RAIZ, 'public', 'sin-conexion', 'app.js');
const CABECERA = '// ⚠️ ARCHIVO ARMADO: no se edita a mano. Sale de lib/sin-conexion/cascaron.ts con `node scripts/sin-conexion/armar.mjs`.\n';

/** El JS armado, como texto. Lo usa el test. */
export async function armar() {
  // esbuild viene con tsx (devDependency): no se suma nada al package.json.
  const esbuild = createRequire(join(RAIZ, 'package.json'))('esbuild');
  const r = await esbuild.build({
    stdin: { contents: "import { arrancar } from './cascaron';\narrancar();\n", resolveDir: join(RAIZ, 'lib', 'sin-conexion'), loader: 'ts', sourcefile: 'entrada.ts' },
    bundle: true,
    format: 'iife',
    target: ['es2020'],
    platform: 'browser',
    minify: false,
    legalComments: 'none',
    charset: 'utf8',
    write: false,
    logLevel: 'silent',
    tsconfig: join(RAIZ, 'tsconfig.json'),
  });
  return CABECERA + r.outputFiles[0].text.replace(/\r\n/g, '\n');
}

const esPrincipal = process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1]);
if (esPrincipal) {
  const js = await armar();
  if (process.argv.includes('--revisar')) {
    let viejo = '';
    try { viejo = readFileSync(SALIDA, 'utf8').replace(/\r\n/g, '\n'); } catch { /* no está */ }
    if (viejo !== js) { console.error('⛔ public/sin-conexion/app.js quedó viejo: correr node scripts/sin-conexion/armar.mjs'); process.exit(1); }
    console.log('ok: public/sin-conexion/app.js está al día');
  } else {
    writeFileSync(SALIDA, js);
    console.log(`public/sin-conexion/app.js: ${(Buffer.byteLength(js) / 1024).toFixed(1)} KB`);
  }
}
