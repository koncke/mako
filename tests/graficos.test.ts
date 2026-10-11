// Tests del Dashboard (el editor de informes): el catálogo que decide qué se puede atar a un
// gráfico (lib/graficos-catalogo.ts), el agregador que convierte filas en lo que se dibuja
// (lib/graficos-agregar.ts) y que el lector (lib/graficos-datos.ts) llene cada campo que el
// catálogo ofrece. Correr: npm test.
//
// Probados rompiéndolos (11/10/2026), con la base en 0 fallos:
//   · La razón cambiada por un valor fijo → 1 fallo («una razón se calcula…»).
//   · Los distintos sumados en vez de contados → 1 fallo («las personas se cuentan…»).
//   · La serie de tiempo sólo con los días que tienen filas → 1 fallo («el tiempo se rellena»).
//   · Sacar `agendas:` del lector de Meta → 1 fallo («el lector llena cada campo»).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FUENTES, TIPOS, sanearGrafico, sanearTablero, tableroInicial, nuevoGrafico, tituloDe, metricasPara, fuenteDe, rangoDe, rangoDeGrafico,
  nuevoControl, esGrafico, type Grafico, type Hoja,
} from '../lib/graficos-catalogo';
import { agregar, clavesDelRango, fmtValor, histograma, OTROS, SIN_DATO, type Fila } from '../lib/graficos-agregar';

const g = (r: Partial<Grafico> & Record<string, unknown>): Grafico => sanearGrafico({ id: 'g1', ...r })!;

test('sanear: una fuente que no existe no es un gráfico', () => {
  assert.equal(sanearGrafico({ fuente: 'sql_libre', tipo: 'barras' }), null);
  assert.equal(sanearGrafico(null), null);
});

test('sanear: corrige en vez de rechazar (tipo, dimensión y métricas que no sirven)', () => {
  const x = g({ fuente: 'meta', tipo: 'serie', dimension: 'campana', metricas: ['gasto', 'inventada', 'gasto'] });
  assert.equal(x.dimension, 'dia', 'una serie temporal sólo acepta tiempo');
  assert.deepEqual(x.metricas, ['gasto']);
  const n = g({ fuente: 'meta', tipo: 'numero', dimension: 'campana', metricas: ['gasto', 'leads'] });
  assert.equal(n.dimension, null);
  assert.deepEqual(n.metricas, ['gasto'], 'un cuadro de resultados tiene UNA métrica');
  // Los nombres del v1 siguen valiendo.
  assert.equal(g({ fuente: 'meta', tipo: 'linea' }).tipo, 'serie');
  assert.equal(g({ fuente: 'meta', tipo: 'torta' }).tipo, 'circular');
});

test('sanear: lo que sólo se suma (circular, embudo) no acepta razones, y el mínimo de métricas se completa', () => {
  assert.deepEqual(g({ fuente: 'meta', tipo: 'circular', dimension: 'campana', metricas: ['ctr'] }).metricas, ['gasto']);
  assert.ok(metricasPara(fuenteDe('meta')!, 'embudo').every((m) => !m.razon));
  assert.equal(g({ fuente: 'leads', tipo: 'embudo', metricas: ['leads'] }).metricas.length, 2, 'un embudo pide dos pasos');
  assert.equal(g({ fuente: 'meta', tipo: 'burbujas', metricas: [] }).metricas.length, 3);
});

test('sanear: la tabla dinámica exige el desglose; las columnas lo aceptan opcional', () => {
  const p = g({ fuente: 'leads', tipo: 'dinamica', dimension: 'closer' });
  assert.ok(p.desglose && p.desglose !== 'closer');
  assert.equal(g({ fuente: 'leads', tipo: 'columnas', dimension: 'closer' }).desglose, null);
  assert.equal(g({ fuente: 'leads', tipo: 'columnas', dimension: 'closer', desglose: 'etapa' }).desglose, 'etapa');
});

test('un informe del v1 se pasa a una hoja, y uno sin hojas no se pierde', () => {
  const v1 = sanearTablero({ graficos: [{ id: 'x', fuente: 'meta', tipo: 'numero' }, { id: 'x', fuente: 'leads', tipo: 'numero' }] })!;
  assert.equal(v1.hojas.length, 1);
  assert.equal(v1.hojas[0].componentes.length, 2);
  assert.notEqual(v1.hojas[0].componentes[0].id, v1.hojas[0].componentes[1].id, 'dos ids iguales no comparten la key de la grilla');
  assert.equal(sanearTablero({ nada: 1 }), null, 'lo que no se entiende no es un informe vacío');
  assert.equal(sanearTablero({ hojas: [] })!.hojas.length, 1);
});

test('el informe inicial trae las hojas Marketing y Comercial, y todo sale válido', () => {
  const t = tableroInicial();
  assert.deepEqual(t.hojas.map((h) => h.id), ['marketing', 'comercial']);
  for (const h of t.hojas) for (const c of h.componentes) assert.deepEqual(sanearGrafico(c), c);
  for (const x of TIPOS) { const n = nuevoGrafico(x.id, []); assert.deepEqual(sanearGrafico(n), n, x.id); }
  assert.equal(tituloDe(g({ fuente: 'meta', tipo: 'circular', dimension: 'campana', metricas: ['gasto'] })), 'Gasto por campaña');
});

test('el período: los presets, y el control de la hoja manda sobre el «Automático»', () => {
  assert.deepEqual(rangoDe('ult7', '2026-10-11'), { desde: '2026-10-05', hasta: '2026-10-11' });
  assert.deepEqual(rangoDe('mes_pasado', '2026-01-15'), { desde: '2025-12-01', hasta: '2025-12-31' });
  assert.deepEqual(rangoDe('este_mes', '2026-10-11'), { desde: '2026-10-01', hasta: '2026-10-11' });
  const graf = g({ fuente: 'meta', tipo: 'numero' });
  const control = { ...nuevoControl([]), preset: 'ult7' as const };
  const hoja: Hoja = { id: 'h', nombre: 'H', componentes: [graf, control] };
  assert.deepEqual(rangoDeGrafico(graf, hoja, '2026-10-11'), { desde: '2026-10-05', hasta: '2026-10-11' });
  assert.deepEqual(rangoDeGrafico({ ...graf, periodo: 'ayer' }, hoja, '2026-10-11'), { desde: '2026-10-10', hasta: '2026-10-10' }, 'el período propio gana');
  assert.deepEqual(rangoDeGrafico(graf, { ...hoja, componentes: [graf] }, '2026-10-11'), { desde: '2026-09-12', hasta: '2026-10-11' }, 'sin control, 30 días');
});

const filasMeta: Fila[] = [
  { f: '2026-10-01', d: { campana: 'A' }, v: { gasto: 100, clics: 10, impresiones: 1000 }, u: { anuncios: 'a1' } },
  { f: '2026-10-01', d: { campana: 'B' }, v: { gasto: 50, clics: 1, impresiones: 10 }, u: { anuncios: 'b1' } },
  { f: '2026-10-03', d: { campana: 'A' }, v: { gasto: 30, clics: 0, impresiones: 1000 }, u: { anuncios: 'a1' } },
  { f: '2026-10-03', d: { campana: null }, v: { gasto: 5, clics: 0, impresiones: 0 }, u: { anuncios: 'x9' } },
];

test('una razón se calcula sobre lo SUMADO del grupo, no promediando filas', () => {
  const r = agregar(g({ fuente: 'meta', tipo: 'tabla', dimension: 'campana', metricas: ['ctr'] }), filasMeta, '2026-10-01', '2026-10-03');
  assert.equal(r.filas.find((f) => f.clave === 'A')!.valores[0], 0.5);
  assert.ok(Math.abs((r.totales[0] ?? 0) - (11 / 2010) * 100) < 1e-9);
});

test('las personas (los distintos) se cuentan en el grupo, no se suman', () => {
  const r = agregar(g({ fuente: 'meta', tipo: 'tabla', dimension: 'campana', metricas: ['anuncios'] }), filasMeta, '2026-10-01', '2026-10-03');
  assert.equal(r.filas.find((f) => f.clave === 'A')!.valores[0], 1, 'el mismo anuncio dos días es UN anuncio');
  assert.equal(r.totales[0], 3);
});

test('el tiempo se rellena: un día sin filas es un cero, no un día que falta', () => {
  const r = agregar(g({ fuente: 'meta', tipo: 'serie', dimension: 'dia', metricas: ['gasto'] }), filasMeta, '2026-10-01', '2026-10-03');
  assert.deepEqual(r.filas.map((f) => f.clave), ['2026-10-01', '2026-10-02', '2026-10-03']);
  assert.deepEqual(r.filas.map((f) => f.valores[0]), [150, 0, 35]);
  assert.deepEqual(clavesDelRango('mes', '2026-11-15', '2027-01-02'), ['2026-11-01', '2026-12-01', '2027-01-01']);
  assert.deepEqual(clavesDelRango('semana', '2026-10-01', '2026-10-12'), ['2026-09-28', '2026-10-05', '2026-10-12']);
});

test('la circular suma el total: lo que no entra va a «Otros», y lo vacío a «(sin dato)»', () => {
  const r = agregar(g({ fuente: 'meta', tipo: 'circular', dimension: 'campana', metricas: ['gasto'], limite: 3 }), [
    ...filasMeta,
    { f: '2026-10-02', d: { campana: 'C' }, v: { gasto: 20 } },
    { f: '2026-10-02', d: { campana: 'D' }, v: { gasto: 10 } },
  ], '2026-10-01', '2026-10-03');
  assert.deepEqual(r.filas.map((f) => f.etiqueta), ['A', 'B', OTROS]);
  assert.equal(r.filas.reduce((s, f) => s + (f.valores[0] ?? 0), 0), r.totales[0]);
  const todas = agregar(g({ fuente: 'meta', tipo: 'barras', dimension: 'campana', metricas: ['gasto'], limite: 50 }), filasMeta, '2026-10-01', '2026-10-03');
  assert.equal(todas.filas.at(-1)!.etiqueta, SIN_DATO, '«(sin dato)» va al final');
});

test('el desglose arma el cruce sobre la primera métrica, y cuadra con la fila', () => {
  const filas: Fila[] = [
    { f: '2026-10-01', d: { closer: 'Ana', etapa: 'Ganado' }, v: { leads: 1 } },
    { f: '2026-10-01', d: { closer: 'Ana', etapa: 'Perdido' }, v: { leads: 1 } },
    { f: '2026-10-02', d: { closer: 'Beto', etapa: 'Ganado' }, v: { leads: 1 } },
  ];
  const r = agregar(g({ fuente: 'leads', tipo: 'dinamica', dimension: 'closer', desglose: 'etapa', metricas: ['leads'] }), filas, '2026-10-01', '2026-10-02');
  assert.deepEqual(r.cruce!.claves, ['Ganado', 'Perdido']);
  assert.deepEqual(r.cruce!.celdas, [[1, 1], [1, 0]]);
  r.filas.forEach((f, i) => assert.equal(r.cruce!.celdas[i].reduce<number>((s, v) => s + (v ?? 0), 0), f.valores[0]));
});

test('la cronología guarda cuándo empezó y terminó cada grupo; el histograma reparte en franjas', () => {
  const r = agregar(g({ fuente: 'meta', tipo: 'cronologia', dimension: 'campana', metricas: ['gasto'] }), filasMeta, '2026-10-01', '2026-10-03');
  const a = r.filas.find((f) => f.clave === 'A')!;
  assert.equal(a.desde, '2026-10-01');
  assert.equal(a.hasta, '2026-10-03');
  const h = histograma([1, 2, 3, 10], 3);
  assert.equal(h.reduce((s, x) => s + x.cuantos, 0), 4);
});

test('fmtValor: plata, porcentaje, veces, segundos y lo que no se puede calcular', () => {
  assert.equal(fmtValor(null, 'usd'), '—');
  assert.equal(fmtValor(12.5, 'pct'), '12,5%');
  assert.equal(fmtValor(2.345, 'veces'), '2,35x');
  assert.equal(fmtValor(125, 'segundos'), '2 min 5 s');
  assert.match(fmtValor(1234, 'usd'), /^US\$1\.234$/);
  assert.equal(fmtValor(0, 'usd'), 'US$0');
});

test('el lector llena cada métrica base y cada dimensión de cada conjunto del catálogo', () => {
  const src = readFileSync(join(__dirname, '..', 'lib', 'graficos-datos.ts'), 'utf8').replace(/\r\n/g, '\n');
  const lectores = src.slice(src.indexOf('export const LECTORES'), src.indexOf('};', src.indexOf('export const LECTORES')));
  // La clave puede ir con valor (`gasto: …`) o abreviada (`{ estado, … }`).
  const llena = (id: string) => new RegExp(`(?:\\b${id}:|[{,]\\s*${id}\\s*[,}])`);
  for (const f of FUENTES) {
    const m = new RegExp(`\\b${f.id}: \\([^)]*\\) => (\\w+)\\(`).exec(lectores);
    assert.ok(m, `falta el lector de ${f.id} en LECTORES`);
    const ini = src.indexOf(`async function ${m![1]}(`);
    assert.ok(ini >= 0, `no encuentro ${m![1]}`);
    const fin = src.indexOf('\nasync function ', ini + 10);
    const cuerpo = src.slice(ini, fin < 0 ? undefined : fin);
    for (const x of f.metricas.filter((y) => !y.razon)) assert.match(cuerpo, llena(x.id), `${f.id} no llena la métrica ${x.id}`);
    for (const d of f.dimensiones.filter((y) => y.clase === 'categoria')) assert.match(cuerpo, llena(d.id), `${f.id} no llena la dimensión ${d.id}`);
    for (const x of f.metricas.filter((y) => y.razon)) {
      assert.ok(f.metricas.some((b) => b.id === x.razon!.num && !b.razon), `${f.id}.${x.id}: el numerador no es una base`);
      assert.ok(f.metricas.some((b) => b.id === x.razon!.den && !b.razon), `${f.id}.${x.id}: el denominador no es una base`);
    }
  }
});

test('ningún componente del informe inicial se queda sin fuente conocida', () => {
  for (const h of tableroInicial().hojas) for (const c of h.componentes) if (esGrafico(c)) assert.ok(fuenteDe(c.fuente), c.fuente);
});
