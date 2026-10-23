// =============================================================================
// En cada refresco del Ops Center se redibuja sólo lo que cambió (23/10/2026)
// =============================================================================
// Medido en producción: un chat TRABAJANDO, con sus pasos en vivo y el refresco cada 2,5 s, trababa de 745 ms a 3,6 s en cada
// vuelta. El Cerebro: «que en cada refresco se redibuje sólo lo que cambió: el paso nuevo, la línea de estado. El hilo y la
// lista no, memorizados por uuid y con las líneas estables». Lo que lo trababa: cada refresco traía arreglos nuevos de lo
// mismo (y `ahora` al milisegundo), y con ellos se rehacían todos los chats y su historial, y el hilo se dibujaba entero.
//   1. lo que vale lo mismo vuelve con la MISMA referencia (`mismoValor`, `estabilizarLista`, `claveDeLinea`);
//   2. un turno plegado («Avance: …») es el mismo objeto de una vuelta a otra;
//   3. una línea del hilo no se redibuja si no cambió (`mismaLinea`); un trabajo en camino sí, con el reloj;
//   4. el refresco usa todo eso: cada cosa cambia sólo si cambió, los chats con el reloj al minuto, las líneas estables.
//
// Correr: node --import tsx --test tests/ops-center-refresco-estable.test.ts
// PROBADO ROMPIÉNDOLO (base 4/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import * as modulo from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claveDeLinea, estabilizarLista, minutoDe, mismoValor } from '../lib/centro-estable';
import { lineasDeConversacion, type LineaChat } from '../lib/centro-chats';

type Loader = (url: string, ctx: unknown, next: (url: string, ctx: unknown) => unknown) => unknown;
const { registerHooks } = modulo as unknown as { registerHooks: (h: { load: Loader }) => void };
registerHooks({ load: (url, ctx, next) => (/\.css($|\?)/.test(url) ? { format: 'commonjs', source: '', shortCircuit: true } : next(url, ctx)) });

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const clon = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

const turno = (uuid: string, rol: 'yo' | 'el' | 'otro', texto: string, i: number) =>
  ({ tipo: 'turno', instante: i, turno: { uuid, rol, texto, at: new Date(i).toISOString() } }) as unknown as LineaChat;

test('1. lo que vale lo mismo vuelve con la MISMA referencia', () => {
  const a = { pasos: [{ texto: 'Leyendo', at: 1 }] };
  assert.equal(mismoValor(a, clon(a)), a, 'lo mismo de otro refresco: el de antes');
  const b = { pasos: [{ texto: 'Escribiendo', at: 2 }] };
  assert.equal(mismoValor(a, b), b, 'lo que cambió: lo nuevo');
  const circular: Record<string, unknown> = {}; circular.yo = circular;
  assert.equal(mismoValor({}, circular), circular, 'lo que no se puede comparar: lo nuevo');
  // Una lista: cada elemento igual es el de antes; si todos, la lista de antes.
  const antes = [{ clave: 'a', n: 1 }, { clave: 'b', n: 2 }];
  assert.equal(estabilizarLista(antes, clon(antes), (x) => x.clave), antes);
  const cambio = estabilizarLista(antes, [{ clave: 'a', n: 1 }, { clave: 'b', n: 3 }], (x) => x.clave);
  assert.notEqual(cambio, antes);
  assert.equal(cambio[0], antes[0], 'el que no cambió es el de antes');
  assert.deepEqual(cambio[1], { clave: 'b', n: 3 });
  assert.equal(estabilizarLista(undefined, antes, (x) => x.clave), antes, 'sin lo de antes, lo nuevo');
  // La clave de cada línea: su turno, su pedido, su trabajo, su pregunta.
  assert.equal(claveDeLinea(turno('u1', 'el', 'hola', 1)), 't:u1');
  assert.equal(claveDeLinea({ tipo: 'trabajo', instante: 1, trabajo: { id: 'w9' } } as unknown as LineaChat), 'w:w9');
  assert.equal(claveDeLinea({ tipo: 'pregunta', instante: 1, pregunta: { id: 'q3' }, trabajo: null } as unknown as LineaChat), 'q:q3');
  assert.equal(minutoDe(125_000), 120_000);
});

test('2. un turno plegado («Avance: …») es el mismo objeto de una vuelta a otra', () => {
  const lineas = [turno('o1', 'otro', 'Del Cerebro', 1), turno('e1', 'el', 'Avance para el Cerebro', 2), turno('y1', 'yo', 'Martín', 3)];
  const una = lineasDeConversacion(lineas);
  const otra = lineasDeConversacion(lineas);
  const p1 = una.find((l) => l.tipo === 'turno' && l.turno.uuid === 'e1')!;
  const p2 = otra.find((l) => l.tipo === 'turno' && l.turno.uuid === 'e1')!;
  assert.equal((p1 as { plegado?: boolean }).plegado, true);
  assert.equal(p1, p2, 'la misma línea plegada: el hilo memorizado no la vuelve a dibujar');
});

test('3. una línea no se redibuja si no cambió; un trabajo en camino sí, con el reloj', async () => {
  const { mismaLinea } = await import('../app/admin/operaciones/Hilo');
  const l = turno('u1', 'el', 'hola', 1);
  const w = { tipo: 'trabajo', instante: 1, trabajo: { id: 'w1' } } as unknown as LineaChat;
  const quien = { titulo: 'CRM', animo: 'despierto' }, vivo = { chat: { clave: 'c' }, carteros: [] }, lineas = [l, w], pushes: never[] = [];
  const p = (x: LineaChat, o: Record<string, unknown> = {}) => ({ l: x, pushes, ahora: 60_000, quien, vivo, extras: {}, wa: { marcas: null, lineas }, ...o }) as never;
  assert.equal(mismaLinea(p(l), p(l, { ahora: 61_000, wa: { marcas: null, lineas: [...lineas] }, extras: {} })), true, 'otro render con lo mismo: no se redibuja');
  assert.equal(mismaLinea(p(l), p(l, { ahora: 125_000 })), false, 'cambió el minuto');
  assert.equal(mismaLinea(p(l), p(turno('u1', 'el', 'hola', 1))), false, 'otra línea (no la estable)');
  assert.equal(mismaLinea(p(l), p(l, { vivo: { chat: { clave: 'c' }, carteros: [] } })), false, 'otro chat');
  assert.equal(mismaLinea(p(l), p(l, { vivo: { chat: vivo.chat, carteros: [1] } })), true, 'un turno no mira a los Runners');
  assert.equal(mismaLinea(p(w), p(w, { ahora: 61_000 })), false, 'un trabajo en camino, con el reloj');
  assert.equal(mismaLinea(p(w), p(w, { vivo: { chat: vivo.chat, carteros: [1] } })), false, 'y con los Runners');
  assert.match(sinComentarios(leer('app/admin/operaciones/Hilo.tsx')), /const Linea = memo\(LineaSinMemo, mismaLinea\);/);
});

test('4. el refresco: cada cosa cambia sólo si cambió, los chats con el reloj al minuto, las líneas estables', () => {
  const u = sinComentarios(leer('app/admin/operaciones/useCentro.ts'));
  const refresco = u.slice(u.indexOf('const refrescar = useCallback('), u.indexOf('const apurado = hayEnCamino('));
  for (const s of ['setCola', 'setEstado', 'setAbiertas', 'setNombresCuentas', 'setPasos', 'setYaVistos', 'setDecisiones']) {
    assert.match(refresco, new RegExp(`${s}\\(\\(x\\) => mismoValor\\(x, `), `${s}: sólo si cambió`);
  }
  for (const s of ['setPreguntas', 'setTareas', 'setMarcas']) assert.match(u, new RegExp(`${s}\\(\\([a-z]\\) => \\{ const v = mismoValor\\(`), `${s} del chat abierto`);
  assert.match(u, /const ahoraLista = minutoDe\(ahora\);/);
  assert.match(u, /completarChats\(base, \{ carteros, trabajos, ahora: ahoraLista, pasos \}\)/, 'los chats, con el reloj al minuto');
  assert.match(u, /\}, \[base, carteros, trabajos, ahoraLista, pasos\]\);/);
  assert.match(u, /estabilizarLista\(lineasAntes\.current\.get\(c\.clave\),[\s\S]{0,260}?claveDeLinea\)/, 'cada línea igual, la de antes');
});

// PROBADO ROMPIÉNDOLO (23/10/2026, base 4/0):
//   · `mismoValor` siempre lo nuevo                     → 3/1 (1)
//   · el plegado armado de nuevo cada vez               → 3/1 (2)
//   · una línea mira el reloj al milisegundo            → 3/1 (3)
//   · el refresco vuelve a pisar la cola                → 3/1 (4)
//   · los chats con el reloj de cada refresco           → 3/1 (4)
