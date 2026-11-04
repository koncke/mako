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
//        sin-tiempo    → exit 97  «SIN TIEMPO»            (no terminó antes de TIPOS_TOPE_S: es la máquina; punta.yml relanza la corrida una vez)
//      El 98 es el mismo «SIN TIPOS» de tests-afectados/antes-de-subir (SALIDA_SIN_TIPOS): el mismo hecho se llama igual en la PC y en Actions.
//   2. MIDE: corre con `--extendedDiagnostics --expose-gc`. Con `--expose-gc`, el «Memory used» del tsc es la memoria VIVA después de un GC
//      completo y de chequear todo, que es lo que decide si entra en el tope (el RSS no: V8 deja crecer el heap hasta el tope aunque no haga falta).
//      La línea `TIPOS-MEDIDA …` queda en el log de CADA run, y si lo vivo pasa del 80 % del tope sale un `::warning::` ANTES de que el paso muera.
//   3. NO DEPENDE DE UN NÚMERO A MANO: el tope se deriva de la RAM del runner (RAM − 1,5 GB para el SO y el runner), con TIPOS_HEAP_MB para
//      forzarlo. Si algún día el repo pasa a un runner más grande, el tope sube solo; si el runner se achica, el paso lo dice en vez de morir mudo.
//
// ⚠️ «TIPOS» ES SIEMPRE EL TSC ENTERO (21/10/2026, criterio del Cerebro tras la revisión): el paso que frena el push no puede dar un OK falso. Las TANDAS (abajo) son sólo el RESPALDO si el tsc entero
// muere por memoria (exit 98): su OK sale como «OK PARCIAL» (línea TIPOS-MEDIDA con `parcial=1`, aviso ::warning:: y el resumen del run), nunca como un OK limpio, y los errores que encuentran siguen frenando.
// TIPOS_SOLO_TANDAS=1 salta el intento del entero (cuando se sabe que ya no entra): también PARCIAL.
// TANDAS (TIPOS_TANDAS=K, default 1 = sin respaldo): el chequeo completo repartido en K procesos, de a uno, cada uno con el programa entero atado pero chequeando sólo su pedazo
// (scripts/tipos-por-tandas.mjs). Es el arreglo de fondo del 21/10/2026: el tsc guarda en memoria todo lo que instancia, y el programa crece ~1 GB de memoria viva por semana. Con K tandas
// el pico por proceso baja hacia (piso + resto/K). Se decide K con los números de scripts/medir-tipos.mjs (docs/hallazgos-infra.md); acá sólo se enciende.
// TIPOS_RAICES=1 (con K > 1): cada tanda crea su programa sólo desde SUS archivos (más los ambientes y lo que ellos importan), en vez de desde todo el proyecto: baja el piso por proceso
// (medido en Actions el 21/10/2026: pico 2.595 MB con 4 tandas contra 3.537 MB sin raíces). Igual al tsc salvo ciclos de imports raros: el checker cachea algunos errores (TS2589, TS2303) y los atribuye al primer archivo que los dispara, y las tandas se reparten en el orden del programa para que ese archivo sea del mismo pedazo
// o de uno anterior (tests/tipos-por-tandas.test.ts, repros del 21/10/2026); un tsc entero de respaldo es lo único que lo garantiza.
//
// TIEMPO (4/11/2026, corrida 180: el paso murió por el tope de 18 min de Actions sin una línea): con TIPOS_TOPE_S el script corta el tsc antes que
// Actions y lo dice («SIN TIEMPO», 97, con la memoria y el swap de ese momento), y deja una línea TIPOS-RAM por minuto. Lo prueba
// tests/tipos-ci-tiempo.test.ts.
//
// Lo que NO hace: no arregla que el programa crezca (en 7 días pasó de >4,0 a >5,0 GB de heap). Eso se mide con los números de la línea
// TIPOS-MEDIDA y se decide con ellos: docs/hallazgos-infra.md.
//
// Uso: node scripts/tipos-ci.mjs [argumentos extra del tsc, p. ej. -p otro.tsconfig.json]
// =============================================================================

import { spawn } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { cpus, totalmem, tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { veredicto } from './tsc-bitacoras.mjs';

/** Mismo número que SALIDA_SIN_TIPOS de tests-afectados.mjs (lo fija tests/tipos-ci.test.ts): «no hay veredicto de tipos». */
export const SALIDA_SIN_TIPOS = 98;

/**
 * «El tsc no terminó a tiempo» (4/11/2026, punta/dash-cobranza, corrida 180: el paso murió por el tope de 18 min de Actions SIN una línea, y se
 * leyó como un rojo del chat). Es otro número que el 98 a propósito: punta.yml relanza UNA vez la corrida con este código, porque un tsc que tarda
 * 129-532 s y no termina en 14 min es la máquina (el runner sin RAM, swapeando), no el código. Con el 98 no se relanza: un programa que no entra
 * en el heap no entra la segunda vez.
 */
export const SALIDA_SIN_TIEMPO = 97;

/**
 * El tope de tiempo del tsc (TIPOS_TOPE_S, en segundos), o null sin tope. Va por DEBAJO del `timeout-minutes` del paso: así el que corta es este
 * script, que dice qué pasó y cómo estaba la memoria, y no Actions, que mata el paso sin una línea. Puro.
 * @param {Record<string, string | undefined>} env
 * @returns {number | null}
 */
export function topeDeTiempoS(env) {
  const s = Number.parseInt(env.TIPOS_TOPE_S ?? '', 10);
  return Number.isInteger(s) && s > 0 ? s : null;
}

/**
 * La memoria de la máquina en un momento, de /proc/meminfo: la disponible y el swap usado, en MB. null en lo que no aparezca (en Windows no hay
 * /proc). Puro.
 * @param {string} texto el contenido de /proc/meminfo
 * @returns {{ disponibleMb: number | null, swapMb: number | null }}
 */
export function leerMeminfo(texto) {
  const kb = (k) => { const m = new RegExp(`^${k}:\\s+(\\d+) kB`, 'm').exec(texto); return m ? Number(m[1]) : null; };
  const disponible = kb('MemAvailable');
  const swapTotal = kb('SwapTotal');
  const swapLibre = kb('SwapFree');
  return {
    disponibleMb: disponible == null ? null : Math.round(disponible / 1024),
    swapMb: swapTotal == null || swapLibre == null ? null : Math.round((swapTotal - swapLibre) / 1024),
  };
}

/**
 * Lo que usa el tsc de memoria física y de swap, de /proc/<pid>/status, en MB. Si el tsc tiene swap, está esperando al disco: es la señal de
 * que se va a pasar del tope de tiempo. Puro.
 * @param {string} texto el contenido de /proc/<pid>/status
 * @returns {{ rssMb: number | null, swapMb: number | null }}
 */
export function leerStatusDeProceso(texto) {
  const kb = (k) => { const m = new RegExp(`^${k}:\\s+(\\d+) kB`, 'm').exec(texto); return m ? Number(m[1]) : null; };
  const rss = kb('VmRSS');
  const swap = kb('VmSwap');
  return { rssMb: rss == null ? null : Math.round(rss / 1024), swapMb: swap == null ? null : Math.round(swap / 1024) };
}

/**
 * La línea `TIPOS-RAM` que el script imprime cada minuto mientras corre el tsc: si un paso se pasa del tiempo, el log dice si fue la memoria.
 * Puro.
 * @param {{ segundos: number, maquina: ReturnType<typeof leerMeminfo>, tsc: ReturnType<typeof leerStatusDeProceso> }} a
 */
export function lineaDeRam({ segundos, maquina, tsc }) {
  const n = (x) => (x == null ? 'n/d' : String(x));
  return `TIPOS-RAM s=${Math.round(segundos)} disponible_mb=${n(maquina.disponibleMb)} swap_mb=${n(maquina.swapMb)} tsc_rss_mb=${n(tsc.rssMb)} tsc_swap_mb=${n(tsc.swapMb)}`;
}

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
 * @param {{ status: number | null, signal?: string | null, salida?: string, porTiempo?: boolean }} a
 * @returns {{ estado: 'ok' | 'errores' | 'sin-memoria' | 'matado' | 'sin-chequear' | 'sin-tiempo', errores?: number }}
 */
export function clasificar({ status, signal = null, salida = '', porTiempo = false }) {
  // Lo cortó este script por el tope de tiempo: el SIGKILL es nuestro, no del OOM-killer, y lo que imprimió no es un veredicto.
  if (porTiempo) return { estado: 'sin-tiempo' };
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
 * @returns {{ archivos: number | null, tipos: number | null, instanciaciones: number | null, simbolos: number | null, vivoMb: number | null, baseMb: number | null, chequeados: number | null, chequeoS: number | null, totalS: number | null }}
 */
export function leerEstadisticas(salida) {
  const num = (nombre) => {
    const m = new RegExp(`^${nombre}:\\s+([\\d.,]+)[KMGs]?\\s*$`, 'mi').exec(salida);
    if (!m) return null;
    const n = Number.parseFloat(m[1].replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  const memoriaK = num('Memory used');
  const baseK = num('Base memory used');
  return {
    archivos: num('Files'),
    tipos: num('Types'),
    instanciaciones: num('Instantiations'),
    simbolos: num('Symbols'),
    vivoMb: memoriaK == null ? null : Math.round((memoriaK * 1000) / 1048576),
    baseMb: baseK == null ? null : Math.round((baseK * 1000) / 1048576),     // sólo en una tanda: el programa creado y atado, sin chequear un archivo (el piso)
    chequeados: num('Files checked'),
    chequeoS: num('Check time'),
    totalS: num('Total time'),
  };
}

/**
 * Qué se imprime, qué se anota y con qué exit sale. Puro (sin tocar el disco ni la consola): lo prueba un test.
 * @param {{ estado: string, errores?: number, segundos: number, topeMb: number, ramMb: number, cpu?: number, estadisticas?: Partial<ReturnType<typeof leerEstadisticas>>, status?: number | null, signal?: string | null, tandas?: number, tandaFallida?: number | null, raices?: boolean, parcial?: string | null, topeS?: number | null, alCortar?: { disponibleMb: number | null, swapMb: number | null, tscSwapMb: number | null } | null }} a
 * @returns {{ codigo: number, palabra: string, lineas: string[], anotaciones: string[], resumen: string[] }}
 */
export function veredictoDeTipos({ estado, errores = 0, segundos, topeMb, ramMb, cpu = 0, estadisticas, status = null, signal = null, tandas = 1, tandaFallida = null, raices = false, parcial = null, topeS = null, alCortar = null }) {
  const e = estadisticas ?? {};
  const enTanda = tandas > 1 && tandaFallida != null ? ` (tanda ${tandaFallida}/${tandas})` : '';
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
    // Sólo con tandas, y al FINAL: quien lee la línea de siempre no ve cambiar ni una posición.
    ...(tandas > 1 ? [`tandas=${tandas}`, `base_mb=${e.baseMb ?? 'n/d'}`, ...(raices ? ['raices=1'] : []), ...(parcial ? ['parcial=1'] : [])] : []),
  ].join(' ');
  const lineas = [medida];
  const anotaciones = [];
  const topes = `tope de heap ${miles(topeMb)} MB, RAM del runner ${miles(ramMb)} MB${cpu ? `, ${cpu} CPU` : ''}`;
  // Con tandas, una puede terminar con errores REALES y otra morir: el que no haya veredicto completo no borra los errores de las que sí terminaron (el 21/10 decía «no hay nada que corregir»).
  const reales = `  ⚠️ ADEMÁS hay ${errores} error(es) de tipos REALES en las tandas que terminaron (están arriba, con archivo y línea): esos SÍ se corrigen.`;
  const realesCorto = `hay ${errores} error(es) de tipos REALES en las tandas que terminaron (mirá el log del paso: archivo y línea): esos sí se corrigen.`;
  let codigo;
  let palabra;
  if (estado === 'ok') {
    codigo = 0;
    palabra = parcial ? 'OK PARCIAL' : 'OK';
    // ⚠️ Con tandas NUNCA es un OK limpio: repartir el chequeo puede perder un error que el tsc entero da (los que el checker cachea, TS2589/TS2303; en este repo lib/ es un ciclo de 580 archivos partido entre las tandas). Se dice, con el porqué.
    if (parcial) {
      lineas.push(`Tipos: OK PARCIAL — NO es el tsc entero (${parcial}). Se chequeó por tandas y NINGUNA dio errores, pero un error cacheado puede haberse perdido: no es la garantía de siempre.`);
      anotaciones.push(`::warning title=Tipos: verificación PARCIAL (no es el tsc entero)::${parcial}. Las ${tandas} tandas dieron OK, pero repartir el chequeo puede perder errores que el tsc entero da (los que el checker cachea); lo cubre el tsc entero semanal (tipos-respaldo.yml). Subir el tope o achicar el programa vuelve al tsc entero.`);
    }
    if (!parcial) lineas.push(`Tipos: OK · ${Math.round(segundos)} s · memoria viva ${e.vivoMb == null ? 'sin medir' : `${miles(e.vivoMb)} MB de ${miles(topeMb)} (${Math.round(fraccion * 100)} %)`}`);
    if (parcial) lineas.push(`  ${Math.round(segundos)} s · memoria viva ${e.vivoMb == null ? 'sin medir' : `${miles(e.vivoMb)} MB de ${miles(topeMb)} (${Math.round(fraccion * 100)} %)`} en la tanda más pesada`);
    if (fraccion != null && fraccion >= UMBRAL_AVISO) {
      anotaciones.push(`::warning title=Tipos: al borde de la memoria::${tandas > 1 ? `La tanda más pesada (de ${tandas})` : 'El tsc'} usó ${miles(e.vivoMb)} MB vivos de ${miles(topeMb)} (${Math.round(fraccion * 100)} %). Cuando pase del tope el paso muere por memoria (SIN MEMORIA, no errores de tipos). Hay que medir qué infla el programa o partirlo: docs/hallazgos-infra.md.`);
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
      errores > 0
        ? `Tipos: SIN MEMORIA — el quedarse sin heap NO es un error de tipos, pero hay errores reales. El tsc se quedó sin heap${enTanda} a los ${Math.round(segundos)} s (${topes}) y no llegó a un veredicto completo.`
        : `Tipos: SIN MEMORIA — NO son errores de tipos. El tsc se quedó sin heap${enTanda} a los ${Math.round(segundos)} s (${topes}) y no llegó a un veredicto.`,
      ...(errores > 0 ? [reales] : []),
      `  Qué hacer: ${errores > 0 ? 'corregir esos errores y, aparte,' : 'no corregir código;'} re-correr sólo sirve si el programa estaba justo en el borde. Si se repite: bajar lo que el tsc carga (partir el programa`,
      '  en dos, o ver qué infla los tipos), subir el tope si el runner tiene RAM de sobra (TIPOS_HEAP_MB), o usar un runner con más RAM. docs/hallazgos-infra.md.',
    );
    anotaciones.push(errores > 0
      ? `::error title=Tipos: SIN MEMORIA y ERRORES DE TIPOS::El tsc se quedó sin heap${enTanda} a los ${Math.round(segundos)} s con el tope de ${miles(topeMb)} MB (RAM del runner: ${miles(ramMb)} MB): eso es el tamaño del programa. Pero ${realesCorto}`
      : `::error title=Tipos: SIN MEMORIA (no son errores de tipos)::El tsc se quedó sin heap${enTanda} a los ${Math.round(segundos)} s con el tope de ${miles(topeMb)} MB (RAM del runner: ${miles(ramMb)} MB). No hay nada que corregir en el código: es el tamaño del programa.`);
  } else if (estado === 'matado') {
    codigo = SALIDA_SIN_TIPOS;
    palabra = 'MATADO POR EL SISTEMA';
    lineas.push(
      `Tipos: MATADO POR EL SISTEMA — NO son errores de tipos${errores > 0 ? ' (pero hay errores reales, abajo)' : ''}. El tsc murió${enTanda} por ${signal ?? `código ${status}`} a los ${Math.round(segundos)} s (${topes}).`,
      ...(errores > 0 ? [reales] : []),
      '  Eso es el OOM-killer del runner: el tope de heap es mayor que la RAM física que quedaba. Bajar TIPOS_HEAP_MB no lo arregla (el tsc moriría igual por heap);',
      '  hay que bajar lo que carga el programa o usar un runner con más RAM.',
    );
    anotaciones.push(`::error title=Tipos: MATADO POR EL SISTEMA${errores > 0 ? ' y ERRORES DE TIPOS' : ' (no son errores de tipos)'}::El tsc murió por ${signal ?? `código ${status}`} con el tope de ${miles(topeMb)} MB sobre ${miles(ramMb)} MB de RAM: el sistema se quedó sin memoria física.${errores > 0 ? ` Además ${realesCorto}` : ''}`);
  } else if (estado === 'sin-tiempo') {
    codigo = SALIDA_SIN_TIEMPO;
    palabra = 'SIN TIEMPO';
    const n = (x) => (x == null ? 'n/d' : `${miles(x)} MB`);
    const memoria = alCortar
      ? `Al cortarlo, la máquina tenía ${n(alCortar.disponibleMb)} disponibles y ${n(alCortar.swapMb)} de swap usado; el tsc, ${n(alCortar.tscSwapMb)} en swap.`
      : 'No hay una medición de la memoria al cortarlo.';
    const swapeando = alCortar?.tscSwapMb != null && alCortar.tscSwapMb > 0;
    lineas.push(
      `Tipos: SIN TIEMPO — NO son errores de tipos${errores > 0 ? ' (pero hay errores reales, abajo)' : ''}. El tsc no terminó${enTanda} en ${Math.round(segundos)} s (tope TIPOS_TOPE_S=${topeS ?? 'n/d'} s; ${topes}) y lo corté.`,
      ...(errores > 0 ? [reales] : []),
      `  ${memoria}`,
      swapeando
        ? '  El tsc estaba en swap: esperaba al disco. Es la MÁQUINA (el runner sin RAM libre), no el código. punta.yml relanza la corrida una vez.'
        : '  Lo normal es 2-9 min (129-532 s medidos el 4/11/2026). Es la máquina, no el código: punta.yml relanza la corrida una vez. Si se repite, mirá las líneas TIPOS-RAM de arriba.',
    );
    anotaciones.push(`::error title=Tipos: SIN TIEMPO (no son errores de tipos)::El tsc no terminó en ${Math.round(segundos)} s y lo corté. ${memoria} Es la máquina, no el código${errores > 0 ? `; además ${realesCorto}` : ''}.`);
  } else {
    codigo = SALIDA_SIN_TIPOS;
    palabra = 'SIN VEREDICTO';
    lineas.push(
      errores > 0
        ? `Tipos: SIN VEREDICTO — una tanda salió con ${signal ?? `código ${status}`} a los ${Math.round(segundos)} s sin ninguna línea «error TS» y no llegó a un veredicto. Mirá la cola del log.`
        : `Tipos: SIN VEREDICTO — el tsc salió con ${signal ?? `código ${status}`} a los ${Math.round(segundos)} s y sin ninguna línea «error TS»: no hay un error de tipos que corregir. Mirá la cola del log.`,
      ...(errores > 0 ? [reales] : []),
    );
    anotaciones.push(`::error title=Tipos: sin veredicto${errores > 0 ? ' y ERRORES DE TIPOS' : ''}::${errores > 0 ? `Una tanda salió con ${signal ?? `código ${status}`} y sin errores de tipos: no hay veredicto de esa tanda. Además ${realesCorto}` : `El tsc salió con ${signal ?? `código ${status}`} y sin errores de tipos: no hay veredicto. Mirá el log.`}`);
  }
  const resumen = [
    `**Tipos: ${palabra}** · ${Math.round(segundos)} s`,
    '',
    '| | |',
    '|---|---|',
    `| Memoria viva (tras GC) | ${e.vivoMb == null ? 'sin medir' : `${miles(e.vivoMb)} MB de ${miles(topeMb)} (${Math.round(fraccion * 100)} %)`} |`,
    `| Archivos / tipos / instanciaciones | ${[e.archivos, e.tipos, e.instanciaciones].map((x) => (x == null ? 'n/d' : miles(x))).join(' / ')} |`,
    ...(tandas > 1 ? [`| Tandas | ${tandas}: pico por tanda ${e.vivoMb == null ? 'n/d' : `${miles(e.vivoMb)} MB`}, piso (${raices ? 'programa de sus raíces' : 'programa atado'}) ${e.baseMb == null ? 'n/d' : `${miles(e.baseMb)} MB`} |`] : []),
    `| Runner | ${miles(ramMb)} MB de RAM${cpu ? `, ${cpu} CPU` : ''} |`,
    '',
  ];
  return { codigo, palabra, lineas, anotaciones, resumen };
}

/**
 * Cuántas tandas se piden (TIPOS_TANDAS): un entero de 1 a 8; cualquier otra cosa es 1 (el tsc de siempre). Puro.
 * @param {Record<string, string | undefined>} env
 */
export function tandasPedidas(env) {
  const k = Number.parseInt(env.TIPOS_TANDAS ?? '', 10);
  return Number.isInteger(k) && k >= 1 && k <= 8 ? k : 1;
}

/**
 * TIPOS_SOLO_TANDAS=1 (con K > 1): ni se intenta el tsc entero, se verifica directo por tandas, SIEMPRE como verificación PARCIAL. Es el consentimiento explícito de quien sabe que el entero ya no entra
 * (ahorra el run que muere por memoria, ~3 min) y de quien prueba el respaldo. Puro.
 * @param {Record<string, string | undefined>} env
 */
export function soloTandasPedido(env) {
  return env.TIPOS_SOLO_TANDAS === '1';
}

/**
 * Si se pide que cada tanda cree su programa SÓLO desde sus raíces (TIPOS_RAICES=1; `--raices` del driver): el piso de cada proceso baja de «todo el programa» a «lo que su pedazo importa».
 * Sólo vale con más de una tanda (con una es el tsc de siempre). Puro.
 * @param {Record<string, string | undefined>} env
 */
export function raicesPedidas(env) {
  return env.TIPOS_RAICES === '1';
}

/**
 * Los argumentos de node + el driver de tandas (scripts/tipos-por-tandas.mjs). El `--expose-gc` es lo que hace que «Memory used» sea la memoria VIVA.
 * Con `raices`, `orden` es el archivo donde la primera tanda deja el orden del programa entero y las demás lo leen (el reparto va en ESE orden: ver tipos-por-tandas.mjs).
 * @param {{ topeMb: number, script: string, i: number, K: number, extra?: string[], raices?: boolean, orden?: string | null }} a
 * @returns {string[]}
 */
export function argumentosDeTanda({ topeMb, script, i, K, extra = [], raices = false, orden = null }) {
  return [`--max-old-space-size=${topeMb}`, '--expose-gc', script, ...(raices ? ['--raices', ...(orden ? ['--orden', orden] : [])] : []), ...extra, '--tanda', `${i}/${K}`];
}

/**
 * El resultado de varias tandas como si fuera UNO. El estado más grave manda (sin memoria > matado > sin veredicto > errores > ok): una tanda que no llegó a un veredicto no se compensa con las demás.
 * Las líneas de error se juntan SIN repetir (un error de configuración o de sintaxis lo informan todas las tandas). El pico de memoria es el de la tanda más pesada, y el piso el del programa atado.
 * Puro.
 * @param {{ clase: { estado: string }, segundos: number, estadisticas: ReturnType<typeof leerEstadisticas>, lineasDeError?: string[] }[]} tandas
 */
export function juntarTandas(tandas) {
  const orden = ['sin-memoria', 'matado', 'sin-tiempo', 'sin-chequear', 'errores', 'ok'];
  const estado = orden.find((e) => tandas.some((t) => t.clase.estado === e)) ?? 'ok';
  const tandaFallida = estado === 'ok' || estado === 'errores' ? null : tandas.findIndex((t) => t.clase.estado === estado) + 1;
  const maximo = (k) => tandas.reduce((a, t) => { const v = t.estadisticas?.[k]; return v == null ? a : a == null || v > a ? v : a; }, /** @type {number | null} */ (null));
  const lineas = new Set(tandas.flatMap((t) => t.lineasDeError ?? []));
  return {
    estado,
    tandaFallida,
    errores: lineas.size,
    segundos: tandas.reduce((a, t) => a + t.segundos, 0),
    // tipos/instanciaciones son de CADA proceso (se solapan): sumarlos mentiría; van por tanda en las líneas TIPOS-TANDA.
    estadisticas: { archivos: tandas[0]?.estadisticas?.archivos ?? null, tipos: null, instanciaciones: null, simbolos: null, vivoMb: maximo('vivoMb'), baseMb: maximo('baseMb'), chequeados: null, chequeoS: tandas.reduce((a, t) => a + (t.estadisticas?.chequeoS ?? 0), 0) || null, totalS: null },
  };
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
 * `args`: los argumentos de node completos (para correr una tanda en vez del tsc).
 * `topeS`: si el tsc no terminó en esos segundos, se lo mata (SIGKILL) y vuelve `porTiempo: true`, con la memoria de ese momento en `alCortar`.
 * `cadaS`: cada cuántos segundos imprime una línea TIPOS-RAM (null: nunca). `leer` lee /proc (se inyecta en las pruebas); si falla, la línea dice n/d.
 * @param {{ topeMb: number, tsc: string, extra?: string[], cwd?: string, lanzar?: Function, salida?: { stdout: { write: Function }, stderr: { write: Function } }, args?: string[], topeS?: number | null, cadaS?: number | null, leer?: (ruta: string) => string }} a
 * @returns {Promise<{ status: number | null, signal: string | null, salida: string, segundos: number, fallo: Error | null, porTiempo: boolean, alCortar: { disponibleMb: number | null, swapMb: number | null, tscSwapMb: number | null } | null }>}
 */
export function correrTsc({ topeMb, tsc, extra = [], cwd = process.cwd(), lanzar = spawn, salida = process, args, topeS = null, cadaS = null, leer = (r) => readFileSync(r, 'utf8') }) {
  return new Promise((resolver) => {
    const t0 = Date.now();
    const hijo = lanzar(process.execPath, args ?? argumentosDeTsc({ topeMb, tsc, extra }), { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let acumulada = '';
    const juntar = (flujo, destino) => flujo.on('data', (b) => {
      destino.write(b);
      if (acumulada.length < 64 * 1024 * 1024) acumulada += b.toString();
    });
    juntar(hijo.stdout, salida.stdout);
    juntar(hijo.stderr, salida.stderr);
    const medir = () => {
      let maquina = { disponibleMb: null, swapMb: null };
      let delTsc = { rssMb: null, swapMb: null };
      try { maquina = leerMeminfo(leer('/proc/meminfo')); } catch { /* sin /proc: n/d */ }
      try { if (hijo.pid) delTsc = leerStatusDeProceso(leer(`/proc/${hijo.pid}/status`)); } catch { /* ya terminó, o sin /proc */ }
      return { maquina, delTsc };
    };
    const muestreo = cadaS ? setInterval(() => {
      const { maquina, delTsc } = medir();
      salida.stdout.write(`${lineaDeRam({ segundos: (Date.now() - t0) / 1000, maquina, tsc: delTsc })}\n`);
    }, cadaS * 1000) : null;
    let porTiempo = false;
    /** @type {{ disponibleMb: number | null, swapMb: number | null, tscSwapMb: number | null } | null} */
    let alCortar = null;
    const corte = topeS ? setTimeout(() => {
      const { maquina, delTsc } = medir();
      alCortar = { disponibleMb: maquina.disponibleMb, swapMb: maquina.swapMb, tscSwapMb: delTsc.swapMb };
      porTiempo = true;
      salida.stdout.write(`${lineaDeRam({ segundos: (Date.now() - t0) / 1000, maquina, tsc: delTsc })} corte=tope_${topeS}s\n`);
      try { hijo.kill('SIGKILL'); } catch { /* ya terminó */ }
    }, topeS * 1000) : null;
    let fallo = null;
    hijo.on('error', (e) => { fallo = e; });
    hijo.on('close', (status, signal) => {
      if (muestreo) clearInterval(muestreo);
      if (corte) clearTimeout(corte);
      resolver({ status: fallo ? null : status, signal, salida: acumulada, segundos: (Date.now() - t0) / 1000, fallo, porTiempo, alCortar });
    });
  });
}

async function main() {
  const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
  const ramMb = totalmem() / 1048576;
  const topeMb = topeDeHeapMb({ totalMb: ramMb, env: process.env });
  const cpu = cpus().length;
  process.stdout.write(`tipos-ci: ${cpu} CPU, ${miles(ramMb)} MB de RAM · tope de heap ${miles(topeMb)} MB${process.env.TIPOS_HEAP_MB ? ' (forzado por TIPOS_HEAP_MB)' : ' (RAM − 1,5 GB)'}\n`);
  // El tope de tiempo vale para TODO el script (el tsc entero y, si muere por memoria, sus tandas): es lo que queda del paso.
  const topeS = topeDeTiempoS(process.env);
  const limite = topeS == null ? null : Date.now() + topeS * 1000;
  const restante = () => (limite == null ? null : Math.max(1, Math.round((limite - Date.now()) / 1000)));
  // Una línea TIPOS-RAM por minuto (sólo donde hay /proc): si el paso se pasa del tiempo, el log dice si fue la memoria.
  const cadaS = process.platform === 'linux' ? 60 : null;
  if (topeS != null) process.stdout.write(`tipos-ci: tope de tiempo ${topeS} s (TIPOS_TOPE_S): si el tsc no termina, lo corto y sale ${SALIDA_SIN_TIEMPO} (SIN TIEMPO), no un rojo de tipos\n`);
  // ⚠️ TIPOS_TANDAS=K ya NO reparte el chequeo por defecto (21/10/2026, revisión del Cerebro): el paso que FRENA el push no puede dar un OK falso, y las tandas pueden perder un error cacheado
  // (TS2589/TS2303) que el tsc entero da: en este repo lib/ es UN ciclo de imports de 580 archivos que queda partido entre las tandas 1 y 2 (medido por el revisor con TIPOS_TANDAS=4: «Tipos: OK» con
  // exit 0 donde el tsc da 2). Ahora «Tipos» es SIEMPRE el tsc entero; las K tandas son el RESPALDO si el entero muere por memoria (98), y su OK sale marcado «OK PARCIAL» con un aviso, nunca limpio.
  const K = tandasPedidas(process.env);
  const soloTandas = K > 1 && soloTandasPedido(process.env);
  const tsc = join(raiz, 'node_modules', 'typescript', 'bin', 'tsc');
  let v;
  /** @type {{ clase: { estado: string }, segundos: number } | null} */
  let entero = null;
  if (!soloTandas) {
    // TIPOS_HEAP_ENTERO_MB: el tope de heap SÓLO del intento entero (para probar el respaldo: que el entero muera y las tandas, con el tope de siempre, entren). Sin él, el de siempre.
    const topeEntero = Number.parseInt(process.env.TIPOS_HEAP_ENTERO_MB ?? '', 10) > 0 ? Number.parseInt(process.env.TIPOS_HEAP_ENTERO_MB ?? '', 10) : topeMb;
    const r = await correrTsc({ topeMb: topeEntero, tsc, extra: process.argv.slice(2), cwd: raiz, topeS: restante(), cadaS });
    const clase = r.fallo ? { estado: 'sin-chequear' } : clasificar({ status: r.status, signal: r.signal, salida: r.salida, porTiempo: r.porTiempo });
    entero = { clase, segundos: r.segundos };
    v = veredictoDeTipos({ ...clase, segundos: r.segundos, topeMb, ramMb, cpu, estadisticas: leerEstadisticas(r.salida), status: r.status, signal: r.signal, topeS, alCortar: r.alCortar });
  }
  const murioPorMemoria = entero != null && (entero.clase.estado === 'sin-memoria' || entero.clase.estado === 'matado');
  if (K > 1 && (soloTandas || murioPorMemoria)) {
    const parcial = soloTandas
      ? 'pedido con TIPOS_SOLO_TANDAS=1: no se intentó el tsc entero'
      : `el tsc entero murió por memoria (${entero?.clase.estado === 'matado' ? 'lo mató el sistema' : 'sin heap'} a los ${Math.round(entero?.segundos ?? 0)} s)`;
    process.stdout.write(`tipos-ci: ${parcial}: verifico por ${K} tandas (TIPOS_TANDAS), una verificación PARCIAL\n`);
    const raices = raicesPedidas(process.env);
    process.stdout.write(`tipos-ci: ${K} tandas${raices ? ', cada una con el programa de SUS raíces (TIPOS_RAICES)' : ''}, de a una\n`);
    const script = join(raiz, 'scripts', 'tipos-por-tandas.mjs');
    const hechas = [];
    let ultima = { status: /** @type {number | null} */ (null), signal: /** @type {string | null} */ (null), alCortar: /** @type {{ disponibleMb: number | null, swapMb: number | null, tscSwapMb: number | null } | null} */ (null) };
    // El orden del programa entero, calculado por la primera tanda y leído por las demás: una carpeta de la corrida, que se borra al terminar.
    const carpetaOrden = raices ? mkdtempSync(join(tmpdir(), 'tipos-orden-')) : null;
    const orden = carpetaOrden ? join(carpetaOrden, 'orden.json') : null;
    for (let i = 1; i <= K; i++) {
      process.stdout.write(`\n── tanda ${i}/${K} ──\n`);
      const r = await correrTsc({ topeMb, tsc, args: argumentosDeTanda({ topeMb, script, i, K, extra: process.argv.slice(2), raices, orden }), cwd: raiz, topeS: restante(), cadaS });
      const clase = r.fallo ? { estado: 'sin-chequear' } : clasificar({ status: r.status, signal: r.signal, salida: r.salida, porTiempo: r.porTiempo });
      const estadisticas = leerEstadisticas(r.salida);
      hechas.push({ clase, segundos: r.segundos, estadisticas, lineasDeError: r.salida.split('\n').map((l) => l.trim()).filter((l) => /error TS\d+/.test(l)) });
      ultima = { status: r.status, signal: r.signal, alCortar: r.alCortar };
      process.stdout.write(`TIPOS-TANDA ${i}/${K} estado=${clase.estado} segundos=${Math.round(r.segundos)} vivo_mb=${estadisticas.vivoMb ?? 'n/d'} base_mb=${estadisticas.baseMb ?? 'n/d'} chequeados=${estadisticas.chequeados ?? 'n/d'} tipos=${estadisticas.tipos ?? 'n/d'} instanciaciones=${estadisticas.instanciaciones ?? 'n/d'}\n`);
      // Una tanda que no llegó a un veredicto (sin memoria, matada, muda) no se compensa con las otras: se corta ahí, que son minutos de runner.
      if (['sin-memoria', 'matado', 'sin-tiempo', 'sin-chequear'].includes(clase.estado)) break;
    }
    if (carpetaOrden) rmSync(carpetaOrden, { recursive: true, force: true });
    const j = juntarTandas(hechas);
    v = veredictoDeTipos({ estado: j.estado, errores: j.errores, segundos: j.segundos + (entero?.segundos ?? 0), topeMb, ramMb, cpu, estadisticas: j.estadisticas, status: ultima.status, signal: ultima.signal, tandas: K, tandaFallida: j.tandaFallida, raices, parcial, topeS, alCortar: ultima.alCortar });
  }
  process.stdout.write(`\n${v.lineas.join('\n')}\n${v.anotaciones.join('\n')}${v.anotaciones.length ? '\n' : ''}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${v.resumen.join('\n')}\n`); } catch { /* el resumen es un lujo: el log ya lo dijo */ }
  }
  process.exit(v.codigo);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
