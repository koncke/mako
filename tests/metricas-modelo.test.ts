// =============================================================================
// Las tres reglas del reporte de números que se rompen solas y en silencio
// =============================================================================
// El reporte contesta «un trimestre: inversión, impresiones, llegadas al landing,
// juntas agendadas, J1 y J2 realizadas». Nada de eso da error cuando sale mal: da
// un número plausible. Estas son las tres formas de que salga mal sin que nadie lo
// note, y por eso `metricas-modelo.ts` vive sin `server-only`.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  claveDe, clavesDelRango, validarRango, celda, metricasACsv, metricasAMarkdown,
  COLUMNAS, MAX_DIAS, type ReporteMetricas, type FilaMetricas,
} from '../lib/metricas-modelo';

// ── 1. El bucket ─────────────────────────────────────────────────────────────

test('el mes agrupa por YYYY-MM y la semana por su LUNES', () => {
  assert.equal(claveDe('2026-03-15', 'mes'), '2026-03');
  assert.equal(claveDe('2026-03-15', 'dia'), '2026-03-15');
  // 2026-03-15 es domingo: su semana arranca el lunes 9.
  assert.equal(claveDe('2026-03-15', 'semana'), '2026-03-09');
  // Un lunes se devuelve a sí mismo.
  assert.equal(claveDe('2026-03-09', 'semana'), '2026-03-09');
});

test('un TRIMESTRE por mes son exactamente 3 filas, en orden', () => {
  // El caso que motivó el módulo, literal.
  assert.deepEqual(clavesDelRango('2026-01-01', '2026-03-31', 'mes'), ['2026-01', '2026-02', '2026-03']);
});

test('LA REGLA: un mes sin una sola fila APARECE igual', () => {
  // Si se omitiera, el que lee la tabla no puede distinguir «no pasó nada» de
  // «no se midió», y esas dos cosas llevan a decisiones opuestas. `clavesDelRango`
  // sale del RANGO PEDIDO, nunca de los datos que volvieron.
  const claves = clavesDelRango('2026-01-01', '2026-03-31', 'mes');
  assert.equal(claves.length, 3, 'febrero tiene que estar aunque no haya tenido nada');
  assert.ok(claves.includes('2026-02'));
});

test('el cruce de año no se saltea diciembre ni enero', () => {
  assert.deepEqual(clavesDelRango('2025-12-30', '2026-01-02', 'mes'), ['2025-12', '2026-01']);
  assert.deepEqual(
    clavesDelRango('2026-02-27', '2026-03-02', 'dia'),
    ['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02'],
    'febrero de 2026 tiene 28 días: el 29 no existe y el 1 de marzo sigue al 28',
  );
});

test('un año bisiesto no pierde el 29 de febrero', () => {
  const dias = clavesDelRango('2028-02-28', '2028-03-01', 'dia');
  assert.deepEqual(dias, ['2028-02-28', '2028-02-29', '2028-03-01']);
});

// ── 2. El rango ──────────────────────────────────────────────────────────────

test('sin fechas, el default son los últimos 90 días TERMINANDO HOY', () => {
  const { desde, hasta } = validarRango('2026-09-02');
  assert.equal(hasta, '2026-09-02');
  assert.equal(desde, '2026-06-05');
  // 90 días INCLUSIVOS: el trimestre móvil se cuenta con las dos puntas adentro.
  assert.equal(clavesDelRango(desde, hasta, 'dia').length, 90);
});

test('el rango al revés se rechaza en vez de devolver vacío', () => {
  // Devolver cero filas sería indistinguible de «no hubo nada en el trimestre».
  assert.throws(() => validarRango('2026-09-02', '2026-03-31', '2026-01-01'), /al revés/);
});

test('una fecha inventada se rechaza, y el mensaje dice el formato', () => {
  assert.throws(() => validarRango('2026-09-02', '2026-02-30', '2026-03-01'), /no es una fecha válida/);
  assert.throws(() => validarRango('2026-09-02', 'ayer', '2026-03-01'), /no es una fecha válida/);
});

test('el tope de 5 años frena antes de barrer la tabla entera', () => {
  // No es ahorro: sin tope, un ?desde=1970 muere por timeout con un 500 mudo.
  assert.throws(() => validarRango('2026-09-02', '1970-01-01', '2026-09-02'), /tope es/);
  // Y el borde justo por debajo sí pasa.
  const desde = clavesDelRango('2021-09-02', '2026-09-02', 'dia');
  assert.ok(desde.length <= MAX_DIAS + 1);
});

// ── 3. La salida ─────────────────────────────────────────────────────────────

const filaVacia = (periodo: string, over: Partial<FilaMetricas> = {}): FilaMetricas => ({
  periodo,
  meta_inversion: null, meta_inversion_usd: null, meta_impresiones: null,
  meta_clics: null, meta_clics_link: null, meta_landing_views: null, meta_formularios: null,
  landing_visitas: null, landing_visitantes: null, vsl_plays: null, vsl_visitantes: null,
  leads_nuevos: 0, agendas_creadas: 0,
  j1_programadas: 0, j1_realizadas: 0, j1_noshow: 0, j1_sin_marcar: 0,
  j2_programadas: 0, j2_realizadas: 0, j2_noshow: 0, j2_sin_marcar: 0,
  ganados: 0, ingreso_usd: 0,
  ...over,
});

const reporteDemo = (): ReporteMetricas => {
  const filas = [
    filaVacia('2026-01', { meta_inversion: 12_500.5, meta_impresiones: 340_000, j1_programadas: 12, j1_realizadas: 9, j1_noshow: 2, j1_sin_marcar: 1 }),
    // Febrero SIN Meta: la fuente existe pero ese mes no hubo campañas → CERO, no null.
    filaVacia('2026-02', { meta_inversion: 0, meta_impresiones: 0, j1_programadas: 4, j1_realizadas: 4 }),
  ];
  return {
    periodo: { desde: '2026-01-01', hasta: '2026-02-28', grano: 'mes', zona: 'America/Tijuana' },
    moneda: { meta: 'MXN', tipo_cambio_usd_mxn: 17.3, nota: 'x' },
    filas,
    totales: (({ periodo: _p, ...resto }) => ({
      ...resto, meta_inversion: 12_500.5, meta_impresiones: 340_000,
      j1_programadas: 16, j1_realizadas: 13, j1_noshow: 2, j1_sin_marcar: 1,
    }))(filaVacia('')),
    cobertura: {
      meta: { hay_datos: true, filas: 90, nota: '' },
      landing: { hay_datos: false, filas: 0, nota: 'El snippet no está puesto en la landing.' },
      vsl: { hay_datos: false, filas: 0, nota: 'Sin plays.' },
      crm: { hay_datos: true, filas: 40, nota: '' },
    },
    advertencias: ['un no-show no es una reunión sin marcar'],
  };
};

test('LA REGLA QUE MÁS IMPORTA: un null sale como celda VACÍA, nunca como 0', () => {
  // En una planilla, un 0 en «inversión» es una afirmación falsa sobre el negocio
  // («no invertiste») y una celda vacía es la verdad («no tenemos el dato»).
  assert.equal(celda(null), '');
  assert.equal(celda(undefined), '');
  // Y un cero REAL sí sale como 0: son estados distintos y se ven distintos.
  assert.equal(celda(0), '0');
});

test('el CSV distingue «no hay fuente» (vacío) de «no hubo nada» (0) en la misma columna', () => {
  const csv = metricasACsv(reporteDemo());
  const lineas = csv.replace(/^﻿/, '').trim().split('\n');
  const iVisitas = COLUMNAS.indexOf('landing_visitas');
  const iInv = COLUMNAS.indexOf('meta_inversion');

  const enero = lineas[1].split(',');
  const febrero = lineas[2].split(',');

  // landing NO tiene fuente en ningún mes → vacío en los dos.
  assert.equal(enero[iVisitas], '', 'sin snippet la celda va vacía, no en 0');
  assert.equal(febrero[iVisitas], '');
  // Meta SÍ tiene fuente: enero con plata, febrero con un cero de verdad.
  assert.equal(enero[iInv], '12500.5');
  assert.equal(febrero[iInv], '0', 'un mes sin campañas es un CERO, y se tiene que ver');
});

test('el CSV lleva BOM o Excel en Windows rompe los acentos', () => {
  assert.ok(metricasACsv(reporteDemo()).startsWith('﻿'));
});

test('el CSV trae la fila TOTAL adentro del mismo archivo', () => {
  const lineas = metricasACsv(reporteDemo()).trim().split('\n');
  const ultima = lineas[lineas.length - 1].split(',');
  assert.equal(ultima[0], 'TOTAL', 'un total en un archivo aparte es un total que nadie abre');
  assert.equal(ultima[COLUMNAS.indexOf('j1_realizadas')], '13');
});

test('una celda con coma o comilla se escapa, o la planilla se corre de columna', () => {
  assert.equal(celda('a,b'), '"a,b"');
  assert.equal(celda('dijo "hola"'), '"dijo ""hola"""');
  assert.equal(celda('a;b'), '"a;b"');
  assert.equal(celda('dos\nlíneas'), '"dos\nlíneas"');
});

test('el CSV tiene una columna por encabezado en TODAS las filas', () => {
  // Un desfase de una columna no da error: corre los números de lugar.
  const lineas = metricasACsv(reporteDemo()).replace(/^﻿/, '').trim().split('\n');
  for (const l of lineas) {
    assert.equal(l.split(',').length, COLUMNAS.length, `la fila «${l.slice(0, 30)}…» no tiene ${COLUMNAS.length} columnas`);
  }
});

test('el markdown explica POR QUÉ una columna está vacía, no la deja muda', () => {
  const md = metricasAMarkdown(reporteDemo());
  assert.match(md, /Columnas vacías y por qué/);
  assert.match(md, /El snippet no está puesto en la landing/);
  // Y las advertencias viajan con la tabla: sin ellas cada número se lee como exacto.
  assert.match(md, /un no-show no es una reunión sin marcar/);
  // Un null se dibuja como raya, que se lee como «no hay dato» y no como cero.
  assert.match(md, /—/);
});
