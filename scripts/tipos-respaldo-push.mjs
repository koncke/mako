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
// El heap de cada tanda. 26/10/2026: con tren-m (Grabadores, MaKo recomienda, el Scraper) la tanda 1 «se quedó sin heap» en
// 4096 MB: el programa entero creció. `MAKO_TIPOS_HEAP_MB` lo sube a mano (entre 4096 y 8192); el piso de RAM sube con él,
// así que sólo sirve con RAM libre de verdad (después de reiniciar la app de Claude, o con la PC a 32 GB).
const HEAP_A_MANO_MB = Number(process.env.MAKO_TIPOS_HEAP_MB);
export const HEAP_MB = Number.isFinite(HEAP_A_MANO_MB) && HEAP_A_MANO_MB >= 4096 ? Math.min(HEAP_A_MANO_MB, 8192) : 4096;
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

/**
 * El turno de tipos de la PC: un ARCHIVO tomado con `wx` (el test-and-set), con el pid del dueño adentro. Es el mismo lock que
 * scripts/typecheck-lock.mjs y tsc-acotado. `lock` y `pid` son parámetros para que el test arme el suyo en una carpeta temporal.
 * @param {string} lock
 * @param {number} [pid]
 */
export function turnoDeArchivo(lock, pid = process.pid) {
  const dueno = () => { try { return Number.parseInt(readFileSync(lock, 'utf8').trim(), 10); } catch { return NaN; } };
  return {
    dueno,
    tomar: () => { try { writeFileSync(lock, String(pid), { flag: 'wx' }); return true; } catch { return false; } },
    // Sólo si sigue siendo MÍO: si se declaró huérfano y lo tomó otro, borrarlo le sacaría el turno al que trabaja.
    soltar: () => { try { if (dueno() === pid) unlinkSync(lock); } catch { /* ya no es mío */ } },
    // Un lock cuyo dueño murió no puede frenar a nadie para siempre.
    sacarHuerfano: () => { if (!vivo(dueno())) { try { unlinkSync(lock); } catch { /* lo sacó otro */ } } },
  };
}
const soltarLock = () => turnoDeArchivo(LOCK).soltar();

const dormirDeVerdad = (ms) => new Promise((r) => setTimeout(r, ms));

/** Espera a que `cond()` dé true, hasta `maxMs`. Con `dormir` y `ahora` inyectables: el test corre en milisegundos. */
async function esperarHasta(cond, maxMs, pausaMs, { dormir, ahora, aviso }) {
  const hasta = ahora() + maxMs;
  let dicho = false;
  while (ahora() < hasta) {
    if (cond()) return true;
    if (!dicho && aviso) { aviso(); dicho = true; }
    await dormir(pausaMs);
  }
  return cond();
}

const gb = (n) => n.toFixed(1);

/**
 * Las TANDAS con el turno de tipos de la PC, SIN ESPERAR NADA CON EL TURNO EN LA MANO (18/11/2026, O26).
 *
 * El arreglo del 29/10 (dac670c09) esperaba afuera sólo la RAM de la tanda 1: después de tomar el turno, el bucle volvía a
 * esperar hasta 15 min por tanda CON el turno tomado (la tanda 1 también, si la RAM bajó durante los 10 min de fila), y no lo
 * soltaba nunca. Con la PC en 2-3,5 GB eso es la fila de tipos de TODA la PC frenada sin que corra ningún tsc, que es justo lo
 * que la regla de docs/hallazgos-infra.md prohíbe («nada espera RAM ni pausa con un lock tomado… y si ya no alcanza se suelta»).
 *
 * Lo que hace ahora, por tanda (el molde es `esperarRamSinRetener`, scripts/antes-de-subir.mjs, y con-turno):
 *   1. con el turno en la mano, MIRA la RAM (sin esperar): si alcanza, corre;
 *   2. si no alcanza, SUELTA el turno y espera la RAM afuera, donde no frena a nadie;
 *   3. con RAM, vuelve a hacer fila por el turno, y al tomarlo vuelve al paso 1 (se pudo ir en la fila);
 *   4. si la RAM no aparece en `esperaRamMs` (sólo cuenta lo esperado afuera, no la fila), sale con 99 SIN el turno.
 *
 * ⚠️ NO MIRA LA PAUSA DEL CEREBRO, a propósito: la pausa (scripts/pausa-cerebro.mjs) existe PARA el push — mientras está prendida,
 *    lo pesado de los chats espera y con-turno no le da el turno a nadie que no sea el push. Si el push la esperara, se esperaría
 *    a sí mismo. Lo fija tests/tipos-respaldo-push.test.ts con la pausa prendida.
 *
 * @param {{
 *   tandas?: number,
 *   hayRam: () => boolean,
 *   libreGb?: () => number,
 *   pisoGb?: number,
 *   turno: { tomar: () => boolean, soltar: () => void, dueno: () => number, sacarHuerfano: () => void },
 *   correr: (i: number) => Promise<{ code: number | null, signal?: string | null, salida: string }>,
 *   dormir?: (ms: number) => Promise<unknown>,
 *   ahora?: () => number,
 *   esperaRamMs?: number,
 *   esperaTurnoMs?: number,
 *   sondeoRamMs?: number,
 *   sondeoTurnoMs?: number,
 *   out?: (t: string) => void,
 *   err?: (t: string) => void,
 * }} d
 * @returns {Promise<{ codigo: number, resultados: ReturnType<typeof clasificarTanda>[] }>}
 */
export async function tandasConTurno(d) {
  const tandas = d.tandas ?? TANDAS;
  const dormir = d.dormir ?? dormirDeVerdad;
  const ahora = d.ahora ?? Date.now;
  const esperaRamMs = d.esperaRamMs ?? RAM_ESPERA_MAX_MS;
  const esperaTurnoMs = d.esperaTurnoMs ?? LOCK_ESPERA_MAX_MS;
  const sondeoRamMs = d.sondeoRamMs ?? 2000;
  const sondeoTurnoMs = d.sondeoTurnoMs ?? 400;
  const out = d.out ?? ((t) => process.stdout.write(t));
  const err = d.err ?? ((t) => process.stderr.write(t));
  const libre = () => (d.libreGb ? gb(d.libreGb()) : '?');
  const piso = gb(d.pisoGb ?? RAM_MIN_GB);
  const min = Math.round(esperaRamMs / 60000);
  const { turno } = d;
  /** @type {ReturnType<typeof clasificarTanda>[]} */
  const resultados = [];
  let tengo = false;
  const cierre = () => ({ codigo: veredictoRespaldo(resultados, tandas), resultados });
  try {
    for (let i = 1; i <= tandas; i++) {
      // El tope de RAM cuenta SÓLO lo esperado afuera, no la fila (la revisión de esperarRamSinRetener: tras una fila larga, un
      // bajón momentáneo de RAM no puede dar 99 en el acto).
      let gastado = 0;
      for (;;) {
        if (tengo) {
          if (d.hayRam()) break;            // con el turno se MIRA, nunca se espera
          turno.soltar();
          tengo = false;
          err(`  [tipos por tandas] tanda ${i}/${tandas}: quedan ${libre()} GB y pide ${piso}; suelto el turno y espero afuera (no frena a nadie)…\n`);
          const t0 = ahora();
          await dormir(sondeoRamMs);        // un respiro antes de volver a mirar: si la RAM titila, no se gira en vacío
          gastado += ahora() - t0;
        }
        const desde = ahora();
        const hay = await esperarHasta(() => d.hayRam(), Math.max(0, esperaRamMs - gastado), sondeoRamMs, {
          dormir, ahora,
          aviso: () => err(`  [tipos por tandas] tanda ${i}/${tandas}: quedan ${libre()} GB y pide ${piso}; espero hasta ${min} min SIN tomar el turno…\n`),
        });
        gastado += ahora() - desde;
        if (!hay) {
          err(`  ✖ tanda ${i}/${tandas}: no hubo RAM en ${min} min. NO es un error de tipos: no se chequeó.\n`);
          resultados.push({ estado: 'sin-chequear', errores: [], porque: 'no hubo RAM' });
          return cierre();
        }
        const tomado = await esperarHasta(() => {
          if (turno.tomar()) return true;
          turno.sacarHuerfano();
          return false;
        }, esperaTurnoMs, sondeoTurnoMs, {
          dormir, ahora,
          aviso: () => err(`  [tipos por tandas] otro typecheck tiene el turno (pid ${turno.dueno()}); espero mi lugar…\n`),
        });
        if (!tomado) {
          err(`  ✖ el turno del typecheck no se liberó en ${Math.round(esperaTurnoMs / 60000)} min: no chequeo (NO es un error de tipos).\n`);
          resultados.push({ estado: 'sin-chequear', errores: [], porque: 'no se liberó el turno' });
          return cierre();
        }
        tengo = true;                       // y vuelve arriba: se MIRA la RAM con el turno en la mano
      }
      const t0 = ahora();
      const r = clasificarTanda(await d.correr(i));
      resultados.push(r);
      const s = Math.round((ahora() - t0) / 1000);
      if (r.estado === 'ok') out(`  ✔ tanda ${i}/${tandas}: 0 errores · ${s} s\n`);
      else if (r.estado === 'errores') out(`  ✖ tanda ${i}/${tandas}: ${r.errores.length} error(es) de tipos · ${s} s\n${r.errores.map((e) => `      ${e}`).join('\n')}\n`);
      else { out(`  ✖ tanda ${i}/${tandas}: no terminó (${r.porque}) · ${s} s\n`); break; }
    }
  } finally {
    if (tengo) turno.soltar();
  }
  const fin = cierre();
  if (fin.codigo === 0) out(`  ✔ tipos por tandas: las ${tandas} en 0 (OK por tandas, no el tsc entero)\n`);
  return fin;
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

/**
 * El respaldo de verdad: la RAM libre de la PC, el lock de la PC y las tandas de scripts/tipos-por-tandas.mjs. `over` reemplaza
 * cualquiera de esas piezas (lo usa el test, con una RAM y unas tandas de mentira y un lock en una carpeta temporal).
 * @param {Partial<Parameters<typeof tandasConTurno>[0]>} [over]
 */
export async function main(over = {}) {
  // Las tandas chequean el árbol del cwd (el worktree que empuja), con su tsconfig.
  const guion = existsSync(join(process.cwd(), 'scripts', 'tipos-por-tandas.mjs'))
    ? join(process.cwd(), 'scripts', 'tipos-por-tandas.mjs')
    : join(dirname(fileURLToPath(import.meta.url)), 'tipos-por-tandas.mjs');
  const { codigo } = await tandasConTurno({
    tandas: TANDAS,
    pisoGb: RAM_MIN_GB,
    hayRam: () => freemem() / 1024 ** 3 >= RAM_MIN_GB,
    libreGb: () => freemem() / 1024 ** 3,
    turno: turnoDeArchivo(LOCK),
    correr: (i) => correrTanda(i, guion),
    ...over,
  });
  return codigo;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((c) => process.exit(c), (e) => { process.stderr.write(`  ✖ tipos por tandas: ${e?.message ?? e}\n`); soltarLock(); process.exit(SALIDA_SIN_CHEQUEAR); });
}
