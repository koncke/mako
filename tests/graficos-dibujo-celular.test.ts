// Tests del rediseño del Dashboard tipo por tipo (14/10/2026, Martín: «Que rediseñe bloque por bloque y que tenga en cuenta
// mobile... con datos ficticios»). Lo que se vio en el arnés de capturas y se volvió regla:
//   · las etiquetas del eje X son las que ENTRAN (`intervaloPorAncho`, lib/graficos-gordo.ts);
//   · los datos de ejemplo (lib/graficos-muestra.ts, que también dibujan la galería de plantillas) tienen que ser creíbles:
//     conteos enteros, una razón que promedia, un embudo que baja, una tabla dinámica que suma;
//   · la leyenda sigue el orden del gráfico, no el alfabético de recharts.
// Correr: npx tsx --test tests/graficos-dibujo-celular.test.ts
//
// Probados rompiéndolos (14/10/2026), con la base en 8 pases y 0 fallos, restaurando de memoria:
//   · `intervaloPorAncho` sin la cuenta por ancho (sólo el tope)         -> 6 / 2 («categorías…», «el histograma…»)
//   · `intervaloPorAncho` con el tope de cinco también para categorías    -> 7 / 1 («categorías…», el caso de los ocho)
//   · la muestra sin redondear los conteos del ranking                    -> 7 / 1 («conteos enteros…»)
//   · `esRazonDe` mirando sólo el formato (como antes)                    -> 7 / 1 («una razón en plata…»)
//   · sin la bajada del embudo de ejemplo                                 -> 7 / 1 («el embudo de ejemplo baja»)
//   · sin el total por fila de la dinámica                                -> 7 / 1 («la dinámica de ejemplo suma»)
//   · un <Legend> sin itemSorter={null}                                    -> 7 / 1 («la leyenda sigue el orden…»)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { intervaloPorAncho, anchoTexto } from '../lib/graficos-gordo';
import { resultadoDeMuestra } from '../lib/graficos-muestra';
import { sanearGrafico, type Grafico } from '../lib/graficos-catalogo';

const HOY = '2026-10-14';
const g = (raw: Record<string, unknown>): Grafico => sanearGrafico({ id: 'g-test', x: 0, y: 0, w: 6, h: 8, ...raw })!;
/** Cuántas etiquetas se dibujan con un intervalo dado (recharts: una, y después saltea `k`). */
const visibles = (n: number, k: number) => Math.ceil(n / (k + 1));

test('categorías: todas las etiquetas si entran; si no, las que entran sin pisarse', () => {
  const cinco = ['Nuevo', 'Agendó', 'Asistió', 'Propuesta', 'Cerró'];
  assert.equal(intervaloPorAncho(cinco, 460, null), 0, 'cinco etapas en media hoja entran todas');
  const ocho = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Fede', 'Gabi', 'Hugo'];
  assert.equal(intervaloPorAncho(ocho, 700, null), 0, 'ocho nombres cortos a lo ancho: los ocho (el tope de cinco es del tiempo)');
  const doce = Array.from({ length: 12 }, (_, i) => `Opción ${i + 1}`);
  const k = intervaloPorAncho(doce, 300, null);
  assert.ok(k > 0, 'doce nombres no entran en 300 px');
  // Las que se dibujan, entran: su ancho más el aire no pasa del lugar de cada una.
  const largo = Math.max(...doce.map((e) => anchoTexto(e))) + 14;
  assert.ok(visibles(12, k) * largo <= 300 + largo, `con intervalo ${k} se dibujan ${visibles(12, k)} y no entran`);
});

test('el tiempo: como mucho cinco marcas, aunque entren más', () => {
  const dias = Array.from({ length: 14 }, (_, i) => `${String(i + 1).padStart(2, '0')}/10`);
  const k = intervaloPorAncho(dias, 2000);
  assert.ok(visibles(14, k) <= 5, `a lo ancho se dibujan ${visibles(14, k)}`);
});

test('el histograma: «US$59–97» en el celular no se encima con la de al lado', () => {
  const franjas = ['US$59–97', 'US$97–135', 'US$135–174', 'US$174–212', 'US$212–250', 'US$250–288', 'US$288–326', 'US$326–365', 'US$365–403'];
  const k = intervaloPorAncho(franjas, 280, null);
  const largo = Math.max(...franjas.map((e) => anchoTexto(e))) + 14;
  assert.ok((k + 1) * (280 / franjas.length) >= largo, `con intervalo ${k}, cada etiqueta tiene ${((k + 1) * 280 / franjas.length).toFixed(0)} px y pide ${largo}`);
});

test('conteos enteros en el ranking de ejemplo (antes: «4,8 leads»)', () => {
  const r = resultadoDeMuestra(g({ tipo: 'tabla', fuente: 'leads', metricas: ['agendas', 'cierres'], dimension: 'closer' }), HOY);
  for (const f of r.filas) for (const v of f.valores) assert.equal(v, Math.round(v ?? 0), `${f.etiqueta}: ${v}`);
});

test('una razón en plata (el costo por lead) promedia en el total; no se suma', () => {
  const r = resultadoDeMuestra(g({ tipo: 'tabla', fuente: 'meta', metricas: ['gasto', 'cpl'], dimension: 'campana' }), HOY);
  const cpl = r.filas.map((f) => f.valores[1] ?? 0);
  const promedio = cpl.reduce((s, v) => s + v, 0) / cpl.length;
  assert.ok(Math.abs((r.totales[1] ?? 0) - promedio) < 1, `total ${r.totales[1]} contra el promedio ${promedio.toFixed(1)}`);
});

test('el embudo de ejemplo baja de escalón en escalón', () => {
  const r = resultadoDeMuestra(g({ tipo: 'embudo_vertical', fuente: 'leads', metricas: ['leads', 'agendas', 'asistencias', 'cierres'] }), HOY);
  for (let i = 1; i < r.totales.length; i++) assert.ok((r.totales[i] ?? 0) <= (r.totales[i - 1] ?? 0), `escalón ${i}: ${r.totales.join(' → ')}`);
});

test('la dinámica de ejemplo suma: el total de cada fila es la suma de sus celdas', () => {
  const r = resultadoDeMuestra(g({ tipo: 'dinamica', fuente: 'leads', metricas: ['leads'], dimension: 'etapa', desglose: 'producto' }), HOY);
  assert.ok(r.cruce, 'trae el cruce');
  r.filas.forEach((f, i) => assert.equal(f.valores[0], r.cruce!.celdas[i].reduce<number>((s, v) => s + (v ?? 0), 0), f.etiqueta));
});

test('la leyenda sigue el orden del gráfico: todo <Legend> lleva itemSorter={null}', () => {
  const src = readFileSync(join(__dirname, '../app/dashboard/Grafico.tsx'), 'utf8').replace(/\r\n/g, '\n')
    .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const leyendas = [...src.matchAll(/<Legend\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(leyendas.length > 0, 'hay leyendas de recharts');
  for (const l of leyendas) assert.match(l, /itemSorter=\{null\}/, l.slice(0, 80));
});
