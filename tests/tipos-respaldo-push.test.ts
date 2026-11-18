// El respaldo del pre-push a `main` cuando el tsc entero no consigue RAM: los tipos de TODO el repo en 3 tandas
// (scripts/tipos-respaldo-push.mjs). Lo que se fija acá es que NUNCA dé un OK que no es: una tanda que no terminó es un
// rechazo (99), un error de tipos frena (1), y sólo las TRES en 0 dejan pasar. Y que el hook lo llame sólo cuando el tsc
// entero salió con 99, antes de bloquear.
//
// PROBADO ROMPIÉNDOLO (22/10/2026, base 5/0; cada rotura a mano y vuelta atrás):
//   · clasificarTanda sin exigir «Total time» (un proceso cortado con código 0 pasaba como ok) → 4/1
//   · clasificarTanda que no mira el heap (un OOM con código 0 y estadísticas viejas) → 4/1
//   · veredictoRespaldo que acepta menos tandas que las pedidas → 4/1
//   · veredictoRespaldo donde «sin-chequear» gana a «errores» (escondía errores reales) → 4/1
//   · el hook llamando al respaldo DESPUÉS del bloque de 99 (nunca corría) → 4/1
// Y de punta a punta, a mano: un error de tipos plantado en un archivo de la tanda 3 hizo salir al script con 1 y el error en
// pantalla (docs/hallazgos-infra.md, «Sin minutos de Actions»).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clasificarTanda, veredictoRespaldo, main, turnoDeArchivo, TANDAS, SALIDA_SIN_CHEQUEAR } from '../scripts/tipos-respaldo-push.mjs';

const RAIZ = join(__dirname, '..');
const ESTADISTICAS = '\nFiles: 7000\nMemory used: 3900000K\nTotal time: 95.66s\n';

test('una tanda que terminó sin errores es ok; con errores, errores (y se listan)', () => {
  assert.equal(clasificarTanda({ code: 0, salida: ESTADISTICAS }).estado, 'ok');
  const r = clasificarTanda({ code: 2, salida: `lib/x.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'.${ESTADISTICAS}` });
  assert.equal(r.estado, 'errores');
  assert.equal(r.errores.length, 1);
  assert.match(r.errores[0], /lib\/x\.ts\(3,7\): error TS2322/);
});

test('una tanda que no terminó NUNCA es ok: matada, sin heap, con señal o sin el bloque de estadísticas', () => {
  assert.equal(clasificarTanda({ code: 1, salida: '' }).estado, 'sin-chequear', 'el vigía la mató: código 1 sin salida');
  assert.equal(clasificarTanda({ code: 134, salida: 'FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory' }).estado, 'sin-chequear');
  assert.equal(clasificarTanda({ code: 0, salida: `JavaScript heap out of memory${ESTADISTICAS}` }).estado, 'sin-chequear', 'un OOM no es un ok aunque haya estadísticas');
  assert.equal(clasificarTanda({ code: null, signal: 'SIGTERM', salida: '' }).estado, 'sin-chequear');
  assert.equal(clasificarTanda({ code: 0, salida: 'Files: 7000\n' }).estado, 'sin-chequear', 'código 0 sin «Total time»: no terminó el chequeo');
});

test('el veredicto: las TRES en ok → 0; un error de tipos → 1 aunque otra no haya corrido; si no, 99', () => {
  const ok = { estado: 'ok' as const, errores: [] };
  const err = { estado: 'errores' as const, errores: ['a.ts(1,1): error TS1: x'] };
  const sin = { estado: 'sin-chequear' as const, errores: [], porque: 'matada' };
  assert.equal(TANDAS, 3);
  assert.equal(veredictoRespaldo([ok, ok, ok]), 0);
  assert.equal(veredictoRespaldo([ok, err, ok]), 1);
  assert.equal(veredictoRespaldo([err, sin]), 1, 'un error real no se esconde detrás de una tanda que no corrió');
  assert.equal(veredictoRespaldo([ok, sin]), SALIDA_SIN_CHEQUEAR);
  assert.equal(veredictoRespaldo([ok, ok]), SALIDA_SIN_CHEQUEAR, 'menos tandas que las pedidas no es un ok');
  assert.equal(veredictoRespaldo([]), SALIDA_SIN_CHEQUEAR);
});

test('el pre-push llama al respaldo sólo con el 99 del tsc entero, y ANTES de bloquear', () => {
  const hook = readFileSync(join(RAIZ, 'scripts', 'claude-hooks', 'pre-push'), 'utf8');
  const main = hook.slice(hook.indexOf('if [ "$A_MAIN" -eq 1 ]; then'));
  const lock = main.indexOf('node "$LOCK_TSC"');
  const respaldo = main.indexOf('node "$RESPALDO"');
  const bloqueo = main.indexOf('✖ PUSH BLOQUEADO: no se pudo chequear los tipos');
  assert.ok(lock > 0 && respaldo > lock && bloqueo > respaldo, 'el orden: tsc entero → respaldo → bloqueo del 99');
  assert.match(main.slice(lock, respaldo), /if \[ "\$TIPOS" -eq 99 \]; then\s+RESPALDO="scripts\/tipos-respaldo-push\.mjs"/);
  assert.match(main.slice(respaldo), /^node "\$RESPALDO"\s+TIPOS=\$\?/);
});

test('el respaldo usa el programa ENTERO (sin --raices) y K = 3', () => {
  const src = readFileSync(join(RAIZ, 'scripts', 'tipos-respaldo-push.mjs'), 'utf8');
  const lanzar = src.slice(src.indexOf('function correrTanda'));
  assert.doesNotMatch(lanzar.slice(0, lanzar.indexOf('\n}\n')), /--raices/, 'con --raices faltan los tipos globales de Next: 15 errores falsos el 22/10');
  assert.match(src, /export const TANDAS = 3;/);
});

// ── NADA ESPERA RAM CON EL TURNO TOMADO (O26, 18/11/2026) ──────────────────────────────────────────────────────────────────
// 29/10/2026, el push de tren-y: con el lock de tipos tomado y sin RAM, el respaldo esperaba 15 min sin correr ningún tsc y la
// fila de tipos de TODA la PC quedaba frenada. El arreglo de ese día (dac670c09) esperaba afuera sólo la RAM de la tanda 1: las
// tandas 2 y 3 (y la 1, si la RAM bajó en la fila) la seguían esperando CON el lock, y no lo soltaban nunca. Y el test de antes
// comparaba el orden de dos cadenas del fuente: daba verde con ese agujero adentro.
//
// Acá se CORRE `main` de verdad con el turno de verdad (un archivo con `wx`, en una carpeta temporal), otros procesos de verdad
// que piden ese mismo turno, la PAUSA del Cerebro prendida, y sólo la RAM y las tandas de mentira, con tiempos de milisegundos.
// Lo que se mira es lo que se ve desde AFUERA: si otro proceso consigue el turno mientras el respaldo espera RAM.
//
// PROBADO ROMPIÉNDOLO (18/11/2026, base 10/0; cada rotura a mano en scripts/tipos-respaldo-push.mjs y vuelta atrás):
//   · con el turno tomado y sin RAM, ESPERAR la RAM ahí (lo de antes) en vez de soltarlo              → 8/2 (A y C)
//   · no volver a mirar la RAM después de tomar el turno (correr directo)                             → 9/1 (C)
//   · `tandasConTurno` esperando la pausa del Cerebro (`await esperarSinPausa()`) antes de empezar     → 5 en verde y 5 cancelados
//                                                                                                      (A-E, por el tope de 20 s)
//   · no soltar el turno al terminar (sin el `finally`)                                               → 9/1 (B, a los 15 s: el
//     hijo que hacía fila se va solo; antes de ponerle ese tope, el proceso de tests quedaba vivo para siempre)
const NODE = process.execPath;
const HIJOS = new Set<ReturnType<typeof spawn>>();
after(() => { for (const h of HIJOS) { try { h.kill(); } catch { /* ya terminó */ } } });
const ESTADISTICAS_OK = { code: 0, signal: null, salida: ESTADISTICAS };

/** La PAUSA del Cerebro prendida para todo el archivo, fuera de CI: un respaldo que la esperara se quedaría colgado acá. */
const DIR_PAUSA = mkdtempSync(join(tmpdir(), 'respaldo-pausa-'));
const ENV_ANTES = { CI: process.env.CI, MAKO_PAUSA_ARCHIVO: process.env.MAKO_PAUSA_ARCHIVO, MAKO_IGNORAR_PAUSA: process.env.MAKO_IGNORAR_PAUSA };
before(() => {
  writeFileSync(join(DIR_PAUSA, 'pausa.txt'), 'sube un tren (test)');
  process.env.MAKO_PAUSA_ARCHIVO = join(DIR_PAUSA, 'pausa.txt');
  delete process.env.CI;
  delete process.env.MAKO_IGNORAR_PAUSA;
});
after(() => {
  for (const [k, v] of Object.entries(ENV_ANTES)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  rmSync(DIR_PAUSA, { recursive: true, force: true });
});

/**
 * Otro proceso que PIDE el turno (un tsc de un chat, el typecheck del push de otra sesión): lo intenta con `wx` cada 10 ms, lo
 * retiene `retenerMs` y lo suelta. `tomadoEn` / `soltadoEn` son la hora que escribió EL HIJO (el reloj de la PC es uno solo):
 * `tomado` justo DESPUÉS de tomarlo y `soltado` justo ANTES de borrarlo, así nadie lo pudo tomar antes de esa hora.
 */
function otroPide(lock: string, retenerMs: number) {
  // ⚠️ El hijo se va solo a los 15 s pase lo que pase: con un respaldo roto que nunca suelta el turno, un hijo que lo pide para
  // siempre mantendría vivo este proceso y la tanda entera de tests moriría por «no avanza» (un 99), no por ESTE rojo.
  const codigo = `setTimeout(()=>process.exit(3),15000);const fs=require('fs');const [lock,ret]=[process.argv[1],Number(process.argv[2])];`
    + `const t=setInterval(()=>{try{fs.writeFileSync(lock,String(process.pid),{flag:'wx'})}catch{return}clearInterval(t);`
    + `process.stdout.write('tomado '+Date.now()+'\\n');setTimeout(()=>{process.stdout.write('soltado '+Date.now()+'\\n');`
    + `try{if(fs.readFileSync(lock,'utf8').trim()===String(process.pid))fs.unlinkSync(lock)}catch{}process.exit(0)},ret)},10);`;
  const hijo = spawn(NODE, ['-e', codigo, lock, String(retenerMs)], { stdio: ['ignore', 'pipe', 'inherit'] });
  HIJOS.add(hijo);
  const estado: { tomadoEn: number | null; soltadoEn: number | null } = { tomadoEn: null, soltadoEn: null };
  let deTomar: () => void = () => {};
  const tomado = new Promise<void>((r) => { deTomar = r; });
  const fin = new Promise<void>((r) => hijo.on('close', () => r()));
  let resto = '';
  hijo.stdout.on('data', (b: Buffer) => {
    resto += b.toString();
    const lineas = resto.split('\n');
    resto = lineas.pop() ?? '';
    for (const linea of lineas) {
      const [que, cuando] = linea.split(' ');
      if (que === 'tomado') { estado.tomadoEn = Number(cuando); deTomar(); }
      if (que === 'soltado') estado.soltadoEn = Number(cuando);
    }
  });
  return { hijo, estado, tomado, fin, matar: () => { try { hijo.kill(); } catch { /* ya terminó */ } } };
}

/** Un lock propio por test, en una carpeta temporal, y las piezas de mentira con tiempos chicos. */
function armarTurno() {
  const dir = mkdtempSync(join(tmpdir(), 'respaldo-turno-'));
  const lock = join(dir, 'mako-typecheck.lock');
  const base = turnoDeArchivo(lock);
  let tomas = 0;
  const turno = { ...base, tomar: () => { const ok = base.tomar(); if (ok) tomas++; return ok; } };
  const textos: string[] = [];
  const corridas: number[] = [];
  const opciones = (hayRam: () => boolean, extra: Partial<Parameters<typeof main>[0]> = {}) => main({
    hayRam, libreGb: () => 1.2, turno,
    correr: async (i: number) => { corridas.push(Date.now()); assert.equal(base.dueno(), process.pid, `la tanda ${i} corrió SIN el turno`); return ESTADISTICAS_OK; },
    esperaRamMs: 1500, esperaTurnoMs: 5000, sondeoRamMs: 20, sondeoTurnoMs: 10,
    out: (t: string) => { textos.push(t); }, err: (t: string) => { textos.push(t); },
    ...extra,
  });
  return { lock, base, turno, textos, corridas, tomas: () => tomas, opciones, limpiar: () => rmSync(dir, { recursive: true, force: true }) };
}

test('A · la RAM baja después de la tanda 1: suelta el turno, otro lo usa mientras espera, y sale con 99 SIN el turno', { timeout: 20_000 }, async () => {
  const t = armarTurno();
  let ram = true;
  let otro: ReturnType<typeof otroPide> | null = null;
  try {
    const inicio = Date.now();
    const codigo = await t.opciones(() => ram, {
      // Mientras corre la tanda 1 (con el turno en la mano) llega otro que lo pide, y la RAM se va para siempre.
      correr: async () => { t.corridas.push(Date.now()); otro = otroPide(t.lock, 150); ram = false; return ESTADISTICAS_OK; },
    });
    const finRespaldo = Date.now();
    await otro!.fin;
    assert.equal(codigo, SALIDA_SIN_CHEQUEAR, 'sin RAM para la tanda 2 no es un ok ni un error de tipos');
    assert.equal(t.corridas.length, 1, 'sólo corrió la tanda 1');
    assert.ok(otro!.estado.tomadoEn != null, 'el otro nunca consiguió el turno');
    assert.ok(otro!.estado.tomadoEn! < finRespaldo - 500,
      `el otro consiguió el turno ${otro!.estado.tomadoEn! - inicio} ms después de arrancar y el respaldo terminó a los ${finRespaldo - inicio}: lo retuvo esperando RAM`);
    assert.ok(otro!.estado.soltadoEn! < finRespaldo, 'el otro alcanzó a trabajar y soltar mientras el respaldo esperaba afuera');
    assert.ok(finRespaldo - inicio < 4000, 'el tope de RAM se respeta (1,5 s acá), no se cuelga');
    assert.ok(!existsSync(t.lock), 'al salir no queda ningún turno tomado');
    assert.match(t.textos.join(''), /suelto el turno y espero afuera/);
  } finally { (otro as ReturnType<typeof otroPide> | null)?.matar(); t.limpiar(); }
});

test('B · otro tiene el turno, la pausa está prendida y otro más lo pide: el respaldo espera su lugar, corre las 3 y lo suelta', { timeout: 20_000 }, async () => {
  const t = armarTurno();
  const dueno = otroPide(t.lock, 300);
  let segundo: ReturnType<typeof otroPide> | null = null;
  try {
    await dueno.tomado;                       // el turno ya tiene dueño (vivo) cuando arranca el respaldo
    segundo = otroPide(t.lock, 50);           // y alguien más hace fila al mismo tiempo
    const inicio = Date.now();
    const codigo = await t.opciones(() => true);
    const fin = Date.now();
    await Promise.all([dueno.fin, segundo.fin]);
    assert.equal(codigo, 0, 'las tres tandas en 0');
    assert.equal(t.corridas.length, 3);
    assert.ok(t.corridas[0] >= dueno.estado.soltadoEn!, 'no corrió una tanda mientras el turno era de otro');
    assert.ok(fin - inicio < 8000, `tardó ${fin - inicio} ms: con la pausa prendida el push no se espera a sí mismo`);
    assert.ok(segundo.estado.tomadoEn != null, 'el que hacía fila también consiguió su turno');
    assert.ok(!existsSync(t.lock) || t.base.dueno() !== process.pid, 'al terminar el turno no queda en manos del respaldo');
  } finally { dueno.matar(); (segundo as ReturnType<typeof otroPide> | null)?.matar(); t.limpiar(); }
});

test('C · la RAM se fue mientras hacía fila: con el turno en la mano la MIRA, lo suelta, otro lo usa, y vuelve cuando hay', { timeout: 20_000 }, async () => {
  const t = armarTurno();
  let ram = true;
  let otro: ReturnType<typeof otroPide> | null = null;
  let vuelveEn = Infinity;
  try {
    const codigo = await t.opciones(() => {
      // La primera vez que mira la RAM CON el turno en la mano, ya no está (se fue en la fila) y aparece otro que lo pide.
      if (ram && !otro && t.base.dueno() === process.pid) { ram = false; otro = otroPide(t.lock, 100); vuelveEn = Date.now() + 500; }
      if (!ram && Date.now() >= vuelveEn) ram = true;
      return ram;
    });
    await otro!.fin;
    assert.equal(codigo, 0);
    assert.equal(t.corridas.length, 3);
    assert.ok(otro!.estado.tomadoEn != null && otro!.estado.tomadoEn < t.corridas[0], 'el otro usó el turno ANTES de que corriera la tanda 1: se soltó');
    assert.ok(t.tomas() >= 2, 'tomó el turno, lo soltó sin RAM y lo volvió a tomar');
  } finally { (otro as ReturnType<typeof otroPide> | null)?.matar(); t.limpiar(); }
});

test('D · nunca hay RAM: sale con 99 sin haber tomado el turno ni una vez', { timeout: 20_000 }, async () => {
  const t = armarTurno();
  try {
    const inicio = Date.now();
    const codigo = await t.opciones(() => false, { esperaRamMs: 300 });
    assert.equal(codigo, SALIDA_SIN_CHEQUEAR);
    assert.equal(t.tomas(), 0, 'esperando RAM no se toma el turno');
    assert.equal(t.corridas.length, 0);
    assert.ok(Date.now() - inicio < 3000);
    assert.match(t.textos.join(''), /no hubo RAM en .* NO es un error de tipos/);
  } finally { t.limpiar(); }
});

test('E · el turno no se libera nunca (dueño vivo): sale con 99 sin correr nada; un turno HUÉRFANO no frena', { timeout: 20_000 }, async () => {
  const t = armarTurno();
  const dueno = otroPide(t.lock, 10_000);
  try {
    await dueno.tomado;
    assert.equal(await t.opciones(() => true, { esperaTurnoMs: 300 }), SALIDA_SIN_CHEQUEAR);
    assert.equal(t.corridas.length, 0);
    assert.equal(t.base.dueno(), dueno.hijo.pid, 'no le sacó el turno a un dueño vivo');
  } finally { dueno.matar(); await dueno.fin; }
  try {
    writeFileSync(t.lock, '999999999');       // un pid que no existe: el dueño murió sin soltarlo
    assert.equal(await t.opciones(() => true), 0, 'un lock huérfano no puede frenar a nadie para siempre');
    assert.equal(t.corridas.length, 3);
  } finally { t.limpiar(); }
});
