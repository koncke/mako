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
// TANDAS (TIPOS_TANDAS=K, default 1 = el tsc de siempre): el chequeo completo repartido en K procesos, de a uno, cada uno con el programa entero atado pero chequeando sólo su pedazo
// (scripts/tipos-por-tandas.mjs). Es el arreglo de fondo del 21/10/2026: el tsc guarda en memoria todo lo que instancia, y el programa crece ~1 GB de memoria viva por semana. Con K tandas
// el pico por proceso baja hacia (piso + resto/K). Se decide K con los números de scripts/medir-tipos.mjs (docs/hallazgos-infra.md); acá sólo se enciende.
// TIPOS_RAICES=1 (con K > 1): cada tanda crea su programa sólo desde SUS archivos (más los ambientes y lo que ellos importan), en vez de desde todo el proyecto: baja el piso por proceso
// (medido en Actions el 21/10/2026: pico 2.595 MB con 4 tandas contra 3.537 MB sin raíces). Igual al tsc salvo ciclos de imports raros: el checker cachea algunos errores (TS2589, TS2303) y los atribuye al primer archivo que los dispara, y las tandas se reparten en el orden del programa para que ese archivo sea del mismo pedazo
// o de uno anterior (tests/tipos-por-tandas.test.ts, repros del 21/10/2026); un tsc entero de respaldo es lo único que lo garantiza.
//
// Lo que NO hace: no arregla que el programa crezca (en 7 días pasó de >4,0 a >5,0 GB de heap). Eso se mide con los números de la línea
// TIPOS-MEDIDA y se decide con ellos: docs/hallazgos-infra.md.
//
// Uso: node scripts/tipos-ci.mjs [argumentos extra del tsc, p. ej. -p otro.tsconfig.json]
// =============================================================================

import { spawn } from 'node:child_process';
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs';
import { cpus, totalmem, tmpdir } from 'node:os';
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
 * @param {{ estado: string, errores?: number, segundos: number, topeMb: number, ramMb: number, cpu?: number, estadisticas?: Partial<ReturnType<typeof leerEstadisticas>>, status?: number | null, signal?: string | null, tandas?: number, tandaFallida?: number | null, raices?: boolean }} a
 * @returns {{ codigo: number, palabra: string, lineas: string[], anotaciones: string[], resumen: string[] }}
 */
export function veredictoDeTipos({ estado, errores = 0, segundos, topeMb, ramMb, cpu = 0, estadisticas, status = null, signal = null, tandas = 1, tandaFallida = null, raices = false }) {
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
    ...(tandas > 1 ? [`tandas=${tandas}`, `base_mb=${e.baseMb ?? 'n/d'}`, ...(raices ? ['raices=1'] : [])] : []),
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
    palabra = 'OK';
    lineas.push(`Tipos: OK · ${Math.round(segundos)} s · memoria viva ${e.vivoMb == null ? 'sin medir' : `${miles(e.vivoMb)} MB de ${miles(topeMb)} (${Math.round(fraccion * 100)} %)`}`);
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
  const orden = ['sin-memoria', 'matado', 'sin-chequear', 'errores', 'ok'];
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
 * @param {{ topeMb: number, tsc: string, extra?: string[], cwd?: string, lanzar?: Function, salida?: { stdout: { write: Function }, stderr: { write: Function } }, args?: string[] }} a
 * @returns {Promise<{ status: number | null, signal: string | null, salida: string, segundos: number, fallo: Error | null }>}
 */
export function correrTsc({ topeMb, tsc, extra = [], cwd = process.cwd(), lanzar = spawn, salida = process, args }) {
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
  const K = tandasPedidas(process.env);
  const tsc = join(raiz, 'node_modules', 'typescript', 'bin', 'tsc');
  let v;
  if (K === 1) {
    const r = await correrTsc({ topeMb, tsc, extra: process.argv.slice(2), cwd: raiz });
    const clase = r.fallo ? { estado: 'sin-chequear' } : clasificar({ status: r.status, signal: r.signal, salida: r.salida });
    v = veredictoDeTipos({ ...clase, segundos: r.segundos, topeMb, ramMb, cpu, estadisticas: leerEstadisticas(r.salida), status: r.status, signal: r.signal });
  } else {
    const raices = raicesPedidas(process.env);
    process.stdout.write(`tipos-ci: ${K} tandas (TIPOS_TANDAS)${raices ? ', cada una con el programa de SUS raíces (TIPOS_RAICES)' : ''}, de a una\n`);
    const script = join(raiz, 'scripts', 'tipos-por-tandas.mjs');
    const hechas = [];
    let ultima = { status: /** @type {number | null} */ (null), signal: /** @type {string | null} */ (null) };
    // El orden del programa entero, calculado por la primera tanda y leído por las demás: una carpeta de la corrida, que se borra al terminar.
    const carpetaOrden = raices ? mkdtempSync(join(tmpdir(), 'tipos-orden-')) : null;
    const orden = carpetaOrden ? join(carpetaOrden, 'orden.json') : null;
    for (let i = 1; i <= K; i++) {
      process.stdout.write(`\n── tanda ${i}/${K} ──\n`);
      const r = await correrTsc({ topeMb, tsc, args: argumentosDeTanda({ topeMb, script, i, K, extra: process.argv.slice(2), raices, orden }), cwd: raiz });
      const clase = r.fallo ? { estado: 'sin-chequear' } : clasificar({ status: r.status, signal: r.signal, salida: r.salida });
      const estadisticas = leerEstadisticas(r.salida);
      hechas.push({ clase, segundos: r.segundos, estadisticas, lineasDeError: r.salida.split('\n').map((l) => l.trim()).filter((l) => /error TS\d+/.test(l)) });
      ultima = { status: r.status, signal: r.signal };
      process.stdout.write(`TIPOS-TANDA ${i}/${K} estado=${clase.estado} segundos=${Math.round(r.segundos)} vivo_mb=${estadisticas.vivoMb ?? 'n/d'} base_mb=${estadisticas.baseMb ?? 'n/d'} chequeados=${estadisticas.chequeados ?? 'n/d'} tipos=${estadisticas.tipos ?? 'n/d'} instanciaciones=${estadisticas.instanciaciones ?? 'n/d'}\n`);
      // Una tanda que no llegó a un veredicto (sin memoria, matada, muda) no se compensa con las otras: se corta ahí, que son minutos de runner.
      if (['sin-memoria', 'matado', 'sin-chequear'].includes(clase.estado)) break;
    }
    if (carpetaOrden) rmSync(carpetaOrden, { recursive: true, force: true });
    const j = juntarTandas(hechas);
    v = veredictoDeTipos({ estado: j.estado, errores: j.errores, segundos: j.segundos, topeMb, ramMb, cpu, estadisticas: j.estadisticas, status: ultima.status, signal: ultima.signal, tandas: K, tandaFallida: j.tandaFallida, raices });
  }
  process.stdout.write(`\n${v.lineas.join('\n')}\n${v.anotaciones.join('\n')}${v.anotaciones.length ? '\n' : ''}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${v.resumen.join('\n')}\n`); } catch { /* el resumen es un lujo: el log ya lo dijo */ }
  }
  process.exit(v.codigo);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
