// =============================================================================
// El «AI Analyst» del Dashboard: lo que viaja al modelo, lo que vuelve, y cuándo corre
// =============================================================================
// Lo que se persigue acá falla EN SILENCIO, y por eso tiene test:
//   · un nombre de persona que viaja al modelo con la feature declarada `pii: false`;
//   · un gráfico que no se pudo leer y le llega al modelo como un cero («tu gasto se desplomó»);
//   · una unidad que no viaja pegada al número (pesos leídos como dólares, una tasa como cantidad);
//   · un hallazgo que cita un número que el modelo inventó, mostrado con la autoridad del sistema;
//   · un horario que deriva porque se ancló en `ahora` y no en la ocurrencia agendada.
//
// Correr: npx tsx --test tests/graficos-analisis.test.ts
//
// PROBADO ROMPIÉNDOLO (11/10/2026), cada rotura restaurada antes de la siguiente, sobre una base de
// 20 pass / 0 fail:
//   1. `closer` agregado a DIMENSIONES_PUBLICAS.leads                         → 17 / 3 (los nombres, el
//      filtro, y el hallazgo anclado en «Closer 1», que deja de existir como fila)
//   2. la rama de error de `serializarGrafico` devolviendo `totales: { leads: 0 }` → 19 / 1 («no se pudo leer»)
//   3. SUFIJO.usd = '' (la unidad deja de ir en la clave)                      → 14 / 6
//   4. sin el chequeo de números inventados en los hallazgos                   → 19 / 1
//   5. `siguienteCorrida` anclada en `ahora` en vez de `proximaAt`             → 18 / 2 (la de horas y la de días)
//   6. el tope sin aplicar (`serializarHoja` devuelve siempre el primer armado)  → 19 / 1
//   7. `claveTablero` con otro prefijo ('graficos.informe.')                   → 19 / 1
//   (re-medidas en la corrida de cierre del mismo día, la 1 y la 5: 17 / 3 y 18 / 2, igual que arriba)
//   8. «Elegí al menos un gráfico.» en el aviso del panel (base 21 / 0)        → 20 / 1 (el de voseo;
//      `marcasDeVoseo` solo NO lo ve: lo caza la búsqueda de palabras terminadas en tilde)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sanearCron } from '../lib/cron-aviso';
import { sanearGrafico, type Grafico } from '../lib/graficos-catalogo';
import { agregar, type Fila, type Resultado } from '../lib/graficos-agregar';
import {
  Alias, cambiosDesde, conNombres, firmaResultado, numerosDe, citaPermitida, paraModelo, primeraCorrida, puedeArrancar,
  sanearCronAnalisis, sanearSalida, serializarGrafico, serializarHoja, siguienteCorrida, textoParaModelo, vistaDeFila,
  VENCE_MS, type EntradaAnalisis, type FilaAnalisis, type ItemAnalisis,
} from '../lib/graficos-analisis';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string): string => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/(^|[^A-Za-z0-9_])\/\*[\s\S]*?\*\//g, '$1');

const DESDE = '2026-10-01';
const HASTA = '2026-10-10';
const g = (o: Record<string, unknown>): Grafico => sanearGrafico(o)!;
const fila = (f: string, d: Record<string, string | null>, v: Record<string, number>): Fila => ({ f, d, v });
const ok = (gr: Grafico, filas: Fila[]): { ok: true; resultado: Resultado } => ({ ok: true, resultado: agregar(gr, filas, DESDE, HASTA) });
const item = (gr: Grafico, lectura: ItemAnalisis['lectura'], extra: Partial<ItemAnalisis> = {}): ItemAnalisis =>
  ({ g: gr, lectura, desde: DESDE, hasta: HASTA, hastaFuente: HASTA, filtros: [], noAplica: [], ...extra });
const hoja = (items: ItemAnalisis[], tope?: number): EntradaAnalisis =>
  serializarHoja({ hoja: { id: 'h1', nombre: 'Comercial' }, hoy: HASTA, origen: 'manual', conVista: false, items, noIncluidos: [], tope });

// ── Los fixtures: gráficos de verdad, agregados con la función de la pantalla ──────────────

const gCloser = g({ id: 'g-closer', tipo: 'barras', fuente: 'leads', dimension: 'closer', metricas: ['leads', 'tasa_cierre'] });
const filasCloser = [
  fila('2026-10-02', { closer: 'Juan Pérez' }, { leads: 1, asistencias: 1, cierres: 1 }),
  fila('2026-10-03', { closer: 'Juan Pérez' }, { leads: 1, asistencias: 1, cierres: 0 }),
  fila('2026-10-04', { closer: 'Ana Gómez' }, { leads: 1, asistencias: 1, cierres: 0 }),
];
const gPagos = g({ id: 'g-pagos', tipo: 'tabla', fuente: 'pagos', dimension: 'cliente', metricas: ['monto'] });
const filasPagos = [fila('2026-10-05', { cliente: 'Mariana Lugo', estado: 'Cobrado' }, { monto: 1234.56, cobrado: 1234.56, pagos: 1 })];
const gCambios = g({ id: 'g-cambios', tipo: 'tabla', fuente: 'crm_cambios', dimension: 'valor', metricas: ['cambios'] });
const filasCambios = [fila('2026-10-05', { valor: '+52 664 555 0199', campo: 'telefono' }, { cambios: 1 })];
const gTareas = g({ id: 'g-tareas', tipo: 'tabla', fuente: 'tareas', fecha: 'alta', dimension: 'proyecto', metricas: ['tareas'] });
const filasTareas = [fila('2026-10-05', { proyecto: 'Cliente: Mauricio' }, { tareas: 3 }), fila('2026-10-06', { proyecto: 'Feature: CRM' }, { tareas: 2 })];
const gMotivo = g({ id: 'g-motivo', tipo: 'tabla', fuente: 'leads', dimension: 'motivo', metricas: ['leads'] });
const filasMotivo = [fila('2026-10-05', { motivo: 'Lo llamó Roberto y no contestó' }, { leads: 1 })];
const gSetter = g({ id: 'g-setter', tipo: 'columnas_apiladas', fuente: 'leads', dimension: 'etapa', desglose: 'setter', metricas: ['leads'] });
const filasSetter = [fila('2026-10-05', { etapa: 'Agendado', setter: 'Lucía Ramos' }, { leads: 2 })];
const gGasto = g({ id: 'g-gasto', tipo: 'numero', fuente: 'negocio', metricas: ['gasto'] });
const gMeta = g({ id: 'g-meta', tipo: 'serie', fuente: 'meta', dimension: 'dia', metricas: ['gasto', 'ctr'] });
const filasMeta = [fila('2026-10-02', {}, { gasto: 100.004, impresiones: 1000, clics: 25 }), fila('2026-10-03', {}, { gasto: 50, impresiones: 500, clics: 5 })];

// ── El serializador ────────────────────────────────────────────────────────────────────────

test('ningún nombre de persona viaja al modelo: closer, cliente, valor libre, «Cliente: X», motivo y el desglose', () => {
  const e = hoja([
    item(gCloser, ok(gCloser, filasCloser)), item(gPagos, ok(gPagos, filasPagos)), item(gCambios, ok(gCambios, filasCambios)),
    item(gTareas, ok(gTareas, filasTareas)), item(gMotivo, ok(gMotivo, filasMotivo)), item(gSetter, ok(gSetter, filasSetter)),
  ]);
  const txt = textoParaModelo(e);
  for (const nombre of ['Juan', 'Pérez', 'Ana Gómez', 'Mariana', '664', '0199', 'Mauricio', 'Roberto', 'Lucía']) {
    assert.ok(!txt.includes(nombre), `«${nombre}» viajó al modelo`);
  }
  // Van con alias estables, y los nombres reales quedan del lado del server para la pantalla.
  assert.match(txt, /Closer 1/);
  assert.match(txt, /Cliente 1/);
  assert.match(txt, /Setter 1/);
  assert.equal(e.nombres['Closer 1'], 'Juan Pérez');
  assert.ok(Object.values(e.nombres).includes('Cliente: Mauricio'));
  // Lo que NO es una persona sigue viajando con su nombre: es lo que el análisis necesita.
  assert.match(txt, /Feature: CRM/);
  assert.match(txt, /Agendado/);
  // Y el modelo no ve el mapa de nombres, ni las firmas, ni los formatos.
  assert.deepEqual(Object.keys(paraModelo(e)).sort(), ['fuera_por_tope', 'graficos', 'hoja', 'hoy', 'no_incluidos']);
});

test('un filtro sobre una dimensión con personas viaja con el alias, no con el nombre', () => {
  const alias = new Alias();
  const s = serializarGrafico(item(gCloser, ok(gCloser, filasCloser), { filtros: [{ dimension: 'closer', valores: ['Juan Pérez'] }] }), alias);
  const txt = JSON.stringify(s.entrada);
  assert.ok(!txt.includes('Juan'), 'el nombre del filtro viajó');
  assert.ok('filtros' in s.entrada && s.entrada.filtros[0] === 'Closer: Closer 1', JSON.stringify('filtros' in s.entrada && s.entrada.filtros));
});

test('un gráfico que no se pudo leer viaja como «no se pudo leer», nunca como un cero', () => {
  const e = hoja([item(gCloser, { ok: false, error: 'No pude leer los datos' }), item(gPagos, ok(gPagos, filasPagos))]);
  const roto = e.graficos.find((x) => x.id === 'g-closer')!;
  assert.ok('error' in roto && roto.error === 'no se pudo leer', JSON.stringify(roto));
  assert.ok(!('totales' in roto), 'un gráfico sin leer no puede traer totales');
  assert.equal(e.firmas['g-closer'], 'error');
  // Y no puede anclar un hallazgo: no tiene números.
  const s = sanearSalida({ hallazgos: [{ grafico: 'g-closer', metrica: 'leads', titulo: 'Bajaron los leads', texto: 'Hubo 0 leads.' }] }, e);
  assert.equal(s, null);
});

test('la unidad va en la clave de cada columna, y los valores redondeados a lo que dicen algo', () => {
  const e = hoja([item(gMeta, ok(gMeta, filasMeta)), item(gCloser, ok(gCloser, filasCloser))]);
  const meta = e.graficos.find((x) => x.id === 'g-meta')!;
  assert.ok('columnas' in meta);
  assert.deepEqual(meta.columnas.map((c) => c.clave), ['gasto_usd', 'ctr_pct']);
  assert.equal(meta.totales.gasto_usd, 150);
  assert.equal(meta.totales.ctr_pct, 2);
  assert.equal(e.formatos['g-meta'].gasto_usd, 'usd');
  const closer = e.graficos.find((x) => x.id === 'g-closer')!;
  assert.ok('columnas' in closer);
  assert.deepEqual(closer.columnas.map((c) => c.clave), ['leads', 'tasa_cierre_pct']);
  // Las filas de tiempo llevan la fecha con año, no «02/10».
  assert.equal(meta.filas[1].etiqueta, '2026-10-02');
});

test('los recortes se declaran ADENTRO del payload: grupos de más, la pauta que termina ayer, la serie por semana', () => {
  const muchas = Array.from({ length: 20 }, (_, i) => fila('2026-10-02', { campana: `Campaña ${String(i).padStart(2, '0')}` }, { gasto: 100 + i }));
  const gCamp = g({ id: 'g-camp', tipo: 'tabla', fuente: 'meta', dimension: 'campana', metricas: ['gasto'], limite: 50 });
  const e = hoja([
    item(gCamp, ok(gCamp, muchas), { hastaFuente: '2026-10-09' }),
    item(gMeta, ok(gMeta, filasMeta), { comprimida: ok(gMeta, filasMeta), agrupadaPor: 'semana' }),
  ]);
  const camp = e.graficos[0];
  assert.ok('recortes' in camp);
  assert.equal(camp.filas.length, 12);
  assert.ok(camp.recortes.some((r) => /12 de 20 grupos/.test(r)), camp.recortes.join(' | '));
  assert.ok(camp.recortes.some((r) => /llegan hasta el 2026-10-09/.test(r)), camp.recortes.join(' | '));
  assert.equal(camp.periodo.hasta, '2026-10-09');
  const serie = e.graficos[1];
  assert.ok('recortes' in serie && serie.recortes.some((r) => /va por semana/.test(r)), JSON.stringify(serie));
});

test('el tope: lo que no entra se NOMBRA en fuera_por_tope, y lo que va pesa menos que el tope', () => {
  const muchas = Array.from({ length: 50 }, (_, i) => fila('2026-10-02', { campana: `Una campaña con un nombre bastante largo ${i}` }, { gasto: 1000 + i, clics: i, impresiones: 100 * i }));
  const items = Array.from({ length: 30 }, (_, i) => {
    const gr = g({ id: `g${i}`, titulo: `Gráfico ${i}`, tipo: 'tabla', fuente: 'meta', dimension: 'campana', metricas: ['gasto', 'clics', 'impresiones', 'ctr', 'cpc'], limite: 50 });
    return item(gr, ok(gr, muchas));
  });
  const tope = 20_000;
  const e = hoja(items, tope);
  assert.ok(textoParaModelo(e).length <= tope, `pesa ${textoParaModelo(e).length}`);
  assert.ok(e.fuera_por_tope.length > 0, 'nada quedó afuera con 30 gráficos y un tope de 20.000');
  assert.equal(e.graficos.length + e.fuera_por_tope.length, 30, 'un gráfico desapareció sin rastro');
  // Las firmas son de TODOS (la pantalla compara contra lo que ve, aunque no haya entrado al modelo).
  assert.equal(Object.keys(e.firmas).length, 30);
});

// ── El saneo de la salida ──────────────────────────────────────────────────────────────────

const base = () => hoja([item(gCloser, ok(gCloser, filasCloser)), item(gPagos, ok(gPagos, filasPagos)), item(gMeta, ok(gMeta, filasMeta))]);

test('un hallazgo anclado pasa, y el número que se muestra sale de la ENTRADA, no del texto', () => {
  const s = sanearSalida({
    resumen: 'El gasto fue de US$150. La tasa de cierre de Closer 1 es de 50%.',
    hallazgos: [
      { grafico: 'g-meta', metrica: 'gasto_usd', fila: null, titulo: 'Gastaste US$150', texto: 'Son US$150 en el período.', tono: 'neutro' },
      { grafico: 'g-closer', metrica: 'tasa_cierre', fila: 'Closer 1', titulo: 'Closer 1 cierra la mitad', texto: 'Cierra el 50% de sus llamadas.', tono: 'bueno' },
      { grafico: 'g-pagos', metrica: 'monto_usd', fila: 'Cliente 1', titulo: 'Un pago de US$1.235', texto: 'El único cobro: US$1.234,56.', tono: 'bueno' },
    ],
    recomendaciones: [{ accion: 'Revisar las llamadas de Closer 2', porque: 'Cerró 0 de 1.', graficos: ['g-closer'], impacto: 'alto', esfuerzo: 'bajo' }],
  }, base());
  assert.ok(s, 'la salida buena se tiró');
  assert.equal(s!.hallazgos.length, 3, JSON.stringify(s!.descartes));
  assert.deepEqual(s!.hallazgos.map((h) => h.cita.valor), [150, 50, 1234.56]);
  assert.equal(s!.hallazgos[1].cita.fila, 'Closer 1');
  assert.equal(s!.hallazgos[2].cita.formato, 'usd');
  assert.equal(s!.recomendaciones.length, 1);
  assert.equal(s!.recomendaciones[0].impacto, 'alto');
});

test('lo que cita un gráfico, una columna o una fila que no se mandaron se descarta, con su motivo', () => {
  const s = sanearSalida({
    hallazgos: [
      { grafico: 'g-meta', metrica: 'gasto_usd', titulo: 'Gastaste US$150', texto: '' },
      { grafico: 'g-otro', metrica: 'gasto_usd', titulo: 'Algo', texto: '' },
      { grafico: 'g-meta', metrica: 'ventas', titulo: 'Algo', texto: '' },
      { grafico: 'g-closer', metrica: 'leads', fila: 'Pedro', titulo: 'Algo', texto: '' },
    ],
    recomendaciones: [
      { accion: 'Pausar la campaña', porque: 'x', graficos: ['g-inventado'] },
      { accion: 'Pausar la campaña', porque: 'x', graficos: [] },
    ],
  }, base());
  assert.equal(s!.hallazgos.length, 1);
  assert.equal(s!.recomendaciones.length, 0);
  assert.equal(s!.descartes.length, 5);
});

test('un número que no llegó tira el hallazgo, la recomendación o la FRASE del resumen; uno redondeado pasa', () => {
  const s = sanearSalida({
    resumen: 'El gasto fue de US$150. El CAC subió a US$812.',
    hallazgos: [
      { grafico: 'g-meta', metrica: 'gasto_usd', titulo: 'Gastaste US$150', texto: 'Contra US$9.300 del mes pasado.' },
      { grafico: 'g-meta', metrica: 'ctr_pct', titulo: 'El CTR es de 2%', texto: 'Muy por debajo del 4,7% del rubro.' },
      { grafico: 'g-pagos', metrica: 'monto_usd', titulo: 'Cobraste 1,2k', texto: 'Redondeado: US$1.235.' },
    ],
    recomendaciones: [{ accion: 'Subir el presupuesto a US$500', porque: 'x', graficos: ['g-meta'] }],
  }, base());
  assert.ok(s);
  assert.deepEqual(s!.hallazgos.map((h) => h.titulo), ['Cobraste 1,2k']);
  assert.equal(s!.recomendaciones.length, 0);
  assert.equal(s!.resumen, 'El gasto fue de US$150.');
});

test('los números se leen en los dos formatos (1.234,56 y 1,234.56) y con «k»/«M»; los conteos chicos pasan', () => {
  const permitidos = [1234.56, 0.5, 2_500_000];
  const pasa = (t: string) => numerosDe(t).every((n) => citaPermitida(n, permitidos));
  assert.ok(pasa('US$1.234,56'));
  assert.ok(pasa('US$1,234.56'));
  assert.ok(pasa('1.235'));
  assert.ok(pasa('1,2k'));
  assert.ok(pasa('2,5 M'));
  assert.ok(pasa('los 3 primeros, en 2026'));
  assert.ok(!pasa('US$1.300'));
  assert.ok(!pasa('47'));
});

test('sin ningún hallazgo anclado la salida no sirve (la cascada prueba otro proveedor); y hay tope de cantidad', () => {
  assert.equal(sanearSalida({ resumen: 'Todo bien.', hallazgos: [] }, base()), null);
  assert.equal(sanearSalida('no es un objeto', base()), null);
  const muchos = Array.from({ length: 8 }, () => ({ grafico: 'g-meta', metrica: 'gasto_usd', titulo: 'Gastaste US$150', texto: '' }));
  const recs = Array.from({ length: 6 }, () => ({ accion: 'Revisar la pauta', porque: 'x', graficos: ['g-meta'] }));
  const s = sanearSalida({ hallazgos: muchos, recomendaciones: recs }, base())!;
  assert.equal(s.hallazgos.length, 5);
  assert.equal(s.recomendaciones.length, 3);
});

test('conNombres devuelve el nombre real para la pantalla, sin confundir «Closer 1» con «Closer 10»', () => {
  const n = { 'Closer 1': 'Juan Pérez', 'Closer 10': 'Ana Gómez' };
  assert.equal(conNombres('Closer 10 y Closer 1 cierran poco', n), 'Ana Gómez y Juan Pérez cierran poco');
  assert.equal(conNombres('Sin alias acá', {}), 'Sin alias acá');
});

// ── La firma y lo que cambió ───────────────────────────────────────────────────────────────

test('la firma cambia con los datos y no con el orden de armado; cambiosDesde separa datos, período y faltantes', () => {
  const r1 = agregar(gCloser, filasCloser, DESDE, HASTA);
  const r2 = agregar(gCloser, [...filasCloser, fila('2026-10-05', { closer: 'Ana Gómez' }, { leads: 1 })], DESDE, HASTA);
  assert.equal(firmaResultado(r1), firmaResultado(agregar(gCloser, filasCloser, DESDE, HASTA)));
  assert.notEqual(firmaResultado(r1), firmaResultado(r2));
  const e = hoja([item(gCloser, ok(gCloser, filasCloser)), item(gPagos, ok(gPagos, filasPagos)), item(gMeta, ok(gMeta, filasMeta))]);
  const c = cambiosDesde(e, [
    { id: 'g-closer', titulo: '', desde: DESDE, hasta: HASTA, resultado: r2 },
    { id: 'g-pagos', titulo: '', desde: '2026-09-01', hasta: HASTA, resultado: agregar(gPagos, filasPagos, DESDE, HASTA) },
  ]);
  assert.deepEqual(c, { datos: ['g-closer'], periodo: ['g-pagos'], faltan: ['g-meta'] });
  const igual = cambiosDesde(e, [{ id: 'g-closer', titulo: '', desde: DESDE, hasta: HASTA, resultado: r1 }]);
  assert.deepEqual(igual.datos, []);
});

// ── El horario ─────────────────────────────────────────────────────────────────────────────

test('se programa cada día, semana o mes; «cada hora» y «cada año» no (la cuota gratis es por día)', () => {
  assert.equal(sanearCronAnalisis({ unidad: 'hora', cada: 1 }), null);
  assert.equal(sanearCronAnalisis({ unidad: 'anio', cada: 1 }), null);
  assert.equal(sanearCronAnalisis(null), null);
  assert.equal(sanearCronAnalisis({ unidad: 'dia', hora: 9, minuto: 0 })?.unidad, 'dia');
  assert.equal(sanearCronAnalisis({ unidad: 'semana', diaSemana: 3 })?.diaSemana, 3);
  assert.equal(sanearCronAnalisis({ unidad: 'mes', diaMes: 15 })?.diaMes, 15);
});

test('la próxima corrida se ancla en la AGENDADA, no en ahora (la unidad relativa es la que lo mide)', () => {
  // AGENTS.md: con día/semana/mes la hora de pared se reconstruye y el test pasa aunque el ancla esté
  // en `ahora`; con horas, no. `siguienteCorrida` no sanea la unidad: se prueba el ancla pelada.
  const cada6h = sanearCron({ unidad: 'hora', cada: 6 })!;
  const agendada = '2026-10-11T12:00:00.000Z';
  const tarde = new Date('2026-10-11T12:07:33.000Z');   // el cron corrió 7 minutos tarde
  assert.equal(siguienteCorrida(cada6h, agendada, 'America/Tijuana', tarde).toISOString(), '2026-10-11T18:00:00.000Z');
});

test('y con «cada 2 días», un cron caído más de un día corre UNA vez y sigue en su grilla', () => {
  const cada2d = sanearCronAnalisis({ unidad: 'dia', cada: 2, hora: 9, minuto: 0 })!;
  // Agendada el 10/10 a las 9:00 de Tijuana (16:00 UTC); el cron vuelve el 11/10 a las 10:00 de Tijuana.
  const agendada = '2026-10-10T16:00:00.000Z';
  const vuelve = new Date('2026-10-11T17:00:00.000Z');
  // Desde la agendada: el 12/10 a las 9:00. Desde `ahora` saldría el 13/10.
  assert.equal(siguienteCorrida(cada2d, agendada, 'America/Tijuana', vuelve).toISOString(), '2026-10-12T16:00:00.000Z');
  const primera = primeraCorrida(cada2d, 'America/Tijuana', vuelve);
  assert.ok(primera.getTime() > vuelve.getTime());
});

// ── El estado de la fila ───────────────────────────────────────────────────────────────────

const filaBase = (o: Partial<FilaAnalisis> = {}): FilaAnalisis => ({
  id: 1, hoja_id: 'h1', componentes: null, cron: null, tz: null, proxima_at: null, anterior_at: null, que_tablero: null,
  estado: null, fase: null, corrida_id: null, origen: null, started_at: null, finished_at: null, error: null,
  analizado_at: null, resultado: null, entrada: null, modelo: null, visto_at: null, corridas: 0, ...o,
});

test('un «corriendo» vencido se pinta como fallo y deja arrancar otra; uno vivo, no', () => {
  const ahora = Date.parse('2026-10-11T12:00:00Z');
  const vivo = filaBase({ estado: 'corriendo', started_at: new Date(ahora - 60_000).toISOString() });
  const muerto = filaBase({ estado: 'corriendo', started_at: new Date(ahora - VENCE_MS - 1000).toISOString() });
  assert.equal(puedeArrancar(vivo, ahora), false);
  assert.equal(puedeArrancar(muerto, ahora), true);
  assert.ok(vistaDeFila(vivo, ahora).corriendo);
  assert.equal(vistaDeFila(muerto, ahora).corriendo, null);
  assert.match(vistaDeFila(muerto, ahora).fallo!.error, /se cortó/);
});

test('«nuevo» compara INSTANTES (Postgres devuelve +00:00, el navegador escribe Z), y un fallo no tapa el último bueno', () => {
  const e = base();
  const salida = sanearSalida({ hallazgos: [{ grafico: 'g-meta', metrica: 'gasto_usd', titulo: 'Gastaste US$150', texto: '' }] }, e)!;
  const ahora = Date.parse('2026-10-11T12:00:00Z');
  const comun = { analizado_at: '2026-10-11T10:00:00+00:00', resultado: salida, entrada: e };
  assert.equal(vistaDeFila(filaBase({ ...comun, visto_at: '2026-10-11T10:00:00.000Z' }), ahora).nuevo, false);
  assert.equal(vistaDeFila(filaBase({ ...comun, visto_at: null }), ahora).nuevo, true);
  const conFallo = vistaDeFila(filaBase({ ...comun, estado: 'error', error: 'Sin cuota', finished_at: '2026-10-11T11:00:00+00:00' }), ahora);
  assert.equal(conFallo.fallo?.error, 'Sin cuota');
  assert.ok(conFallo.ultimo, 'el fallo de un intento borró el último análisis bueno');
});

// ── Los cables que el compilador no ve ─────────────────────────────────────────────────────

test('el cron lee el informe con LA MISMA clave que guarda la pantalla (lib/graficos-tablero.ts)', () => {
  const tablero = sinComentarios(leer('../lib/graficos-tablero.ts'));
  const server = sinComentarios(leer('../lib/graficos-analisis-server.ts'));
  const prefijo = /const clave = \(sub: string\) => `([^`$]+)\$\{sub\}`/.exec(tablero)?.[1];
  assert.ok(prefijo, 'no encontré la clave del informe en lib/graficos-tablero.ts');
  assert.ok(server.includes(`\`${prefijo}\${sub}\``), `el analista no lee «${prefijo}<sub>»: el programado analizaría el informe inicial de todos`);
});

// El guard de voseo del repo enumera con `git ls-files`, que no ve un archivo sin `git add`
// (AGENTS.md): hasta que esto se commitee, éste es el único que mira el texto del analista. Se mira
// el CÓDIGO sin comentarios (los comentarios de la casa van de vos, a propósito), incluidos los de fin
// de línea, y también el system del modelo, que pide «de tú».
const NEUTRAS = new Set(['más', 'está', 'aquí', 'así', 'ahí', 'allí', 'sí', 'qué', 'días', 'después', 'además', 'través', 'país']);
const sinNingunComentario = (src: string): string => sinComentarios(src).replace(/([\s;,)}\]])\/\/.*$/gm, '$1');
test('sin voseo en lo que lee la persona (el panel, los errores de la ruta y del server) ni en el system', async () => {
  const { marcasDeVoseo } = await import('../lib/puestas-data');
  for (const ruta of ['../app/dashboard/PanelAnalista.tsx', '../app/api/graficos/analisis/route.ts', '../lib/graficos-analisis-server.ts', '../lib/graficos-analisis.ts']) {
    const codigo = sinNingunComentario(leer(ruta));
    assert.deepEqual(marcasDeVoseo(codigo), [], `${ruta}: voseo`);
    const raras = [...new Set((codigo.match(/(?<!\p{L})\p{L}+(?:á|é|í|ás|és|ís)(?!\p{L})/gu) ?? []).map((w) => w.toLowerCase()))].filter((w) => !NEUTRAS.has(w));
    assert.deepEqual(raras, [], `${ruta}: palabras con forma de voseo («elegí», «probá»…)`);
  }
});

test('el análisis va SOLO por la cascada gratis (nunca chatClaude) y con un plazo absoluto', () => {
  const server = sinComentarios(leer('../lib/graficos-analisis-server.ts'));
  assert.ok(!/chatClaude/.test(server), 'chatClaude cae a Sonnet cuando la cascada falla, y el veto lo corta');
  assert.match(server, /chatCheapCascade\(/);
  assert.match(server, /CASCADA_DOCS/);
  assert.match(server, /hastaMs: p\.hastaMs/);
});

// Martín, 11/10/2026 («siempre tiene que probar con otros provedoores»): la única key de Gemini del ws1
// la bloqueó Google y el panel decía que no pudo. Probado rompiéndolo (base 22 / 0): sin la llamada a la
// red -> 21 / 1; con el «sin IA propia, no se intenta» de antes -> 21 / 1; la red sin el «⚠» -> 21 / 1.
test('sin respuesta usable de las keys del negocio (o sin keys), va la RED DE PLATAFORMA: gratis, registrada y con sus errores aparte', () => {
  const server = sinComentarios(leer('../lib/graficos-analisis-server.ts'));
  const iCascada = server.indexOf('await chatCheapCascade(opciones)');
  const iRed = server.indexOf('await porLaRedDePlataforma(');
  const iError = server.indexOf("await errorDeCascada(errores, 'analizar tus gráficos')");
  assert.ok(iCascada > 0 && iRed > iCascada && iError > iRed, 'el orden: las keys del negocio, la red, y recién ahí el error');
  assert.doesNotMatch(server, /return await fallar\(await errorDeCascada\(\[\]/, 'sin IA propia ya no se corta antes de probar la red');
  assert.doesNotMatch(server, /cuenta\.sinIa|sinIa:/, 'el cron también analiza al negocio sin IA propia');
  const red = sinComentarios(leer('../lib/graficos-ia-red.ts'));
  assert.match(red, /provsGratisDePlataforma\(\)/);
  assert.match(red, /motivo: `⚠ red de plataforma \(\$\{r\.provider\}\)/, 'se registra como red de plataforma en el Saldo de IA');
  // Desde el 16/10/2026 el crédito de Claude de la plataforma va PRIMERO (ya pagado, y la API de Anthropic no entrena):
  // el único camino a Anthropic es su puerta (`conCreditoDeLaPlataforma`, lib/veto-claude.ts). Nada que cobre por pedido.
  assert.match(red, /const \{ conCreditoDeLaPlataforma \} = await import\('\.\/anthropic'\);/);
  assert.doesNotMatch(red.replace("import('./anthropic')", ''), /chatClaude|anthropic|openai/i, 'nada que cobre por pedido');
  assert.match(red, /console\.warn\(/, 'sus errores van al log');
  assert.doesNotMatch(red, /erroresOut/, 'y nunca a la lista con la que se arma el texto del cliente');
});
