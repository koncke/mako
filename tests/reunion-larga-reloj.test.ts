// =============================================================================
// Una reunión LARGA: la extracción mira el reloj y una lectura a medias se completa (17/10/2026)
// =============================================================================
// Dos pendientes del Plan (docs/hallazgos-plan.md, «La extracción, medida otra vez…» y «La revisión adversarial del
// kanban», 16-17/10):
//   · «La extracción de una reunión larga muere a los 300 s sin dejar ninguna tarea»: `extraerTareasDeTexto` no recibía
//     el `hasta` de quien la llamaba. Una junta de 3 h (8-9 partes de 20k, de a tres, 70-140 s por ronda con Gemini
//     cargado) pasaba los 300 s y Vercel mataba la función antes de escribir el borrador.
//   · «Una reunión leída a medias no se completa nunca»: el cron la salteaba porque ya tenía borrador.
// La regla, en lib/lectura-por-partes.ts (puro: acá con un reloj de mentira); el cron entero, en el hijo
// tests/_fathom-carga-hijo.ts (modo `parcial`), con la base y la extracción de mentira.
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026), una rotura por vez y vuelta atrás:
//   1. `leerPorRondas` sin mirar el reloj antes de cada ronda (`if (!entra())` fuera) ................ 1 fallo
//   2. el reintento sin mirar el reloj (`entra(ms)` fuera) ............................................ 1 fallo
//   3. `saltearSi` sin comparar `partes` (usa la marca de otro troceado) .............................. 1 fallo
//   4. reunion-auto con el `continue` de antes (`if (previo) continue`, sin mirar la marca) ............ 1 fallo
//   5. reunion-auto completando SIN `sinLasYaPropuestas` (la repetida del corte vuelve) ................ 1 fallo
//   6. reunion-auto sin pasarle `hasta` a la extracción ................................................ 1 fallo
//   7. `recordingDeRef` con el `Number(ref.slice(7))` de antes ........................................ 1 fallo
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  leerPorRondas, leerMarca, unirLeidas, lecturaCompleta, saltearSi, refDelResto, recordingDeRef, sinLasYaPropuestas,
  MIN_PARTE_MS,
} from '../lib/lectura-por-partes';

/** Un reloj de mentira: cada lectura «tarda» lo que diga el escenario, y dormir avanza el reloj. */
function reloj(inicio = 0) {
  let t = inicio;
  return { ahora: () => t, avanzar: (ms: number) => { t += ms; }, dormir: async (ms: number) => { t += ms; } };
}

test('la extracción no arranca una ronda que no entra en el reloj: lo que falta vuelve SIN TIEMPO, no se pierde', async () => {
  const r = reloj();
  // Nueve partes de a tres, cada ronda «tarda» 140 s (lo medido con Gemini cargado). Plazo: 255 s (285 − el margen).
  const leidas: number[] = [];
  const res = await leerPorRondas({
    indices: [0, 1, 2, 3, 4, 5, 6, 7, 8], concurrencia: 3, vacia: () => 0, plazo: 255_000,
    ahora: r.ahora, dormir: r.dormir,
    leer: async (i) => { leidas.push(i); if (i % 3 === 2) r.avanzar(140_000); return { salida: 1, fallo: false }; },
  });
  // Ronda 1 en 0 s (entra), termina en 140 s; ronda 2 necesitaría hasta 260 s (> 255): no arranca.
  assert.deepEqual(leidas, [0, 1, 2], 'leyó sólo la ronda que entraba');
  assert.deepEqual(res.filter((x) => !x.fallo).map((x) => x.i), [0, 1, 2]);
  assert.deepEqual(res.filter((x) => x.sinTiempo).map((x) => x.i), [3, 4, 5, 6, 7, 8], 'las demás vuelven sin tiempo');
  assert.equal(res.length, 9, 'una entrada por parte pedida');
  // Sin plazo, como antes: lee todo.
  const todo = await leerPorRondas({ indices: [0, 1, 2, 3], concurrencia: 3, vacia: () => 0, leer: async () => ({ salida: 1, fallo: false }) });
  assert.equal(todo.filter((x) => !x.fallo).length, 4);
});

test('el reintento de una parte que falló sólo corre si todavía entra', async () => {
  const r = reloj();
  let intentos = 0;
  // El plazo deja lugar para UNA parte y no para la espera más otra.
  const res = await leerPorRondas({
    indices: [0], concurrencia: 3, vacia: () => 0, plazo: MIN_PARTE_MS + 500, ahora: r.ahora, dormir: r.dormir,
    espera: () => 1200,
    leer: async () => { intentos++; return { salida: 0, fallo: true }; },
  });
  assert.equal(intentos, 1, 'no reintentó: la espera más una parte no entraban');
  assert.equal(res[0].fallo, true);
  assert.equal(res[0].sinTiempo, false, 'se intentó: es una falla, no falta de tiempo');
  // Con tiempo de sobra, sí reintenta (y la segunda sale bien).
  let n = 0;
  const ok = await leerPorRondas({
    indices: [0], concurrencia: 3, vacia: () => 0, plazo: 10 * MIN_PARTE_MS, ahora: r.ahora, dormir: r.dormir,
    leer: async () => { n++; return n === 1 ? { salida: 0, fallo: true } : { salida: 7, fallo: false }; },
  });
  assert.equal(n, 2);
  assert.deepEqual([ok[0].fallo, ok[0].salida], [false, 7]);
});

test('la marca de una lectura a medias: sólo vale para el MISMO troceado', () => {
  const m = leerMarca(JSON.stringify({ partes: 4, leidas: [1, 0, 1, 9], refs: ['fathom:950', 'otra'], ts: 'x' }));
  assert.deepEqual(m, { partes: 4, leidas: [0, 1], refs: ['fathom:950'], ts: 'x' }, 'sin repetidas, sin índices de más, sin refs ajenas');
  assert.equal(leerMarca(''), null);
  assert.equal(leerMarca('{roto'), null);
  assert.deepEqual([...saltearSi(m, 4)], [0, 1]);
  assert.deepEqual([...saltearSi(m, 5)], [], 'con otro número de partes, los índices hablan de otros pedazos: se lee todo');
  assert.deepEqual(unirLeidas([0, 1], [3, 1]), [0, 1, 3]);
  assert.equal(lecturaCompleta(4, [0, 1, 2, 3]), true);
  assert.equal(lecturaCompleta(4, [0, 1, 3]), false);
});

test('el borrador que completa una reunión: ref determinista, y la reunión se reconoce igual', () => {
  assert.equal(refDelResto(950, [3, 2]), 'fathom:950:partes-3-4');
  assert.equal(recordingDeRef('fathom:950'), 950);
  assert.equal(recordingDeRef('fathom:950:partes-3-4'), 950, 'sin esto, sus tareas no se pueden mandar a nadie');
  assert.equal(recordingDeRef('archivo:12'), undefined);
  assert.equal(recordingDeRef(undefined), undefined);
  const nuevas = [{ titulo: 'Grabar el video de bienvenida del curso' }, { titulo: 'Llamar al contador por la factura' }];
  assert.deepEqual(sinLasYaPropuestas(nuevas, [{ titulo: 'Grabar el video de bienvenida del curso' }]).map((t) => t.titulo), ['Llamar al contador por la factura']);
});

const RAIZ = join(__dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_fathom-carga-hijo.ts'), 'parcial'], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, env: { ...process.env, NODE_ENV: 'test' },
});
type Foto = { borradores: Array<{ ref: string; estado: string; titulos: string[]; resumen: string }>; marca: string | null; vista: boolean };
const r = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as {
  parcial: { pedidos: Array<{ hasta: boolean; previa: { partes: number; leidas: number[] } | null }>; tras1: Foto; tras2: Foto; corridas: Array<{ nuevas: number; conTareas: number; tareas: number }> };
  sinMock: string[];
};

test('el cron le pasa su reloj a la extracción', () => {
  assert.ok(r.parcial.pedidos.length >= 1);
  assert.ok(r.parcial.pedidos.every((p) => p.hasta), 'sin `hasta`, una junta de 3 h muere a los 300 s sin escribir');
});

test('una reunión leída a medias se COMPLETA: la corrida siguiente lee sólo lo que falta, en un borrador aparte', () => {
  const { tras1, tras2, pedidos, corridas } = r.parcial;
  // Primera corrida: el borrador con lo leído, la marca con las partes 1 y 2, y la reunión abierta.
  assert.deepEqual(tras1.borradores.map((b) => b.ref), ['fathom:950']);
  assert.deepEqual(JSON.parse(tras1.marca ?? '{}').leidas, [0, 1]);
  assert.equal(tras1.vista, false, 'leída a medias: no se cierra');
  // Segunda corrida: NO la saltea por tener borrador; lee con la marca y deja lo nuevo aparte, sin la repetida del corte.
  assert.equal(pedidos.length, 2, 'la segunda corrida la volvió a mirar');
  assert.deepEqual({ partes: pedidos[1].previa?.partes, leidas: pedidos[1].previa?.leidas }, { partes: 4, leidas: [0, 1] }, 'le pasó lo ya leído para no releerlo');
  const resto = tras2.borradores.find((b) => b.ref === 'fathom:950:partes-3-4');
  assert.ok(resto, 'el resto va a un borrador aparte');
  assert.deepEqual(resto.titulos, ['Llamar al contador por la factura de septiembre'], 'sin la que ya propuso la primera vuelta');
  assert.match(resto.resumen, /terminó de leer/);
  assert.deepEqual(tras2.borradores.find((b) => b.ref === 'fathom:950')?.titulos.length, 2, 'el primer borrador no se toca');
  // Leída entera: se cierra y la marca se vacía. La tercera corrida ya no la mira.
  assert.equal(tras2.vista, true);
  assert.equal(tras2.marca, '');
  assert.deepEqual(corridas.map((c) => c.nuevas), [1, 1, 0]);
  assert.deepEqual(corridas.map((c) => c.tareas), [2, 1, 0]);
});

test('el escenario no usó tablas sin mock', () => {
  // `mako_knowledge` es el glosario (`glosarioTexto`, con su `.catch`): sin él la extracción va igual.
  assert.deepEqual(r.sinMock.filter((t) => t !== 'mako_knowledge'), []);
});
