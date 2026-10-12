// El agregador del Dashboard v5 (lib/graficos-agregar.ts): lo que sumó el contrato para que los bloques de
// antes sean gráficos — la métrica PERCENTIL, la razón con MÍNIMO («X de Y»), la dimensión con VALORES FIJOS,
// el atributo que falta (null, no 0), las opciones de tabla (sin vacíos, del más nuevo, el límite, columnas
// extra), la miniatura y las coordenadas de un grupo, la métrica secundaria y la dispersión sin recorte.
// Correr: npx tsx --test tests/graficos-datos-agregar.test.ts
//
// Probados rompiéndolos (12/10/2026, arnés que restaura de memoria), con la base en 0 fallos (11 tests):
//   · `percentilDe` con Math.ceil en vez de Math.floor (otra posición que getSCL)    → 10 pass / 1 fail («el P90…»)
//   · `valor` sin el `minimo` (la razón sale igual con 2 casos)                    → 10 pass / 1 fail («la razón con mínimo…»)
//   · la escala de valores fijos sin los vacíos (sólo las que tienen filas)         → 10 pass / 1 fail («valores fijos…»)
//   · el atributo sin el `n` (vuelve el 0 en vez de null)                           → 10 pass / 1 fail («un atributo…»)
//   · `descendente` sin el recorte a las N más nuevas                               → 10 pass / 1 fail («la tabla de cohortes…»)
//   · `textoExtra` devolviendo el más frecuente solo (sin «+N»)                     → 10 pass / 1 fail («columnas extra…»)
//   · la miniatura de la PRIMERA fila del grupo y no la más reciente               → 10 pass / 1 fail («la miniatura…»)
//   · 'dispersion' fuera de SIN_RECORTE                                             → 10 pass / 1 fail («la dispersión…»)
//   · la secundaria sin leer (`mSec` siempre undefined)                             → 10 pass / 1 fail («la métrica secundaria…»)
//   · el percentil metiendo un 0 por cada fila sin dato                             → 10 pass / 1 fail («una mediana…»)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanearGrafico, type Grafico } from '../lib/graficos-catalogo';
import { agregar, percentilDe, SIN_DATO, type Fila } from '../lib/graficos-agregar';

/** Un gráfico del catálogo con los campos del v5 que el saneo de P1 puede todavía no conservar. */
const g = (base: Record<string, unknown>, extra: Record<string, unknown> = {}): Grafico => ({ ...sanearGrafico({ id: 'g1', ...base })!, ...extra } as Grafico);

test('el P90 del ciclo: la posición floor(0,9·(n−1)) de la lista ordenada, como getSCL', () => {
  assert.equal(percentilDe([10, 1, 5, 7, 3, 9, 2, 8, 4, 6], 90), 9);
  assert.equal(percentilDe([4], 90), 4);
  assert.equal(percentilDe([], 90), null);
  // En el agregador, la lista es la del CICLO de cada lead (dias_ciclo ÷ con_ciclo de cada fila): un lead sin
  // ciclo (con_ciclo 0) no es un cero, no entra.
  const filas: Fila[] = [
    ...[3, 5, 8, 13, 21, 34, 55, 89, 144, 233].map((d, i) => ({ f: `2026-10-${String(i + 1).padStart(2, '0')}`, d: {}, v: { dias_ciclo: d, con_ciclo: 1, leads: 1 } })),
    { f: '2026-10-11', d: {}, v: { dias_ciclo: 0, con_ciclo: 0, leads: 1 } },
  ];
  const r = agregar(g({ fuente: 'leads', tipo: 'numero', metricas: ['p90_ciclo'] }), filas, '2026-10-01', '2026-10-31');
  assert.equal(r.totales[0], 144);
});

test('la razón con mínimo: con menos casos que el mínimo no hay porcentaje, hay «X de Y»', () => {
  // tasa_cierre_calificadas = cierres ÷ limpias, mínimo 3 (el ratio de cierre de la «Salud del funnel»).
  const dos: Fila[] = [
    { f: '2026-10-01', d: {}, v: { cierres: 1, limpias: 1 } },
    { f: '2026-10-02', d: {}, v: { cierres: 0, limpias: 1 } },
  ];
  const r = agregar(g({ fuente: 'leads', tipo: 'numero', fecha: 'agenda', metricas: ['tasa_cierre_calificadas'] }), dos, '2026-10-01', '2026-10-31');
  assert.equal(r.totales[0], null, 'un 50% sobre 2 casos se leería como un dato firme');
  assert.deepEqual(r.muestraChica, [{ num: 1, den: 2 }]);
  const tres = [...dos, { f: '2026-10-03', d: {}, v: { cierres: 1, limpias: 1 } }];
  const r3 = agregar(g({ fuente: 'leads', tipo: 'numero', fecha: 'agenda', metricas: ['tasa_cierre_calificadas'] }), tres, '2026-10-01', '2026-10-31');
  assert.ok(Math.abs((r3.totales[0] ?? 0) - 66.666) < 0.01);
  assert.equal(r3.muestraChica, undefined);
  // Sin ningún caso no es «0 de 0»: es «—» (null), como siempre.
  const cero = agregar(g({ fuente: 'leads', tipo: 'numero', fecha: 'agenda', metricas: ['tasa_cierre_calificadas'] }), [], '2026-10-01', '2026-10-31');
  assert.equal(cero.totales[0], null);
  assert.equal(cero.muestraChica, undefined);
});

test('valores fijos: la escala en SU orden, con los vacíos en cero y lo que no está en la escala al final', () => {
  // La pirámide: Alta, Media, Baja, A futuro — no alfabética ni por tamaño, y una banda sin tareas existe.
  const filas: Fila[] = [
    { f: null, d: { prioridad: 'Baja' }, v: { activas: 5 } },
    { f: null, d: { prioridad: 'Alta' }, v: { activas: 2 } },
    { f: null, d: { prioridad: 'Otra' }, v: { activas: 1 } },
    { f: null, d: { prioridad: null }, v: { activas: 1 } },
  ];
  const r = agregar(g({ fuente: 'ejecucion', tipo: 'barras', dimension: 'prioridad', metricas: ['activas'], limite: 3 }), filas, '2026-10-01', '2026-10-31');
  assert.deepEqual(r.filas.map((x) => [x.clave, x.valores[0]]), [['Alta', 2], ['Media', 0], ['Baja', 5], ['A futuro', 0], ['Otra', 1], [SIN_DATO, 1]]);
  assert.equal(r.fuera, 0, 'una escala no se recorta al límite');
  // La curva del video: los 20 cortes, aunque el límite sea 10.
  const curva = agregar(g({ fuente: 'retencion_vsl', tipo: 'area', dimension: 'corte', metricas: ['siguen'] }),
    [{ f: '2026-10-01', d: { corte: '5' }, v: { pasaron_corte: 1, medidos_corte: 1 } }, { f: '2026-10-01', d: { corte: '50' }, v: { pasaron_corte: 0, medidos_corte: 1 } }],
    '2026-10-01', '2026-10-31');
  assert.equal(curva.filas.length, 20);
  assert.deepEqual(curva.filas.slice(0, 2).map((x) => x.valores[0]), [100, null]);
  assert.equal(curva.filas[9].valores[0], 0, 'el 50%: medido y no llegó');
});

test('un atributo que el grupo no trae es null, no 0 (un proyecto sin evaluar no está en la esquina)', () => {
  const filas: Fila[] = [
    { f: null, d: { proyecto: 'A' }, v: { proyectos: 1, tareas: 3, impacto: 80, esfuerzo: 20 } },
    { f: null, d: { proyecto: 'B' }, v: { proyectos: 1, tareas: 2 } },
  ];
  const r = agregar(g({ fuente: 'proyectos', tipo: 'burbujas', dimension: 'proyecto', metricas: ['esfuerzo', 'impacto', 'tareas'] }), filas, '2026-10-01', '2026-10-31');
  const porClave = Object.fromEntries(r.filas.map((x) => [x.clave, x.valores]));
  assert.deepEqual(porClave.A, [20, 80, 3]);
  assert.deepEqual(porClave.B, [null, null, 2]);
  assert.deepEqual(r.totales.slice(0, 2), [null, null], 'un atributo no tiene total');
});

test('la tabla de cohortes: sin meses vacíos, del más nuevo al más viejo, y las N más nuevas', () => {
  const filas: Fila[] = ['2026-03-10', '2026-03-20', '2026-06-01', '2026-08-15', '2026-09-30', '2026-10-01'].map((f) => ({ f, d: { madurez_mes: f < '2026-09-01' ? 'Madura' : 'Reciente' }, v: { agendas: 1 } }));
  const base = { fuente: 'leads', tipo: 'tabla', fecha: 'agenda', dimension: 'mes', metricas: ['agendas'], limite: 3 };
  // Sin opciones: el tiempo se rellena entero (los 10 meses del rango; con «Todo» eran 82), en orden, sin límite.
  assert.equal(agregar(g(base), filas, '2026-01-01', '2026-10-31').filas.length, 10);
  const r = agregar(g(base, { tabla: { sinVacios: true, descendente: true, columnas: ['madurez_mes'] } }), filas, '2026-01-01', '2026-10-31');
  assert.deepEqual(r.filas.map((x) => x.clave), ['2026-10-01', '2026-09-01', '2026-08-01']);
  assert.equal(r.fuera, 2, 'los dos meses más viejos quedaron afuera, y se dice');
  assert.deepEqual(r.filas.map((x) => x.extra?.madurez_mes), ['Reciente', 'Reciente', 'Madura']);
  assert.deepEqual(r.columnasExtra, [{ id: 'madurez_mes', nombre: 'Madurez del mes' }]);
  // Sin vacíos y ascendente: las N más nuevas, en orden.
  const asc = agregar(g(base, { tabla: { sinVacios: true } }), filas, '2026-01-01', '2026-10-31');
  assert.deepEqual(asc.filas.map((x) => x.clave), ['2026-08-01', '2026-09-01', '2026-10-01']);
});

test('columnas extra: el valor si todas las filas dicen lo mismo; si no, los dos más frecuentes y «+N»; y la fecha', () => {
  const filas: Fila[] = [
    { f: '2026-10-01', d: { llamada: 'Ana', closer: 'Leo', reunion: 'R1' }, v: { llamadas: 1, puntos: 7, con_puntaje: 1 } },
    { f: '2026-10-03', d: { llamada: 'Beto', closer: 'Leo', reunion: 'R1' }, v: { llamadas: 1, puntos: 5, con_puntaje: 1 } },
    { f: '2026-10-03', d: { llamada: 'Beto', closer: 'Sol', reunion: 'R2' }, v: { llamadas: 1, puntos: 6, con_puntaje: 1 } },
    { f: '2026-10-04', d: { llamada: 'Beto', closer: 'Leo', reunion: 'R2' }, v: { llamadas: 1, puntos: 6, con_puntaje: 1 } },
    { f: '2026-10-05', d: { llamada: 'Beto', closer: 'Ian', reunion: 'R2' }, v: { llamadas: 1, puntos: 6, con_puntaje: 1 } },
  ];
  const r = agregar(g({ fuente: 'llamadas_venta', tipo: 'tabla', dimension: 'llamada', metricas: ['llamadas'] }, { tabla: { columnas: ['closer', 'reunion', 'fecha'] } }), filas, '2026-10-01', '2026-10-31');
  const ana = r.filas.find((x) => x.clave === 'Ana')!;
  const beto = r.filas.find((x) => x.clave === 'Beto')!;
  assert.deepEqual(ana.extra, { closer: 'Leo', reunion: 'R1', fecha: '01/10' });
  assert.equal(beto.extra?.closer, 'Leo, Ian +1', 'tres closers: dos y cuántos más');
  assert.equal(beto.extra?.reunion, 'R2, R1');
  // El color de una dispersión viaja por el mismo camino.
  const d = agregar(g({ fuente: 'proyectos', tipo: 'burbujas', dimension: 'proyecto', metricas: ['esfuerzo', 'impacto', 'tareas'] }, { colorPor: 'cuadrante' }),
    [{ f: null, d: { proyecto: 'A', cuadrante: 'Quick win' }, v: { tareas: 1, impacto: 80, esfuerzo: 20 } }], '2026-10-01', '2026-10-31');
  assert.equal(d.filas[0].extra?.cuadrante, 'Quick win');
});

test('la miniatura de un grupo es la de su fila MÁS RECIENTE; las coordenadas, el promedio', () => {
  const filas: Fila[] = [
    { f: '2026-10-01', d: { guion: 'G1' }, v: { gasto: 1 }, img: 'https://cdn/x-viejo.jpg' },
    { f: '2026-10-05', d: { guion: 'G1' }, v: { gasto: 1 }, img: 'https://cdn/x-nuevo.jpg' },
    { f: '2026-10-03', d: { guion: 'G1' }, v: { gasto: 1 }, img: null },
  ];
  const r = agregar(g({ fuente: 'guiones', tipo: 'tabla', dimension: 'guion', metricas: ['gasto'] }), filas, '2026-10-01', '2026-10-31');
  assert.equal(r.filas[0].imagen, 'https://cdn/x-nuevo.jpg');
  const geo = agregar(g({ fuente: 'ubicacion', tipo: 'tabla', dimension: 'ciudad', metricas: ['visitas'] }), [
    { f: '2026-10-01', d: { ciudad: 'Tijuana' }, v: { visitas: 1 }, geo: { lat: 32.5, lon: -117 } },
    { f: '2026-10-02', d: { ciudad: 'Tijuana' }, v: { visitas: 1 }, geo: { lat: 32.7, lon: -117 } },
    { f: '2026-10-02', d: { ciudad: 'Tijuana' }, v: { visitas: 1 }, geo: null },
  ], '2026-10-01', '2026-10-31');
  assert.equal(geo.filas[0].valores[0], 3);
  assert.ok(Math.abs(geo.filas[0].geo!.lat - 32.6) < 1e-9 && geo.filas[0].geo!.lon === -117);
});

test('la métrica secundaria de un cuadro de resultados («14 cierres») sale de las MISMAS filas', () => {
  const filas: Fila[] = [
    { f: '2026-10-01', d: {}, v: { vendido: 1000, cierres: 1 } },
    { f: '2026-10-02', d: {}, v: { vendido: 500, cierres: 1 } },
  ];
  const r = agregar(g({ fuente: 'revenue', tipo: 'numero', metricas: ['vendido'] }, { secundaria: 'cierres' }), filas, '2026-10-01', '2026-10-31');
  assert.equal(r.totales[0], 1500);
  assert.deepEqual(r.secundaria, { id: 'cierres', nombre: 'Cierres', formato: 'numero', valor: 2 });
});

test('la dispersión no se recorta al límite: los 71 proyectos del dueño eran 10', () => {
  const filas: Fila[] = Array.from({ length: 71 }, (_, i) => ({ f: null, d: { proyecto: `P${i}` }, v: { tareas: 1, impacto: i, esfuerzo: 70 - i } }));
  const r = agregar(g({ fuente: 'proyectos', tipo: 'dispersion', dimension: 'proyecto', metricas: ['esfuerzo', 'impacto'], limite: 10 }), filas, '2026-10-01', '2026-10-31');
  assert.equal(r.filas.length, 71);
  assert.equal(r.fuera, 0);
});

test('un desglose con valores fijos va en su orden, con sus vacíos', () => {
  const filas: Fila[] = [
    { f: '2026-10-01', d: { dimension: 'Situación', tono: 'Perdida' }, v: { puntos: 4, con_puntaje: 1 } },
    { f: '2026-10-01', d: { dimension: 'Situación', tono: 'Ganada' }, v: { puntos: 8, con_puntaje: 1 } },
  ];
  const r = agregar(g({ fuente: 'llamadas_dimensiones', tipo: 'barras', dimension: 'dimension', desglose: 'tono', metricas: ['puntaje'] }), filas, '2026-10-01', '2026-10-31');
  assert.deepEqual(r.cruce?.claves, ['Ganada', 'En proceso', 'Perdida']);
  assert.deepEqual(r.cruce?.celdas[0], [8, null, 4]);
});

test('una mediana de tiempos de respuesta: sólo los turnos que se respondieron', () => {
  const filas: Fila[] = [
    { f: '2026-10-01', d: {}, v: { turnos: 1, respondidos: 1, minutos_respuesta: 2 } },
    { f: '2026-10-01', d: {}, v: { turnos: 1, respondidos: 1, minutos_respuesta: 3 } },
    { f: '2026-10-01', d: {}, v: { turnos: 1, respondidos: 1, minutos_respuesta: 4290 } },
    { f: '2026-10-01', d: {}, v: { turnos: 1, respondidos: 0 } },
  ];
  const r = agregar(g({ fuente: 'conversaciones', tipo: 'numero', metricas: ['mediana_respuesta'] }), filas, '2026-10-01', '2026-10-31');
  assert.equal(r.totales[0], 3, 'el que no se respondió no es un 0 en la lista');
});
