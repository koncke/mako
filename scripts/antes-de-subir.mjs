#!/usr/bin/env node
// =============================================================================
// antes-de-subir.mjs — lo que Actions le va a decir a tu punta, dicho ANTES de pasársela al Cerebro
// =============================================================================
// POR QUE EXISTE: de los 101 runs de integracion al 17/10/2026, 21 fallaron (más 14 cancelados), y cada
// rojo costó ~15 min de reloj y de los 2.000 minutos gratis del mes (los fallidos se llevaron 140). Los 21
// rojos son de DOS clases, y ninguna la cubre «corré los tests de tu área»:
//   (a) 16 en «Tests»: un test de OTRA área que lee el código como texto (un regex exacto sobre el fuente) o
//       un barrido global del repo (puente-panel-copy, progreso, fuentes-sin-next-font, frontera-use-client).
//   (b) 5 en «Tipos»: un ayudante de tests sin export que tsc toma por script global (51 y 52), un test que
//       llamaba con dos argumentos a una firma que pide uno (31), una bitácora sin `puntos` (10), un test que pasaba
//       `{}` donde se pide un `ProcessEnv` (100).
// El área la define quien escribe el cambio; lo que se rompe lo define quien escribió el test o el tipo. Por
// eso esto no pregunta «¿qué tocaste?» sino «¿qué mira lo que tocaste?» — y lo contesta leyendo el código.
//
// QUE HACE (de más barato a más caro; frena en el primer rojo, `--todo` sigue):
//   1. Las GUARDAS DEL PUSH (scripts/guardas-push.sh): las mismas que corren el pre-push y Actions — tipos de
//      las bitácoras, skills y plugin al día, la API de MaKo, hooks de React, y «todo .ts es un módulo».
//   2. El TSC ACOTADO de lo que cambió (el tsc suma solo lo que esos archivos importan; `--importadores` suma también a quienes
//      los importan, un nivel — no es el default: con 14 chats abiertos pedía 4,3 GB y la PC tenía 1,3). Con el piso de RAM de
//      scripts/typecheck-lock.mjs y su mismo lock. ⚠️ Si no entra en 90 s (RAM o lock), NO se espera 15 min ni se sale con 99:
//      dice «tipos: los chequea Actions» y sigue con los tests; la línea final queda `VERDE <sha> (tipos: los chequea Actions)`.
//   3. Los TESTS AFECTADOS (scripts/tests-afectados.mjs): todas las barredoras (git ls-files, readdir…, detectadas
//      solas), los que NOMBRAN un archivo cambiado como texto y los que lo IMPORTAN, directo o transitivo.
//   Todo con poca concurrencia (2 procesos) y esperando RAM, no cayéndose.
//
// DOS MODOS (medidos el 17/10/2026 en esta PC con ~14 chats abiertos, sobre la punta de Automations de 21 archivos, que tiene 3 rojos reales):
//   · COMPLETO (el default): guardas + tipos de lo cambiado + tests afectados a TODOS los saltos. Los tests: 4 min 21 s (396 archivos, 4.712 tests).
//   · `--rapido`: el MÍNIMO que un jefe corre antes de pasar una punta (AGENTS.md). Guardas + los tests que nombran o importan DIRECTO un archivo
//     cambiado (profundidad 1) + todas las barredoras, SIN tipos (`--con-tipos` los suma): 3 min 28 s en total. Le deja a Actions los tipos y
//     los importadores a 2+ saltos; el replay (`replay-fallos-ci.mjs --rapido`) dice exactamente qué cubre: 19 de los 20 rojos de «Tests», y de los
//     5 de «Tipos» sólo los 2 que frena la guarda de módulos.
//   ⚠️ Antes de compartir procesos (abajo) la misma punta tardaba 26 min con 388 archivos, y el modo rápido 9 min 23 s.
//
// POR QUÉ ES RÁPIDO: los tests que no tocan estado global corren JUNTOS en UN proceso (`--test-isolation=none`) con las lecturas de archivos en
// memoria (scripts/cache-lecturas.cjs). El costo no era el regex: ~68 barredoras leen los mismos ~5.400 archivos y con `node --test` cada archivo de
// test es un proceso aparte que los vuelve a leer. Medido: 12 barredoras globales, 193 s separadas y 40 s juntas; la SUITE ENTERA (1.050 tests
// compartibles, 10.905 casos) en 2 procesos, 260 s, 0 rojos. Todo rojo de un proceso compartido se REPITE aislado antes de contarlo (puede ser
// interferencia: `editor-landing-origen` falló una vez porque otro test había dejado algo que hacía creer a lib/app-url.ts que corría «en el
// navegador»). Riesgo que queda: un FALSO VERDE por contagio — por eso Actions sigue corriendo cada test en su proceso.
//
// LA SALIDA ES UNA LÍNEA, la última:   VERDE <sha>     o     ROJO: <qué>
// y el VERDE sólo vale si (a) el árbol está LIMPIO (lo que probaste es lo que viaja: un archivo nuevo sin
// commitear se ve acá pero no llega a la integración) y (b) tu rama TIENE origin/main mergeado (si no, probaste
// contra una versión vieja de lo que hicieron los demás). Por eso el chat le pasa al Cerebro SU PUNTA Y ESA LÍNEA,
// y el Cerebro no integra una punta sin ella. Exit: 0 verde · 1 rojo · 99 no corrió por falta de RAM (no es un rojo
// de código: cerrá chats o esperá).
//
// Uso:  node scripts/antes-de-subir.mjs [--base origin/main] [--todo] [--cortar] [--sin-fetch] [--listar]
//   --listar: sólo el plan (qué tests y qué archivos de tipos), no corre nada · --sin-fetch: no baja origin/main antes
//   --sin-condiciones: no exige árbol limpio ni origin/main mergeado (lo usa el pre-push, que ya sabe qué commit sube)
//   --rapido [--con-tipos]: el modo rápido (arriba) · --sin-compartir: cada test en su proceso, como `npm test`.
//   --importadores: el tsc acotado suma, además de lo cambiado, a quienes lo importan (un nivel).
//   MAKO_TIPOS_ESPERA_S=<segundos>: cuánto espera RAM para los tipos antes de decir «los chequea Actions» (default 90).
//   --profundidad N: de los tests que IMPORTAN un archivo cambiado, sólo los que están a N saltos o menos (default: todos).
//     Es la palanca si el tiempo aprieta (26 min en la PC cargada con una punta de 21 archivos); un VERDE así dice «--profundidad N» en su línea.
//   --solo guardas|tipos|tests: una sola etapa; la última línea es `PARCIAL …`, nunca `VERDE` (no vale para pasar una punta)
//
// ───────────────────────────────────────────────────────────────────────────
// LA PRUEBA: el REPLAY de los 21 runs rojos (node scripts/replay-fallos-ci.mjs --md). Para cada run se toma el árbol
// de la cabeza que falló y la base REAL = el último run verde anterior (docs/fallos-ci-integracion.jsonl), y se
// mira si el rojo habría salido. 21/21 runs, 25/25 rojos:
//
// | run | cabeza | base (run) | paso | el rojo | lo elige porque | tests elegidos |
// |---|---|---|---|---|---|---|
// | 100 | e9d5b041a | 89ee3aee3 (97) | Tipos | centro-preguntas-chat.test.ts | ✔ tsc: el cambio lo toca | tsc: 72 archivos |
// | 99 | 2e70621a5 | 89ee3aee3 (97) | Tests | onboarding-hub-retirado.test.ts | ✔ barre: git ls-files | 387/1134 |
// | 99 | 2e70621a5 | 89ee3aee3 (97) | Tests | undecima-email-propio.test.ts | ✔ barre: recorre carpetas | 387/1134 |
// | 98 | 0484dc0c2 | 89ee3aee3 (97) | Tests | link-con-workspace.test.ts | ✔ barre: recorre carpetas | 387/1134 |
// | 94 | 14d945d10 | 70276424a (93) | Tests | centro-abrir.test.ts | ✔ cambio: el cambio lo toca | 476/1125 |
// | 91 | 852198de7 | e5f23ef0d (90) | Tests | frontera-use-client.test.ts | ✔ barre: git ls-files | 332/1113 |
// | 89 | 20b129409 | 3e6976024 (87) | Tests | plazo-etapa-automatizacion.test.ts | ✔ nombra: lib/nutricion.ts | 465/1111 |
// | 85 | cdb744ddd | 7fc4137b4 (84) | Tests | centro-revisar.test.ts | ✔ nombra: lib/operaciones-reglas.ts | 442/1101 |
// | 85 | cdb744ddd | 7fc4137b4 (84) | Tests | medios-automatizacion.test.ts | ✔ nombra: lib/nutricion.ts | 442/1101 |
// | 82 | 543f52bbe | 7c3d1174f (81) | Tests | zona-negocio.test.ts | ✔ barre: recorre carpetas | 336/1090 |
// | 80 | 6c0c2fb87 | d3a6d3b9d (79) | Tests | editor-acciones.test.ts | ✔ nombra: lib/api-mako/registro.ts | 447/1084 |
// | 80 | 6c0c2fb87 | d3a6d3b9d (79) | Tests | puente-panel-copy.test.ts | ✔ nombra: lib/mako-doer-in.ts | 447/1084 |
// | 63 | 6785855a4 | 5d77294c4 (62) | Tests | crm-menu-contextual.test.ts | ✔ nombra: app/crm/CrmBoard.tsx | 187/1073 |
// | 60 | fb434b555 | 481295b6e (59) | Tests | onboarding-hub-retirado.test.ts | ✔ barre: git ls-files | 152/1073 |
// | 53 | 2e88e9737 | 7c2fc7488 (50) | Tests | agenda-whatsapp.test.ts | ✔ importa: lib/api-mako/areas/plan.def.ts (2 saltos) | 420/1064 |
// | 53 | 2e88e9737 | 7c2fc7488 (50) | Tests | flujos-ws-explicito.test.ts | ✔ nombra: app/api/webhooks/fathom/route.ts | 420/1064 |
// | 52 | 463c804a8 | 7c2fc7488 (50) | Tipos | _cobros-conexion-hijo.ts | ✔ guarda de módulos: _fathom-carga-hijo.ts, _plan-kanban-hijo.ts sin import/export | tsc: 102 archivos |
// | 51 | e30d9fe07 | 7c2fc7488 (50) | Tipos | _cobros-conexion-hijo.ts | ✔ guarda de módulos: _fathom-carga-hijo.ts, _plan-kanban-hijo.ts sin import/export | tsc: 102 archivos |
// | 48 | 49fea715e | 2f913cddc (47) | Tests | puente-panel-copy.test.ts | ✔ cambio: el cambio lo toca | 339/1053 |
// | 43 | 6970a8429 | d9e35f78a (42) | Tests | puente-panel-copy.test.ts | ✔ barre: git ls-files | 351/1038 |
// | 38 | 60d618007 | 701efb8e2 (37) | Tests | progreso.test.ts | ✔ nombra: AGENTS.md | 468/1036 |
// | 31 | fecd5cbaf | 7c94db5f5 (30) | Tipos | crm-campo-inline.test.ts | ✔ tsc: el cambio lo toca | tsc: 85 archivos |
// | 23 | 70c2efd4d | 0057d1aec (22) | Tests | tsc-acotado.test.ts | ✔ cambio: el cambio lo toca | 413/996 |
// | 10 | ef08b26ff | 91f41eb92 (9) | Tipos | app/admin/dev/chatbot/bitacora.ts | ✔ tsc: el cambio lo toca | tsc: 33 archivos |
// | 1 | 73ba933f0 | ae8febb5e (sin verde) | Tests | fuentes-sin-next-font.test.ts | ✔ barre: git ls-files | 462/958 |
//
// «Lo elige porque»: nombra = el test escribe la ruta de un archivo cambiado · barre = recorre el repo (corre siempre) · importa = importa
// uno cambiado (N saltos) · cambio = el cambio toca al test · tsc = el .ts con el error está en lo que compila el tsc acotado.
// Los 5 rojos de «Tipos»: en 10, 31 y 100 el archivo con el error CAMBIÓ, y por eso entra al tsc acotado (y el tsc real, corrido sobre
// esos árboles con `--solo tipos`, reproduce el error: TS2554 en crm-campo-inline.test.ts); 51 y 52 los frena scripts/modulos-ts.mjs
// (el archivo del error NO cambió: chocaba con dos scripts globales que sí). Los «tests elegidos» son 14-45 % de la suite cuando
// la base es el último verde del Cerebro (que junta ~8 puntas): no es azar — 11 de 25 rojos son barredoras que corren SIEMPRE, y
// los otros 14 los elige lo que tocaron. Por eso corre acá y en Actions primero, y el resto después (integracion.yml).
// =============================================================================

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { armarTsconfig } from './tsc-acotado.mjs';
import { veredicto } from './tsc-bitacoras.mjs';
import {
  agrupar, alcanceTsc, correrTests, dormir, esperarRam, git, imprimirPlan, indiceConNuevos, min, planear, ramLibreGb,
  SALIDA_SIN_CORRER, ZONA_ROJA_VIGIA_GB,
} from './tests-afectados.mjs';

// La raíz es la del árbol DESDE DONDE se corre (no la de este archivo): así el mismo script se puede probar sobre el árbol
// de un commit viejo (replay de los runs rojos) y el hook lo corre sobre el worktree que se pushea.
const RAIZ = (() => { try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim(); } catch { return process.cwd(); } })();

// ---------------------------------------------------------------------------
// 1. Las guardas del push
// ---------------------------------------------------------------------------

/** El `sh` de Git for Windows no siempre está en el PATH de quien llama (PowerShell, una app): se lo busca al lado de git. */
export function buscarSh() {
  if (spawnSync('sh', ['-c', 'exit 0'], { stdio: 'ignore' }).status === 0) return 'sh';
  try {
    const exec = execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim();
    for (const rel of ['../../../bin/sh.exe', '../../../usr/bin/sh.exe', '../../bin/sh.exe']) {
      const cand = path.resolve(exec, rel);
      if (spawnSync(cand, ['-c', 'exit 0'], { stdio: 'ignore' }).status === 0) return cand;
    }
  } catch { /* sin git */ }
  return null;
}

function correrGuardas(out) {
  const sh = buscarSh();
  if (!sh) return { ok: false, porque: 'no encontré `sh` (Git for Windows) para correr scripts/guardas-push.sh' };
  const r = spawnSync(sh, ['scripts/guardas-push.sh', 'origin'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  if (r.status === 0) {
    out(`  ✔ ${(salida.match(/\[pre-push\] Chequeando/g) ?? []).length} guardas del push en verde`);
    return { ok: true };
  }
  out(salida.split('\n').slice(-25).join('\n'));
  const cual = (salida.match(/\[pre-push\] (Chequeando[^\n]*)\n(?:(?!\[pre-push\]).*\n)*?\s*(?:X|✖) PUSH BLOQUEADO: ([^\n]*)/) ?? [])[2];
  return { ok: false, porque: `una guarda del push: ${cual ?? 'mirá el detalle de arriba'}` };
}

// ---------------------------------------------------------------------------
// 2. El tsc acotado (mismo lock y mismo criterio de RAM que scripts/typecheck-lock.mjs)
// ---------------------------------------------------------------------------

const LOCK = path.join(os.tmpdir(), 'mako-typecheck.lock');    // el MISMO archivo: un tsc por máquina, sea completo o acotado
const vivo = (pid) => { if (!Number.isInteger(pid) || pid <= 0) return false; try { process.kill(pid, 0); return true; } catch { return false; } };
const duenoDelLock = () => { try { return Number.parseInt(readFileSync(LOCK, 'utf8').trim(), 10); } catch { return NaN; } };

async function tomarLock(maxMs = 10 * 60 * 1000) {
  const hasta = Date.now() + maxMs;
  let aviso = false;
  while (Date.now() < hasta) {
    try { writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); return true; } catch { /* ocupado */ }
    if (!vivo(duenoDelLock())) { try { unlinkSync(LOCK); } catch { /* otro lo sacó */ } continue; }
    if (!aviso) { process.stderr.write(`  [antes-de-subir] otro typecheck está corriendo (pid ${duenoDelLock()}); espero mi turno…\n`); aviso = true; }
    await dormir(500);
  }
  return false;
}
const soltarLock = () => { try { if (duenoDelLock() === process.pid) unlinkSync(LOCK); } catch { /* ya no es mío */ } };

/** Heap según cuántos archivos hay que compilar (el tsc suma lo que esos archivos importan: ~1.000 para 170). */
export const heapPara = (n) => (n > 600 ? 5120 : n > 250 ? 4096 : n > 120 ? 3072 : 2048);
const pisoTsc = (heapMb) => (() => heapMb / 1024 + 0.1 + ZONA_ROJA_VIGIA_GB);

// ⚠️ EL TIPO NO ES UN CANDADO QUE SE ARREGLE ESPERANDO (17/10/2026). El primer push del Cerebro con el pre-push nuevo se trabó en
// «tipos (188 archivos)»: pedía 4,3 GB y la PC, con ~14 chats abiertos, tenía 1,3 libres. Ahora el paso espera poco (90 s) y, si no
// entra, DICE «tipos: los chequea Actions» y sigue con los tests — el tsc completo de Actions corre justo después de los afectados.
// «El gate tiene que poder correr en esta PC con 14 chats abiertos; si no, nadie lo va a usar.»
const ESPERA_TIPOS_MS = (Number(process.env.MAKO_TIPOS_ESPERA_S) || 90) * 1000;

async function correrTsc(alcance, out) {
  if (alcance.length === 0) { out('  ✔ ningún .ts/.tsx cambió: nada que compilar'); return { ok: true }; }
  const heap = heapPara(alcance.length);
  const saltar = (porque) => { out(`  ⚠ tipos: los chequea Actions (${porque})`); return { ok: true, saltado: porque }; };
  if (!(await tomarLock(ESPERA_TIPOS_MS))) return saltar('otro typecheck está corriendo y no se liberó');
  try {
    const c = await esperarRam(1, { pisoGb: pisoTsc(heap), quien: 'antes-de-subir', esperaMaxMs: ESPERA_TIPOS_MS });
    if (c === 0) return saltar(`no hay RAM: quedan ${ramLibreGb().toFixed(1)} GB y el tsc acotado pide ${pisoTsc(heap)(1).toFixed(1)}`);
    const dir = mkdtempSync(path.join(os.tmpdir(), 'antes-de-subir-tsc-'));
    const config = path.join(dir, 'tsconfig.json');
    writeFileSync(config, JSON.stringify(armarTsconfig(RAIZ, alcance), null, 2));
    const t0 = Date.now();
    try {
      const r = spawnSync(process.execPath, [`--max-old-space-size=${heap}`, path.join(RAIZ, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', config], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
      const v = veredicto(r.error ? null : r.status, salida);
      if (v === 'ok') { out(`  ✔ tipos de ${alcance.length} archivos sin errores · ${min(Date.now() - t0)} · heap ${heap} MB`); return { ok: true }; }
      if (v === 'errores') {
        // ⚠️ SÓLO BLOQUEAN los errores de los archivos DEL ALCANCE (lo cambiado; con --importadores, también quienes lo importan). tsc también compila todo lo que
        // esos archivos importan, y ahí un archivo suelto no ve los tipos que AGREGA otro (`declare module`, `.d.ts` ambientes):
        // medido el 17/10/2026 al reproducir el run 10, `insertar.ts` (TipTap) daba TS2339 que el tsc completo no da. Esos errores
        // se muestran pero no frenan: los decide el tsc completo de Actions. Un cambio que rompe a un importador DIRECTO sí frena.
        const delAlcance = new Set(alcance);
        const errores = salida.split('\n').filter((l) => /error TS\d+/.test(l));
        const archivoDe = (l) => l.split('(')[0].replace(/\\/g, '/');
        const propios = errores.filter((l) => delAlcance.has(archivoDe(l)));
        const porArrastre = errores.length - propios.length;
        if (propios.length === 0) {
          out(`  ✔ tipos de ${alcance.length} archivos sin errores · ${min(Date.now() - t0)} · heap ${heap} MB`);
          out(`  ℹ ${porArrastre} error(es) en archivos que sólo se compilan por arrastre (no frenan; los decide el tsc de Actions): ${[...new Set(errores.map(archivoDe))].slice(0, 3).join(', ')}`);
          return { ok: true };
        }
        out(propios.slice(0, 30).join('\n') + (propios.length > 30 ? `\n  …y ${propios.length - 30} más` : ''));
        if (porArrastre) out(`  ℹ y ${porArrastre} más en archivos que sólo se compilan por arrastre (no cuentan acá)`);
        return { ok: false, porque: `tipos: ${propios.length} errores (${[...new Set(propios.map(archivoDe))].slice(0, 3).join(', ')})` };
      }
      return saltar(`el tsc acotado no terminó (código ${r.status ?? r.error?.message}, ${salida.length} bytes): lo mató el vigía de RAM o se quedó sin heap — no es un error de tipos`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  } finally { soltarLock(); }
}

// ---------------------------------------------------------------------------
// 3. Las condiciones del VERDE, y la corrida
// ---------------------------------------------------------------------------

/** Lo que el árbol tiene sin commitear (modificado, borrado o NUEVO sin git): un VERDE sobre eso no vale para el sha. */
export function sucio() {
  return execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter(Boolean);
}

function leerArgs(argv) {
  const o = { base: 'origin/main', todo: false, cortar: false, fetch: true, listar: false, condiciones: true, solo: '', profundidad: Infinity, importadores: false, rapido: false, conTipos: false, compartir: !process.env.CI };
  for (let i = 0; i < argv.length; i++) {
    const [k, v] = argv[i].split(/=(.*)/s);
    if (k === '--base') o.base = v !== undefined ? v : argv[++i];
    else if (k === '--todo') o.todo = true;
    else if (k === '--cortar') o.cortar = true;
    else if (k === '--sin-fetch') o.fetch = false;
    else if (k === '--sin-condiciones') o.condiciones = false;
    else if (k === '--listar') o.listar = true;
    else if (k === '--importadores') o.importadores = true;
    else if (k === '--rapido') { o.rapido = true; o.profundidad = 1; }
    else if (k === '--con-tipos') o.conTipos = true;
    else if (k === '--sin-compartir') o.compartir = false;
    else if (k === '--solo') o.solo = v !== undefined ? v : argv[++i];
    else if (k === '--profundidad') o.profundidad = Math.max(1, Number.parseInt(v !== undefined ? v : argv[++i], 10) || 1);
    else { process.stderr.write(`  [antes-de-subir] no conozco «${argv[i]}»\n`); o.ayuda = true; }
  }
  return o;
}

async function main(argv) {
  const o = leerArgs(argv);
  const out = (s = '') => process.stdout.write(s + '\n');
  // La línea final. Si el pre-push pasa MAKO_LINEA_VEREDICTO, también queda en ese archivo: el hook la repite como ÚLTIMA línea del push.
  const lineaFinal = (linea) => {
    out(linea);
    if (process.env.MAKO_LINEA_VEREDICTO) { try { writeFileSync(process.env.MAKO_LINEA_VEREDICTO, linea + '\n'); } catch { /* sólo es un espejo */ } }
  };
  if (o.ayuda) { out('node scripts/antes-de-subir.mjs [--base origin/main] [--todo] [--cortar] [--sin-fetch] [--sin-condiciones] [--solo guardas|tipos|tests] [--profundidad N] [--importadores] [--rapido [--con-tipos]] [--sin-compartir] [--listar]'); return 2; }
  process.chdir(RAIZ);

  const sha = git(['rev-parse', '--short=9', 'HEAD']).trim();
  if (o.fetch) {
    const f = spawnSync('git', ['fetch', 'origin', 'main'], { cwd: RAIZ, stdio: 'ignore', timeout: 30000 });
    if (f.status !== 0) out('  ⚠ no pude bajar origin/main (¿sin red?): sigo con la copia que tengo');
  }

  // La rama tiene que traer origin/main: si no, esto prueba tu punta contra un main que ya no es el de hoy.
  let sinMain = '';
  const haceFalta = o.base.startsWith('origin/');
  if (haceFalta && o.condiciones) {
    const atras = Number(git(['rev-list', '--count', `HEAD..${o.base}`]).trim());
    if (atras > 0) sinMain = `tu rama no tiene ${o.base} mergeado (le faltan ${atras} commits): git fetch origin && git merge ${o.base}, y volvé a correr`;
  }

  const plan = planear(o.base, { profundidad: o.profundidad });
  if (!plan) { lineaFinal(`ROJO: no encuentro la base «${o.base}» (probá git fetch origin)`); return 1; }
  const { cambios, sel } = plan;
  out(`[antes-de-subir] ${sha} · ${cambios.cambiados.length} archivos cambiados respecto de ${o.base}`);
  const alcance = alcanceTsc({ cambiados: cambios.cambiados, archivos: plan.archivos, importadoPor: sel.importadoPor, aumentan: sel.aumentan, importadores: o.importadores });
  if (o.listar) {
    imprimirPlan(plan, { base: o.base, explicar: false }, out);
    out(`  tsc acotado: ${alcance.length} archivos${alcance.length ? ' (' + alcance.slice(0, 4).join(', ') + (alcance.length > 4 ? '…' : '') + ')' : ''}`);
    return 0;
  }

  const rojos = [];
  const parar = () => rojos.length > 0 && !o.todo;
  let sinRam = false;
  let tiposSaltados = '';
  const t0 = Date.now();

  const toca = (etapa) => !o.solo || o.solo === etapa;
  if (toca('guardas')) {
    out('\n[1/3] guardas del push');
    const g = correrGuardas(out);
    if (!g.ok) rojos.push(g.porque);
  }

  if (toca('tipos') && !parar() && (!o.rapido || o.conTipos)) {
    out(`\n[2/3] tipos (tsc acotado a ${alcance.length} archivos)`);
    const t = await correrTsc(alcance, out);
    if (!t.ok) { rojos.push(t.porque); if (t.sinRam) sinRam = true; }
    if (t.saltado) tiposSaltados = t.saltado;
  }

  if (toca('tests') && !parar()) {
    out('\n[3/3] tests afectados');
    imprimirPlan(plan, { base: o.base, explicar: false }, out);
    const ag = agrupar(sel.tests, sel.compartibles, { compartir: o.compartir });
    const lista = ag.orden;
    const compartidos = ag.compartidos;
    if (lista.length === 0 && compartidos.length === 0) out('  Ningún test mira lo cambiado.');
    else {
      if (compartidos.length) out(`  ↳ ${compartidos.length} barredoras que sólo leen corren juntas en un proceso, con las lecturas en memoria`);
      const carpetaTmp = mkdtempSync(path.join(os.tmpdir(), 'antes-de-subir-'));
      const indice = indiceConNuevos(cambios.nuevos, carpetaTmp);
      const env = { ...process.env, ...(indice ? { GIT_INDEX_FILE: indice } : {}) };
      const r = await correrTests({ lista, compartidos, tanda: 6, concurrencia: 2, cortar: o.cortar, env, carpetaTmp, out });
      if (r.sinRam) { rojos.push(`tests: no hay RAM (quedan ${ramLibreGb().toFixed(1)} GB) — no se corrieron, no es un rojo de código`); sinRam = true; }
      else {
        rmSync(carpetaTmp, { recursive: true, force: true });
        out(`  ${r.rojos.size ? '✖' : '✔'} ${r.total.tests} tests de ${lista.length + compartidos.length} archivos · ${min(r.ms)} · RAM libre mínima ${Number.isFinite(r.ramMin) ? r.ramMin.toFixed(1) : '?'} GB`);
        if (r.flaky.length) out(`  ⚠ ${r.flaky.length} FLAKY (rojos con varios procesos o con otro test en el mismo proceso, verdes aislados; no frenan): ${r.flaky.join(', ')}`);
        if (r.rojos.size) rojos.push(`tests: ${[...r.rojos].map((f) => f.replace(/^tests\//, '')).slice(0, 6).join(', ')}${r.rojos.size > 6 ? '…' : ''}`);
      }
    }
  }

  // Una sola etapa nunca es un VERDE: no vale para pasarle una punta al Cerebro.
  if (o.solo) {
    out(`\n[antes-de-subir] ${min(Date.now() - t0)} · etapa «${o.solo}»`);
    lineaFinal(rojos.length ? `ROJO: ${rojos.join(' · ')}` : `PARCIAL (${o.solo}): sin rojos — no vale como VERDE, faltan las otras etapas`);
    return rojos.length ? (sinRam && rojos.length === 1 ? SALIDA_SIN_CORRER : 1) : 0;
  }

  // Con la profundidad recortada (sin --rapido) no se miró todo lo que se debía: tampoco es un VERDE para pasar una punta.
  if (Number.isFinite(o.profundidad) && !o.rapido) {
    out(`\n[antes-de-subir] ${min(Date.now() - t0)} en total · --profundidad ${o.profundidad}`);
    lineaFinal(rojos.length ? `ROJO: ${rojos.join(' · ')}` : `PARCIAL (--profundidad ${o.profundidad}): sin rojos — no vale como VERDE, quedaron afuera los importadores más lejanos`);
    return rojos.length ? (sinRam && rojos.length === 1 ? SALIDA_SIN_CORRER : 1) : 0;
  }

  // Las condiciones que NO son un chequeo pero sin las cuales el VERDE no vale.
  const sucios = sucio();
  if (o.condiciones && rojos.length === 0 && sucios.length) rojos.push(`el árbol tiene ${sucios.length} cambios sin commitear (${sucios.slice(0, 3).map((l) => l.slice(3)).join(', ')}${sucios.length > 3 ? '…' : ''}): un VERDE de acá no valdría para ${sha} — commitealos o sacalos y volvé a correr`);
  if (o.condiciones && rojos.length === 0 && sinMain) rojos.push(sinMain);

  out(`\n[antes-de-subir] ${min(Date.now() - t0)} en total`);
  // Sin RAM para el tsc acotado el VERDE sigue valiendo, pero lo dice: los tipos los decide Actions (que corre el tsc completo).
  // `--rapido` es el MÍNIMO que un jefe corre antes de pasar una punta (AGENTS.md): sin tipos y sin los importadores lejanos — los decide Actions —,
  // y la línea lo dice, para que el Cerebro sepa qué se miró.
  if (rojos.length === 0) { lineaFinal(`VERDE ${sha}${o.rapido ? (o.conTipos && !tiposSaltados ? ' (rápido: sin importadores lejanos; los chequea Actions)' : ' (rápido: sin tipos ni importadores lejanos; los chequea Actions)') : tiposSaltados ? ' (tipos: los chequea Actions)' : ''}`); return 0; }
  lineaFinal(`ROJO: ${rojos.join(' · ')}`);
  return sinRam && rojos.length === 1 ? SALIDA_SIN_CORRER : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { soltarLock(); process.stderr.write(`  [antes-de-subir] error inesperado: ${e?.stack ?? e}\n`); console.log(`ROJO: error inesperado del script (${String(e?.message ?? e).split('\n')[0]})`); process.exit(1); });
}
