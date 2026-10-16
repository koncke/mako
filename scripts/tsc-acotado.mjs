#!/usr/bin/env node
// =============================================================================
// tsc-acotado.mjs — chequear los tipos de UNOS archivos sin el tsc completo
// =============================================================================
// El tsc completo pide 3-5 GB y en la notebook compartida lo corre GitHub Actions
// (AGENTS.md → «El typecheck NO corre en el build»). Para validar lo que uno tocó,
// cada chat armaba su tsconfig temporal a mano, y las trampas de esa receta daban
// rojos que no eran del código. Este script lo arma con todas resueltas:
//
//   - `"files"` con la lista Y `"include": []`. Sin el include vacío, `extends`
//     hereda el `include` del repo y se chequea TODO (14/10: sin heap a 2 GB).
//   - `"typeRoots": [<repo>/node_modules/@types]` ABSOLUTO + `"types": ["node"]`.
//     En el completo, los tipos de Node entran por `next-env.d.ts`, que un archivo
//     suelto no ve y un worktree ni tiene: sale «Cannot find name 'process'»
//     (TS2580). El tsconfig vive fuera del repo, por eso la ruta es absoluta.
//     Medido el 16/10 con app/web-generator/editor/insertar.ts: sin esto, 1 error;
//     con esto, 0.
//
// Lo que NO puede resolver solo, y lo dice al final si hay errores: un tipo que
// AGREGA otro archivo con `declare module` (los comandos de cada extensión de
// TipTap sobre `ChainedCommands`) no existe para un archivo compilado solo — ese
// mismo insertar.ts daba 5 rojos así. La cura es importar por tipos lo que se usa
// (`import type {} from '@tiptap/extension-task-list'`) o sumar ese archivo a la
// lista. Y el acotado NO sube a los que importan lo que tocaste: si cambiaste un
// TIPO compartido, sumá a sus consumidores.
//
// Uso:
//   node scripts/tsc-acotado.mjs <archivo.ts> [<archivo.tsx> ...]
//   node scripts/tsc-acotado.mjs --rama        (lo que cambió la rama contra el
//                                               merge-base con origin/main)
//   --heap=<MB>  (default 2560)
//
// Salida: 0 sin errores · 1 hay errores de tipos · 99 NO SE PUDO CHEQUEAR (tsc no
// terminó: lo mató el vigía de RAM, código 1 y cero salida, o se quedó sin heap).
// Un 99 no es un verde: no se miró nada.
// =============================================================================

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { veredicto } from './tsc-bitacoras.mjs';

const barra = (p) => p.replace(/\\/g, '/');

/** El tsconfig temporal. Puro: lo prueba un test. */
export function armarTsconfig(repo, archivos) {
  const r = barra(resolve(repo));
  return {
    extends: `${r}/tsconfig.json`,
    compilerOptions: {
      noEmit: true,
      incremental: false,
      typeRoots: [`${r}/node_modules/@types`],
      types: ['node'],
    },
    files: archivos.map((a) => barra(resolve(repo, a))),
    include: [],
  };
}

function archivosDeLaRama(repo) {
  const base = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: repo, encoding: 'utf8' }).trim();
  return execFileSync('git', ['diff', '--name-only', '--diff-filter=d', base], { cwd: repo, encoding: 'utf8' })
    .split('\n').map((s) => s.trim())
    .filter((f) => /\.(ts|tsx|mts)$/.test(f) && !f.endsWith('.d.ts') && existsSync(join(repo, f)));
}

function main() {
  const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
  const args = process.argv.slice(2);
  const heap = Number(args.find((a) => a.startsWith('--heap='))?.slice(7)) || 2560;
  const archivos = args.includes('--rama') ? archivosDeLaRama(repo) : args.filter((a) => !a.startsWith('--'));
  if (!archivos.length) {
    process.stderr.write(args.includes('--rama')
      ? '  [tsc-acotado] la rama no cambió ningún .ts/.tsx contra el merge-base con origin/main\n'
      : '  [tsc-acotado] no hay archivos para chequear (pasalos como argumento, o --rama)\n');
    process.exit(0);
  }
  const dir = mkdtempSync(join(tmpdir(), 'tsc-acotado-'));
  const config = join(dir, 'tsconfig.json');
  writeFileSync(config, JSON.stringify(armarTsconfig(repo, archivos), null, 2));
  // ⚠️ El código de salida se decide adentro y se sale AFUERA: un process.exit() dentro
  // del try corta en el acto y el finally que borra el tsconfig temporal no corre.
  let codigo = 99;
  try {
    const r = spawnSync(process.execPath, [`--max-old-space-size=${heap}`, join(repo, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', config], {
      cwd: repo, encoding: 'utf8',
    });
    const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    const v = veredicto(r.error ? null : r.status, salida);
    if (v === 'ok') {
      process.stdout.write(`  [tsc-acotado] ✓ ${archivos.length} archivo(s) sin errores de tipos\n`);
      codigo = 0;
    } else if (v === 'errores') {
      process.stdout.write(salida);
      process.stdout.write('\n  [tsc-acotado] Antes de creerle a un rojo: si el que falta lo agrega OTRO archivo con `declare module`\n' +
        '  (TipTap: los comandos de cada extensión), importalo por tipos o sumá ese archivo a la lista.\n');
      codigo = 1;
    } else {
      process.stderr.write(`  [tsc-acotado] NO SE PUDO CHEQUEAR (código ${r.status ?? r.error?.message}, ${salida.length} bytes de salida): ` +
        'no es un verde. Si fue el vigía de RAM, esperá o cerrá chats.\n');
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  process.exit(codigo);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
