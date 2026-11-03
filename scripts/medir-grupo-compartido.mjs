#!/usr/bin/env node
// =============================================================================
// medir-grupo-compartido.mjs — cuánto TARDA y cuánta RAM PIDE un proceso compartido de N barredoras
// =============================================================================
// POR QUE EXISTE: los dos números con los que `scripts/tests-afectados.mjs` decide el grupo compartido se midieron el 17/10/2026
// con 12 y con 148 archivos, y hoy son más de 1.000:
//   · `TOPE_COMPARTIDO_MS = 25 min`, un número FIJO: a los 25 min `matarArbol` mata el proceso y `colgada` lo vuelve código 1 (rojo).
//   · `COSTO_COMPARTIDO_GB = 0.8`, medido con 24 barredoras (~725 MB de pico) y aplicado igual a un grupo de 514.
// El 30/10/2026 los dos grupos del tren salieron `0 tests · ROJO · 25 min 0 s` y `25 min 2 s` en el runner de Actions, que tiene
// memoria dedicada: eso no es una caída por RAM, es el TOPE. Y cuánto tarda de verdad un grupo de 514 no se sabía porque nunca
// terminó. Este script es la medición que faltaba, y queda para volver a correrla cuando la suite crezca otra vez.
//
// QUE HACE: arma la lista de los tests COMPARTIBLES igual que tests-afectados (`compartible()` sobre el fuente), toma los primeros
// N, los reparte en `--grupos` procesos que corren EN PARALELO (como el código de verdad: `Promise.all`), con el tope levantado, y
// mide de cada proceso: el reloj, los tests que reportó, su PICO de memoria (`tasklist`, cada 2 s) y la curva de avance (cuántos
// casos había juzgado a cada minuto). Al final imprime la fila lista para pegar en el hallazgo.
//
// ⚠️ ES PESADO Y SE COMPORTA COMO TAL: toma el candado de lo pesado (scripts/candado-pesado.mjs) y espera RAM antes de arrancar,
// porque un grupo grande pide GBs y esta PC tiene 16. `--sin-cola` lo saltea (Actions, o cuando ya tenés el candado a mano).
//
// Uso:
//   node scripts/medir-grupo-compartido.mjs                         514 archivos en 1 proceso, tope de 60 min
//   node scripts/medir-grupo-compartido.mjs --n 24 --tope-min 10    el punto chico, para la curva
//   node scripts/medir-grupo-compartido.mjs --n 1028 --grupos 2     los dos grupos del tren, en paralelo
//   --piso-gb <n>: cuánta RAM libre exigir antes de arrancar (default: lo que pediría pisoCompartido hoy)
// Salida: 0 si todos los grupos terminaron solos · 1 si alguno se quedó sin medir (lo mató el tope o el vigía).
// =============================================================================

import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compartible, esperarRam, ES_TEST, git, leerDisco, leerResultado, lineasZ, min, motivoBarredora, ramLibreGb, sinComentarios, ZONA_ROJA_VIGIA_GB } from './tests-afectados.mjs';
import { tomarTurno } from './candado-pesado.mjs';

const CACHE_LECTURAS = fileURLToPath(new URL('./cache-lecturas.cjs', import.meta.url)).replace(/\\/g, '/');

/** El pico de memoria de un pid, en GB, como lo ve Windows («Mem Usage» de tasklist, que es el working set). 0 si ya murió. */
export function memoriaGb(pid, plataforma = process.platform) {
  try {
    if (plataforma === 'win32') {
      const s = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true });
      const kb = (s.match(/"([\d.,]+) K"/) ?? [])[1];
      return kb ? Number(kb.replace(/[.,]/g, '')) * 1024 / 1024 ** 3 : 0;
    }
    const s = execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' });
    return Number(s.trim()) * 1024 / 1024 ** 3;
  } catch { return 0; }
}

/** Los tests que se pueden compartir (no tocan estado global), en el mismo orden en que los agruparía tests-afectados. */
export function compartibles(raiz = '.') {
  return lineasZ(git(['ls-files', '-z'], { cwd: raiz })).filter((f) => ES_TEST.test(f)).filter((f) => {
    const src = leerDisco(path.join(raiz, f));
    return src !== null && compartible(src);
  }).sort();
}

/** Un proceso compartido, instrumentado: el reloj, el pico de memoria y en qué minuto iba cada caso juzgado. */
function correrMedido(archivos, { raiz, topeMs, cada = 2000, conCache = true }) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const { NODE_TEST_CONTEXT: _anidado, ...limpio } = process.env;
    const NODE_OPTIONS = conCache ? `${limpio.NODE_OPTIONS ?? ''} --require ${JSON.stringify(CACHE_LECTURAS)}`.trim() : (limpio.NODE_OPTIONS ?? '');
    const hijo = spawn(process.execPath, ['--import', 'tsx', '--test', '--test-isolation=none', ...archivos], { cwd: raiz, env: { ...limpio, NODE_OPTIONS }, stdio: ['ignore', 'pipe', 'pipe'] });
    const trozos = [];
    let casos = 0;
    let resto = '';
    // La CURVA: cuántos casos se habían juzgado a cada minuto. Es lo que dice si el costo es por archivo o si se va en el arranque.
    const curva = [];
    const leer = (d) => {
      trozos.push(d);
      const texto = resto + d.toString('utf8');
      const lineas = texto.split('\n');
      resto = lineas.pop() ?? '';
      for (const l of lineas) if (/^\s*[✔✖﹣].*\(\d+(?:\.\d+)?ms\)/.test(l)) casos++;
    };
    hijo.stdout.on('data', leer);
    hijo.stderr.on('data', leer);
    let pico = 0;
    let libreMin = Infinity;
    const vigilante = setInterval(() => {
      pico = Math.max(pico, memoriaGb(hijo.pid));
      libreMin = Math.min(libreMin, ramLibreGb());
      const minuto = Math.floor((Date.now() - t0) / 60000);
      if (curva.length <= minuto) curva[minuto] = casos;
      else curva[minuto] = casos;
    }, cada);
    let colgada = false;
    const reloj = setTimeout(() => { colgada = true; try { if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(hijo.pid), '/T', '/F'], { stdio: 'ignore' }); else hijo.kill('SIGKILL'); } catch { /* ya murió */ } }, topeMs);
    hijo.on('close', (codigo) => {
      clearTimeout(reloj);
      clearInterval(vigilante);
      resolve({ salida: Buffer.concat(trozos).toString('utf8'), codigo, colgada, ms: Date.now() - t0, pico, libreMin, casos, curva: [...curva] });
    });
  });
}

function leerArgs(argv) {
  const o = { n: 514, grupos: 1, topeMin: 60, cola: true, pisoGb: 0, md: false, listar: false, uno: false, cache: true };
  for (let i = 0; i < argv.length; i++) {
    const [k, v] = argv[i].split(/=(.*)/s);
    const val = () => (v !== undefined ? v : argv[++i]);
    if (k === '--n') o.n = Math.max(1, Number.parseInt(val(), 10) || 1);
    else if (k === '--grupos') o.grupos = Math.max(1, Number.parseInt(val(), 10) || 1);
    else if (k === '--tope-min') o.topeMin = Math.max(1, Number.parseInt(val(), 10) || 1);
    else if (k === '--piso-gb') o.pisoGb = Number(val()) || 0;
    else if (k === '--sin-cola') o.cola = false;
    else if (k === '--md') o.md = true;
    else if (k === '--listar') o.listar = true;          // sólo la lista de compartibles: no corre nada, no hace fila
    else if (k === '--uno-por-uno') o.uno = true;        // corre los N AISLADOS, de a uno, y dice cuál no ejecutó ni un test
    else if (k === '--sin-cache') o.cache = false;       // sin el --require de cache-lecturas.cjs: para medir cuánto aporta (o cuánto cuesta)
    else { process.stderr.write(`  [medir-grupo-compartido] no conozco «${argv[i]}»\n`); return { ...o, ayuda: true }; }
  }
  return o;
}

async function main(argv) {
  const o = leerArgs(argv);
  const out = (s = '') => process.stdout.write(s + '\n');
  if (o.ayuda) return 2;
  const raiz = (() => { try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim(); } catch { return process.cwd(); } })();

  const todos = compartibles(raiz);
  const lista = todos.slice(0, o.n);
  if (o.listar) {
    // ⚠️ `compartible()` contesta «es SEGURO compartirlo» (no toca estado global), NO «vale la pena compartirlo» (relee el repo).
    // Lo que el proceso compartido vino a ahorrar es la RELECTURA de los ~5.400 archivos que hacen las barredoras; un test chico
    // que no barre no gana nada y paga la carga del grupo. El selector no distingue, y de ahí salió un grupo de 1.028.
    const motivos = new Map();
    for (const f of todos) {
      const src = sinComentarios(leerDisco(path.join(raiz, f)) ?? '');
      const m = motivoBarredora(src);
      motivos.set(m ?? '(no barre: no gana nada compartiendo)', (motivos.get(m ?? '(no barre: no gana nada compartiendo)') ?? 0) + 1);
    }
    out(`[medir] ${todos.length} tests compartibles (seguros de compartir). De ellos, por qué BARREN —que es lo que el proceso compartido ahorra—:`);
    for (const [m, n] of [...motivos].sort((a, b) => b[1] - a[1])) out(`  ${String(n).padStart(5)}  ${m}`);
    const barren = [...motivos].filter(([m]) => !m.startsWith('(no barre')).reduce((a, [, n]) => a + n, 0);
    out(`  → ${barren} barren de verdad; ${todos.length - barren} sólo son SEGUROS de compartir.`);
    for (const f of todos) out(`  ${f}`);
    return 0;
  }
  out(`[medir] ${todos.length} tests compartibles en el repo; mido ${lista.length} en ${o.grupos} proceso(s) en paralelo, con el tope en ${o.topeMin} min`);
  if (lista.length < o.n) out(`  ⚠ pediste ${o.n} y hay ${lista.length}: mido los que hay`);

  // Pesado de verdad: fila y RAM antes de arrancar. El piso por defecto es el que pediría hoy pisoCompartido (0,9 + 0,8 × grupos + 0,05).
  const piso = o.pisoGb || (ZONA_ROJA_VIGIA_GB + 0.8 * o.grupos + 0.05);
  let turno = null;
  if (o.cola && !process.env.CI && !process.env.MAKO_SIN_COLA) {
    out('[medir] candado de lo pesado: anotándome en la fila…');
    turno = await tomarTurno({ datos: { chat: `medir-grupo-compartido ${lista.length} archivos`, cuenta: process.env.MAKO_CUENTA ?? '?', comando: `medir-grupo-compartido ${argv.join(' ')}` }, aviso: (t) => out(`  ${t}`) });
    if (turno.vencio) { out('  ✖ no me tocó el turno: no medí nada'); return 1; }
    out('  ✔ candado tomado');
  }
  try {
    const c = await esperarRam(o.grupos, { pisoGb: () => piso, quien: 'medir-grupo-compartido' });
    if (c === 0) { out(`  ✖ no hay RAM: hacen falta ${piso.toFixed(1)} GB y quedan ${ramLibreGb().toFixed(1)}. No medí nada (y NO es un resultado: es que no se pudo).`); return 1; }
    out(`[medir] arranco con ${ramLibreGb().toFixed(1)} GB libres`);

    const partes = Array.from({ length: o.grupos }, () => []);
    lista.forEach((f, i) => partes[i % o.grupos].push(f));
    const t0 = Date.now();
    out(`[medir] cache de lecturas: ${o.cache ? 'SI (como el codigo de verdad)' : 'NO (--sin-cache)'}`);
    const rs = await Promise.all(partes.map((p) => correrMedido(p, { raiz, topeMs: o.topeMin * 60 * 1000, conCache: o.cache })));
    const total = Date.now() - t0;

    out('');
    out('| grupo | archivos | tests | reloj | s/archivo | pico RAM | RAM libre mín | terminó |');
    out('|---|---|---|---|---|---|---|---|');
    for (const [i, r] of rs.entries()) {
      const res = leerResultado(r.salida);
      out(`| ${i + 1}/${rs.length} | ${partes[i].length} | ${res.tests || r.casos || 0} | ${min(r.ms)} | ${(r.ms / 1000 / partes[i].length).toFixed(2)} s | ${r.pico.toFixed(2)} GB | ${Number.isFinite(r.libreMin) ? r.libreMin.toFixed(1) : '?'} GB | ${r.colgada ? `NO: lo mató el tope de ${o.topeMin} min` : r.codigo === 0 ? 'sí, verde' : `sí, código ${r.codigo}`} |`);
    }
    out('');
    for (const [i, r] of rs.entries()) {
      out(`  curva del grupo ${i + 1} (casos juzgados por minuto): ${r.curva.map((n, m) => `${m}′:${n ?? 0}`).join(' ')}`);
    }
    out('');
    out(`[medir] ${lista.length} archivos en ${o.grupos} proceso(s): ${min(total)} de reloj, pico ${Math.max(...rs.map((r) => r.pico)).toFixed(2)} GB por proceso`);
    const sinTerminar = rs.filter((r) => r.colgada).length;
    if (sinTerminar) out(`  ⚠ ${sinTerminar} grupo(s) no terminaron ni con el tope en ${o.topeMin} min: lo que se sabe es «tarda más que eso».`);
    return sinTerminar ? 1 : 0;
  } finally {
    try { turno?.soltar(); } catch { /* ya está suelto */ }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { process.stderr.write(`  [medir-grupo-compartido] error inesperado: ${e?.stack ?? e}\n`); process.exit(2); });
}

export { correrMedido };
