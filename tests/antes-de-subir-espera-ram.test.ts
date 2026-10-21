// =============================================================================
// antes-de-subir: quien espera RAM NO retiene el candado de lo pesado (esperarRamSinRetener)
// =============================================================================
// El 21/10/2026 un `antes-de-subir --solo tipos` con MAKO_TIPOS_ESPERA_S=1500 tuvo el candado de lo pesado 25 minutos esperando 4 GB de RAM que no había (la app de Claude
// ocupaba 4,3 GB y Chrome 2), con cuatro chats detrás en la fila (el Cerebro lo confirmó con `--cola`: pid 17932). Quien espera RAM no está usando RAM: el candado es para lo que SÍ la
// usa. Los tres pasos que esperan RAM (los tipos y los dos de tests) pasan por `esperarRamSinRetener`, que:
//   1. mira si hay RAM AHORA (sin esperar y sin soltar nada);
//   2. si no hay, SUELTA el candado, espera sin él, y vuelve a hacer fila al haber;
//   3. con el turno en la mano confirma que la RAM sigue (se pudo ir en la fila), y si no, repite;
//   4. si la RAM no aparece en el tope de ESE paso, devuelve 0 sin el candado y sin volver a hacer fila; el paso siguiente espera con SU tope (los tipos del --rapido esperan 20 s, los tests 15 min).
// Acá se prueba con una RAM y una cola de mentira: el momento exacto en que se suelta y se retoma, y que los TRES pasos reales la usen.
//
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026): ver el final del archivo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esperarRamSinRetener } from '../scripts/antes-de-subir.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url));

type Turno = { soltar: () => boolean; nombre: string };
type Ctx = { candado: Turno | null; tomar?: () => Promise<Turno | { vencio: true }>; motivo?: string | null };

/** Una RAM de mentira: `libre[i]` es lo que contesta la i-ésima consulta (la última se repite), y cada llamada anota si SE ESTABA ESPERANDO y si el candado estaba en la mano. */
function armar(libre: number[], { turnos = ['segundo', 'tercero', 'cuarto'], vence = false }: { turnos?: string[]; vence?: boolean } = {}) {
  const eventos: string[] = [];
  const ctx: Ctx = { candado: null };
  const nuevo = (nombre: string): Turno => ({ nombre, soltar: () => { eventos.push(`suelta ${nombre}`); return true; } });
  ctx.candado = nuevo('primero');
  let n = 0;
  let tomados = 0;
  ctx.tomar = async () => {
    eventos.push('hace fila');
    if (vence) return { vencio: true };
    const t = nuevo(turnos[tomados++] ?? `turno${tomados}`);
    eventos.push(`toma ${t.nombre}`);
    return t;
  };
  const esperar = async (concurrencia: number, opciones: { esperaMaxMs?: number } = {}) => {
    const quedan = libre[Math.min(n++, libre.length - 1)];
    const espera = opciones.esperaMaxMs ?? 900_000;
    const c = quedan >= 1 ? concurrencia : 0;
    eventos.push(`${espera > 0 ? 'ESPERA' : 'mira'}(${espera}) con ${ctx.candado ? `candado ${ctx.candado.nombre}` : 'SIN candado'} → ${c}`);
    return c;
  };
  const avisos: string[] = [];
  const f = esperarRamSinRetener(ctx as never, { esperar: esperar as never, aviso: (t) => avisos.push(t), ahora: () => 0 });
  return { f, ctx, eventos, avisos };
}

test('hay RAM al llegar el turno: sigue con el candado, sin esperar ni soltar nada', async () => {
  const { f, ctx, eventos } = armar([1]);
  assert.equal(await f(2, { esperaMaxMs: 60_000 }), 2);
  assert.equal(ctx.candado?.nombre, 'primero', 'el mismo candado');
  assert.deepEqual(eventos, ['mira(0) con candado primero → 2']);
});

test('no hay RAM: SUELTA el candado ANTES de esperar, espera SIN él y vuelve a hacer fila al haber', async () => {
  const { f, ctx, eventos, avisos } = armar([0, 1, 1]);     // ahora no · (esperando) sí · ya con el turno, sí
  assert.equal(await f(1, { esperaMaxMs: 60_000 }), 1);
  assert.deepEqual(eventos, [
    'mira(0) con candado primero → 0',
    'suelta primero',
    'ESPERA(60000) con SIN candado → 1',
    'hace fila',
    'toma segundo',
    'mira(0) con candado segundo → 1',
  ], 'la espera de 60 s ocurre con el candado SUELTO; el que sigue lo toma al volver');
  assert.equal(ctx.candado?.nombre, 'segundo', 'el que usa lo pesado después es el turno NUEVO, no el que soltó');
  assert.match(avisos.join('\n'), /suelto el candado mientras espero/);
});

test('la RAM se va mientras se esperaba el turno: se vuelve a soltar y a esperar (nunca corre sin RAM con el candado)', async () => {
  const { f, eventos, ctx } = armar([0, 1, 0, 1, 1]);
  assert.equal(await f(1, { esperaMaxMs: 60_000 }), 1);
  assert.deepEqual(eventos.filter((e) => /^(suelta|toma)/.test(e)), ['suelta primero', 'toma segundo', 'suelta segundo', 'toma tercero']);
  assert.ok(eventos.filter((e) => e.startsWith('ESPERA')).every((e) => e.includes('SIN candado')), 'toda espera es sin candado');
  assert.equal(ctx.candado?.nombre, 'tercero');
});

test('la RAM no aparece en el tope de ESTE paso: devuelve 0 SIN el candado y sin hacer fila; el paso que sigue espera con SU tope (no hereda el fracaso del anterior)', async () => {
  const { f, ctx, eventos } = armar([0]);
  assert.equal(await f(1, { esperaMaxMs: 120_000 }), 0, 'una espera larga de los tipos: se vence y nada');
  assert.equal(ctx.candado, null, 'no tiene el candado');
  assert.ok(!eventos.includes('hace fila'), 'no hace una fila de media hora sólo para decir «no hay RAM»');
  const antes = eventos.length;
  assert.equal(await f(2), 0, 'los tests, con su tope de 15 min, esperan DE NUEVO (y sin candado)');
  assert.deepEqual(eventos.slice(antes), ['ESPERA(900000) con SIN candado → 0'], 'esperan sin candado y sin hacer fila');
});

test('REGRESIÓN (exit 99): una espera de tipos vence sin RAM, y los tests, que esperan 15 min, la consiguen: corren con un candado NUEVO', async () => {
  // La primera versión marcaba «sin candado» para siempre al vencer los tipos: los tests salían «no hay RAM» sin esperar (medido el 21/10: 1 min 34 s en total).
  const { f, ctx, eventos } = armar([0, 0, 1, 1]);     // tipos: mira no · espera 20 s no — tests: espera sí · ya con el turno, sí
  assert.equal(await f(1, { esperaMaxMs: 120_000 }), 0);
  assert.equal(await f(2), 2, 'los tests tuvieron su espera y corren');
  assert.equal(ctx.candado?.nombre, 'segundo', 'con un candado nuevo, hecho después de que apareció la RAM');
  assert.deepEqual(eventos.filter((e) => /fila|toma|suelta/.test(e)), ['suelta primero', 'hace fila', 'toma segundo']);
});

test('el turno vence al volver a hacer fila: 0 sin candado (no es un rojo del código)', async () => {
  const { f, ctx } = armar([0, 1], { vence: true });
  assert.equal(await f(1, { esperaMaxMs: 60_000 }), 0);
  assert.equal(ctx.candado, null);
});

test('sin candado en la mano (Actions, --ya-tengo-el-candado, MAKO_SIN_COLA): espera como siempre, con las mismas opciones', async () => {
  const visto: unknown[] = [];
  const ctx: Ctx = { candado: null };
  const f = esperarRamSinRetener(ctx as never, { esperar: (async (c: number, o: unknown) => { visto.push([c, o]); return c; }) as never });
  assert.equal(await f(2, { esperaMaxMs: 5, quien: 'x' } as never), 2);
  assert.deepEqual(visto, [[2, { esperaMaxMs: 5, quien: 'x' }]]);
  // Aunque haya cómo hacer fila (`tomar`), sin candado en la mano no hay nada que soltar ni que retomar: no se hace fila de la nada.
  let filas = 0;
  let llamadas = 0;
  const f2 = esperarRamSinRetener({ candado: null, tomar: async () => { filas++; return { soltar: () => true }; } } as never, { esperar: (async (c: number) => (llamadas++ === 0 ? 0 : c)) as never });
  assert.equal(await f2(1), 0, 'sin RAM contesta lo que contesta esperarRam, una sola vez');
  assert.equal(filas, 0, 'no hizo fila');
  assert.equal(llamadas, 1);
});

test('el tiempo de espera es UNO solo aunque haya que volver a hacer fila: lo que se esperó se descuenta', async () => {
  let reloj = 0;
  const eventos: string[] = [];
  const ctx: Ctx = { candado: { nombre: 'a', soltar: () => true } };
  ctx.tomar = async () => ({ nombre: 'b', soltar: () => true });
  let n = 0;
  const f = esperarRamSinRetener(ctx as never, {
    ahora: () => reloj,
    esperar: (async (c: number, o: { esperaMaxMs: number }) => {
      eventos.push(`espera ${o.esperaMaxMs}`);
      if (o.esperaMaxMs > 0) reloj += 40_000;     // lo que tardó en aparecer la RAM
      const i = n++;
      return i === 1 || i >= 3 ? c : 0;            // mira(0) no · espera sí · mira(0) no · espera sí · mira(0) sí
    }) as never,
  });
  assert.equal(await f(1, { esperaMaxMs: 100_000 }), 1);
  assert.deepEqual(eventos, ['espera 0', 'espera 100000', 'espera 0', 'espera 60000', 'espera 0'], 'la segunda espera sólo tiene lo que queda: 100 s − 40 s');
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Los TRES pasos que esperan RAM la esperan por esperarRamSinRetener (en el código de verdad, no sólo en la función)
// ---------------------------------------------------------------------------------------------------------------------------------

const sinComentarios = (t: string) => t.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

test('antes-de-subir pasa la espera que no retiene el candado a los tipos y a los dos pasos de tests, y NINGUNO espera RAM por su cuenta', () => {
  const adsub = sinComentarios(readFileSync(join(REPO, 'scripts', 'antes-de-subir.mjs'), 'utf8').replace(/\r\n/g, '\n'));
  assert.match(adsub, /const esperar = esperarRamSinRetener\(ctx/, 'se arma una vez');
  assert.match(adsub, /correrTsc\(alcance, out, [^)]*, esperar, \(\) => ctx\.motivo\)/, 'los tipos la reciben (y el motivo, para decir la causa real)');
  assert.match(adsub, /correrTests\(\{[^}]*\besperar\b[^}]*\}\)/, 'los tests la reciben');
  assert.match(adsub, /await esperar\(1, \{ pisoGb: pisoTsc\(heap\)/, 'y los tipos esperan con ella');
  assert.doesNotMatch(adsub, /await esperarRam\(/, 'ningún paso espera RAM llamando a esperarRam directo (retendría el candado)');
  const tests = sinComentarios(readFileSync(join(REPO, 'scripts', 'tests-afectados.mjs'), 'utf8').replace(/\r\n/g, '\n'));
  const cuerpo = /export async function correrTests\(([\s\S]*?)\n}\n/.exec(tests)?.[0] ?? '';
  assert.ok(cuerpo.length > 500, 'encontré correrTests');
  assert.match(cuerpo, /esperar = esperarRam/, 'correrTests recibe `esperar` (default esperarRam: tests-afectados suelto sigue igual)');
  assert.equal((cuerpo.match(/await esperar\(/g) ?? []).length, 2, 'las dos esperas de correrTests (cada tanda y el grupo compartido) van por `esperar`');
  assert.doesNotMatch(cuerpo, /await esperarRam\(/);
});

test('el candado que se retoma es el que se suelta al terminar (ctx, no una variable vieja): main usa ctx.candado en el exit, la señal y el finally', () => {
  const adsub = sinComentarios(readFileSync(join(REPO, 'scripts', 'antes-de-subir.mjs'), 'utf8').replace(/\r\n/g, '\n'));
  assert.match(adsub, /ctx\.candado = turno;/);
  assert.match(adsub, /const soltarYa = \(\) => \{ try \{ ctx\.candado\?\.soltar\(\);/, 'al salir o con una señal se suelta el candado QUE HAY, no el primero');
  assert.match(adsub, /finally \{ try \{ ctx\.candado\?\.soltar\(\);/, 'y en el finally');
  assert.doesNotMatch(adsub, /(?<![.\w])candado\.soltar\(\)/, 'ninguna referencia suelta al candado viejo (sin el `ctx.` delante)');
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Revisión del Cerebro (21/10 noche): las dos medias y la baja
// ---------------------------------------------------------------------------------------------------------------------------------

test('una espera CORTA (los tipos del --rapido: 20 s) se hace CON el candado en la mano: no se pierde el lugar en la fila por 20 s aunque los tests, que piden menos RAM, entren', async () => {
  const { f, ctx, eventos } = armar([0]);
  assert.equal(await f(1, { esperaMaxMs: 20_000 }), 0);
  assert.deepEqual(eventos, ['ESPERA(20000) con candado primero → 0'], 'esperó con el candado, sin soltarlo ni hacer fila');
  assert.equal(ctx.candado?.nombre, 'primero', 'el candado sigue en la mano: los tests de después no tienen que volver a la fila');
});

test('el tope cuenta sólo el tiempo ESPERANDO RAM, no el de la fila: tras 20 min de fila un bajón momentáneo no da 0 (se perdería toda la fila)', async () => {
  let reloj = 0;
  const eventos: string[] = [];
  const ctx: Ctx = { candado: { nombre: 'a', soltar: () => true } };
  ctx.tomar = async () => { reloj += 20 * 60_000; eventos.push('fila de 20 min'); return { nombre: 'b', soltar: () => true }; };
  let n = 0;
  const f = esperarRamSinRetener(ctx as never, {
    ahora: () => reloj,
    esperar: (async (c: number, o: { esperaMaxMs: number }) => {
      const i = n++;
      eventos.push(`${o.esperaMaxMs > 0 ? 'espera' : 'mira'} ${o.esperaMaxMs}`);
      return [0, c, 0, c, 0, c, c][i];      // mira no · aparece · (tras la fila) mira: un bajón · aparece · otro bajón · aparece · mira sí
    }) as never,
  });
  assert.equal(await f(1, { esperaMaxMs: 900_000 }), 1, 'después de 40 min de fila, con la RAM de vuelta, corre');
  assert.deepEqual(eventos.filter((e) => e.startsWith('espera')), ['espera 900000', 'espera 900000', 'espera 900000'], 'cada espera conserva el tope entero: la fila (20 min cada vez) no se descuenta');
});

test('el motivo: si el turno no le toca al volver a hacer fila dice «fila» (no es la RAM); si la RAM no aparece, «ram»', async () => {
  const a = armar([0, 1], { vence: true });
  assert.equal(await a.f(1, { esperaMaxMs: 120_000 }), 0);
  assert.equal((a.ctx as Ctx).motivo, 'fila', 'el mensaje no puede culpar a la RAM');
  const b = armar([0]);
  assert.equal(await b.f(1, { esperaMaxMs: 120_000 }), 0);
  assert.equal((b.ctx as Ctx).motivo, 'ram');
  const c = armar([1]);
  assert.equal(await c.f(1, { esperaMaxMs: 120_000 }), 1);
  assert.equal((c.ctx as Ctx).motivo, null, 'con RAM no hay motivo');
});

test('UN SOLO ORDEN DE CANDADOS en correrTsc: la RAM (lo pesado) se espera ANTES de tomar el lock de typecheck, y los mensajes dicen la causa real', () => {
  const adsub = sinComentarios(readFileSync(join(REPO, 'scripts', 'antes-de-subir.mjs'), 'utf8').replace(/\r\n/g, '\n'));
  const cuerpo = /async function correrTsc\(([\s\S]*?)\n}\n/.exec(adsub)?.[0] ?? '';
  assert.ok(cuerpo.length > 500, 'encontré correrTsc');
  const iRam = cuerpo.indexOf('await esperar(1,');
  const iLock = cuerpo.indexOf('await tomarLock(');
  assert.ok(iRam > 0 && iLock > 0 && iRam < iLock, `la RAM (${iRam}) va antes que el lock de typecheck (${iLock}): si no, al soltar lo pesado esperando se vuelve a la fila con el lock en la mano y el que recibe lo pesado se bloquea por él`);
  assert.match(cuerpo, /el turno del candado no me tocó al volver a hacer fila: no es la RAM/, 'los tipos dicen la causa real si perdieron el turno');
  assert.match(adsub, /ctx\.motivo === 'fila' \? 'tests: el turno del candado no me tocó/, 'y los tests también');
});

// =============================================================================
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026; se rompe UNA pieza, se corren estas pruebas, se restaura): 14 roturas, 14 rojas — TRES se CUELGAN en vez de fallar (el bucle no termina: no retomar el turno, reintentar con el turno vencido, no mirar antes de soltar).
//   no soltar el candado antes de esperar → 3 · esperar con el candado en la mano → 5 · el fracaso de un paso que se hereda al siguiente (el exit 99 de la primera versión) → 2 · esperar el tope entero cada vez (sin descontar lo esperado) → 1 ·
//   sin cómo hacer fila no delegar → 1 · los tipos que esperan por su cuenta → 1 · los tests sin la espera → 1 · correrTests que espera por su cuenta (cada tanda → 1, el grupo compartido → 1) · el exit que suelta el candado viejo → 1 · el finally → 1.
// La primera versión marcaba «sin candado» para siempre al vencer UNA espera: los tipos del --rapido vencen a los 20 s y los tests, que esperan 15 min, salían «no hay RAM» sin esperar (exit 99, 1 min 34 s en total, visto en el primer VERDE de este cambio).
// =============================================================================
