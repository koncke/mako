#!/usr/bin/env node
// =============================================================================
// tsc-bitacoras.mjs — el chequeo de tipos ACOTADO a las bitácoras de /admin/dev
// =============================================================================
// POR QUÉ: un hito `tipo: 'prompt'` sin `puntos` (TS2741) frenó tres pushes el
// 14/10/2026, y el 15/10 tiró un run entero de GitHub Actions (38830968542) —
// ~10 minutos de los 2.000 del mes— por un error que se ve en segundos. Las
// bitácoras se escriben a mano en cada tanda y son lo que más se rompe así.
//
// Corre en las guardas baratas del push (scripts/guardas-push.sh), con un tsconfig
// que extiende el principal e incluye sólo esas 55 bitácoras
// (scripts/tsconfig.bitacoras.json) y 2 GB de heap: el tsc completo pide 3-5 GB y
// por eso vive en Actions.
//
// Tres salidas, y la tercera es la que importa: si tsc no termina (lo mató el
// vigía de RAM, que deja código 1 y cero salida, o se quedó sin heap), eso NO es
// un error de tipos y el push SIGUE — Actions corre el tsc completo igual. Frenar
// por eso sería un candado que se arregla esperando, no corrigiendo.
// =============================================================================

import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

/** 'ok' | 'errores' | 'sin-chequear', según cómo terminó tsc. Puro: lo prueba un test. */
export function veredicto(status, salida) {
  if (status === 0) return 'ok';
  if (/error TS\d+/.test(salida ?? '')) return 'errores';
  return 'sin-chequear';
}

function main() {
  const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
  const r = spawnSync(process.execPath, [
    '--max-old-space-size=2048',
    join(raiz, 'node_modules', 'typescript', 'bin', 'tsc'),
    '-p', join(raiz, 'scripts', 'tsconfig.bitacoras.json'),
  ], { cwd: raiz, encoding: 'utf8' });
  const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const v = veredicto(r.error ? null : r.status, salida);
  if (v === 'errores') {
    process.stdout.write(salida);
    process.exit(1);
  }
  if (v === 'sin-chequear') {
    process.stderr.write(`  (no se pudo chequear las bitácoras — código ${r.status ?? r.error?.message}, ${salida.length} bytes de salida: lo chequea GitHub Actions)\n`);
  }
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
