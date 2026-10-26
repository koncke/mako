#!/usr/bin/env node
// tipos-respaldo-push.mjs — el chequeo de tipos de TODO el repo en 3 tandas, para el pre-push a `main` cuando el tsc entero
// (scripts/typecheck-lock.mjs) no consigue su RAM.
//
// POR QUE EXISTE (22/10/2026): sin minutos de GitHub Actions, a `main` sólo se llega por el pre-push, que corre el tsc entero
// con un piso de 6,3 GB libres. Con la app de Claude abierta esta PC no pasa de 6,0-6,1 GB: el push quedaba bloqueado y la única
// salida era `--no-verify`. Las 3 tandas de scripts/tipos-por-tandas.mjs con el programa ENTERO entran (picos de 3,8 a 4,2 GB) y
// cubren todo el repo. Medido ese día: el lote 87365c830 dio 0, 0 y 0.
//
// LO QUE NO SE NEGOCIA: una tanda que no terminó (el vigía la mató, se quedó sin heap, no había RAM, salió sin su bloque de
// estadísticas) es un RECHAZO (99), nunca un OK. Sólo pasa si las TRES terminaron y ninguna imprimió un error de tipos.
//
// ⚠️ SIN `--raices`: con raíces, una tanda no carga los tipos globales de Next (`next` en RequestInit, `*.module.css`) y da
// errores falsos (15 el 22/10 en la 2/3). Con el programa entero dieron 0.
// ⚠️ K = 3, y no 4 ni más: la revisión del 21/10 midió que `lib/` es un ciclo de imports de 580 archivos que con K = 4, 5 o 6
// queda partido entre tandas (y un error que el checker cachea, TS2589/TS2303, se puede perder); con K = 3 no se parte. Lo que
// queda: el caso de un script global sin import ni export (docs/hallazgos-infra.md). Por eso sale «OK por tandas», no «OK».
//
// Salida: 0 las tres en 0 · 1 hay errores de tipos (se imprimen) · 99 no se pudo chequear (no es un error de tipos).

import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir, freemem } from 'node:os';

export const TANDAS = 3;
export const HEAP_MB = 4096;
export const SALIDA_SIN_CHEQUEAR = 99;
// El piso de RAM de cada tanda: el heap (+0,1 de overhead) + la zona roja del vigía (0,9) + margen. ≈ 5,3 GB.
// 26/10/2026 (el Cerebro): con la app de Claude abierta la PC dejó de pasar los 4,5 GB disponibles aunque se archivaran cuatro
// chats (quietos, ya estaban en disco), y el tren esperó horas. La zona roja no protege la PC: con el vigía PRENDIDO, una tanda que
// la toca muere y el push sale con 99 («sin chequear», nunca un verde falso). `MAKO_TIPOS_RAM_MIN_GB` baja el piso a mano para
// intentarlo igual, nunca por debajo del heap + 0,3; sin el vigía corriendo no se usa (lo dice docs/hallazgos-infra.md).
const PISO_POR_DEFECTO_GB = HEAP_MB / 1024 + 0.1 + 0.9 + 0.3;
const PISO_A_MANO_GB = Number(process.env.MAKO_TIPOS_RAM_MIN_GB);
export const RAM_MIN_GB = Number.isFinite(PISO_A_MANO_GB) && PISO_A_MANO_GB > 0
  ? Math.max(HEAP_MB / 1024 + 0.3, Math.min(PISO_A_MANO_GB, PISO_POR_DEFECTO_GB))
  : PISO_POR_DEFECTO_GB;
const RAM_ESPERA_MAX_MS = 15 * 60 * 1000;
// El mismo lock que scripts/typecheck-lock.mjs: nunca dos tsc grandes a la vez en esta PC.
const LOCK = join(tmpdir(), 'mako-typecheck.lock');
const LOCK_ESPERA_MAX_MS = 10 * 60 * 1000;

/**
 * Qué pasó con una tanda. Puro: lo prueba un test.
 * `ok` exige las dos cosas: salió con 0 Y llegó al bloque de estadísticas del final («Total time»). Sin ese bloque el proceso
 * no terminó su chequeo, aunque el código diga 0.
 * @param {{ code: number | null, signal?: string | null, salida: string }} r
 * @returns {{ estado: 'ok' | 'errores' | 'sin-chequear', errores: string[], porque?: string }}
 */
export function clasificarTanda({ code, signal = null, salida }) {
  const errores = salida.split(/\r?\n/).filter((l) => /\berror TS\d+:/.test(l));
  if (errores.length) return { estado: 'errores', errores };
  if (/heap out of memory|Reached heap limit|FATAL ERROR: .*heap/i.test(salida)) return { estado: 'sin-chequear', errores, porque: 'se quedó sin heap' };
  if (signal) return { estado: 'sin-chequear', errores, porque: `murió por la señal ${signal}` };
  if (code !== 0) return { estado: 'sin-chequear', errores, porque: `salió con ${code} sin errores de tipos (¿lo mató el vigía?)` };
  if (!/Total time:/.test(salida)) return { estado: 'sin-chequear', errores, porque: 'salió con 0 pero sin terminar el chequeo (falta el bloque de estadísticas)' };
  return { estado: 'ok', errores };
}

/**
 * El veredicto de las tandas. Puro: lo prueba un test.
 * Un error de tipos es real aunque otra tanda no haya podido correr: manda 1. Si ninguna dio errores y alguna no terminó, 99.
 * Sólo con las TRES tandas en `ok` sale 0. Menos tandas que las pedidas (se cortó a mitad) también es 99.
 * @param {ReturnType<typeof clasificarTanda>[]} resultados
 * @param {number} [esperadas]
 */
export function veredictoRespaldo(resultados, esperadas = TANDAS) {
  if (resultados.some((r) => r.estado === 'errores')) return 1;
  if (resultados.length < esperadas || resultados.some((r) => r.estado !== 'ok')) return SALIDA_SIN_CHEQUEAR;
  return 0;
}

function vivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}
const duenoDelLock = () => { try { return Number.parseInt(readFileSync(LOCK, 'utf8').trim(), 10); } catch { return NaN; } };
const tomarLock = () => { try { writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); return true; } catch { return false; } };
const soltarLock = () => { try { if (duenoDelLock() === process.pid) unlinkSync(LOCK); } catch { /* ya no es mío */ } };

async function esperar(cond, maxMs, pausaMs, aviso) {
  const hasta = Date.now() + maxMs;
  let dicho = false;
  while (Date.now() < hasta) {
    if (cond()) return true;
    if (!dicho && aviso) { process.stderr.write(aviso()); dicho = true; }
    await new Promise((r) => setTimeout(r, pausaMs));
  }
  return cond();
}

function correrTanda(i, guion) {
  return new Promise((resolve) => {
    const hijo = spawn(process.execPath, [`--max-old-space-size=${HEAP_MB}`, '--expose-gc', guion, '--tanda', `${i}/${TANDAS}`], { stdio: ['ignore', 'pipe', 'pipe'] });
    let salida = '';
    for (const f of [hijo.stdout, hijo.stderr]) f.on('data', (b) => { salida += b.toString(); });
    hijo.on('exit', (code, signal) => resolve({ code, signal, salida }));
    hijo.on('error', (e) => resolve({ code: 1, signal: null, salida: `no pude lanzar la tanda: ${e.message}` }));
  });
}

async function main() {
  // Las tandas chequean el árbol del cwd (el worktree que empuja), con su tsconfig.
  const guion = existsSync(join(process.cwd(), 'scripts', 'tipos-por-tandas.mjs'))
    ? join(process.cwd(), 'scripts', 'tipos-por-tandas.mjs')
    : join(dirname(fileURLToPath(import.meta.url)), 'tipos-por-tandas.mjs');
  const turno = await esperar(() => {
    if (tomarLock()) return true;
    if (!vivo(duenoDelLock())) { try { unlinkSync(LOCK); } catch { /* lo sacó otro */ } }
    return false;
  }, LOCK_ESPERA_MAX_MS, 400, () => `  [tipos por tandas] otro typecheck tiene el lock (pid ${duenoDelLock()}); espero mi turno…\n`);
  if (!turno) { process.stderr.write('  ✖ el lock del typecheck no se liberó en 10 min: no chequeo (NO es un error de tipos).\n'); return SALIDA_SIN_CHEQUEAR; }
  const resultados = [];
  try {
    for (let i = 1; i <= TANDAS; i++) {
      const hayRam = await esperar(() => freemem() / 1024 ** 3 >= RAM_MIN_GB, RAM_ESPERA_MAX_MS, 2000,
        () => `  [tipos por tandas] tanda ${i}/${TANDAS}: quedan ${(freemem() / 1024 ** 3).toFixed(1)} GB y pide ${RAM_MIN_GB.toFixed(1)}; espero hasta 15 min…\n`);
      if (!hayRam) {
        process.stderr.write(`  ✖ tanda ${i}/${TANDAS}: no hubo RAM en 15 min. NO es un error de tipos: no se chequeó.\n`);
        resultados.push({ estado: 'sin-chequear', errores: [], porque: 'no hubo RAM' });
        break;
      }
      const t0 = Date.now();
      const r = clasificarTanda(await correrTanda(i, guion));
      resultados.push(r);
      const s = Math.round((Date.now() - t0) / 1000);
      if (r.estado === 'ok') process.stdout.write(`  ✔ tanda ${i}/${TANDAS}: 0 errores · ${s} s\n`);
      else if (r.estado === 'errores') process.stdout.write(`  ✖ tanda ${i}/${TANDAS}: ${r.errores.length} error(es) de tipos · ${s} s\n${r.errores.map((e) => `      ${e}`).join('\n')}\n`);
      else { process.stdout.write(`  ✖ tanda ${i}/${TANDAS}: no terminó (${r.porque}) · ${s} s\n`); break; }
    }
  } finally { soltarLock(); }
  const v = veredictoRespaldo(resultados);
  if (v === 0) process.stdout.write(`  ✔ tipos por tandas: las ${TANDAS} en 0 (OK por tandas, no el tsc entero)\n`);
  return v;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((c) => process.exit(c), (e) => { process.stderr.write(`  ✖ tipos por tandas: ${e?.message ?? e}\n`); soltarLock(); process.exit(SALIDA_SIN_CHEQUEAR); });
}
