#!/usr/bin/env node
// =============================================================================
// tipos-ci.mjs — el paso «Tipos» de Actions: el tsc COMPLETO, dicho como lo que es
// =============================================================================
// POR QUÉ EXISTE (21/10/2026, run 200, 06ce1cb25): el paso era `node --max-old-space-size=5120 tsc --noEmit` pelado. Murió con exit 134 a los
// 297 s, con 5.082 MB de los 5.120 del tope («heap out of memory»), y en GitHub eso se ve IGUAL que un error de tipos: un paso en rojo y el email
// «All jobs have failed». Quien lo abre tiene que leer el log entero para descubrir que el código no tenía la culpa. Y el tope subió cuatro veces en
// una semana (2048 → 3072 → 4096 → 5120) cada vez DESPUÉS de que un run muriera: se descubría por el email, no por un número.
//
// Qué hace, por orden de importancia:
//   1. DICE QUÉ PASÓ, con una palabra y un exit distintos:
//        ok            → exit 0
//        errores       → exit 1   «ERRORES DE TIPOS»      (el código tiene la culpa: se corrige)
//        sin-memoria   → exit 98  «SIN MEMORIA»           (NO son errores de tipos: el tsc no llegó a un veredicto)
//        matado        → exit 98  «MATADO POR EL SISTEMA» (el OOM-killer del runner: el tope era más que la RAM física)
//        sin-chequear  → exit 98  «SIN VEREDICTO»         (salió con error y sin un solo «error TS»: no hay nada que corregir)
//      El 98 es el mismo «SIN TIPOS» de tests-afectados/antes-de-subir (SALIDA_SIN_TIPOS): el mismo hecho se llama igual en la PC y en Actions.
//   2. MIDE: corre con `--extendedDiagnostics --expose-gc`. Con `--expose-gc`, el «Memory used» del tsc es la memoria VIVA después de un GC
//      completo y de chequear todo, que es lo que decide si entra en el tope (el RSS no: V8 deja crecer el heap hasta el tope aunque no haga falta).
//      La línea `TIPOS-MEDIDA …` queda en el log de CADA run, y si lo vivo pasa del 80 % del tope sale un `::warning::` ANTES de que el paso muera.
//   3. NO DEPENDE DE UN NÚMERO A MANO: el tope se deriva de la RAM del runner (RAM − 1,5 GB para el SO y el runner), con TIPOS_HEAP_MB para
//      forzarlo. Si algún día el repo pasa a un runner más grande, el tope sube solo; si el runner se achica, el paso lo dice en vez de morir mudo.
//
// Lo que NO hace: no arregla que el programa crezca (en 7 días pasó de >4,0 a >5,0 GB de heap). Eso se mide con los números de la línea
// TIPOS-MEDIDA y se decide con ellos: docs/hallazgos-infra.md.
//
// Uso: node scripts/tipos-ci.mjs [argumentos extra del tsc, p. ej. -p otro.tsconfig.json]
// =============================================================================

import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { veredicto } from './tsc-bitacoras.mjs';

/** Mismo número que SALIDA_SIN_TIPOS de tests-afectados.mjs (lo fija tests/tipos-ci.test.ts): «no hay veredicto de tipos». */
export const SALIDA_SIN_TIPOS = 98;

/** RAM que se le deja al SO, al runner de GitHub y a lo que node usa FUERA del heap. */
export const RESERVA_MB = 1536;
export const TOPE_MIN_MB = 4096;
export const TOPE_MAX_MB = 8192;
/** Desde qué fracción del tope la memoria viva es una alarma (un warning, no un fallo). */
export const UMBRAL_AVISO = 0.8;

/** 6144 → «6.144» (separador de miles fijo: el log se lee igual en la PC y en Linux). */
export const miles = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * El tope del heap de node para el tsc. TIPOS_HEAP_MB manda; si no, se deriva de la RAM del runner: lo que sobra después de la reserva,
 * redondeado hacia abajo a múltiplos de 512 y acotado a [TOPE_MIN_MB, TOPE_MAX_MB]. Con los 7.9 GB del runner de 2 CPU da 6.144.
 * Puro: lo prueba un test.
 * @param {{ totalMb: number, env?: Record<string, string | undefined> }} a
 * @returns {number}
 */
export function topeDeHeapMb({ totalMb, env = {} }) {
  const pedido = Number.parseInt(env.TIPOS_HEAP_MB ?? '', 10);
  if (Number.isInteger(pedido) && pedido > 0) return pedido;
  const derivado = Math.floor((totalMb - RESERVA_MB) / 512) * 512;
  return Math.min(TOPE_MAX_MB, Math.max(TOPE_MIN_MB, derivado));
}

const SIN_HEAP = /heap out of memory|Reached heap limit|FATAL ERROR: .*(heap|allocation)/i;

/**
 * Cómo terminó el tsc: { estado, errores? }. El «ok / hay errores / sin veredicto» es `veredicto` de tsc-bitacoras (una sola copia de esa regla);
 * acá se separa de «sin veredicto» el porqué más común. ⚠️ Un «heap out of memory» GANA sobre cualquier «error TS»: si el tsc murió a mitad,
 * los errores que alcanzó a imprimir no son TODOS, y corregir sólo esos manda a la persona a una vuelta más. Puro.
 * @param {{ status: number | null, signal?: string | null, salida?: string }} a
 * @returns {{ estado: 'ok' | 'errores' | 'sin-memoria' | 'matado' | 'sin-chequear', errores?: number }}
 */
export function clasificar({ status, signal = null, salida = '' }) {
  if (status === 0) return { estado: 'ok' };
  if (SIN_HEAP.test(salida) || signal === 'SIGABRT' || status === 134) return { estado: 'sin-memoria' };
  if (signal === 'SIGKILL' || status === 137) return { estado: 'matado' };
  const v = veredicto(status, salida);
  if (v === 'errores') return { estado: 'errores', errores: (salida.match(/error TS\d+/g) ?? []).length };
  return { estado: 'sin-chequear' };
}

/**
 * Los números de `--extendedDiagnostics` que importan, o null en lo que no aparezca. El formato (medido con el tsc 5.9.3) es una línea por dato,
 * sin separador de miles: «Types:                      15727», «Memory used:               69011K» (miles de BYTES, no KiB), «Check time:  1.06s».
 * ⚠️ Una línea que falta es null, no 0: un 0 de memoria viva se leería como «sobra aire». Puro.
 * @param {string} salida
 * @returns {{ archivos: number | null, tipos: number | null, instanciaciones: number | null, simbolos: number | null, vivoMb: number | null, chequeoS: number | null, totalS: number | null }}
 */
export function leerEstadisticas(salida) {
  const num = (nombre) => {
    const m = new RegExp(`^${nombre}:\\s+([\\d.,]+)[KMGs]?\\s*$`, 'mi').exec(salida);
    if (!m) return null;
    const n = Number.parseFloat(m[1].replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  const memoriaK = num('Memory used');
  return {
    archivos: num('Files'),
    tipos: num('Types'),
    instanciaciones: num('Instantiations'),
    simbolos: num('Symbols'),
    vivoMb: memoriaK == null ? null : Math.round((memoriaK * 1000) / 1048576),
    chequeoS: num('Check time'),
    totalS: num('Total time'),
  };
}

/**
 * Qué se imprime, qué se anota y con qué exit sale. Puro (sin tocar el disco ni la consola): lo prueba un test.
 * @param {{ estado: string, errores?: number, segundos: number, topeMb: number, ramMb: number, cpu?: number, estadisticas?: ReturnType<typeof leerEstadisticas>, status?: number | null, signal?: string | null }} a
 * @returns {{ codigo: number, palabra: string, lineas: string[], anotaciones: string[], resumen: string[] }}
 */
export function veredictoDeTipos({ estado, errores = 0, segundos, topeMb, ramMb, cpu = 0, estadisticas, status = null, signal = null }) {
  const e = estadisticas ?? {};
  const fraccion = e.vivoMb != null ? e.vivoMb / topeMb : null;
  const medida = [
    'TIPOS-MEDIDA',
    `estado=${estado}`,
    `segundos=${Math.round(segundos)}`,
    `tope_mb=${topeMb}`,
    `ram_mb=${Math.round(ramMb)}`,
    `vivo_mb=${e.vivoMb ?? 'n/d'}`,
    `vivo_pct=${fraccion == null ? 'n/d' : Math.round(fraccion * 100)}`,
    `archivos=${e.archivos ?? 'n/d'}`,
    `tipos=${e.tipos ?? 'n/d'}`,
    `instanciaciones=${e.instanciaciones ?? 'n/d'}`,
    `chequeo_s=${e.chequeoS ?? 'n/d'}`,
  ].join(' ');
  const lineas = [medida];
  const anotaciones = [];
  const topes = `tope de heap ${miles(topeMb)} MB, RAM del runner ${miles(ramMb)} MB${cpu ? `, ${cpu} CPU` : ''}`;
  let codigo;
  let palabra;
  if (estado === 'ok') {
    codigo = 0;
    palabra = 'OK';
    lineas.push(`Tipos: OK · ${Math.round(segundos)} s · memoria viva ${e.vivoMb == null ? 'sin medir' : `${miles(e.vivoMb)} MB de ${miles(topeMb)} (${Math.round(fraccion * 100)} %)`}`);
    if (fraccion != null && fraccion >= UMBRAL_AVISO) {
      anotaciones.push(`::warning title=Tipos: al borde de la memoria::El tsc usó ${miles(e.vivoMb)} MB vivos de ${miles(topeMb)} (${Math.round(fraccion * 100)} %). Cuando pase del tope el paso muere por memoria (SIN MEMORIA, no errores de tipos). Hay que medir qué infla el programa o partirlo: docs/hallazgos-infra.md.`);
    }
  } else if (estado === 'errores') {
    codigo = 1;
    palabra = 'ERRORES DE TIPOS';
    lineas.push(`Tipos: ERRORES DE TIPOS · ${errores} error(es) · ${Math.round(segundos)} s — son del código: están arriba, con archivo y línea.`);
    anotaciones.push(`::error title=Tipos: errores de tipos::${errores} error(es) de tipos (mirá el log del paso: archivo y línea).`);
  } else if (estado === 'sin-memoria') {
    codigo = SALIDA_SIN_TIPOS;
    palabra = 'SIN MEMORIA';
    lineas.push(
      `Tipos: SIN MEMORIA — NO son errores de tipos. El tsc se quedó sin heap a los ${Math.round(segundos)} s (${topes}) y no llegó a un veredicto.`,
      '  Qué hacer: no corregir código. Re-correr sólo sirve si el programa estaba justo en el borde. Si se repite: bajar lo que el tsc carga (partir el programa',
      '  en dos, o ver qué infla los tipos), subir el tope si el runner tiene RAM de sobra (TIPOS_HEAP_MB), o usar un runner con más RAM. docs/hallazgos-infra.md.',
    );
    anotaciones.push(`::error title=Tipos: SIN MEMORIA (no son errores de tipos)::El tsc se quedó sin heap a los ${Math.round(segundos)} s con el tope de ${miles(topeMb)} MB (RAM del runner: ${miles(ramMb)} MB). No hay nada que corregir en el código: es el tamaño del programa.`);
  } else if (estado === 'matado') {
    codigo = SALIDA_SIN_TIPOS;
    palabra = 'MATADO POR EL SISTEMA';
    lineas.push(
      `Tipos: MATADO POR EL SISTEMA — NO son errores de tipos. El tsc murió por ${signal ?? `código ${status}`} a los ${Math.round(segundos)} s (${topes}).`,
      '  Eso es el OOM-killer del runner: el tope de heap es mayor que la RAM física que quedaba. Bajar TIPOS_HEAP_MB no lo arregla (el tsc moriría igual por heap);',
      '  hay que bajar lo que carga el programa o usar un runner con más RAM.',
    );
    anotaciones.push(`::error title=Tipos: MATADO POR EL SISTEMA (no son errores de tipos)::El tsc murió por ${signal ?? `código ${status}`} con el tope de ${miles(topeMb)} MB sobre ${miles(ramMb)} MB de RAM: el sistema se quedó sin memoria física.`);
  } else {
    codigo = SALIDA_SIN_TIPOS;
    palabra = 'SIN VEREDICTO';
    lineas.push(`Tipos: SIN VEREDICTO — el tsc salió con ${signal ?? `código ${status}`} a los ${Math.round(segundos)} s y sin ninguna línea «error TS»: no hay un error de tipos que corregir. Mirá la cola del log.`);
    anotaciones.push(`::error title=Tipos: sin veredicto::El tsc salió con ${signal ?? `código ${status}`} y sin errores de tipos: no hay veredicto. Mirá el log.`);
  }
  const resumen = [
    `**Tipos: ${palabra}** · ${Math.round(segundos)} s`,
    '',
    '| | |',
    '|---|---|',
    `| Memoria viva (tras GC) | ${e.vivoMb == null ? 'sin medir' : `${miles(e.vivoMb)} MB de ${miles(topeMb)} (${Math.round(fraccion * 100)} %)`} |`,
    `| Archivos / tipos / instanciaciones | ${[e.archivos, e.tipos, e.instanciaciones].map((x) => (x == null ? 'n/d' : miles(x))).join(' / ')} |`,
    `| Runner | ${miles(ramMb)} MB de RAM${cpu ? `, ${cpu} CPU` : ''} |`,
    '',
  ];
  return { codigo, palabra, lineas, anotaciones, resumen };
}

/**
 * Los argumentos de node + tsc. El `--expose-gc` es lo que hace que «Memory used» sea la memoria VIVA y no la que quedó sin recoger.
 * @param {{ topeMb: number, tsc: string, extra?: string[] }} a
 * @returns {string[]}
 */
export function argumentosDeTsc({ topeMb, tsc, extra = [] }) {
  return [`--max-old-space-size=${topeMb}`, '--expose-gc', tsc, '--noEmit', '--extendedDiagnostics', ...extra];
}

/**
 * Corre el tsc, reenvía su salida EN VIVO (un paso colgado no tiene que quedar mudo) y devuelve cómo terminó. `lanzar` se inyecta en las
 * pruebas. La salida se acumula hasta 64 MB: un tsc con más que eso en errores ya no es una salida que alguien lea.
 * @param {{ topeMb: number, tsc: string, extra?: string[], cwd?: string, lanzar?: Function, salida?: { stdout: { write: Function }, stderr: { write: Function } } }} a
 * @returns {Promise<{ status: number | null, signal: string | null, salida: string, segundos: number, fallo: Error | null }>}
 */
export function correrTsc({ topeMb, tsc, extra = [], cwd = process.cwd(), lanzar = spawn, salida = process }) {
  return new Promise((resolver) => {
    const t0 = Date.now();
    const hijo = lanzar(process.execPath, argumentosDeTsc({ topeMb, tsc, extra }), { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let acumulada = '';
    const juntar = (flujo, destino) => flujo.on('data', (b) => {
      destino.write(b);
      if (acumulada.length < 64 * 1024 * 1024) acumulada += b.toString();
    });
    juntar(hijo.stdout, salida.stdout);
    juntar(hijo.stderr, salida.stderr);
    let fallo = null;
    hijo.on('error', (e) => { fallo = e; });
    hijo.on('close', (status, signal) => resolver({ status: fallo ? null : status, signal, salida: acumulada, segundos: (Date.now() - t0) / 1000, fallo }));
  });
}

async function main() {
  const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
  const ramMb = totalmem() / 1048576;
  const topeMb = topeDeHeapMb({ totalMb: ramMb, env: process.env });
  const cpu = cpus().length;
  process.stdout.write(`tipos-ci: ${cpu} CPU, ${miles(ramMb)} MB de RAM · tope de heap ${miles(topeMb)} MB${process.env.TIPOS_HEAP_MB ? ' (forzado por TIPOS_HEAP_MB)' : ' (RAM − 1,5 GB)'}\n`);
  const r = await correrTsc({ topeMb, tsc: join(raiz, 'node_modules', 'typescript', 'bin', 'tsc'), extra: process.argv.slice(2), cwd: raiz });
  const clase = r.fallo ? { estado: 'sin-chequear' } : clasificar({ status: r.status, signal: r.signal, salida: r.salida });
  const v = veredictoDeTipos({ ...clase, segundos: r.segundos, topeMb, ramMb, cpu, estadisticas: leerEstadisticas(r.salida), status: r.status, signal: r.signal });
  process.stdout.write(`\n${v.lineas.join('\n')}\n${v.anotaciones.join('\n')}${v.anotaciones.length ? '\n' : ''}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${v.resumen.join('\n')}\n`); } catch { /* el resumen es un lujo: el log ya lo dijo */ }
  }
  process.exit(v.codigo);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
