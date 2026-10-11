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
// Y la réplica de las tabs viejas (11/10/2026, base en 0 fallos, 19 tests):
//   · El tope de la tabla de vuelta a 6 métricas → 1 fallo («la réplica… sin perder una métrica»).
//   · El ciclo dividido por todos los cierres → 1 fallo («el ciclo de venta se promedia…»).
//   · El período anterior un día más largo → 1 fallo («comparar: …»).
//   · El negocio sin `vistas_vsl` → 1 fallo («el lector llena cada campo»).
//   · El lector sin `resultado.anterior` → 1 fallo («comparar: …»).
//   · La grilla escribiendo sin estar editando → 1 fallo de 20 («mirar no guarda»).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FUENTES, TIPOS, sanearGrafico, sanearTablero, tableroInicial, nuevoGrafico, tituloDe, metricasPara, fuenteDe, rangoDe, rangoDeGrafico,
  nuevoControl, esGrafico, type Grafico, type Hoja,
} from '../lib/graficos-catalogo';
import { agregar, chipComparar, clavesDelRango, fmtValor, histograma, OTROS, periodoAnterior, SIN_DATO, type Fila } from '../lib/graficos-agregar';

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

test('el informe inicial es la réplica de las tabs viejas: los bloques en su lugar y sin perder una métrica', () => {
  const [mk, co] = tableroInicial().hojas;
  const graf = (h: Hoja) => h.componentes.filter(esGrafico);
  // Marketing, primera fila: las cuatro KPI estrella, en el orden de antes.
  const fila1 = graf(mk).filter((c) => c.y === 0).sort((a, b) => a.x - b.x);
  assert.deepEqual(fila1.map((c) => c.titulo), ['Ad Spend', 'CAC real', 'ROAS cash', 'ROAS sold']);
  assert.deepEqual(fila1.map((c) => c.metricas[0]), ['gasto', 'cac', 'roas_cobrado', 'roas_vendido']);
  assert.ok(fila1[0].estilo.comparar, 'el Ad Spend trae el chip contra el período anterior');
  assert.deepEqual(graf(mk).find((c) => c.tipo === 'embudo_vertical')?.metricas, ['impresiones', 'clics', 'vistas_landing', 'vistas_vsl']);
  assert.deepEqual(graf(co).find((c) => c.tipo === 'embudo_vertical')?.metricas, ['agendas', 'asistencias', 'calificados', 'cierres']);
  // Las cohortes con sus ocho columnas: el saneo no se comió ninguna (el tope de la tabla era 6).
  const coh = graf(co).find((c) => c.titulo === 'Cohortes mensuales')!;
  assert.deepEqual(coh.metricas, ['agendas', 'asistencias', 'no_show', 'calificados', 'cierres', 'tasa_cierre', 'ciclo', 'vendido']);
  // Nadie se pisa en la grilla: la compactación correría lo de abajo y lo sacaría de su lugar.
  for (const h of [mk, co]) {
    const cs = h.componentes;
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j];
      const pisa = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!pisa, `${h.nombre}: se pisan ${(a as Grafico).titulo} y ${(b as Grafico).titulo}`);
    }
  }
});

test('el ciclo de venta se promedia sobre los que tienen las dos fechas, no sobre todos los cierres', () => {
  const filas: Fila[] = [
    { f: '2026-10-01', d: {}, v: { dias_ciclo: 10, con_ciclo: 1, cierres: 1 } },
    { f: '2026-10-02', d: {}, v: { dias_ciclo: 0, con_ciclo: 0, cierres: 1 } },
    { f: '2026-10-03', d: {}, v: { dias_ciclo: 20, con_ciclo: 1, cierres: 1 } },
  ];
  const r = agregar(g({ fuente: 'leads', tipo: 'numero', fecha: 'cierre', metricas: ['ciclo'] }), filas, '2026-10-01', '2026-10-31');
  assert.equal(r.totales[0], 15);
});

test('comparar: el período anterior es del mismo largo y termina el día antes; el chip no divide por cero', () => {
  assert.deepEqual(periodoAnterior('2026-10-01', '2026-10-30'), { desde: '2026-09-01', hasta: '2026-09-30' });
  assert.deepEqual(periodoAnterior('2026-10-11', '2026-10-11'), { desde: '2026-10-10', hasta: '2026-10-10' });
  assert.deepEqual(periodoAnterior('2026-03-01', '2026-03-31'), { desde: '2026-01-29', hasta: '2026-02-28' });
  assert.equal(chipComparar(130, 100), '↑ 1,3×');
  assert.equal(chipComparar(80, 100), '↓ 0,8×');
  assert.equal(chipComparar(5, 0), null);
  assert.equal(chipComparar(null, 3), null);
  // Y el lector lo pide de verdad: con `comparar`, los totales del período anterior viajan en `anterior`.
  const src = readFileSync(join(__dirname, '..', 'lib', 'graficos-datos.ts'), 'utf8').replace(/\r\n/g, '\n');
  const cuerpo = src.slice(src.indexOf('export async function datosDeGraficos'));
  assert.ok(cuerpo.includes('g.estilo.comparar && !sinRango ? periodoAnterior(p.desde, hasta)'), 'el lector no pide el período anterior');
  assert.ok(cuerpo.includes('resultado.anterior = agregar(g, await lecturas.get(claveAnt)!, ant.desde, ant.hasta).totales'), 'el lector no devuelve los totales anteriores');
});

test('mirar no guarda: la grilla sólo escribe el informe mientras se edita', () => {
  // La grilla avisa un cambio al montar (compacta lo que vino) y el autoguardado lo escribía: abrir
  // el Dashboard congelaba una copia del informe inicial (el de Mauricio, 11/10 a las 01:59).
  const src = readFileSync(join(__dirname, '..', 'app', 'dashboard', 'EditorInforme.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const ini = src.indexOf('const alMoverGrilla = useCallback(');
  assert.ok(ini >= 0, 'no encuentro alMoverGrilla');
  const cuerpo = src.slice(ini, src.indexOf('}, [idHoja, editando]);', ini));
  assert.ok(cuerpo.length > 0 && cuerpo.length < 1500, `el recorte mide ${cuerpo.length}: está mirando otra cosa`);
  assert.match(cuerpo, /^const alMoverGrilla = useCallback\(\(l: Layout\) => \{\n\s*if \(!editando\) return;/);
});
