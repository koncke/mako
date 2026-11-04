#!/usr/bin/env node
// =============================================================================
// filtro-punta.mjs — el filtro CHICO antes de subir una punta: los tests de lo tocado y sus tipos, en 90 s o nada
// =============================================================================
// Pedido de Martín del 4/11/2026, y lo que lo justifica está medido (docs/hallazgos-infra.md → «Por qué tardaba horas»): cada
// rojo de una punta en GitHub cuesta una corrida entera (10-27 min) y vuelve al chat; la mayoría era un test del mismo archivo
// que se tocó, que en la PC se ve en segundos. Lo corre el pre-push (scripts/claude-hooks/pre-push) en un push a `punta/*`.
//
// ⚠️ NO ES antes-de-subir. Aquél era la fila de N chequeos completos (barredoras, importadores lejanos, el candado de lo
// pesado) que se sacó a propósito el 22/10/2026: con 8 chats tardaba HORAS. Éste:
//   · NO toma el candado de lo pesado ni hace fila: si el lock del typecheck está tomado, los tipos se saltean;
//   · NO espera RAM: si no alcanza AHORA, avisa y deja subir;
//   · NO corre barredoras ni importadores a más de un salto: eso lo corre la punta en GitHub;
//   · tiene un TOPE de pared (MAKO_FILTRO_TOPE_S, 90 por defecto). Lo que no entró, no se corrió: se dice, y deja subir.
// Sólo frena (exit 1) con un rojo CONFIRMADO: un test que corrió y falló, o un error de tipos en un archivo que la punta tocó.
// Nunca devuelve 99: «no pude chequear» acá es «lo chequea GitHub», no un bloqueo.
//
// Uso: node scripts/filtro-punta.mjs [--base origin/main] [--tope 90]
// Salida: 0 pasa (verde, o a medias y avisado) · 1 rojo confirmado. La última línea es el veredicto.
// =============================================================================

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { alcanceTsc, git, leerDisco, leerResultado, motivoPrincipal, pisoRam, ramLibreGb, seleccionar, ZONA_ROJA_VIGIA_GB } from './tests-afectados.mjs';
import { armarTsconfig } from './tsc-acotado.mjs';
import { veredicto } from './tsc-bitacoras.mjs';

const RAIZ_DEL_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TOPE_POR_DEFECTO_S = 90;
const TANDA = 6;
const CONCURRENCIA = 2;
const LOCK_TSC = path.join(os.tmpdir(), 'mako-typecheck.lock');   // el mismo de typecheck-lock, tsc-acotado y antes-de-subir: UN tsc por PC

/**
 * Los tests que son DE lo que la punta tocó: el cambio los toca, nombran un archivo cambiado, o lo importan directo
 * (`planear` con profundidad 1). Una barredora que sólo está por barrer queda afuera: la corre la punta en GitHub.
 * En orden: primero los que el cambio toca, después los que nombran, después los que importan (los rojos salen en ese orden).
 */
export function testsSuyos(tests) {
  const orden = { cambio: 0, nombra: 1, importa: 2 };
  return [...tests]
    .filter(([, razones]) => razones.some((r) => r.tipo in orden))
    .map(([t, razones]) => [t, orden[motivoPrincipal(razones.filter((r) => r.tipo in orden)).tipo]])
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([t]) => t);
}

/**
 * ⚠️ EL TSC «ACOTADO» NO ES CHICO: compila lo tocado Y TODO LO QUE IMPORTA. Medido el 4/11/2026 sobre seis cambios reales (4 CPU):
 * un archivo de app/ o lib/ arrastra 1.355-1.459 archivos del repo (el ciclo de lib/) y el tsc tarda 131 s con 3,2 GB; un test o
 * un script chico arrastra 1-30 y termina en 4-9 s. Con un tope de 90 s, el primero no entra NUNCA (ni en paralelo con los tests):
 * arrancarlo es gastar 3 GB de la PC durante 90 s para cortarlo. Por eso, si lo tocado arrastra más de esto, los tipos se saltean
 * con aviso y los chequea el tsc entero de la punta (148 s en GitHub).
 */
export const CLAUSURA_MAXIMA_PARA_TIPOS = 400;

/** Cuántos archivos del repo alcanza el tsc desde `alcance`, siguiendo los imports hacia adelante (el grafo de tests-afectados). */
export function clausuraDeImports(alcance, importadoPor) {
  const importa = new Map();
  for (const [destino, quienes] of importadoPor) for (const q of quienes) { if (!importa.has(q)) importa.set(q, new Set()); importa.get(q).add(destino); }
  const vistos = new Set(alcance);
  const cola = [...alcance];
  while (cola.length) for (const d of importa.get(cola.pop()) ?? []) if (!vistos.has(d)) { vistos.add(d); cola.push(d); }
  return vistos.size;
}

/** El heap del tsc acotado (el de antes-de-subir: alcances grandes piden más) y lo que pide de RAM libre para arrancar. */
export const heapTsc = (n) => (n > 600 ? 5120 : n > 120 ? 4096 : 3072);
export const pisoTipos = (heapMb) => heapMb / 1024 + 0.1 + ZONA_ROJA_VIGIA_GB;

/** El lock del typecheck, SIN ESPERAR: o es mío ahora, o los tipos se saltean. Un lock de un proceso muerto se saca. */
function tomarLockSinEsperar() {
  for (let i = 0; i < 2; i++) {
    try { writeFileSync(LOCK_TSC, String(process.pid), { flag: 'wx' }); return true; } catch { /* ocupado */ }
    let dueno = Number.NaN;
    try { dueno = Number.parseInt(readFileSync(LOCK_TSC, 'utf8').trim(), 10); } catch { /* lo soltaron */ }
    try { if (Number.isInteger(dueno) && dueno > 0) { process.kill(dueno, 0); return false; } } catch { /* muerto */ }
    try { unlinkSync(LOCK_TSC); } catch { /* otro lo sacó */ }
  }
  return false;
}
function soltarLock() { try { if (readFileSync(LOCK_TSC, 'utf8').trim() === String(process.pid)) unlinkSync(LOCK_TSC); } catch { /* ya no era mío */ } }

/**
 * Corre un proceso con un tope de pared; al vencer mata el ÁRBOL (en Windows, taskkill /T: node --test lanza hijos).
 * @param {string} cmd @param {string[]} args @param {{ ms: number, cwd?: string, env?: NodeJS.ProcessEnv }} o
 * @returns {Promise<{ codigo: number | null, salida: string, vencio: boolean }>}
 */
export function correrConTope(cmd, args, { ms, cwd = process.cwd(), env = process.env }) {
  return new Promise((resolve) => {
    if (ms <= 0) { resolve({ codigo: null, salida: '', vencio: true }); return; }
    const hijo = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    let salida = '';
    hijo.stdout.on('data', (d) => { salida += d; });
    hijo.stderr.on('data', (d) => { salida += d; });
    let vencio = false;
    const reloj = setTimeout(() => {
      vencio = true;
      try {
        if (process.platform === 'win32') spawn('taskkill', ['/pid', String(hijo.pid), '/T', '/F'], { stdio: 'ignore' });
        else process.kill(-hijo.pid, 'SIGKILL');
      } catch { /* ya terminó */ }
    }, ms);
    hijo.on('close', (codigo) => { clearTimeout(reloj); resolve({ codigo, salida, vencio }); });
    hijo.on('error', () => { clearTimeout(reloj); resolve({ codigo: null, salida, vencio }); });
  });
}

/**
 * Corre `tests` en tandas chicas hasta el `hasta`. Lo que una tanda terminó cuenta (un rojo ahí es CONFIRMADO); la tanda que el
 * reloj cortó no cuenta para nada, y las que no arrancaron tampoco. `correr` se inyecta en el test.
 * @param {string[]} tests
 * @param {{ hasta: number, ahora?: () => number, cwd?: string, env?: NodeJS.ProcessEnv,
 *   correr?: (cmd: string, args: string[], o: { ms: number, cwd?: string, env?: NodeJS.ProcessEnv }) => Promise<{ codigo: number | null, salida: string, vencio: boolean }> }} o
 */
export async function correrTestsConTope(tests, { hasta, ahora = Date.now, correr = correrConTope, env = process.env, cwd = process.cwd() }) {
  const r = { corridos: 0, casos: 0, rojos: [], sinCorrer: 0 };
  for (let i = 0; i < tests.length; i += TANDA) {
    const tanda = tests.slice(i, i + TANDA);
    const { NODE_TEST_CONTEXT: _anidado, ...limpio } = env;
    const x = await correr(process.execPath, ['--import', 'tsx', '--test', `--test-concurrency=${CONCURRENCIA}`, ...tanda], { ms: hasta - ahora(), env: limpio, cwd });
    if (x.vencio) { r.sinCorrer = tests.length - i; break; }
    const res = leerResultado(x.salida);
    r.corridos += tanda.length;
    r.casos += res.tests;
    if (x.codigo !== 0) r.rojos.push(...(res.rojos.length ? res.rojos : tanda.map((t) => `${t} (la tanda salió con ${x.codigo})`)));
  }
  return r;
}

/** Los tipos de lo tocado. Devuelve { ok: true } · { ok: false, errores } (sólo los de archivos tocados) · { saltado: porque }. */
async function tiposDeLoTocado(alcance, { hasta, raiz, clausura = 0 }) {
  if (alcance.length === 0) return { ok: true, nada: true };
  if (clausura > CLAUSURA_MAXIMA_PARA_TIPOS) return { saltado: `lo tocado arrastra ${clausura} archivos al tsc y no entra en el tope (los chequea el tsc entero de la punta)` };
  const heap = heapTsc(alcance.length);
  const libre = ramLibreGb();
  if (!process.env.CI && libre < pisoTipos(heap)) return { saltado: `hay ${libre.toFixed(1)} GB libres y el tsc acotado pide ${pisoTipos(heap).toFixed(1)}` };
  if (!tomarLockSinEsperar()) return { saltado: 'otro tsc está corriendo en esta PC (no espero el turno)' };
  const dir = mkdtempSync(path.join(os.tmpdir(), 'filtro-punta-tsc-'));
  try {
    const config = path.join(dir, 'tsconfig.json');
    writeFileSync(config, JSON.stringify(armarTsconfig(raiz, alcance)));
    const x = await correrConTope(process.execPath, [`--max-old-space-size=${heap}`, path.join(RAIZ_DEL_SCRIPT, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', config], { ms: hasta - Date.now(), cwd: raiz });
    if (x.vencio) return { saltado: 'no terminó dentro del tope' };
    const v = veredicto(x.codigo, x.salida);
    if (v === 'ok') return { ok: true };
    if (v !== 'errores') return { saltado: `el tsc acotado no terminó (código ${x.codigo}): no es un error de tipos` };
    // Como antes-de-subir: sólo cuentan los errores de los archivos TOCADOS. Los de arrastre (un archivo suelto no ve los tipos que
    // agrega otro con `declare module`) los decide el tsc entero de la punta.
    const tocados = new Set(alcance);
    const errores = x.salida.split('\n').filter((l) => /error TS\d+/.test(l) && tocados.has(l.split('(')[0].replace(/\\/g, '/')));
    return errores.length ? { ok: false, errores } : { ok: true, arrastre: true };
  } finally {
    soltarLock();
    rmSync(dir, { recursive: true, force: true });
  }
}

/** La selección sobre lo COMMITEADO desde el merge-base con `base` (incluye lo borrado), con el grafo de lo que git sigue. null sin base. */
export function planDeLoCommiteado(base) {
  let desde;
  try { desde = git(['merge-base', base, 'HEAD']).trim(); } catch { return null; }
  const cambiados = git(['diff', '--name-only', '--no-renames', desde, 'HEAD']).split('\n').map((l) => l.trim()).filter(Boolean);
  const archivos = git(['ls-files']).split('\n').map((l) => l.trim()).filter(Boolean);
  const sel = seleccionar({ cambiados, archivos, leer: leerDisco, profundidad: 1 });
  const sucio = git(['status', '--porcelain', '--untracked-files=no']).trim() !== '';
  return { cambios: { cambiados }, archivos, sel, sucio };
}

export async function filtrar({ base = 'origin/main', topeS = TOPE_POR_DEFECTO_S, raiz = process.cwd(), out = (s) => process.stdout.write(s + '\n') } = {}) {
  const t0 = Date.now();
  const hasta = t0 + topeS * 1000;
  // Lo que se SUBE es lo commiteado: la lista sale de `merge-base..HEAD` y de `git ls-files`, nunca del disco (un archivo nuevo sin
  // commitear de otra tarea no viaja, y no puede frenar este push). Los tests corren sobre el disco: si el árbol tiene cambios sin
  // commitear en archivos que git sigue, se avisa.
  const plan = planDeLoCommiteado(base);
  if (!plan) return { codigo: 0, linea: `⚠ FILTRO SIN CORRER: no encuentro «${base}» (git fetch origin). Lo chequea la punta en GitHub.` };
  const { cambios, sel } = plan;
  if (plan.sucio) out(`[filtro-punta] ⚠ hay cambios sin commitear en archivos de git: el filtro corre sobre el disco y no es exactamente lo que sube.`);
  const tests = testsSuyos(sel.tests);
  const alcance = alcanceTsc({ cambiados: cambios.cambiados, archivos: plan.archivos, importadoPor: sel.importadoPor, aumentan: sel.aumentan });
  out(`[filtro-punta] ${cambios.cambiados.length} archivos tocados → ${tests.length} tests suyos y los tipos de ${alcance.length} archivos, con tope de ${topeS} s`);

  // Tests y tipos EN PARALELO si hay RAM para los dos: el tsc «acotado» de un solo archivo arrastra lo que importa, y medido el 4/11
  // sobre commits reales un script de 1 archivo compiló 3.323 y tardó 131 s. Detrás de los tests no entraba casi nunca (1 de 5).
  // Sin RAM para los dos, primero los tests (dan la mayoría de los rojos) y los tipos después, si queda tiempo y RAM.
  const avisos = [];
  const vacio = { corridos: 0, casos: 0, rojos: [], sinCorrer: 0 };
  const libre = ramLibreGb();
  const ramTests = pisoRam(CONCURRENCIA);
  const clausura = clausuraDeImports(alcance, sel.importadoPor);
  const ramTipos = clausura > CLAUSURA_MAXIMA_PARA_TIPOS ? 0 : pisoTipos(heapTsc(alcance.length));
  const correrLosTests = async () => {
    if (!tests.length) return vacio;
    if (!process.env.CI && ramLibreGb() < ramTests) { avisos.push(`tests: no los corrí, hay ${ramLibreGb().toFixed(1)} GB libres`); return vacio; }
    const r = await correrTestsConTope(tests, { hasta, cwd: raiz });
    if (r.sinCorrer) avisos.push(`tests: ${r.sinCorrer} de ${tests.length} no entraron en el tope`);
    return r;
  };
  const juntos = Boolean(process.env.CI) || libre >= ramTests + ramTipos - ZONA_ROJA_VIGIA_GB;
  let t;
  let ti;
  if (juntos) [t, ti] = await Promise.all([correrLosTests(), tiposDeLoTocado(alcance, { hasta, raiz, clausura })]);
  else { t = await correrLosTests(); ti = await tiposDeLoTocado(alcance, { hasta, raiz, clausura }); }
  if (ti.saltado) avisos.push(`tipos: ${ti.saltado}`);
  if (ti.errores) out(ti.errores.slice(0, 20).join('\n'));

  const s = Math.round((Date.now() - t0) / 1000);
  if (t.rojos.length || ti.errores) {
    const que = [t.rojos.length ? `tests rojos: ${[...new Set(t.rojos)].join(', ')}` : '', ti.errores ? `${ti.errores.length} error(es) de tipos en lo tocado` : ''].filter(Boolean).join(' · ');
    return { codigo: 1, linea: `✖ FILTRO ROJO en ${s} s: ${que}` };
  }
  const hecho = `${t.corridos} de ${tests.length} tests (${t.casos} casos)${ti.ok && !ti.nada ? ` y los tipos de ${alcance.length} archivos` : ''}`;
  if (avisos.length) return { codigo: 0, linea: `⚠ FILTRO A MEDIAS en ${s} s: ${hecho} en verde; ${avisos.join('; ')}. Lo que falta lo chequea la punta en GitHub.` };
  return { codigo: 0, linea: `✔ FILTRO VERDE en ${s} s: ${hecho}.` };
}

function leerArgs(argv) {
  const o = { base: 'origin/main', topeS: Number(process.env.MAKO_FILTRO_TOPE_S) || TOPE_POR_DEFECTO_S };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') o.base = argv[++i];
    else if (argv[i] === '--tope') o.topeS = Number(argv[++i]) || o.topeS;
  }
  return o;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try { process.chdir(git(['rev-parse', '--show-toplevel']).trim()); } catch { /* fuera de un repo: planear dirá que no */ }
  filtrar(leerArgs(process.argv.slice(2))).then(
    (r) => { process.stdout.write(`[filtro-punta] ${r.linea}\n`); process.exit(r.codigo); },
    // Un error del filtro NO frena un push: no es un rojo del código.
    (e) => { process.stdout.write(`[filtro-punta] ⚠ FILTRO SIN CORRER: error del filtro (${String(e?.message ?? e).split('\n')[0]}). Lo chequea la punta en GitHub.\n`); process.exit(0); },
  );
}
