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
//   - Los `.d.ts` GLOBALES de next (types/global.d.ts, image-types/global.d.ts) en `files`: hacen
//     OBLIGATORIO `NODE_ENV` en ProcessEnv. 17/10: un `{}` como ProcessEnv dio verde acá y rojo
//     (TS2345, y al castear TS2352) en el completo de Actions, dos veces.
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
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { veredicto } from './tsc-bitacoras.mjs';
import { esperarSinPausa } from './pausa-cerebro.mjs';

// ⚠️ EL MISMO LOCK QUE scripts/typecheck-lock.mjs (y que antes-de-subir y el respaldo por tandas del push): UN tsc por
// máquina. 28/10/2026, 18:34: la app de Claude se cayó con TODOS los chats adentro porque había tres tsc acotados a la vez
// (2,8 + 1,7 + 1,4 GB: dos de un mismo chat) y una barredora de tipos con 8 GB de techo. El acotado no tomaba el lock: la
// regla «un proceso pesado por vez» estaba en cada encargo y no frenó a nadie. Se espera el turno hasta 30 min; pasado eso NO
// corre (sale con 99, «no se pudo chequear»): «correr igual» hacía que todos los que esperaban arrancaran juntos detrás de un
// test colgado (28/10, 19:15, siete en fila), la misma estampida. Un lock de un proceso muerto se saca.
const LOCK_TSC = join(tmpdir(), 'mako-typecheck.lock');
const ESPERA_TURNO_MS = 30 * 60 * 1000;
const pidVivo = (pid) => { if (!Number.isInteger(pid) || pid <= 0) return false; try { process.kill(pid, 0); return true; } catch { return false; } };
const duenoDelLock = () => { try { return Number.parseInt(readFileSync(LOCK_TSC, 'utf8').trim(), 10); } catch { return Number.NaN; } };
function tomarLock() { try { writeFileSync(LOCK_TSC, String(process.pid), { flag: 'wx' }); return true; } catch { return false; } }
function soltarLock() { try { if (duenoDelLock() === process.pid) unlinkSync(LOCK_TSC); } catch { /* ya no era mío */ } }
async function esperarTurnoTsc() {
  const hasta = Date.now() + ESPERA_TURNO_MS;
  let avisado = false;
  while (Date.now() < hasta) {
    if (tomarLock()) return true;
    const pid = duenoDelLock();
    if (!pidVivo(pid)) { try { unlinkSync(LOCK_TSC); } catch { /* otro lo sacó */ } continue; }
    if (!avisado) { process.stderr.write(`  [tsc-acotado] otro chequeo de tipos corre en esta PC (pid ${pid}): espero mi turno…\n`); avisado = true; }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

const barra = (p) => p.replace(/\\/g, '/');

// ⚠️ Los .d.ts GLOBALES que el tsc completo carga por `next-env.d.ts` y un archivo suelto no ve. El que más muerde: next/types/global.d.ts hace
// OBLIGATORIO `NODE_ENV` en `NodeJS.ProcessEnv`. Medido el 17/10/2026 (run 100 de Actions y el que le siguió): un test pasaba `{}` donde se pide un
// `ProcessEnv` — el tsc ACOTADO dio verde y el completo dio rojo dos veces seguidas (TS2345; y después, al castear, TS2352). Se agregan sólo si existen
// (`next-env.d.ts` está en .gitignore y un worktree no lo tiene; los paquetes de next sí).
// Y los otros dos que el completo ve por su `include` y uno suelto no (1/11/2026): sin ellos, el `<style jsx>` de Compartir y el wasm del editor
// de video daban 16 errores que no existen, en la rama de cualquiera que los arrastrara.
const GLOBALES_DE_NEXT = ['node_modules/next/types/global.d.ts', 'node_modules/next/image-types/global.d.ts', 'node_modules/styled-jsx/global.d.ts', 'app/video-editor/_opencut/types/opencut-wasm-bg.d.ts'];

/** El tsconfig temporal. Lo prueba un test (con el repo de mentira no existen los .d.ts de next, y no entran). */
export function armarTsconfig(repo, archivos) {
  const r = barra(resolve(repo));
  const globales = GLOBALES_DE_NEXT.filter((g) => existsSync(join(resolve(repo), g))).map((g) => `${r}/${g}`);
  return {
    extends: `${r}/tsconfig.json`,
    compilerOptions: {
      noEmit: true,
      incremental: false,
      typeRoots: [`${r}/node_modules/@types`],
      types: ['node'],
    },
    files: [...archivos.map((a) => barra(resolve(repo, a))), ...globales],
    include: [],
  };
}

function archivosDeLaRama(repo) {
  const base = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: repo, encoding: 'utf8' }).trim();
  return execFileSync('git', ['diff', '--name-only', '--diff-filter=d', base], { cwd: repo, encoding: 'utf8' })
    .split('\n').map((s) => s.trim())
    .filter((f) => /\.(ts|tsx|mts)$/.test(f) && !f.endsWith('.d.ts') && existsSync(join(repo, f)));
}

async function main() {
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
  // La PAUSA del Cerebro (28/10/2026): mientras sube un tren, el tsc de un chat espera (scripts/pausa-cerebro.mjs).
  await esperarSinPausa({ quien: 'tsc-acotado' });
  // C:/dev/con-turno.mjs (el envoltorio del Cerebro) ya tomó el turno y lo dice con MAKO_TURNO_TOMADO=1: no se espera a sí mismo.
  if (process.env.MAKO_TURNO_TOMADO !== '1' && !(await esperarTurnoTsc())) {
    process.stderr.write(`  [tsc-acotado] NO SE PUDO CHEQUEAR: el turno de la PC lo tiene el pid ${duenoDelLock()} y no se liberó en 30 min. ` +
      'No es un verde ni un rojo: avisale al Cerebro (puede estar colgado).\n');
    process.exit(99);
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
    soltarLock();
    rmSync(dir, { recursive: true, force: true });
  }
  process.exit(codigo);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
