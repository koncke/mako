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
//     cambiado (profundidad 1) + todas las barredoras + los tipos de lo cambiado SI ENTRAN EN RAM SIN ESPERAR (20 s; `--sin-tipos` los apaga): 3 min 28 s
//     sin tipos, en total. Le deja a Actions los importadores a 2+ saltos (y los tipos si no entraron: la línea lo dice); el replay
//     (`replay-fallos-ci.mjs --rapido`) dice qué cubre: 19 de los 20 rojos de «Tests» y los 5 de «Tipos» (3 de ellos sólo con los tipos incluidos).
//     ⚠️ Los tipos se incluyen POR DEFECTO aunque el pedido era «sin tsc»: 3 de los 25 rojos de Actions eran errores de tipos de archivos CAMBIADOS, y los 5
//     que tuvo el test de este mismo script al armarlo los vio sólo el modo completo — un VERDE rápido sin tipos los habría dejado pasar.
//   ⚠️ Antes de compartir procesos (abajo) la misma punta tardaba 26 min con 388 archivos, y el modo rápido 9 min 23 s.
//
// POR QUÉ ES RÁPIDO: los tests que no tocan estado global corren JUNTOS en UN proceso (`--test-isolation=none`) con las lecturas de archivos en
// memoria (scripts/cache-lecturas.cjs). El costo no era el regex: ~68 barredoras leen los mismos ~5.400 archivos y con `node --test` cada archivo de
// test es un proceso aparte que los vuelve a leer. Medido: 12 barredoras globales, 193 s separadas y 40 s juntas; la SUITE ENTERA (1.050 tests
// compartibles, 10.905 casos) en 2 procesos, 260 s, 0 rojos. Todo rojo de un proceso compartido se REPITE aislado antes de contarlo (puede ser
// interferencia: `editor-landing-origen` falló una vez porque otro test había dejado algo que hacía creer a lib/app-url.ts que corría «en el
// navegador»). Riesgo que queda: un FALSO VERDE por contagio — por eso Actions sigue corriendo cada test en su proceso.
//
// LA SALIDA ES UNA LÍNEA, la última, y TIENE QUE ALCANZAR SOLA (es lo único que se lee de un push):
//   VERDE <sha>
//   ROJO: <qué> · RAM libre mínima <N> GB · detalle: <carpeta>
//   SIN CHEQUEAR <sha>: <qué> — NO es un rojo del código · RAM libre mínima <N> GB · detalle: <carpeta>
// La palabra ROJO sólo aparece si hay algo CONFIRMADO roto: un archivo cuyo proceso murió sin ejecutar un test no se sabe si está
// roto, y va en la línea SIN CHEQUEAR (exit 99). El 30/10/2026 un grupo de 495 barredoras murió sin correr un solo test y el
// veredicto escribió los 495 nombres detrás de «ROJO»: medio día de buscar fantasmas, con dos rojos de verdad escondidos entre ellos.
// La RAM MÍNIMA va en la misma línea porque es lo que dice si creerle (con 0,7 GB libres, no), y la carpeta del detalle se conserva
// cuando la corrida termina en rojo o en 99 (si da verde se borra).
// El VERDE sólo vale si (a) el árbol está LIMPIO (lo que probaste es lo que viaja: un archivo nuevo sin
// commitear se ve acá pero no llega a la integración) y (b) tu rama TIENE origin/main mergeado (si no, probaste
// contra una versión vieja de lo que hicieron los demás). Por eso el chat le pasa al Cerebro SU PUNTA Y ESA LÍNEA,
// y el Cerebro no integra una punta sin ella. Exit: 0 verde · 1 rojo CONFIRMADO · 99 no se pudo chequear (falta de
// RAM, el turno que no tocó, o un proceso que murió sin juzgar un test: no es un rojo de código — cerrá chats o esperá).
//
// Uso:  node scripts/antes-de-subir.mjs [--base origin/main] [--todo] [--cortar] [--sin-fetch] [--listar]
//   --listar: sólo el plan (qué tests y qué archivos de tipos), no corre nada · --sin-fetch: no baja origin/main antes
//   --sin-condiciones: no exige árbol limpio ni origin/main mergeado (lo usa el pre-push, que ya sabe qué commit sube)
//   --rapido [--sin-tipos]: el modo rápido (arriba) · --sin-compartir: cada test en su proceso, como `npm test`.
//   --importadores: el tsc acotado suma, además de lo cambiado, a quienes lo importan (un nivel).
//   MAKO_TIPOS_ESPERA_S=<segundos>: cuánto espera RAM para los tipos antes de decir «los chequea Actions» (default 90). Esa espera, como la de los tests,
//     es SIN el candado de lo pesado: si no hay RAM al llegar el turno, lo suelta, espera, y vuelve a hacer fila (esperarRamSinRetener).
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
// los otros 14 los elige lo que tocaron. Por eso corre acá y en Actions primero, y el resto después (antes integracion.yml; hoy la suite de cada noche, semanal-tests.yml).
// =============================================================================

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { armarTsconfig } from './tsc-acotado.mjs';
import { veredicto } from './tsc-bitacoras.mjs';
import { describirEstado, estado, tomarTurno } from './candado-pesado.mjs';
import { lineasDelAviso, pendientesVencidos } from './pendientes-vencidos.mjs';
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

/**
 * Heap según cuántos archivos hay que compilar. ⚠️ El `tsc` suma TODO lo que esos archivos importan, y en este repo un solo archivo de app/ o lib/ ya arrastra ~1.800
 * archivos y ~2,5 GB (medido el 17/10/2026: 1 archivo → 1.835 archivos y 2.533 MB; 10 → 2.196 y 2.729 MB; 60 → 3.476 y 2.514 MB, 96 s). Con un tope de 2 GB (lo que
 * había puesto antes para alcances chicos) el `tsc` moría sin heap a partir de ~10 archivos, y eso se leía como «no terminó» y se SALTABA: los tipos casi nunca se
 * chequeaban. Por eso el mínimo es 3 GB (y el piso de RAM, ~4 GB: en una PC con 14 chats abiertos los tipos se van a saltar seguido, y lo dice la línea final).
 */
export const heapPara = (n) => (n > 600 ? 5120 : n > 120 ? 4096 : 3072);
const pisoTsc = (heapMb) => (() => heapMb / 1024 + 0.1 + ZONA_ROJA_VIGIA_GB);

// ⚠️ EL TIPO NO ES UN CANDADO QUE SE ARREGLE ESPERANDO (17/10/2026). El primer push del Cerebro con el pre-push nuevo se trabó en
// «tipos (188 archivos)»: pedía 4,3 GB y la PC, con ~14 chats abiertos, tenía 1,3 libres. Ahora el paso espera poco (90 s) y, si no
// entra, DICE «tipos: los chequea Actions» y sigue con los tests — el tsc completo de Actions corre justo después de los afectados.
// «El gate tiene que poder correr en esta PC con 14 chats abiertos; si no, nadie lo va a usar.»
const ESPERA_TIPOS_MS = (Number(process.env.MAKO_TIPOS_ESPERA_S) || 90) * 1000;

/** Lo que `esperarRam` espera como máximo si nadie le dice otra cosa (el de tests-afectados: 15 min). */
const ESPERA_RAM_DEFECTO_MS = 15 * 60 * 1000;

/** Hasta acá una espera de RAM se hace CON el candado en la mano (no vale perder el lugar en la fila por 20 s). */
const ESPERA_CORTA_MS = 30 * 1000;

/**
 * Un `esperarRam` que NO retiene el candado de lo pesado mientras espera RAM. ⚠️ El 21/10/2026 un `--solo tipos` con MAKO_TIPOS_ESPERA_S=1500 tuvo el
 * candado 25 min esperando 4 GB que no había (la app de Claude ocupaba 4,3 y Chrome 2), con cuatro chats detrás que quizás necesitaban 1,3. Quien espera
 * RAM no está usando RAM: el candado es para lo que SÍ la usa. Tiene que valer para cualquier paso que espere RAM (los tipos y los dos de tests), así que se arma una vez
 * y se le pasa a los tres. Invariante: si devuelve > 0, el candado está en la mano; si devuelve 0, no (y el paso siguiente que necesite RAM vuelve a esperarla por su cuenta).
 *   1. Con el candado: ¿hay RAM AHORA? (sin esperar y sin soltar nada): sigue con él, como siempre.
 *   2. No hay: SUELTA el candado (el siguiente de la fila avanza) y espera la RAM sin él, con el tope de ESTE paso (los tipos del --rapido esperan 20 s; los tests, 15 min).
 *   3. Si aparece, vuelve a hacer fila (al final: ya cedió el turno) y, con el turno en la mano, vuelve a 1: confirma que la RAM SIGUE (se pudo ir en la fila).
 *   4. Si no aparece en el tope: devuelve 0, SIN candado. Un paso que no es esencial (los tipos: «los chequea Actions») sigue; el que sí (los tests) espera con SU tope.
 * Sin cómo hacer fila en `ctx` (Actions, `--ya-tengo-el-candado`, MAKO_SIN_COLA) espera como siempre. Todo se inyecta para probarlo sin RAM ni cola de verdad.
 * ⚠️ La primera versión marcaba «sin candado» para siempre al vencer UNA espera: los tipos del --rapido vencían a los 20 s y los tests, que esperan 15 min, salían «no hay RAM» sin esperar (exit 99).
 * `ctx.motivo` dice por qué devolvió 0: 'ram' (no apareció en el tope) o 'fila' (el turno no le tocó al volver a hacer fila: NO es la RAM; el mensaje tiene que decirlo).
 * @param {{ candado: { soltar: () => unknown } | null, tomar?: (() => Promise<any>) | null, motivo?: string | null }} ctx candado vigente (o null: ya lo solté) y cómo volver a hacer fila
 * @param {{ esperar?: typeof esperarRam, aviso?: (t: string) => void, ahora?: () => number }} [o]
 * @returns {typeof esperarRam}
 */
export function esperarRamSinRetener(ctx, { esperar = esperarRam, aviso = () => {}, ahora = Date.now } = {}) {
  return async (concurrencia, opciones = {}) => {
    ctx.motivo = null;
    if (!ctx.tomar) return esperar(concurrencia, opciones);
    const tope = opciones.esperaMaxMs ?? ESPERA_RAM_DEFECTO_MS;
    // Una espera CORTA (los tipos del --rapido: 20 s) no vale soltar el turno: se perdería el lugar en la fila aunque los tests, que piden menos RAM, entren. Sólo con el candado en la mano.
    if (ctx.candado && tope <= ESPERA_CORTA_MS) return esperar(concurrencia, opciones);
    // ⚠️ El tope cuenta sólo el tiempo ESPERANDO RAM, NO el de la fila: tras 20 min de fila un bajón momentáneo de RAM daba 0 de inmediato y se perdía toda la fila (revisión del Cerebro).
    let gastado = 0;
    for (;;) {
      if (ctx.candado) {
        const c = await esperar(concurrencia, { ...opciones, esperaMaxMs: 0 });
        if (c > 0) return c;
        try { ctx.candado.soltar(); } catch { /* ya estaba suelto */ }
        ctx.candado = null;
        aviso('no hay RAM: suelto el candado mientras espero, así los que están detrás siguen (al haber vuelvo a hacer fila)');
      }
      const desde = ahora();
      const e = await esperar(concurrencia, { ...opciones, esperaMaxMs: Math.max(0, tope - gastado) });
      gastado += ahora() - desde;
      if (e === 0) { ctx.motivo = 'ram'; return 0; }
      const turno = await ctx.tomar();
      if (turno.vencio) { ctx.motivo = 'fila'; return 0; }
      ctx.candado = turno;
    }
  };
}

async function correrTsc(alcance, out, esperaMs = ESPERA_TIPOS_MS, esperar = esperarRam, motivoSinRam = null) {
  if (alcance.length === 0) { out('  ✔ ningún .ts/.tsx cambió: nada que compilar'); return { ok: true }; }
  const heap = heapPara(alcance.length);
  const saltar = (porque) => { out(`  ⚠ tipos: los chequea Actions (${porque})`); return { ok: true, saltado: porque }; };
  // ⚠️ UN SOLO ORDEN DE CANDADOS: lo pesado (la RAM) → el lock de typecheck. Con el lock de typecheck tomado ANTES, al soltar lo pesado esperando RAM se volvía a la fila con ese lock en la mano y el
  // que recibía lo pesado quedaba bloqueado por él, ocioso, hasta su esperaMs (revisión del Cerebro). Se espera la RAM primero; el lock de typecheck sólo se toma con lo pesado en la mano.
  const c = await esperar(1, { pisoGb: pisoTsc(heap), quien: 'antes-de-subir', esperaMaxMs: esperaMs });
  if (c === 0) return saltar(motivoSinRam?.() === 'fila' ? 'el turno del candado no me tocó al volver a hacer fila: no es la RAM' : `no hay RAM: quedan ${ramLibreGb().toFixed(1)} GB y el tsc acotado pide ${pisoTsc(heap)(1).toFixed(1)}`);
  if (!(await tomarLock(esperaMs))) return saltar('otro typecheck está corriendo y no se liberó');
  try {
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

// ---------------------------------------------------------------------------
// Dónde queda el DETALLE de la corrida (los logs que separan al caído por memoria del roto de verdad)
// ---------------------------------------------------------------------------
// ⚠️ NO EN `os.tmpdir()`. El 23/10/2026 un VERDE murió con `ENOENT … antes-de-subir-XXXX\compartido-1.log`: su carpeta de `%TEMP%`
// desapareció a mitad de la corrida (otra sesión poda `%TEMP%`). Y el 30/10, con 495 barredoras reportadas como rojas sin haber
// corrido, el log del reintento aislado —el ÚNICO que dice cuál murió por memoria y cuál está roto de verdad— ya no existía cuando
// se fue a leer: antes-de-subir lo borraba al terminar. Ahora vive al lado de lo demás que sobrevive a la sesión (~/.claude),
// se CONSERVA si la corrida da rojo o 99 (y su ruta va EN la línea del veredicto), y se borra si da verde: lo que nadie va a mirar
// no ocupa disco. Se guardan las últimas CORRIDAS_QUE_SE_GUARDAN.
export const CORRIDAS_QUE_SE_GUARDAN = 5;
export const casaDelDetalle = (casa = process.env.MAKO_DETALLE_DIR) => casa || path.join(os.homedir(), '.claude', 'antes-de-subir');

/**
 * Crea la carpeta de ESTA corrida y poda las viejas. El nombre empieza con la fecha en ISO, así que ordenar por nombre es ordenar por fecha.
 * @param {{ casa?: string, sha?: string, sello?: string, guardar?: number, fs?: { mkdirSync: typeof mkdirSync, readdirSync: typeof readdirSync, rmSync: typeof rmSync } }} [o]
 */
export function carpetaDeLaCorrida({ casa = casaDelDetalle(), sha = '?', sello = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19), guardar = CORRIDAS_QUE_SE_GUARDAN, fs = { mkdirSync, readdirSync, rmSync } } = {}) {
  const nombre = `${sello}-${sha}`;
  const dir = path.join(casa, nombre);
  fs.mkdirSync(dir, { recursive: true });
  try {
    const viejas = fs.readdirSync(casa).filter((n) => n !== nombre).sort();
    for (const n of viejas.slice(0, Math.max(0, viejas.length - (guardar - 1)))) fs.rmSync(path.join(casa, n), { recursive: true, force: true });
  } catch { /* la poda es de cortesía: nunca frena una corrida */ }
  return dir;
}

/** La de arriba, pero si `~/.claude` no se puede escribir cae al temporal de siempre (con el riesgo de poda que eso tiene). */
function carpetaDelDetalle(sha) {
  try { return carpetaDeLaCorrida({ sha }); } catch { return mkdtempSync(path.join(os.tmpdir(), 'antes-de-subir-')); }
}

// ---------------------------------------------------------------------------
// La LÍNEA del veredicto: la última del push, y lo único que se lee
// ---------------------------------------------------------------------------
/**
 * De los DOS montones —`rojos` (CONFIRMADOS: corrieron y fallaron) y `sinChequear` (no se pudo: sin RAM, sin turno, o un proceso que
 * murió sin juzgar un test)— sale la línea y el código de salida. Las reglas, todas aprendidas de un push que mintió:
 *   · un rojo CONFIRMADO siempre gana (exit 1): si hay algo roto, no se sube — pero la línea avisa que la lista puede estar incompleta;
 *   · sin ningún rojo, lo que no se pudo chequear sale con 99 y la línea NO lleva la palabra ROJO (30/10/2026: 495 nombres detrás de
 *     «ROJO» por un grupo que no había corrido un solo test, y medio día de buscar fantasmas);
 *   · todo lo que no es un VERDE lleva pegados la RAM MÍNIMA (es lo que dice si creerle) y la RUTA del detalle: la línea tiene que
 *     alcanzar sola, sin subir doce líneas del log.
 * `aviso` es lo que hay que saber aunque todo esté verde (los pendientes vencidos): va pegado a la línea, porque la línea es lo único que se lee.
 * @param {{ sha?: string, rojos?: string[], sinChequear?: string[], ramMin?: number, detalle?: string, parcial?: { que: string, porque: string } | null, sufijoVerde?: string, aviso?: string }} p
 * @returns {{ linea: string, codigo: number, guardarDetalle: boolean }}
 */
export function armarVeredicto({ sha = '?', rojos = [], sinChequear = [], ramMin = Infinity, detalle = '', parcial = null, sufijoVerde = '', aviso = '' } = {}) {
  const cola = [
    Number.isFinite(ramMin) ? `RAM libre mínima ${ramMin.toFixed(1)} GB` : null,
    detalle ? `detalle: ${detalle}` : null,
  ].filter(Boolean).join(' · ');
  const pegar = (l, c) => (c ? `${l} · ${c}` : l);
  const con = (l) => pegar(pegar(l, cola), aviso);
  if (rojos.length) {
    const ademas = sinChequear.length ? ` · ⚠ y ADEMÁS ${sinChequear.join(' · ')}: la lista de rojos puede estar incompleta` : '';
    return { linea: con(`ROJO: ${rojos.join(' · ')}${ademas}`), codigo: 1, guardarDetalle: true };
  }
  if (sinChequear.length) {
    const cierre = parcial ? `, y tampoco un VERDE: ${parcial.porque}` : ': volvé a correrlo con menos chats abiertos, o pusheá dejándole el chequeo a Actions';
    return { linea: con(`SIN CHEQUEAR ${sha}: ${sinChequear.join(' · ')} — NO es un rojo del código${cierre}`), codigo: SALIDA_SIN_CORRER, guardarDetalle: true };
  }
  if (parcial) return { linea: pegar(`PARCIAL ${parcial.que}: sin rojos — no vale como VERDE, ${parcial.porque}`, aviso), codigo: 0, guardarDetalle: false };
  return { linea: pegar(`VERDE ${sha}${sufijoVerde}`, aviso), codigo: 0, guardarDetalle: false };
}

/** Lo que el árbol tiene sin commitear (modificado, borrado o NUEVO sin git): un VERDE sobre eso no vale para el sha. */
export function sucio() {
  return execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter(Boolean);
}

/** La cuenta que firma los commits (`Claude-Cuenta:`): la primera línea de ~/.claude/cuenta-activa.txt. */
export function cuentaActiva() {
  if (process.env.MAKO_CUENTA) return process.env.MAKO_CUENTA;
  try { return readFileSync(path.join(os.homedir(), '.claude', 'cuenta-activa.txt'), 'utf8').split('\n')[0].trim() || '?'; } catch { return '?'; }
}

/**
 * Trae `origin/main` a la rama con un MERGE (nunca rebase: el commit del jefe no se reescribe). Se llama al TOMAR el candado, no antes: el que esperó
 * 40 min vuelve con main 40 min más adelante, y como el Cerebro pushea seguido su VERDE salía ROJO sólo por «te faltan N commits de main» (medido el
 * 20/10: Onboarding corrió el VERDE tres veces, con los 2.563 tests en verde). Si choca, se ABORTA el merge (la rama queda como estaba) y se dice en
 * qué archivos. Con `fetch: false` usa el `origin/main` que ya hay. Para probarlo con un repo de mentira: `cwd`.
 * El `fetch` se REINTENTA: los worktrees comparten un solo `.git`, y con una docena de chats bajando a la vez un fetch puede chocar con el lock del otro
 * (o con la red) sin que nada esté roto; la primera vez que corrió con el candado nuevo (20/10) falló una vez y avisó sin decir por qué.
 * @returns {{ ok: boolean, mergeado: boolean, atras: number, archivos?: string[], aviso?: string }}
 */
export function traerMain({ cwd = RAIZ, base = 'origin/main', cuenta = '?', fetch = true, reintentos = 3, pausaMs = 2000 } = {}) {
  // Un GIT_INDEX_FILE heredado (el índice temporal de los tests) haría el merge sobre otro índice.
  const env = { ...process.env };
  for (const k of ['GIT_INDEX_FILE', 'GIT_DIR', 'GIT_WORK_TREE']) delete env[k];
  const g = (args, extra = {}) => spawnSync('git', args, { cwd, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024, ...extra });
  const [remoto, ...resto] = base.split('/');
  let aviso;
  if (fetch) {
    let f;
    for (let intento = 1; intento <= reintentos; intento++) {
      f = g(['fetch', remoto, resto.join('/')], { timeout: 60000 });
      if (f.status === 0) break;
      if (intento < reintentos) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, pausaMs * intento);
    }
    if (f.status !== 0) {
      const lineas = String(f.stderr ?? '').trim().split('\n').filter(Boolean);
      const motivo = f.error?.code === 'ETIMEDOUT' ? 'tardó más de 60 s' : (lineas.find((l) => /^(fatal|error):/.test(l)) ?? lineas.pop() ?? `salió con ${f.status}`).slice(0, 160);
      aviso = `no pude bajar ${base} tras ${reintentos} intentos (${motivo}): sigo con la copia que tengo`;
    }
  }
  const atras = Number(g(['rev-list', '--count', `HEAD..${base}`]).stdout.trim()) || 0;
  if (atras === 0) return { ok: true, mergeado: false, atras: 0, aviso };
  const rama = g(['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
  const mensaje = `Merge remote-tracking branch '${base}' into ${rama === 'HEAD' ? 'la punta' : rama}\n\nAl tomar el candado de lo pesado (scripts/antes-de-subir.mjs).\n\nCo-Authored-By: Claude <noreply@anthropic.com>\nClaude-Cuenta: ${cuenta}\n`;
  // Una PC sin user.email (un clon nuevo, un worktree de otra cuenta) no puede commitear el merge, y eso NO es un choque: se firma con la identidad de Claude.
  const sinIdentidad = !g(['config', 'user.email']).stdout.trim();
  const m = g([...(sinIdentidad ? ['-c', 'user.name=Claude', '-c', 'user.email=noreply@anthropic.com'] : []), 'merge', '-m', mensaje, base]);
  if (m.status === 0) return { ok: true, mergeado: true, atras, aviso };
  const archivos = g(['diff', '--name-only', '--diff-filter=U']).stdout.split('\n').filter(Boolean);
  g(['merge', '--abort']);
  return { ok: false, mergeado: false, atras, archivos, aviso, detalle: `${m.stdout ?? ''}${m.stderr ?? ''}`.trim().split('\n').slice(-3).join(' | ') };
}

function leerArgs(argv) {
  const o = { base: 'origin/main', todo: false, cortar: false, fetch: true, listar: false, condiciones: true, solo: '', profundidad: Infinity, importadores: false, rapido: false, conTipos: true, compartir: !process.env.CI, cola: false, merge: true, yaTengoElCandado: false };
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
    else if (k === '--sin-tipos') o.conTipos = false;
    else if (k === '--sin-compartir') o.compartir = false;
    else if (k === '--cola') o.cola = true;
    else if (k === '--sin-merge') o.merge = false;
    else if (k === '--ya-tengo-el-candado') o.yaTengoElCandado = true;
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
  if (o.ayuda) { out('node scripts/antes-de-subir.mjs [--base origin/main] [--todo] [--cortar] [--sin-fetch] [--sin-condiciones] [--solo guardas|tipos|tests] [--profundidad N] [--importadores] [--rapido [--sin-tipos]] [--sin-compartir] [--listar] [--cola] [--sin-merge] [--ya-tengo-el-candado]'); return 2; }
  process.chdir(RAIZ);

  // Ver quién tiene el candado y cómo está la fila, sin tocar nada.
  if (o.cola) { out('[antes-de-subir] el candado de lo pesado:'); out(describirEstado(estado())); return 0; }

  // ⚠️ EL CANDADO DE LO PESADO, CON COLA (20/10/2026): ver scripts/candado-pesado.mjs. Se toma ANTES de lo pesado (los tipos y los tests), nunca para `--listar`
  // ni para las guardas solas; en Actions (CI) no hace falta; MAKO_SIN_COLA=1 lo saltea; `--ya-tengo-el-candado` es para quien lo tomó a mano (el viejo mkdir).
  const conCandado = !o.listar && o.solo !== 'guardas' && !process.env.CI && !process.env.MAKO_SIN_COLA && !o.yaTengoElCandado;
  // `ctx.candado` es el candado QUE TENGO AHORA (null si no hice fila o si lo solté esperando RAM: ver esperarRamSinRetener); `ctx.tomar` vuelve a hacer fila con los mismos datos.
  /** @type {{ candado: { soltar: () => unknown } | null, tomar: (() => Promise<any>) | null, motivo: string | null }} */
  const ctx = { candado: null, tomar: null, motivo: null };
  let yaTraje = false;
  if (conCandado) {
    // Un árbol sucio no puede tener VERDE: no se hace fila para enterarse de eso al final.
    if (o.condiciones) {
      const s = sucio();
      if (s.length) { lineaFinal(`ROJO: el árbol tiene ${s.length} cambios sin commitear (${s.slice(0, 3).map((l) => l.slice(3)).join(', ')}${s.length > 3 ? '…' : ''}): un VERDE de acá no valdría para el sha — commitealos o sacalos y volvé a correr (no hice fila por esto)`); return 1; }
    }
    // Las guardas del push son baratas (~10 s, ~300 MB; el pre-push las corre sin candado en cada push): se corren ANTES de hacer fila. El 21/10 una guarda
    // frenó un VERDE en 7 s pero DESPUÉS de 25 min de espera. Se vuelven a correr ya mergeado main (puede traer guardas y archivos nuevos).
    if (!o.solo) {
      out('[antes-de-subir] guardas del push, antes de hacer fila (un rojo acá no cuesta espera)…');
      const g = correrGuardas(out);
      if (!g.ok) { lineaFinal(`ROJO: ${g.porque} (no hice fila por esto)`); return 1; }
    }
    const rama = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    const datos = { chat: `${path.basename(RAIZ)} · ${rama}`, cuenta: cuentaActiva(), sha: git(['rev-parse', '--short=9', 'HEAD']).trim(), comando: `antes-de-subir ${argv.join(' ')}`.trim() };
    out('[antes-de-subir] candado de lo pesado: anotándome en la fila…');
    const turno = await tomarTurno({ datos, aviso: (t) => out(`  ${t}`) });
    // Sale con 99, así que la línea NO puede empezar con ROJO: es lo único que se lee del push, y «ROJO» manda a buscar un bug que no existe.
    if (turno.vencio) { lineaFinal(`SIN CHEQUEAR: esperé el candado de lo pesado ${Math.round(turno.esperoMs / 60000)} min y no me tocó — NO es un rojo del código: mirá quién lo tiene con --cola`); return SALIDA_SIN_CORRER; }
    ctx.candado = turno;
    ctx.tomar = () => tomarTurno({ datos, aviso: (t) => out(`  ${t}`) });
    const soltarYa = () => { try { ctx.candado?.soltar(); } catch { /* ya está suelto */ } };
    process.on('exit', soltarYa);
    for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { soltarYa(); process.exit(130); });
    out(`  ✔ candado tomado${turno.esperoMs > 1500 ? ` (esperé ${Math.round(turno.esperoMs / 60000)} min ${Math.round((turno.esperoMs % 60000) / 1000)} s)` : ''}`);
    // AL TOMARLO: traer origin/main (merge, nunca rebase), para que el VERDE no salga ROJO sólo porque main avanzó mientras esperabas.
    if (o.condiciones && o.merge && o.base.startsWith('origin/')) {
      const m = traerMain({ base: o.base, cuenta: cuentaActiva(), fetch: o.fetch });
      if (m.aviso) out(`  ⚠ ${m.aviso}`);
      if (!m.ok) {
        ctx.candado.soltar();
        lineaFinal(m.archivos.length
          ? `ROJO: el merge de ${o.base} chocó en ${m.archivos.length} archivo(s): ${m.archivos.slice(0, 5).join(', ')}${m.archivos.length > 5 ? '…' : ''} — la rama quedó como estaba y solté el candado; mergeá a mano (git merge ${o.base}), resolvé y volvé a correr`
          : `ROJO: no pude mergear ${o.base} (no es un choque de archivos): ${m.detalle || 'git no dijo por qué'} — la rama quedó como estaba y solté el candado`);
        return 1;
      }
      yaTraje = true;
      if (m.mergeado) out(`  ✔ mergeé ${o.base} (+${m.atras} commits): el VERDE vale para el sha NUEVO`);
    }
  }
  try { return await ejecutar(o, out, lineaFinal, { yaTraje, ctx }); }
  finally { try { ctx.candado?.soltar(); } catch { /* ya está suelto */ } }
}

async function ejecutar(o, out, lineaFinal, { yaTraje = false, ctx = { candado: null, tomar: null, motivo: null } } = {}) {
  // Todo paso que espera RAM la espera SIN el candado (ver esperarRamSinRetener): los tipos y los dos de tests.
  const esperar = esperarRamSinRetener(ctx, { aviso: (t) => out(`  ⚠ ${t}`) });
  const sha = git(['rev-parse', '--short=9', 'HEAD']).trim();
  if (o.fetch && !yaTraje) {
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
    out('[antes-de-subir] el candado de lo pesado (si lo corrieras ahora):');
    out(describirEstado(estado()));
    return 0;
  }

  const rojos = [];
  // Lo que NO SE PUDO CHEQUEAR (sale con 99, no con 1): la RAM que no apareció, el turno que no tocó, y los archivos cuyo proceso
  // murió sin juzgar un test. Va aparte de `rojos` a propósito: un rojo CONFIRMADO siempre le gana (si hay algo roto, no se sube), y
  // sin ningún rojo esto no puede llevar la palabra ROJO, que es lo único que lee quien pushea (30/10/2026).
  const sinChequear = [];
  const parar = () => rojos.length > 0 && !o.todo;
  let tiposSaltados = '';
  let ramMin = Infinity;        // la de la corrida de tests: va EN la línea del veredicto (con 0,7 GB libres, a un rojo no se le cree)
  let carpetaDetalle = '';      // dónde quedaron los logs completos; se borra si la corrida da verde
  let vencidos = null;          // pendientes de docs/pendientes.md que nombran un test que ya está verde (avisa, no frena)
  const t0 = Date.now();

  const toca = (etapa) => !o.solo || o.solo === etapa;
  if (toca('guardas')) {
    out('\n[1/3] guardas del push');
    const g = correrGuardas(out);
    if (!g.ok) rojos.push(g.porque);
  }

  if (toca('tipos') && !parar() && (!o.rapido || o.conTipos)) {
    out(`\n[2/3] tipos (tsc acotado a ${alcance.length} archivos)`);
    // En --rapido los tipos se intentan SIN esperar (20 s): si la RAM no alcanza ya, no se frena al jefe. Medido: 3 de los 25 rojos de Actions
    // eran errores de tipos de archivos CAMBIADOS, y los 5 que tuvo mi propio test al armar esto los vio sólo el modo completo.
    const t = await correrTsc(alcance, out, o.rapido ? 20 * 1000 : ESPERA_TIPOS_MS, esperar, () => ctx.motivo);
    if (!t.ok) (t.sinRam ? sinChequear : rojos).push(t.porque);
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
      carpetaDetalle = carpetaDelDetalle(sha);
      const indice = indiceConNuevos(cambios.nuevos, carpetaDetalle);
      const env = { ...process.env, ...(indice ? { GIT_INDEX_FILE: indice } : {}) };
      const r = await correrTests({ lista, compartidos, tanda: 6, concurrencia: 2, cortar: o.cortar, env, carpetaTmp: carpetaDetalle, out, esperar });
      ramMin = r.ramMin;
      if (r.sinRam) sinChequear.push(ctx.motivo === 'fila' ? 'tests: el turno del candado no me tocó al volver a hacer fila (no es la RAM) — no se corrieron, no es un rojo de código' : `tests: no hay RAM (quedan ${ramLibreGb().toFixed(1)} GB) — no se corrieron, no es un rojo de código`);
      else {
        const nombres = (s) => `${[...s].map((f) => f.replace(/^tests\//, '').replace(/\.test\.ts$/, '')).slice(0, 6).join(', ')}${s.size > 6 ? `…y ${s.size - 6} más` : ''}`;
        out(`  ${r.rojos.size ? '✖' : r.sinCorrer.size ? '⚠' : '✔'} ${r.total.tests} tests de ${lista.length + compartidos.length} archivos · ${min(r.ms)} · RAM libre mínima ${Number.isFinite(r.ramMin) ? r.ramMin.toFixed(1) : '?'} GB`);
        if (r.flaky.length) out(`  ⚠ ${r.flaky.length} FLAKY (rojos con varios procesos o con otro test en el mismo proceso, verdes aislados; no frenan): ${r.flaky.join(', ')}`);
        if (r.rojos.size) rojos.push(`tests: ${nombres(r.rojos)}`);
        // ⚠️ NO CORRER NO ES FALLAR (30/10/2026): un archivo cuyo proceso murió sin juzgar un solo test no se sabe si está roto, y
        // ponerlo detrás de la palabra ROJO manda a buscar fantasmas (495 nombres) y esconde a los que sí fallan.
        if (r.sinCorrer.size) sinChequear.push(`tests: ${r.sinCorrer.size} archivo(s) NO corrieron (su proceso murió sin juzgar un test): ${nombres(r.sinCorrer)}`);
        // ⚠️ PENDIENTES VENCIDOS, GRATIS (30/10/2026): los tests que acabaron de correr VERDES ya están en la mano, así que cruzar
        // docs/pendientes.md con ellos no cuesta nada. Un pendiente que nombra un test verde está hecho y nadie lo borró: el 24/10 la
        // sección «Rojos en main sin dueño» quedó seis días con tres tests que se habían arreglado 95 minutos después de escribirla, y
        // el Cerebro los repartió a dos chats. AVISA, NUNCA frena: un test puede estar verde por el entorno (un clon atrasado).
        vencidos = pendientesVencidos({ raiz: RAIZ, verdes: r.verdes });
        for (const l of lineasDelAviso(vencidos)) out(l);
      }
    }
  }

  // El veredicto, con el detalle que se borra sólo si no hay nada que mirar (ver armarVeredicto).
  const cerrar = (parcial = null) => {
    // Sin RAM para el tsc acotado el VERDE sigue valiendo, pero lo dice: los tipos los decide Actions (que corre el tsc completo).
    // `--rapido` es el MÍNIMO que un jefe corre antes de pasar una punta (AGENTS.md): sin los importadores lejanos —los decide Actions—, y con los tipos
    // de lo cambiado sólo si entraron en RAM; la línea lo dice, para que el Cerebro sepa qué se miró.
    const sufijoVerde = o.rapido
      ? (o.conTipos && !tiposSaltados ? ' (rápido: tipos de lo cambiado sí; sin importadores lejanos: los chequea Actions)' : ' (rápido: sin tipos ni importadores lejanos; los chequea Actions)')
      : (tiposSaltados ? ' (tipos: los chequea Actions)' : '');
    // El aviso de los pendientes vencidos viaja EN la línea: si vive sólo doce líneas más arriba, nadie lo lee (es la lección del 30/10).
    const cuantos = (vencidos?.porVerde.length ?? 0) + (vencidos?.porFalta.length ?? 0);
    const aviso = cuantos ? `⚠ ${cuantos} pendiente(s) vencido(s) en docs/pendientes.md (línea${cuantos > 1 ? 's' : ''} ${[...(vencidos?.porVerde ?? []), ...(vencidos?.porFalta ?? [])].map((e) => e.linea).join(', ')}): el test ya está verde o no existe — cerralos` : '';
    const v = armarVeredicto({ sha, rojos, sinChequear, ramMin, detalle: carpetaDetalle, parcial, sufijoVerde, aviso });
    if (!v.guardarDetalle && carpetaDetalle) rmSync(carpetaDetalle, { recursive: true, force: true });
    lineaFinal(v.linea);
    return v.codigo;
  };

  // Una sola etapa nunca es un VERDE: no vale para pasarle una punta al Cerebro.
  if (o.solo) {
    out(`\n[antes-de-subir] ${min(Date.now() - t0)} · etapa «${o.solo}»`);
    return cerrar({ que: `(${o.solo})`, porque: 'faltan las otras etapas' });
  }

  // Con la profundidad recortada (sin --rapido) no se miró todo lo que se debía: tampoco es un VERDE para pasar una punta.
  if (Number.isFinite(o.profundidad) && !o.rapido) {
    out(`\n[antes-de-subir] ${min(Date.now() - t0)} en total · --profundidad ${o.profundidad}`);
    return cerrar({ que: `(--profundidad ${o.profundidad})`, porque: 'quedaron afuera los importadores más lejanos' });
  }

  // Las condiciones que NO son un chequeo pero sin las cuales el VERDE no vale.
  const sucios = sucio();
  if (o.condiciones && rojos.length === 0 && sucios.length) rojos.push(`el árbol tiene ${sucios.length} cambios sin commitear (${sucios.slice(0, 3).map((l) => l.slice(3)).join(', ')}${sucios.length > 3 ? '…' : ''}): un VERDE de acá no valdría para ${sha} — commitealos o sacalos y volvé a correr`);
  if (o.condiciones && rojos.length === 0 && sinMain) rojos.push(sinMain);

  out(`\n[antes-de-subir] ${min(Date.now() - t0)} en total`);
  return cerrar();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { soltarLock(); process.stderr.write(`  [antes-de-subir] error inesperado: ${e?.stack ?? e}\n`); console.log(`ROJO: error inesperado del script (${String(e?.message ?? e).split('\n')[0]})`); process.exit(1); });
}
