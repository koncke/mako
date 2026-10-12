// =============================================================================
// La SECCIÓN del Dashboard (tanda v5, puntos 12 y 24): qué agrupa, qué se esconde al plegarla y la vuelta de
// la grilla — lib/graficos-secciones.ts, y su uso en el pedido de datos (app/dashboard/exportar.ts).
// =============================================================================
// Decisión 2 de Martín (12/10/2026): la sección va A LO ANCHO y agrupa las filas de abajo hasta la siguiente; es
// también el «Desplegable». Lo que este archivo fija, porque ninguno de estos errores da un error:
//   · la membresía sale de la `y` (nada guardado de más), y un DIVISOR (sin título y no plegable) cierra el grupo;
//   · plegar no mueve nada de lo guardado: lo dibujado sube, y la VUELTA de la grilla devuelve las filas guardadas
//     (sin eso, editar con algo plegado escribía las `y` compactadas y al desplegar el grupo caía DESPUÉS de la
//     sección siguiente: se perdía el orden);
//   · lo plegado no se pide (`pedidosDeHoja` con `ocultos`), y sin `ocultos` se pide todo (la API, el CSV).
// Correr: npx tsx --test tests/graficos-secciones.test.ts
//
// ── Roturas (12/10/2026, scratchpad p5/romper.mjs: una por vez, restaurada de MEMORIA y verificada por hash,
//    nunca con git). Base: 9 pasan / 0 fallan; al final, 9 / 0. Cada rotura tumbó SU test (pasan / fallan):
//   · `esCierre` que no mira el título (todo no plegable es divisor)      -> 7 / 2  «la membresía…» y «el fondo…»
//   · el grupo de la última sección cortado en su propia fila            -> 7 / 2  «la membresía…» y «el fondo…»
//   · `plegadasDe` sin la vista (lo elegido mirando no pliega)            -> 8 / 1  «plegar es de la vista…»
//   · una sección NO plegable que igual se pliega                         -> 8 / 1  «plegar es de la vista…»
//   · `aVista` sin subir lo de abajo                                      -> 7 / 2  «lo dibujado…» y «la vuelta…»
//   · `aGuardado` sin sumar lo escondido                                  -> 7 / 2  «la vuelta…» y «el orden…»
//   · `aGuardado` sin mover lo escondido con su sección                   -> 8 / 1  «el orden…»
//   · `fondosDe` con el fondo de una plegada a lo largo del grupo         -> 8 / 1  «el fondo…»
//   · `pedidosDeHoja` sin mirar `ocultos`                                  -> 8 / 1  «lo plegado no se pide…»
//   · page.tsx que pide lo plegado (sin `ocultosPorPlegado`)              -> 8 / 1  «la página y la pantalla…»
//   · el PDF con lo plegado plegado (sin la guarda de `imprimiendo`)      -> 8 / 1  el mismo
//   · `alMoverGrilla` sin la vuelta (los grupos vacíos en `aGuardado`)    -> 8 / 1  el mismo

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanearHoja, type Hoja } from '../lib/graficos-catalogo';
import { aGuardado, aVista, esCierre, fondosDe, gruposDe, ocultosPorPlegado, plegadasDe, plegadasDeEntrada, type ElementoSeccion } from '../lib/graficos-secciones';
import { pedidosDeHoja } from '../app/dashboard/exportar';

const HOY = '2026-10-12';
const sec = (id: string, y: number, texto: string, s: Record<string, unknown> = {}) => ({ id, clase: 'elemento', tipo: 'seccion', texto, x: 0, y, w: 12, h: 1, seccion: s });
const kpi = (id: string, x: number, y: number, w = 4, h = 4) => ({ id, clase: 'grafico', tipo: 'numero', fuente: 'negocio', metricas: ['gasto'], x, y, w, h });
const hoja = (componentes: unknown[]): Hoja => sanearHoja({ id: 'h1', nombre: 'Prueba', componentes }, 0)!;
const items = (h: Hoja) => h.componentes.map((c) => ({ i: c.id, x: c.x, y: c.y, w: c.w, h: c.h }));

// Una hoja con todo: algo arriba de la primera sección, una sección plegable cerrada, un divisor, otra sección.
//   y 0: suelto (arriba de todo, de nadie)
//   y 4: A «Ventas» (plegable, arranca plegada)   → a1 (y 5), a2 (y 5, al lado), a3 (y 9)
//   y 13: divisor (sin título, no plegable)         → cierra A; c1 (y 14) no es de nadie
//   y 18: B «Equipo» (no plegable)                  → b1 (y 19) y todo lo de abajo
const COMPS = [
  kpi('suelto', 0, 0),
  sec('A', 4, 'Ventas', { plegable: true, abierto: false }),
  kpi('a1', 0, 5), kpi('a2', 4, 5), kpi('a3', 0, 9),
  sec('cierre', 13, ''),
  kpi('c1', 0, 14),
  sec('B', 18, 'Equipo'),
  kpi('b1', 0, 19),
];

test('la membresía sale de la y: arriba de todo no es de nadie, un divisor cierra el grupo, la última se lleva lo de abajo', () => {
  const h = hoja(COMPS);
  const g = new Map(gruposDe(h.componentes).map((x) => [x.id, x] as const));
  assert.deepEqual(g.get('A')!.miembros, ['a1', 'a2', 'a3']);
  assert.equal(g.get('A')!.hasta, 13, 'el grupo de A termina donde empieza el divisor');
  assert.deepEqual(g.get('cierre')!.miembros, [], 'un divisor no agrupa nada');
  assert.equal(g.get('cierre')!.cierre, true);
  assert.deepEqual(g.get('B')!.miembros, ['b1'], 'la última sección se lleva todo lo de abajo');
  assert.equal(g.get('B')!.hasta, 23, 'el grupo de la última termina donde termina su último miembro');
  assert.ok(![...g.values()].some((x) => x.miembros.includes('suelto') || x.miembros.includes('c1')), 'lo de arriba de todo y lo de abajo de un divisor no es de nadie');
  // Una sección CON título y no plegable no es un divisor: agrupa.
  const conTitulo = h.componentes.find((c) => c.id === 'B') as ElementoSeccion;
  assert.equal(esCierre(conTitulo), false);
  // Una sección sin título PERO plegable tampoco es un divisor (se puede plegar algo).
  const plegableSinTitulo = hoja([sec('S', 0, '', { plegable: true }), kpi('x', 0, 1)]).componentes[0] as ElementoSeccion;
  assert.equal(esCierre(plegableSinTitulo), false);
});

test('plegar es de la vista: lo de entrada es lo guardado, la vista lo pisa, y lo que no es plegable no se pliega', () => {
  const h = hoja(COMPS);
  assert.deepEqual([...plegadasDeEntrada(h.componentes)], ['A']);
  assert.deepEqual([...plegadasDe(h.componentes)], ['A'], 'sin vista, lo de entrada');
  assert.deepEqual([...plegadasDe(h.componentes, { A: false })], [], 'abrirla mirando');
  assert.deepEqual([...plegadasDe(h.componentes, { B: true })], ['A'], 'B no es plegable: la vista no la pliega');
  const conB = hoja(COMPS.map((c) => (c.id === 'B' ? sec('B', 18, 'Equipo', { plegable: true }) : c)));
  assert.deepEqual([...plegadasDe(conB.componentes, { B: true })].sort(), ['A', 'B']);
  assert.deepEqual([...ocultosPorPlegado(conB.componentes, new Set(['A', 'B']))].sort(), ['a1', 'a2', 'a3', 'b1']);
  assert.deepEqual([...ocultosPorPlegado(h.componentes, new Set(['cierre']))], [], 'un divisor no esconde nada');
});

test('lo dibujado: sin lo plegado, y lo de abajo sube las filas escondidas (lo guardado no cambia)', () => {
  const h = hoja(COMPS);
  const grupos = gruposDe(h.componentes);
  const antes = JSON.stringify(h);
  const d = new Map(aVista(items(h), grupos, new Set(['A'])).map((it) => [it.i, it] as const));
  for (const id of ['a1', 'a2', 'a3']) assert.equal(d.has(id), false, `${id} está plegado`);
  assert.equal(d.get('suelto')!.y, 0);
  assert.equal(d.get('A')!.y, 4, 'la sección se queda');
  // El grupo de A ocupaba de la fila 5 a la 13: 8 filas.
  assert.equal(d.get('cierre')!.y, 5);
  assert.equal(d.get('c1')!.y, 6);
  assert.equal(d.get('B')!.y, 10);
  assert.equal(d.get('b1')!.y, 11);
  assert.equal(JSON.stringify(h), antes, 'dibujar no tocó lo guardado');
  // Sin nada plegado, lo mismo que vino.
  assert.deepEqual(aVista(items(h), grupos, new Set()), items(h));
});

test('la vuelta: lo que la grilla avisa en filas dibujadas vuelve a las guardadas (plegar y desplegar no escribe nada)', () => {
  const h = hoja(COMPS);
  const grupos = gruposDe(h.componentes);
  const plegadas = new Set(['A']);
  const guardado = items(h);
  const vistos = aVista(guardado, grupos, plegadas);
  const vuelta = aGuardado(vistos, guardado, grupos, plegadas);
  for (const it of guardado) assert.deepEqual(vuelta.get(it.i), { x: it.x, y: it.y, w: it.w, h: it.h }, `${it.i} cambió de lugar sin que nadie lo moviera`);
});

test('el orden no se pierde: mover algo con una sección plegada y desplegarla deja cada grupo en su lugar', () => {
  const h = hoja(COMPS);
  const grupos = gruposDe(h.componentes);
  const plegadas = new Set(['A']);
  const guardado = items(h);
  // Editando con A plegada, se sube «b1» arriba de todo (fila 0) y la grilla compacta: todo baja 4.
  const vistos = aVista(guardado, grupos, plegadas).map((it) => (it.i === 'b1' ? { ...it, y: 0 } : { ...it, y: it.y + 4 }));
  const vuelta = aGuardado(vistos, guardado, grupos, plegadas);
  const y = (id: string) => vuelta.get(id)!.y;
  assert.equal(y('b1'), 0);
  assert.equal(y('A'), 8, 'la sección bajó con el resto');
  // Su grupo viaja con ella: la misma distancia a la sección que tenía.
  assert.deepEqual(['a1', 'a2', 'a3'].map(y), [9, 9, 13]);
  // Y lo de abajo de A sigue DEBAJO de su grupo (no se metió adentro): el divisor y B, después de a3.
  assert.ok(y('cierre') >= 13 + 4 && y('B') > y('cierre'), `el divisor (${y('cierre')}) o B (${y('B')}) quedaron adentro del grupo de A`);
  const despues = gruposDe(hoja(COMPS.map((c) => ({ ...c, ...vuelta.get(c.id) }))).componentes);
  assert.deepEqual(despues.find((g) => g.id === 'A')!.miembros, ['a1', 'a2', 'a3'], 'el grupo de A cambió de miembros al desplegar');
});

test('el fondo de una sección: desde la sección hasta el fin de su grupo; plegada, sólo la sección', () => {
  const comps = [sec('A', 2, 'Ventas', { plegable: true, fondo: 3 }), kpi('a1', 0, 3, 4, 5), sec('B', 8, 'Equipo', { fondo: 1 }), kpi('b1', 0, 9, 4, 3)];
  const h = hoja(comps);
  const grupos = gruposDe(h.componentes);
  assert.deepEqual(fondosDe(grupos, new Set()), [{ id: 'A', fondo: 3, y: 2, filas: 6 }, { id: 'B', fondo: 1, y: 8, filas: 4 }]);
  // A plegada: su fondo es la sección; el de B sube las 5 filas escondidas.
  assert.deepEqual(fondosDe(grupos, new Set(['A'])), [{ id: 'A', fondo: 3, y: 2, filas: 1 }, { id: 'B', fondo: 1, y: 3, filas: 4 }]);
  assert.deepEqual(fondosDe(gruposDe(hoja([sec('C', 0, '', { fondo: 2 })]).componentes), new Set()), [], 'un divisor no tiene fondo');
});

test('el saneo: la sección va siempre a lo ancho, y su objeto se guarda', () => {
  const s = hoja([{ ...sec('S', 3, 'Hola', { plegable: true, abierto: false, fondo: 9 }), x: 5, w: 4 }]).componentes[0] as ElementoSeccion;
  assert.deepEqual([s.x, s.w], [0, 12]);
  assert.deepEqual(s.seccion, { fondo: null, plegable: true, abierto: false }, 'un fondo fuera de la paleta (0-7) se cae');
});

test('lo plegado no se pide (pedidosDeHoja con `ocultos`); sin `ocultos` se pide todo (la API y el CSV ven lo plegado)', () => {
  const h = hoja(COMPS);
  const todo = pedidosDeHoja(h, {}, HOY, 0).graficos.map((x) => x.g.id);
  assert.deepEqual(todo.sort(), ['a1', 'a2', 'a3', 'b1', 'c1', 'suelto']);
  const sinPlegado = pedidosDeHoja(h, {}, HOY, 0, ocultosPorPlegado(h.componentes, plegadasDeEntrada(h.componentes))).graficos.map((x) => x.g.id);
  assert.deepEqual(sinPlegado.sort(), ['b1', 'c1', 'suelto']);
});

test('la página y la pantalla piden lo mismo: la primera pintada saca lo que arranca plegado', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(leer('app/dashboard/page.tsx'), /pedidosDeHoja\(hoja, \{\}, hoy, 0, ocultosPorPlegado\(hoja\.componentes, plegadasDeEntrada\(hoja\.componentes\)\)\)/);
  const ed = leer('app/dashboard/EditorInforme.tsx');
  assert.match(ed, /const p = pedidosDeHoja\(lienzo, vista, hoy, version, noSePiden\);/);
  assert.match(ed, /const noSePiden = useMemo\(\(\) => ocultosPorPlegado\(lienzo\.componentes, plegadas\)/);
  // En el PDF sale todo desplegado.
  assert.match(ed, /const plegadas = useMemo\(\(\) => \(imprimiendo \? new Set<string>\(\) : plegadasDe\(lienzo\.componentes, plegadasVista\)\)/);
  // Y la grilla escribe lo GUARDADO: la vuelta pasa por `aGuardado`.
  const mover = ed.slice(ed.indexOf('const alMoverGrilla = useCallback('), ed.indexOf('}, [idHoja, editando]);'));
  assert.ok(mover.length > 0 && mover.length < 800, `el recorte mide ${mover.length}`);
  assert.match(mover, /aGuardado\(l, v\.guardado, v\.grupos, v\.plegadas\)/);
});
