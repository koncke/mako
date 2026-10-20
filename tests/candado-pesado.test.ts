// =============================================================================
// scripts/candado-pesado.mjs — el candado de lo pesado, con COLA justa (y el merge de origin/main al tomarlo)
// =============================================================================
// Medido el 20/10/2026 por el Cerebro: el candado era un `mkdir C:/dev/pesado.lock` que cada chat reintentaba en su loop, y ganaba el que preguntaba más
// seguido — Pagos esperó casi DOS horas. Estas pruebas fijan lo que lo reemplaza: orden FIFO, un proceso muerto que no traba, compatibilidad con el
// mkdir a mano, y que al tomarlo se traiga origin/main (con merge, y sin dejar el repo a medias si choca).
//
// ⚠️ PROBADO ROMPIÉNDOLO (20/10/2026, medido: se rompe UNA pieza, se corren las 11 pruebas de este archivo, se restaura; 12 de 12 dieron rojo):
//   · la cola al revés (el más nuevo primero)                    → 1 roja (FIFO)
//   · ordenar el turno por pid en vez de por hora                → 1 roja (FIFO: los pids van al revés de la hora a propósito; la primera versión
//                                                                   de la prueba tenía los pids crecientes y esta rotura SALÍA VERDE)
//   · no limpiar los turnos de procesos muertos ni sin latido    → 1 roja (el muerto traba la fila)
//   · no limpiar al dueño muerto                                 → 1 roja
//   · el dueño nunca vence (se olvidó el candado, vive el pid)   → 1 roja
//   · pisar el candado a mano de otro (borrar cualquier dueño)   → 5 rojas (compatibilidad con el mkdir a mano, y todo lo que espera)
//   · soltar un candado que no es mío                            → 1 roja
//   · no firmar quien.txt (el formato que lee el que mira a mano)→ 1 roja
//   · traerMain que nunca mergea                                 → 2 rojas
//   · traerMain sin `merge --abort` (deja el merge a medias)     → 1 roja
//   · traerMain sin el trailer Claude-Cuenta                     → 1 roja
//   · traerMain que rebasea en vez de mergear                    → 2 rojas
// Además: una PC sin user.email no podía commitear el merge y eso se leía como «chocó en 0 archivos» → ahora se firma con la identidad de Claude y,
// si falla por otra cosa, el ROJO lo dice (la prueba corre en repos de mentira sin identidad, igual que esta PC).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { traerMain } from '../scripts/antes-de-subir.mjs';
import {
  anotarse, describirEstado, duenoVencido, estado, intentarTomar, leerCola, leerDueno, rutas, soltar, tomarTurno, VENCE_MS,
} from '../scripts/candado-pesado.mjs';

const nuevoDir = () => mkdtempSync(join(os.tmpdir(), 'candado-'));
const conDir = async (fn: (dir: string) => unknown | Promise<unknown>) => { const dir = nuevoDir(); try { await fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); } };
const VIVOS = () => true;

// ---------------------------------------------------------------------------
// La cola
// ---------------------------------------------------------------------------

test('FIFO: entra el que se anotó PRIMERO, aunque el último pregunte cien veces más seguido', () => conDir((dir) => {
  let t = 1_000_000;
  const ahora = () => t;
  // Los pids van AL REVÉS de la hora (el más viejo tiene el pid más alto): ordenar por pid en vez de por hora tiene que dar rojo.
  const PA = 303, PB = 202, PC = 101;
  const a = anotarse({ dir, datos: { chat: 'A' }, pid: PA, ahora }); t += 5;
  const b = anotarse({ dir, datos: { chat: 'B' }, pid: PB, ahora }); t += 5;
  const c = anotarse({ dir, datos: { chat: 'C' }, pid: PC, ahora });
  for (let i = 0; i < 50; i++) assert.equal(intentarTomar({ dir, turno: c, datos: { chat: 'C' }, pid: PC, vivo: VIVOS, ahora }).estado, 'espera', 'C pregunta sin parar y no pasa');
  const rb = intentarTomar({ dir, turno: b, datos: { chat: 'B' }, pid: PB, vivo: VIVOS, ahora });
  assert.deepEqual([rb.estado, (rb as { delante: number }).delante], ['espera', 1], 'B tiene uno delante: A');
  assert.equal(intentarTomar({ dir, turno: a, datos: { chat: 'A' }, pid: PA, vivo: VIVOS, ahora }).estado, 'tomado');
  const rb2 = intentarTomar({ dir, turno: b, datos: { chat: 'B' }, pid: PB, vivo: VIVOS, ahora });
  assert.deepEqual([rb2.estado, (rb2 as { delante: number }).delante], ['espera', 1], 'con A adentro, B sigue siendo el siguiente');
  assert.equal(soltar({ dir, pid: PB }), false, 'B no puede soltar lo de A');
  assert.equal(soltar({ dir, pid: PA }), true);
  assert.equal(intentarTomar({ dir, turno: c, datos: { chat: 'C' }, pid: PC, vivo: VIVOS, ahora }).estado, 'espera', 'libre, pero le toca a B, no a C');
  assert.equal(intentarTomar({ dir, turno: b, datos: { chat: 'B' }, pid: PB, vivo: VIVOS, ahora }).estado, 'tomado');
  soltar({ dir, pid: PB });
  assert.equal(intentarTomar({ dir, turno: c, datos: { chat: 'C' }, pid: PC, vivo: VIVOS, ahora }).estado, 'tomado', 'y por fin C');
}));

test('un turno de un proceso MUERTO no traba a los que vienen detrás (y un turno que dejó de latir, tampoco)', () => conDir((dir) => {
  let t = 2_000_000;
  const ahora = () => t;
  const muerto = anotarse({ dir, datos: { chat: 'muerto' }, pid: 4242, ahora }); t += 5;
  const vivo = anotarse({ dir, datos: { chat: 'vivo' }, pid: 4343, ahora });
  const sinMuertos = (pid: number) => pid !== 4242;
  assert.equal(leerCola({ dir, vivo: sinMuertos, ahora }).length, 1, 'el turno del pid muerto se limpió solo');
  assert.equal(existsSync(muerto), false);
  assert.equal(intentarTomar({ dir, turno: vivo, datos: { chat: 'vivo' }, pid: 4343, vivo: sinMuertos, ahora }).estado, 'tomado');
  soltar({ dir, pid: 4343 });
  // un turno con pid «vivo» pero que no late hace más de 10 min también se limpia (la PC se durmió, el proceso quedó colgado)
  const colgado = anotarse({ dir, datos: { chat: 'colgado' }, pid: 4444 });
  const hace = new Date(Date.now() - 11 * 60_000);
  utimesSync(colgado, hace, hace);
  assert.equal(leerCola({ dir, vivo: VIVOS }).length, 0, 'sin latido, fuera');
}));

test('un turno al que le limpiaron el archivo se vuelve a anotar (al final) en vez de quedarse esperando para siempre', () => conDir((dir) => {
  const turno = anotarse({ dir, datos: { chat: 'X' }, pid: 501 });
  rmSync(turno);
  assert.equal(intentarTomar({ dir, turno, datos: { chat: 'X' }, pid: 501, vivo: VIVOS }).estado, 'sin-turno');
}));

// ---------------------------------------------------------------------------
// El candado, y el mkdir a mano de siempre
// ---------------------------------------------------------------------------

test('COMPATIBLE con el mkdir a mano: quien lo tomó así bloquea al que usa la cola, y al revés', () => conDir((dir) => {
  const { lock } = rutas(dir);
  mkdirSync(lock);
  writeFileSync(join(lock, 'quien.txt'), 'Pagos (claude4) tsc a mano — 20/10 21:00\n');
  const turno = anotarse({ dir, datos: { chat: 'Infra', cuenta: 'claude4' }, pid: 601 });
  const r = intentarTomar({ dir, turno, datos: { chat: 'Infra', cuenta: 'claude4' }, pid: 601, vivo: VIVOS });
  assert.equal(r.estado, 'espera', 'el candado a mano manda');
  assert.match(describirEstado(estado({ dir, vivo: VIVOS })), /A MANO/);
  rmSync(lock, { recursive: true });   // el chat de Pagos lo suelta como siempre
  assert.equal(intentarTomar({ dir, turno, datos: { chat: 'Infra', cuenta: 'claude4', comando: 'antes-de-subir --rapido' }, pid: 601, vivo: VIVOS }).estado, 'tomado');
  // y lo que firma es el formato de siempre (para quien lo mira a mano) más el dueno.json con el pid
  assert.match(readFileSync(join(lock, 'quien.txt'), 'utf8'), /^Infra \(claude4\) antes-de-subir --rapido — \d\d\/\d\d \d\d:\d\d\n$/);
  assert.equal(JSON.parse(readFileSync(join(lock, 'dueno.json'), 'utf8')).pid, 601);
  // mientras lo tiene la cola, un mkdir a mano falla: no se pisan
  assert.throws(() => mkdirSync(lock), /EEXIST/);
}));

test('un dueño que MURIÓ no traba: se limpia, y se anota', () => conDir((dir) => {
  const { lock } = rutas(dir);
  mkdirSync(lock);
  writeFileSync(join(lock, 'dueno.json'), JSON.stringify({ pid: 777, host: os.hostname(), desde: new Date().toISOString(), chat: 'Muerto' }));
  const turno = anotarse({ dir, datos: { chat: 'Vivo' }, pid: 701 });
  assert.equal(intentarTomar({ dir, turno, datos: { chat: 'Vivo' }, pid: 701, vivo: () => true }).estado, 'espera', 'con el dueño vivo y reciente: espera');
  assert.equal(intentarTomar({ dir, turno, datos: { chat: 'Vivo' }, pid: 701, vivo: (p: number) => p !== 777 }).estado, 'tomado', 'con el dueño muerto: lo limpia y entra');
  assert.match(readFileSync(rutas(dir).log, 'utf8'), /limpia-dueno pid 777/);
}));

test('un dueño que VENCIÓ (pasó VENCE_MS) también se limpia: vive, pero ya no es un trabajo, es un olvido', () => conDir((dir) => {
  const { lock } = rutas(dir);
  mkdirSync(lock);
  const viejo = new Date(Date.now() - VENCE_MS - 60_000).toISOString();
  writeFileSync(join(lock, 'dueno.json'), JSON.stringify({ pid: 888, host: os.hostname(), desde: viejo, chat: 'Olvidado' }));
  const turno = anotarse({ dir, datos: { chat: 'Yo' }, pid: 801 });
  assert.equal(intentarTomar({ dir, turno, datos: { chat: 'Yo' }, pid: 801, vivo: VIVOS }).estado, 'tomado');
}));

test('un candado tomado A MANO se libera sólo cuando vence (no se le puede preguntar si vive): joven espera, viejo se limpia', () => conDir((dir) => {
  const { lock } = rutas(dir);
  mkdirSync(lock);
  writeFileSync(join(lock, 'quien.txt'), 'alguien (claude1) a mano — 20/10 10:00\n');
  assert.equal(duenoVencido(leerDueno({ dir }), { vivo: VIVOS }), false, 'recién tomado');
  const hace = new Date(Date.now() - VENCE_MS - 60_000);
  utimesSync(join(lock, 'quien.txt'), hace, hace);
  assert.equal(duenoVencido(leerDueno({ dir }), { vivo: VIVOS }), true, 'de hace más de 90 min');
  const turno = anotarse({ dir, datos: { chat: 'Yo' }, pid: 901 });
  assert.equal(intentarTomar({ dir, turno, datos: { chat: 'Yo' }, pid: 901, vivo: VIVOS }).estado, 'tomado');
}));

test('tomarTurno de punta a punta: dos procesos, el segundo espera hasta que el primero suelta, sin pisarse', async () => conDir(async (dir) => {
  const pausa = () => new Promise<void>((r) => setTimeout(r, 5));
  const orden: string[] = [];
  const A = tomarTurno({ dir, datos: { chat: 'A' }, pid: 1001, vivo: VIVOS, pausa, sondeoMs: 5 }).then((t) => { orden.push('A entra'); return t; });
  await new Promise((r) => setTimeout(r, 30));
  const B = tomarTurno({ dir, datos: { chat: 'B' }, pid: 1002, vivo: VIVOS, pausa, sondeoMs: 5, aviso: (m: string) => { if (!orden.includes('B espera')) orden.push('B espera'); void m; } }).then((t) => { orden.push('B entra'); return t; });
  const a = await A;
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(orden, ['A entra', 'B espera'], 'B espera mientras A lo tiene');
  assert.equal(leerDueno({ dir })?.chat, 'A');
  a.soltar();
  const b = await B;
  assert.deepEqual(orden, ['A entra', 'B espera', 'B entra']);
  assert.equal(leerDueno({ dir })?.chat, 'B');
  b.soltar();
  assert.equal(existsSync(rutas(dir).lock), false, 'al terminar queda libre');
  assert.equal(leerCola({ dir, vivo: VIVOS }).length, 0, 'y sin turnos huérfanos');
}));

test('tomarTurno se cansa: pasado esperaMaxMs devuelve `vencio` y deja la fila limpia', async () => conDir(async (dir) => {
  const { lock } = rutas(dir);
  mkdirSync(lock);
  writeFileSync(join(lock, 'dueno.json'), JSON.stringify({ pid: process.pid, host: os.hostname(), desde: new Date().toISOString(), chat: 'Otro' }));
  const r = await tomarTurno({ dir, datos: { chat: 'Paciente' }, pid: 1101, vivo: VIVOS, pausa: () => new Promise<void>((x) => setTimeout(x, 2)), sondeoMs: 2, esperaMaxMs: 40 });
  assert.equal((r as { vencio?: boolean }).vencio, true);
  assert.equal(leerCola({ dir, vivo: VIVOS }).length, 0, 'se bajó de la fila');
}));

// ---------------------------------------------------------------------------
// Al tomar el candado: traer origin/main (merge), y si choca, dejar todo como estaba
// ---------------------------------------------------------------------------

const limpioDeGit = () => { const e: NodeJS.ProcessEnv = { ...process.env }; for (const k of ['GIT_INDEX_FILE', 'GIT_DIR', 'GIT_WORK_TREE']) delete e[k]; return e; };
const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=Prueba', '-c', 'user.email=prueba@example.com', '-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8', env: limpioDeGit() }).trim();

/** Un origin de mentira (bare) y una copia de trabajo; `otro` es «el Cerebro», que pushea a main por su lado. */
function armarRepos() {
  const raiz = nuevoDir();
  const origen = join(raiz, 'origen.git');
  git(raiz, 'init', '--bare', '-b', 'main', origen);
  const mia = join(raiz, 'mia');
  const otro = join(raiz, 'otro');
  git(raiz, 'clone', origen, mia);
  writeFileSync(join(mia, 'base.txt'), 'uno\n');
  writeFileSync(join(mia, 'c.txt'), 'original\n');
  git(mia, 'add', '.'); git(mia, 'commit', '-m', 'base'); git(mia, 'push', 'origin', 'HEAD:main');
  git(raiz, 'clone', origen, otro);
  // El autocrlf de la PC (Windows lo trae en true) hace que el `merge --abort` reescriba el archivo con CRLF y el status lo vea modificado: fijo LF en la copia.
  for (const dir of [mia, otro]) git(dir, 'config', 'core.autocrlf', 'false');
  git(mia, 'checkout', '-b', 'mi-rama');
  return { raiz, mia, otro };
}

test('traerMain: si main avanzó mientras esperabas, lo MERGEA (no rebase), firma con la cuenta y la rama sigue siendo tuya', () => {
  const { raiz, mia, otro } = armarRepos();
  try {
    writeFileSync(join(mia, 'mio.txt'), 'mi trabajo\n'); git(mia, 'add', 'mio.txt'); git(mia, 'commit', '-m', 'mi punta');
    const miPunta = git(mia, 'rev-parse', 'HEAD');
    writeFileSync(join(otro, 'ajeno.txt'), 'lo de otro\n'); git(otro, 'add', 'ajeno.txt'); git(otro, 'commit', '-m', 'lo del Cerebro'); git(otro, 'push', 'origin', 'HEAD:main');
    const r = traerMain({ cwd: mia, base: 'origin/main', cuenta: 'claude9', fetch: true });
    assert.deepEqual([r.ok, r.mergeado, r.atras], [true, true, 1]);
    assert.equal(git(mia, 'rev-list', '--parents', '-n', '1', 'HEAD').split(' ').length, 3, 'un commit de merge: dos padres');
    assert.equal(git(mia, 'merge-base', '--is-ancestor', miPunta, 'HEAD') === '', true, 'mi punta sigue siendo ancestro: no se reescribió');
    assert.ok(existsSync(join(mia, 'ajeno.txt')) && existsSync(join(mia, 'mio.txt')));
    assert.match(git(mia, 'log', '-1', '--format=%B'), /Co-Authored-By: Claude <noreply@anthropic\.com>\nClaude-Cuenta: claude9/, 'los dos trailers PEGADOS, como pide AGENTS.md');
    assert.equal(git(mia, 'log', '-1', '--format=%(trailers:key=Claude-Cuenta,valueonly)').trim(), 'claude9');
    const otraVez = traerMain({ cwd: mia, base: 'origin/main', cuenta: 'claude9', fetch: true });
    assert.deepEqual([otraVez.ok, otraVez.mergeado, otraVez.atras], [true, false, 0], 'ya está al día: no hace nada');
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('traerMain: si el merge CHOCA, aborta (la rama queda exactamente como estaba) y dice en qué archivos', () => {
  const { raiz, mia, otro } = armarRepos();
  try {
    writeFileSync(join(mia, 'c.txt'), 'versión mía\n'); git(mia, 'add', 'c.txt'); git(mia, 'commit', '-m', 'toco c');
    const antes = git(mia, 'rev-parse', 'HEAD');
    writeFileSync(join(otro, 'c.txt'), 'versión del Cerebro\n'); git(otro, 'add', 'c.txt'); git(otro, 'commit', '-m', 'toca c también'); git(otro, 'push', 'origin', 'HEAD:main');
    const r = traerMain({ cwd: mia, base: 'origin/main', cuenta: 'claude9', fetch: true });
    assert.equal(r.ok, false);
    assert.deepEqual(r.archivos, ['c.txt']);
    assert.equal(git(mia, 'rev-parse', 'HEAD'), antes, 'HEAD no se movió');
    assert.equal(git(mia, 'status', '--porcelain'), '', 'sin marcas de conflicto en el árbol');
    assert.throws(() => git(mia, 'rev-parse', '-q', '--verify', 'MERGE_HEAD'), 'y sin un merge a medias');
    assert.equal(readFileSync(join(mia, 'c.txt'), 'utf8'), 'versión mía\n');
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});
