// Tests de «Mis gráficos» (Graphics): el catálogo que decide qué se puede atar a un gráfico
// (lib/graficos-catalogo.ts), el agregador que convierte filas en lo que se dibuja
// (lib/graficos-agregar.ts) y que el lector (lib/graficos-datos.ts) llene cada campo que el
// catálogo ofrece. Correr: npm test.
//
// Probados rompiéndolos (10/10/2026), con la base en 0 fallos:
//   · La razón cambiada por un valor fijo → pass 9, fail 1 («una razón se calcula…»).
//   · La serie de tiempo sólo con los días que tienen filas → pass 9, fail 1 («el tiempo se rellena»).
//   · «Otros» sin sumar el resto → pass 9, fail 1 («la torta suma el total»).
//   · Sacar `agendas:` del lector de Meta → pass 9, fail 1 («el lector llena cada métrica base»).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FUENTES, TIPOS, sanearGrafico, sanearTablero, tableroInicial, nuevoGrafico, tituloDe, metricasPara, fuenteDe,
  type Grafico,
} from '../lib/graficos-catalogo';
import { agregar, clavesDelRango, fmtValor, OTROS, SIN_DATO, type Fila } from '../lib/graficos-agregar';

const g = (r: Partial<Grafico>): Grafico => sanearGrafico({ id: 'g1', ...r })!;

test('sanear: una fuente que no existe no es un gráfico', () => {
  assert.equal(sanearGrafico({ fuente: 'sql_libre', tipo: 'barras' }), null);
  assert.equal(sanearGrafico(null), null);
});

test('sanear: corrige en vez de rechazar (tipo, dimensión y métricas que no sirven)', () => {
  const x = sanearGrafico({ id: 'a', fuente: 'meta', tipo: 'linea', dimension: 'campana', metricas: ['gasto', 'inventada', 'gasto'] })!;
  assert.equal(x.dimension, 'dia', 'una línea sólo acepta tiempo');
  assert.deepEqual(x.metricas, ['gasto']);
  const n = sanearGrafico({ id: 'b', fuente: 'meta', tipo: 'numero', dimension: 'campana', metricas: ['gasto', 'leads'] })!;
  assert.equal(n.dimension, null);
  assert.deepEqual(n.metricas, ['gasto'], 'un número tiene UNA métrica');
});

test('sanear: una torta no acepta razones (un CTR en porciones no suma 100% de nada)', () => {
  const t = sanearGrafico({ id: 'c', fuente: 'meta', tipo: 'torta', dimension: 'campana', metricas: ['ctr'] })!;
  assert.deepEqual(t.metricas, ['gasto']);
  assert.ok(metricasPara(fuenteDe('meta')!, 'torta').every((m) => !m.razon));
});

test('sanear: dos gráficos con el mismo id no comparten la key de la grilla', () => {
  const t = sanearTablero({ graficos: [{ id: 'x', fuente: 'meta', tipo: 'numero' }, { id: 'x', fuente: 'leads', tipo: 'numero' }] })!;
  assert.equal(t.graficos.length, 2);
  assert.notEqual(t.graficos[0].id, t.graficos[1].id);
  assert.equal(sanearTablero({ nada: 1 }), null, 'lo que no se entiende no es un tablero vacío');
});

test('el tablero inicial y los gráficos nuevos salen válidos', () => {
  for (const x of tableroInicial().graficos) assert.deepEqual(sanearGrafico(x), x);
  for (const t of TIPOS) {
    const n = nuevoGrafico(t.id, []);
    assert.deepEqual(sanearGrafico(n), n, t.id);
  }
  assert.equal(tituloDe(g({ fuente: 'meta', tipo: 'torta', dimension: 'campana', metricas: ['gasto'] })), 'Gasto por campaña');
});

const filasMeta: Fila[] = [
  { f: '2026-10-01', d: { campana: 'A' }, v: { gasto: 100, clics: 10, impresiones: 1000 } },
  { f: '2026-10-01', d: { campana: 'B' }, v: { gasto: 50, clics: 1, impresiones: 10 } },
  { f: '2026-10-03', d: { campana: 'A' }, v: { gasto: 30, clics: 0, impresiones: 1000 } },
  { f: '2026-10-03', d: { campana: null }, v: { gasto: 5, clics: 0, impresiones: 0 } },
];

test('una razón se calcula sobre lo SUMADO del grupo, no promediando filas', () => {
  const r = agregar(g({ fuente: 'meta', tipo: 'tabla', dimension: 'campana', metricas: ['ctr'] }), filasMeta, '2026-10-01', '2026-10-03');
  const a = r.filas.find((f) => f.clave === 'A')!;
  // A: 10 clics / 2000 impresiones = 0,5%. El promedio de 1% y 0% daría 0,5 también, así que
  // se mira B+A juntos en el total: 11 / 2010 = 0,547…%, y el promedio de filas daría 2,75%.
  assert.equal(a.valores[0], 0.5);
  assert.ok(Math.abs((r.totales[0] ?? 0) - (11 / 2010) * 100) < 1e-9);
});

test('el tiempo se rellena: un día sin filas es un cero, no un día que falta', () => {
  const r = agregar(g({ fuente: 'meta', tipo: 'linea', dimension: 'dia', metricas: ['gasto'] }), filasMeta, '2026-10-01', '2026-10-03');
  assert.deepEqual(r.filas.map((f) => f.clave), ['2026-10-01', '2026-10-02', '2026-10-03']);
  assert.deepEqual(r.filas.map((f) => f.valores[0]), [150, 0, 35]);
  assert.deepEqual(clavesDelRango('mes', '2026-11-15', '2027-01-02'), ['2026-11-01', '2026-12-01', '2027-01-01']);
  assert.deepEqual(clavesDelRango('semana', '2026-10-01', '2026-10-12'), ['2026-09-28', '2026-10-05', '2026-10-12']);
});

test('la torta suma el total: lo que no entra va a «Otros», y lo vacío a «(sin dato)»', () => {
  const r = agregar(g({ fuente: 'meta', tipo: 'torta', dimension: 'campana', metricas: ['gasto'], limite: 3 }), [
    ...filasMeta,
    { f: '2026-10-02', d: { campana: 'C' }, v: { gasto: 20 } },
    { f: '2026-10-02', d: { campana: 'D' }, v: { gasto: 10 } },
  ], '2026-10-01', '2026-10-03');
  assert.deepEqual(r.filas.map((f) => f.etiqueta), ['A', 'B', OTROS]);
  const suma = r.filas.reduce((s, f) => s + (f.valores[0] ?? 0), 0);
  assert.equal(suma, r.totales[0]);
  assert.equal(r.totales[0], 215);
  const sinLimite = agregar(g({ fuente: 'meta', tipo: 'barras', dimension: 'campana', metricas: ['gasto'], limite: 50 }), filasMeta, '2026-10-01', '2026-10-03');
  assert.equal(sinLimite.filas.at(-1)!.etiqueta, SIN_DATO, '«(sin dato)» va al final');
});

test('fmtValor: plata, porcentaje y lo que no se puede calcular', () => {
  assert.equal(fmtValor(null, 'usd'), '—');
  assert.equal(fmtValor(12.5, 'pct'), '12,5%');
  assert.match(fmtValor(1234, 'usd'), /^US\$1\.234$/);
});

test('el lector llena cada métrica base y cada dimensión que el catálogo ofrece', () => {
  const src = readFileSync(join(__dirname, '..', 'lib', 'graficos-datos.ts'), 'utf8').replace(/\r\n/g, '\n');
  const bloque = (desde: string, hasta: string) => src.slice(src.indexOf(desde), src.indexOf(hasta, src.indexOf(desde)));
  const lectores: Record<string, string> = {
    meta: bloque('async function filasMeta', 'type FilaLead'),
    leads: bloque('async function filasLeads', 'type FilaPago'),
    pagos: bloque('async function filasPagos', 'export async function filasDeFuente'),
  };
  // La clave puede ir con valor (`gasto: …`) o abreviada (`{ monto, … }`).
  const llena = (id: string) => new RegExp(`(?:\\b${id}:|[{,]\\s*${id}\\s*[,}])`);
  for (const f of FUENTES) {
    const cuerpo = lectores[f.id];
    assert.ok(cuerpo && cuerpo.length > 200, `falta el lector de ${f.id}`);
    for (const m of f.metricas.filter((x) => !x.razon)) assert.match(cuerpo, llena(m.id), `${f.id} no llena la métrica ${m.id}`);
    for (const d of f.dimensiones.filter((x) => x.clase === 'categoria')) assert.match(cuerpo, llena(d.id), `${f.id} no llena la dimensión ${d.id}`);
    for (const m of f.metricas.filter((x) => x.razon)) {
      assert.ok(f.metricas.some((b) => b.id === m.razon!.num && !b.razon), `${m.id}: el numerador no es una base`);
      assert.ok(f.metricas.some((b) => b.id === m.razon!.den && !b.razon), `${m.id}: el denominador no es una base`);
    }
  }
});
