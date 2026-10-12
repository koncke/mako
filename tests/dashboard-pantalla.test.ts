// =============================================================================
// La PANTALLA del Dashboard (app/dashboard/EditorInforme.tsx y sus piezas) y lo que sale de ella
// (app/dashboard/exportar.ts): el CSV, el pedido de datos y lo que lee un modelo de IA.
// =============================================================================
// Pedido de Martín (11/10/2026): el feedback de veinticuatro puntos (app/admin/dev/dashboard/bitacora.ts).
// Lo que este archivo fija, porque ninguno de esos errores da un error:
//   · Lo que alguien elige MIRANDO en un control es estado de VISTA: no pasa por `mutar`, no se guarda.
//   · `firmaDe` lleva los filtros, el «agrupar por», `comparar` y la versión: sin los filtros, cambiar un
//     filtro no pedía nada; sin `comparar`, el chip «↑ 1,3×» no aparecía hasta recargar.
//   · La barra de edición va DEBAJO de las hojas (punto 7); el CSS del cromo no tiene un solo hex (punto 17).
//   · El CSV: BOM, comillas, separador, sin fórmulas, una sección por gráfico, lo salteado contado.
//   · Lo que va a un modelo (el chat de MaKo de cada gráfico) no lleva nombres de personas, con la lista
//     POSITIVA del AI Analyst; y lo que el AI Analyst recibe de la pantalla va TAL CUAL (sólo su firma).
// Correr: npx tsx --test tests/dashboard-pantalla.test.ts
//
// ── Roturas (11/10/2026, scratchpad/romper-pantalla.mjs: una por vez, restaurada de MEMORIA + md5, nunca
//    con git; corrida de nuevo al sumar el AI Analyst y la lista positiva de personas). Base: 19 pasan /
//    0 fallan. Cada rotura tumbó SU test (pasan / fallan):
//   · la firma sin los filtros                         -> 18 / 1  «la firma cambia con los filtros…»
//   · la firma sin `comparar`                          -> 18 / 1  «la firma cambia…»
//   · pedidosDeHoja ignora la vista                    -> 18 / 1  «pedidosDeHoja: lo elegido mirando…»
//   · el CSV sin BOM                                   -> 18 / 1  «el CSV de una hoja…»
//   · una celda sin la guarda de fórmulas              -> 17 / 2  «una celda…» y «el CSV de una hoja…»
//   · una celda con el separador y sin comillas        -> 17 / 2  los mismos dos
//   · sinPersonas que no oculta las filas              -> 17 / 2  «lo que lee MaKo…» y «la lista es la del AI Analyst…»
//   · sinPersonas que no oculta el desglose            -> 18 / 1  «lo que lee MaKo…»
//   · el filtro elegido por nombre sin el alias         -> 17 / 2  los mismos dos
//   · la búsqueda por nombre que viaja                 -> 18 / 1  «la lista es la del AI Analyst…»
//   · el AI Analyst que recibe el resultado con alias  -> 18 / 1  «el AI Analyst recibe el resultado TAL CUAL…»
//   · onVista que además llama a mutar                 -> 18 / 1  «lo que alguien elige … MIRANDO…»
//   · el autoguardado con la vista adentro             -> 18 / 1  el mismo
//   · el pedido de la pantalla sin la vista            -> 18 / 1  el mismo
//   · alMoverGrilla sin `if (!editando) return;`       -> 18 / 1  «mirar no guarda…»
//   · una barra de edición arriba de las hojas         -> 18 / 1  «la barra de edición se dibuja DEBAJO…»
//   · el panel de propiedades sin selección            -> 18 / 1  «lo que se fue…»
//   · un guardado que falla sin el toast               -> 18 / 1  «lo que se fue…»
//   · cambiar de hoja con router.replace               -> 18 / 1  «las hojas: …»
//   · el ⋮ de la hoja sólo editando                    -> 18 / 1  «las hojas: …»
//   · el fondo de Looker (#f8fafd) en el CSS           -> 18 / 1  «una sola superficie y el modo oscuro…»
//   · un hex en la galería                             -> 18 / 1  el mismo
//   · la barra de controles sin sticky                 -> 18 / 1  «la barra de controles va pegada arriba…»
//   · el PDF sin break-inside: avoid                   -> 18 / 1  «el PDF: …»
//   · el AI Analyst mudado al final, como un modal      -> 18 / 1  «el AI Analyst es un panel del costado…»
//   · el AI Analyst sin la vista                       -> 18 / 1  el mismo
//   · el PDF que imprime el panel del AI Analyst       -> 18 / 1  «el PDF: …»
//   · el <main> sin `flex: 'none'` (scrollea la página) -> 19 / 1  «el que scrollea es el lienzo…»
//   · el panel del gráfico con `cambiar` pelado         -> 20 / 1  «cambiar lo de ENTRADA de un control…»
//   · el AI Analyst fixed en la compu (tapa tarjetas)   -> 20 / 1  «el AI Analyst es un panel del costado…»
//
// ── Y la tanda de la TOPBAR (11/10/2026, scratchpad/romper-topbar.mjs, mismo método). Las pestañas, la
//    barra de controles pegada en el lienzo y el botón suelto del AI Analyst se fueron: sus tests se
//    reescribieron sobre la topbar. Base: 21 pasan / 0 fallan:
//   · los filtros de vuelta adentro del lienzo           -> 20 / 1  «los filtros van en la topbar…»
//   · el PDF que imprime «Agrega un subtítulo»           -> 20 / 1  «el PDF: …»
//   · las acciones de una hoja sin poder guardar         -> 20 / 1  «las hojas: …»
//   · el AI Analyst preguntándole al server por el closer -> 20 / 1  «el AI Analyst es un panel del costado…»

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { efectivoDe, sanearGrafico, sanearHoja, type Componente, type Grafico, type Hoja } from '../lib/graficos-catalogo';
import type { Resultado } from '../lib/graficos-agregar';
import { DIMENSIONES_PERSONA } from '../lib/graficos-acciones';
import { dimensionPublica, firmaResultado } from '../lib/graficos-analisis';
import {
  celdaCsv, contextoDeGrafico, csvDeHoja, firmaDe, loQueSeVeDe, nombreArchivo, numeroCsv, pedidosDeHoja, periodoDeHoja, sinPersonas,
} from '../app/dashboard/exportar';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md): un `/*` adentro de un `//` se comería el código.
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»: ¿se movió?`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre «${hasta}» de «${desde}»`);
  return src.slice(i, j);
};

const HOY = '2026-10-11';
const g = (r: Record<string, unknown>): Grafico => sanearGrafico({ id: 'g1', ...r })!;
const hojaCon = (componentes: unknown[], extra: Record<string, unknown> = {}): Hoja => sanearHoja({ id: 'h1', nombre: 'Marketing', componentes, ...extra }, 0)!;
const res = (r: Partial<Resultado>): Resultado => ({ columnas: [], filas: [], totales: [], fuera: 0, clase: null, ...r });

// ── El pedido de datos y su firma ─────────────────────────────────────────────

test('la firma cambia con los filtros, el «agrupar por», comparar y la versión; no con moverlo ni con el título', () => {
  const base = g({ tipo: 'tabla', fuente: 'meta', dimension: 'campana', metricas: ['gasto'] });
  const hoja = hojaCon([base]);
  const ef = efectivoDe(base, hoja, {}, HOY);
  const f0 = firmaDe(base, ef, 0);
  assert.notEqual(firmaDe(base, { ...ef, filtros: [{ dimension: 'campana', valores: ['A'] }] }, 0), f0, 'un filtro nuevo no cambia la firma: no se pediría nada');
  assert.notEqual(firmaDe(base, { ...ef, agrupar: 'semana' }, 0), f0, 'el «agrupar por» no cambia la firma');
  assert.notEqual(firmaDe({ ...base, comparar: true }, ef, 0), f0, '«comparar» no cambia la firma: el chip no aparecería hasta recargar');
  assert.notEqual(firmaDe(base, ef, 1), f0, 'la versión no cambia la firma: refrescar() no pediría nada');
  assert.notEqual(firmaDe(base, { ...ef, desde: '2026-09-01' }, 0), f0);
  assert.equal(firmaDe({ ...base, x: 6, y: 9, w: 3, titulo: 'Otro', subtitulo: 'x' }, ef, 0), f0, 'moverlo o retitularlo pide datos de más');
});

test('pedidosDeHoja: lo elegido mirando cambia el período y los filtros del pedido, y los bloques van aparte', () => {
  const hoja = hojaCon(
    [
      { id: 'g1', clase: 'grafico', tipo: 'tabla', fuente: 'meta', dimension: 'campana', metricas: ['gasto'] },
      { id: 'b1', clase: 'bloque', bloque: 'revenue' },
      { id: 'e1', clase: 'elemento', tipo: 'texto', texto: 'Hola' },
    ],
    { controles: [{ id: 'cp', tipo: 'periodo', preset: 'ult30' }, { id: 'cl', tipo: 'lista', campo: 'campana' }] },
  );
  const sinVista = pedidosDeHoja(hoja, {}, HOY, 0);
  assert.equal(sinVista.graficos.length, 1);
  assert.equal(sinVista.bloques.length, 1);
  assert.deepEqual(sinVista.bloques[0].pedido, { id: 'b1', bloque: 'revenue', desde: '2026-09-12', hasta: HOY });
  assert.deepEqual(sinVista.graficos[0].pedido.filtros, []);
  const conVista = pedidosDeHoja(hoja, { cp: { preset: 'ult7' }, cl: { valores: ['Verano'] } }, HOY, 0);
  assert.equal(conVista.graficos[0].pedido.desde, '2026-10-05');
  assert.deepEqual(conVista.graficos[0].pedido.filtros, [{ dimension: 'campana', valores: ['Verano'] }]);
  assert.notEqual(conVista.graficos[0].firma, sinVista.graficos[0].firma);
  assert.equal(conVista.bloques[0].pedido.desde, '2026-10-05', 'el bloque no sigue al período de la hoja');
});

test('el período de la hoja para el PDF: el control con lo elegido mirando, y los filtros activos', () => {
  const hoja = hojaCon([], { controles: [{ id: 'cp', tipo: 'periodo', preset: 'ult30' }, { id: 'cl', tipo: 'lista', campo: 'campana' }] });
  assert.equal(periodoDeHoja(hoja, {}, HOY), 'Últimos 30 días: 12/09/2026 – 11/10/2026');
  assert.equal(periodoDeHoja(hoja, { cp: { preset: 'ult7' }, cl: { valores: ['Verano'] } }, HOY), 'Últimos 7 días: 05/10/2026 – 11/10/2026 · Campaña: Verano');
  assert.equal(periodoDeHoja(hojaCon([]), {}, HOY), 'Últimos 30 días: 12/09/2026 – 11/10/2026', 'sin control, los 30 días de siempre');
});

// ── El CSV ──────────────────────────────────────────────────────────────────

test('una celda: comillas cuando hacen falta, la comilla de adentro doble, y un texto nunca es una fórmula', () => {
  assert.equal(celdaCsv('Campaña A'), 'Campaña A');
  assert.equal(celdaCsv('Verano, 2026'), '"Verano, 2026"');
  assert.equal(celdaCsv('El "mejor"'), '"El ""mejor"""');
  assert.equal(celdaCsv('dos\nlíneas'), '"dos\nlíneas"');
  assert.equal(celdaCsv(' borde '), '" borde "');
  assert.equal(celdaCsv('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`, 'una campaña que empieza con = se abre como fórmula en Excel');
  assert.equal(celdaCsv('+54 9 11'), "'+54 9 11");
  assert.equal(celdaCsv('@usuario'), "'@usuario");
  assert.equal(celdaCsv(-12.5), '-12.5', 'un NÚMERO negativo es un número: no lleva apóstrofo');
  assert.equal(celdaCsv(null), '');
  assert.equal(celdaCsv('a;b', ';'), '"a;b"', 'el separador manda las comillas');
  assert.equal(numeroCsv(0.1 + 0.2), '0.3');
  assert.equal(numeroCsv(1234.56789), '1234.5679');
  assert.equal(numeroCsv(Number.NaN), '');
});

test('el CSV de una hoja: BOM, CRLF, una sección por gráfico en el orden en que se leen, y lo salteado contado', () => {
  const tabla = { id: 'gt', clase: 'grafico', tipo: 'tabla', fuente: 'meta', dimension: 'campana', metricas: ['gasto', 'leads'], titulo: 'Por campaña', x: 0, y: 4, w: 6, h: 8 };
  const kpi = { id: 'gk', clase: 'grafico', tipo: 'numero', fuente: 'negocio', metricas: ['gasto'], titulo: 'Ad Spend', comparar: true, x: 0, y: 0, w: 3, h: 4 };
  const serie = { id: 'gs', clase: 'grafico', tipo: 'serie', fuente: 'negocio', dimension: 'dia', metricas: ['leads'], titulo: 'Leads', x: 6, y: 4, w: 6, h: 8 };
  const sinDatos = { id: 'gn', clase: 'grafico', tipo: 'tabla', fuente: 'leads', dimension: 'etapa', metricas: ['leads'], x: 0, y: 20, w: 6, h: 8 };
  const hoja = hojaCon([
    tabla, serie, kpi, sinDatos,
    { id: 'b1', clase: 'bloque', bloque: 'revenue', x: 0, y: 30 },
    { id: 'e1', clase: 'elemento', tipo: 'texto', texto: 'Título', x: 0, y: 40 },
  ]);
  const ef = { desde: '2026-09-12', hasta: HOY, agrupar: null };
  const resultados: Record<string, Resultado> = {
    gt: res({
      clase: 'categoria',
      columnas: [{ id: 'gasto', nombre: 'Gasto', formato: 'usd' }, { id: 'leads', nombre: 'Leads', formato: 'numero' }],
      filas: [{ clave: 'Verano, 2026', etiqueta: 'Verano, 2026', valores: [120.5, 3] }, { clave: '=raro', etiqueta: '=raro', valores: [10, null] }],
      totales: [130.5, 3], fuera: 2,
    }),
    gk: res({ columnas: [{ id: 'gasto', nombre: 'Gasto en anuncios', formato: 'usd' }], totales: [500], anterior: [400] }),
    gs: res({ clase: 'tiempo', columnas: [{ id: 'leads', nombre: 'Leads', formato: 'numero' }], filas: [{ clave: '2026-10-10', etiqueta: '10 oct', valores: [4] }], totales: [4] }),
  };
  const { csv, graficos, salteados } = csvDeHoja({ hoja, resultados, efectivos: { gt: ef, gk: ef, gs: ef, gn: ef }, hoy: HOY });
  assert.ok(csv.startsWith(String.fromCharCode(0xfeff)), 'sin BOM, Excel abre «Campaña» como «CampaÃ±a»');
  assert.ok(!/[^\r]\n/.test(csv), 'un salto de línea sin CR (RFC 4180 pide CRLF)');
  assert.equal(graficos, 3);
  assert.deepEqual(salteados, { bloques: 1, elementos: 1, sinDatos: 1 });
  const lineas = csv.slice(1).split('\r\n');
  assert.deepEqual(lineas.slice(0, 2), ['Hoja,Marketing', 'Exportado,11/10/2026']);
  // El orden de lectura: arriba la KPI (y 0), después la tabla (x 0) y la serie (x 6) en la fila 4.
  const titulos = lineas.filter((l) => l.startsWith('Gráfico,')).map((l) => l.slice(8));
  assert.deepEqual(titulos, ['Ad Spend', 'Por campaña', 'Leads']);
  // La KPI: su total y el período anterior (compara).
  const iK = lineas.indexOf('Gráfico,Ad Spend');
  assert.deepEqual(lineas.slice(iK, iK + 5), ['Gráfico,Ad Spend', 'Período,12/09/2026 – 11/10/2026', ',Gasto en anuncios (US$)', 'Total,500', 'Período anterior,400']);
  // La tabla: la unidad en el encabezado, el número pelado, las comillas, la fórmula desarmada y lo que no entró.
  const iT = lineas.indexOf('Gráfico,Por campaña');
  assert.deepEqual(lineas.slice(iT + 2, iT + 7), ['Campaña,Gasto (US$),Leads', '"Verano, 2026",120.5,3', "'=raro,10,", 'Total,130.5,3', 'Sin mostrar,2 grupos más']);
  // La serie: el día con su clave ISO, que Excel y Sheets entienden en cualquier país.
  const iS = lineas.indexOf('Gráfico,Leads');
  assert.equal(lineas[iS + 3], '2026-10-10,4');
  assert.ok(lineas.includes('Sin exportar,"1 bloque, 1 elemento, 1 gráfico sin datos"'), 'no dice qué quedó afuera');
});

test('el CSV de un cruce (desglose): una columna por valor del desglose y el total', () => {
  const cruce = { id: 'gc', clase: 'grafico', tipo: 'columnas_apiladas', fuente: 'leads', dimension: 'etapa', desglose: 'origen', metricas: ['leads'], titulo: 'Cruce' };
  const hoja = hojaCon([cruce]);
  const r = res({
    clase: 'categoria', columnas: [{ id: 'leads', nombre: 'Leads', formato: 'numero' }],
    filas: [{ clave: 'Nuevo', etiqueta: 'Nuevo', valores: [5] }],
    totales: [5], cruce: { claves: ['Meta', 'Orgánico'], celdas: [[3, 2]] },
  });
  const lineas = csvDeHoja({ hoja, resultados: { gc: r }, efectivos: { gc: { desde: '2026-10-01', hasta: HOY, agrupar: null } }, hoy: HOY }).csv.split('\r\n');
  const i = lineas.indexOf('Gráfico,Cruce');
  assert.deepEqual(lineas.slice(i + 2, i + 5), ['Etapa,Meta,Orgánico,Total', 'Nuevo,3,2,5', 'Total,,,5']);
});

test('el nombre del archivo: sin acentos ni espacios', () => {
  assert.equal(nombreArchivo('Ventas & Cobranza — Q4', HOY, 'csv'), 'dashboard-ventas-cobranza-q4-2026-10-11.csv');
  assert.equal(nombreArchivo('📣', HOY, 'pdf'), 'dashboard-hoja-2026-10-11.pdf');
});

// ── Lo que va a un modelo: sin personas ─────────────────────────────────────

test('lo que lee MaKo no lleva nombres de personas: ni los clientes de Pagos ni los closers', () => {
  const pagos = g({ id: 'gp', tipo: 'tabla', fuente: 'pagos', dimension: 'cliente', metricas: ['monto'] });
  const r = res({
    clase: 'categoria', columnas: [{ id: 'monto', nombre: 'Monto', formato: 'usd' }],
    filas: [{ clave: 'Juana Pérez', etiqueta: 'Juana Pérez', valores: [100] }, { clave: 'Otros', etiqueta: 'Otros', valores: [50] }],
    totales: [150],
  });
  const ctx = contextoDeGrafico(pagos, r, { desde: '2026-10-01', hasta: HOY, filtros: [{ dimension: 'cliente', valores: ['Pedro Gómez'] }] });
  assert.ok(!ctx.includes('Juana') && !ctx.includes('Pedro'), `se coló un nombre:\n${ctx}`);
  assert.match(ctx, /Cliente 1: Monto US\$100/);
  assert.match(ctx, /- Otros: /, '«Otros» no es una persona');
  assert.match(ctx, /Filtros: Cliente: Cliente 2\./, 'el filtro elegido por nombre no pasó por el alias');
  assert.match(ctx, /Período: 01\/10\/2026 – 11\/10\/2026/);
  // El desglose también: los closers como columnas del cruce.
  const leads = g({ id: 'gl', tipo: 'columnas_apiladas', fuente: 'leads', dimension: 'etapa', desglose: 'closer', metricas: ['leads'] });
  const rc = res({ clase: 'categoria', columnas: [{ id: 'leads', nombre: 'Leads', formato: 'numero' }], filas: [{ clave: 'Nuevo', etiqueta: 'Nuevo', valores: [3] }], totales: [3], cruce: { claves: ['Martín Sosa', 'Ana Ruiz'], celdas: [[1, 2]] } });
  assert.deepEqual(sinPersonas(leads, rc).cruce!.claves, ['Closer 1', 'Closer 2']);
  // Una dimensión pública se deja como está (el mismo objeto).
  const meta = g({ id: 'gm', tipo: 'tabla', fuente: 'meta', dimension: 'campana', metricas: ['gasto'] });
  const rm = res({ clase: 'categoria', columnas: [{ id: 'gasto', nombre: 'Gasto', formato: 'usd' }], filas: [{ clave: 'Verano', etiqueta: 'Verano', valores: [1] }], totales: [1] });
  assert.equal(sinPersonas(meta, rm), rm);
});

test('la lista es la del AI Analyst y es POSITIVA: el lead, el motivo escrito a mano y un «Cliente: …» tampoco viajan', () => {
  // Las que el detalle declara con personas (lib/graficos-acciones.ts) no son públicas para el modelo.
  for (const d of DIMENSIONES_PERSONA) {
    const [fuente, dim] = d.split('.');
    assert.equal(dimensionPublica(fuente, dim), false, `«${d}» trae nombres y viajaría al chat de MaKo`);
  }
  const fila = (etiqueta: string) => ({ clave: etiqueta, etiqueta, valores: [1] });
  const cols = [{ id: 'leads', nombre: 'Leads', formato: 'numero' as const }];
  const casos: Array<[Record<string, unknown>, string, string]> = [
    [{ fuente: 'leads', dimension: 'lead' }, 'Juana Pérez', 'Lead 1'],
    [{ fuente: 'leads', dimension: 'motivo' }, 'No le alcanzó, habló con Pedro', 'Motivo de pérdida 1'],
    [{ fuente: 'tareas', dimension: 'proyecto' }, 'Cliente: Juana Pérez', 'Cliente 1'],
  ];
  for (const [def, real, alias] of casos) {
    const gr = g({ tipo: 'tabla', metricas: ['leads'], ...def });
    const ctx = contextoDeGrafico(gr, res({ clase: 'categoria', columnas: cols, filas: [fila(real)], totales: [1] }), { desde: '2026-10-01', hasta: HOY, filtros: [] });
    assert.ok(!ctx.includes('Juana') && !ctx.includes('Pedro'), `se coló un nombre por ${def.fuente}.${def.dimension}:\n${ctx}`);
    assert.match(ctx, new RegExp(`- ${alias}: `));
  }
  // Un filtro elegido por nombre recibe el MISMO alias que su fila.
  const pagos = g({ tipo: 'tabla', fuente: 'pagos', dimension: 'cliente', metricas: ['monto'] });
  const ctx = contextoDeGrafico(pagos, res({ clase: 'categoria', columnas: [{ id: 'monto', nombre: 'Monto', formato: 'usd' }], filas: [fila('Ana Ruiz')], totales: [1] }),
    { desde: '2026-10-01', hasta: HOY, filtros: [{ dimension: 'cliente', valores: ['Ana Ruiz'] }] });
  assert.match(ctx, /Filtros: Cliente: Cliente 1\./);
  assert.match(ctx, /- Cliente 1: /);
  // Y lo que se tipeó en una búsqueda sobre una dimensión con personas no viaja (puede ser un nombre).
  const busca = contextoDeGrafico(pagos, res({ clase: 'categoria', columnas: [{ id: 'monto', nombre: 'Monto', formato: 'usd' }], filas: [], totales: [0] }),
    { desde: '2026-10-01', hasta: HOY, filtros: [{ dimension: 'cliente', texto: 'Juana' }] });
  assert.ok(!busca.includes('Juana'), busca);
  assert.match(busca, /Filtros: Cliente: una búsqueda\./);
});

test('el AI Analyst recibe el resultado TAL CUAL: su firma es la que sacó el server (si no, «cambió» para siempre)', () => {
  // No va a ningún modelo: PanelAnalista sólo compara `firmaResultado` contra la del análisis guardado.
  const pagos = g({ id: 'gp', tipo: 'tabla', fuente: 'pagos', dimension: 'cliente', metricas: ['monto'] });
  const r = res({ clase: 'categoria', columnas: [{ id: 'monto', nombre: 'Monto', formato: 'usd' }], filas: [{ clave: 'Juana Pérez', etiqueta: 'Juana Pérez', valores: [100] }], totales: [100] });
  const visto = loQueSeVeDe(hojaCon([pagos]), { gp: r }, { gp: { desde: '2026-10-01', hasta: HOY } });
  assert.equal(visto.length, 1);
  assert.equal(firmaResultado(visto[0].resultado), firmaResultado(r));
});

// ── La pantalla, leyendo el fuente ─────────────────────────────────────────

const EDITOR = sinComentarios(leer('app/dashboard/EditorInforme.tsx'));

test('lo que alguien elige en un control MIRANDO no pasa por mutar ni se guarda', () => {
  const onVista = bloque(EDITOR, 'const onVista = useCallback(', '}, []);');
  assert.ok(onVista.length < 300, `el recorte mide ${onVista.length}: está mirando otra cosa`);
  assert.match(onVista, /setVista\(/);
  assert.doesNotMatch(onVista, /mutar|setTablero|pila|apilar/, 'elegir mirando entró al informe: se guardaría y se apilaría en el deshacer');
  // Los dos que dibujan controles reciben ESE handler, no uno armado en el lugar.
  assert.match(EDITOR, /<BarraControles[\s\S]*?onVista=\{onVista\}/);
  assert.match(EDITOR, /<ChipsControles [^>]*onVista=\{onVista\}/);
  // Y el autoguardado mira el INFORME, nunca la vista.
  const guardado = bloque(EDITOR, 'const json = JSON.stringify(tablero);', '}, [tablero, mandar]);');
  assert.doesNotMatch(guardado, /vista/);
  // El pedido de datos sí la mira (con la versión de refrescar() y, desde la topbar, el token del link
  // compartido, que decide la RUTA del pedido y no lo que se pide).
  assert.match(EDITOR, /const p = pedidosDeHoja\(hoja, vista, hoy, version\);/);
  assert.match(EDITOR, /\}, \[hoja, vista, hoy, version, tokenLink\]\);/);
});

test('cambiar lo de ENTRADA de un control olvida lo elegido mirando en él (la barra y el panel del gráfico)', () => {
  assert.match(bloque(EDITOR, 'const cambiarControl = (', '\n  };'), /olvidarVista\(\[id\]\)/);
  const panel = bloque(EDITOR, 'const cambiarDesdePanel = (', '\n  };');
  assert.match(panel, /olvidarVista\(/);
  // Los dos paneles que editan controles pasan por ahí, no por `cambiar` pelado.
  assert.match(EDITOR, /<PropsGrafico [^>]*onCambiar=\{\(p\) => cambiarDesdePanel\(sel, p\)\}/);
  assert.match(EDITOR, /<PropsBloque [^>]*onCambiar=\{\(p\) => cambiarDesdePanel\(sel, p\)\}/);
});

test('mirar no guarda: la grilla sólo escribe el informe editando', () => {
  const cuerpo = bloque(EDITOR, 'const alMoverGrilla = useCallback(', '}, [idHoja, editando]);');
  assert.ok(cuerpo.length < 1500, `el recorte mide ${cuerpo.length}: está mirando otra cosa`);
  assert.match(cuerpo, /^const alMoverGrilla = useCallback\(\(l: Layout\) => \{\n\s*if \(!editando\) return;/);
  assert.match(EDITOR, /onLayoutChange=\{alMoverGrilla\}/);
});

test('la barra de edición se dibuja DEBAJO de la topbar (punto 7): la topbar no se mueve al apretar Editar', () => {
  const vuelta = EDITOR.slice(EDITOR.indexOf('return (\n    <div className={`lk lk-app'));
  const iTop = vuelta.indexOf('<BarraSuperior');
  const iBarra = vuelta.indexOf('className="lk-barra"');
  assert.ok(iTop > 0 && iBarra > 0, 'no encuentro la topbar o la barra');
  assert.ok(iTop < iBarra, 'la barra de edición está ARRIBA de la topbar');
  assert.equal((vuelta.match(/className="lk-barra"/g) ?? []).length, 1);
});

test('una sola superficie y el modo oscuro: el CSS del cromo no tiene un solo color en hexadecimal', async () => {
  const { CSS } = await import('../app/dashboard/editor-css');
  const sinCom = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.deepEqual(sinCom.match(/#[0-9a-f]{3,8}\b/gi) ?? [], [], 'un hex en el CSS del cromo no se da vuelta en oscuro');
  assert.ok(!CSS.includes('`'), 'una comilla invertida corta la hoja a la mitad');
  // El fondo es var(--bg) de punta a punta: sin el gris del lienzo ni la página con sombra.
  assert.match(sinCom, /\.lk-app \{[^}]*background: var\(--bg\)/);
  assert.match(sinCom, /\.lk-lienzo \{[^}]*background: var\(--bg\)/);
  assert.doesNotMatch(sinCom, /\.lk-pagina \{[^}]*box-shadow/);
  // Los archivos del cromo tampoco pintan con hex en línea (los colores de una serie salen del tema).
  for (const f of ['EditorInforme.tsx', 'Cabecera.tsx', 'Propiedades.tsx', 'PanelEstilo.tsx', 'Galeria.tsx']) {
    const src = sinComentarios(leer(`app/dashboard/${f}`));
    assert.deepEqual(src.match(/['"]#[0-9a-f]{3,8}['"]/gi) ?? [], [], `hex en ${f}`);
  }
});

// Desde la tanda de la topbar (11/10/2026, punto 7: «Los botones de filtro también en la topbar… que
// siempre estén allí») los filtros viven en la TOPBAR, que está AFUERA del lienzo que scrollea: quedan
// arriba siempre sin necesitar sticky (el sticky de antes se rompía en silencio si .lk-lienzo no scrolleaba).
test('los filtros van en la topbar: afuera del lienzo que scrolla, y una sola vez', async () => {
  const { CSS } = await import('../app/dashboard/editor-css');
  assert.match(CSS, /\.lk-lienzo \{[^}]*overflow-y: auto/);
  assert.doesNotMatch(CSS, /\.lk-controles\b/, 'volvió la fila de controles adentro del lienzo');
  const vuelta = EDITOR.slice(EDITOR.indexOf('return (\n    <div className={`lk lk-app'));
  const top = bloque(vuelta, '<BarraSuperior', '<div className="lk-cuerpo">');
  assert.match(top, /derecha=\{\([\s\S]*<BarraControles\b/, 'los filtros no están en la topbar');
  assert.equal((vuelta.match(/<BarraControles\b/g) ?? []).length, 1, 'los filtros se dibujan dos veces');
  assert.doesNotMatch(bloque(vuelta, '<div className="lk-lienzo"', '{sel && ('), /<BarraControles\b/, 'los filtros volvieron al lienzo');
});

// Las tres aserciones de arriba daban VERDE con la barra yéndose con la página (medido en Chrome el
// 11/10/2026: y = -1079 después de la rueda). El sticky estaba bien; lo que faltaba es que .lk-lienzo
// SCROLLEE, y eso lo decide el alto del <main>: con el `flex: 1` de Pagina (base 0%) el `height` no
// manda y el main crecía a su contenido. Sin `flex: 'none'` u `overflow: 'hidden'` vuelve el bug.
test('el que scrollea es el lienzo: el <main> del Dashboard tiene alto (flex none + overflow hidden)', async () => {
  const pagina = bloque(sinComentarios(leer('app/dashboard/page.tsx')), '<Pagina ', '>');
  assert.match(pagina, /flex: 'none'/);
  assert.match(pagina, /height: '100dvh'/);
  assert.match(pagina, /overflow: 'hidden'/);
  // Y el PDF lo desarma: con el main a la altura de la ventana, la impresión se cortaría en la primera hoja.
  const { CSS } = await import('../app/dashboard/editor-css');
  assert.match(bloque(CSS, '@media print', '\n}\n'), /main:has\(> \.lk-app\) \{ height: auto !important; overflow: visible !important; \}/);
});

test('lo que se fue (puntos 9, 10 y 11): el panel Datos, el arrastre de campos, el riel y «Empecemos»', () => {
  for (const [que, re] of [
    ['el panel Datos', /PanelDatos|lk-datos\b/], ['el arrastre de campos', /draggable|MIME_CAMPO|onDragStart=\{arrastrar/],
    ['el riel', /lk-riel/], ['«Empecemos»', /Empecemos/], ['el logo de Looker', /SvgLogo/], ['«Guardado»', /'Guardado'|Guardando…/],
  ] as const) assert.doesNotMatch(EDITOR, re, `volvió ${que}`);
  // Las propiedades, sólo con algo elegido (y elegir sólo existe editando).
  assert.match(EDITOR, /const sel = editando \? hoja\.componentes\.find/);
  assert.match(EDITOR, /\{sel && \(\s*<aside className="lk-props"/);
  // Un guardado que falla avisa.
  assert.match(EDITOR, /show\('No se guardó'/);
});

// Desde la tanda de la topbar (11/10/2026, puntos 1 y 6): sin pestañas y sin el ícono de la tab; las hojas
// son el desplegable del título. Lo que se sigue fijando de antes: el menú de una hoja también mirando (con
// clic derecho), sólo si se puede guardar, y cambiar de hoja sin volver al server.
test('las hojas: sin pestañas ni ícono, el menú de cada hoja también mirando, y cambiar de hoja sin volver al server', () => {
  const cab = sinComentarios(leer('app/dashboard/Cabecera.tsx'));
  assert.doesNotMatch(cab, /<Icon name="graphics"|role="tablist"/, 'volvió el ícono de la tab o las pestañas (puntos 1 y 6)');
  const menu = bloque(cab, 'export function MenuHojas(', '\n}\n');
  assert.match(menu, /onContextMenu=/);
  assert.doesNotMatch(menu, /editando/, 'el menú de la hoja volvió a depender de estar editando');
  assert.match(menu, /\{acciones && \(\s*<button type="button" className="lk-hoja-mas"/, 'el ⋮ sin la guarda: el cambio se perdería sin aviso');
  assert.match(menu, /<NuevoPlaceholder /);
  // Y las acciones de una hoja llegan sólo si se puede guardar.
  assert.match(EDITOR, /acciones=\{guardable \? \{ onRenombrar: renombrarHoja,/);
  // replaceState con el ?ws= de la pestaña; nunca router.replace (vuelve a correr la página del server).
  const ir = bloque(EDITOR, 'const irAHoja = useCallback(', '}, [ws]);');
  assert.match(ir, /window\.history\.replaceState\(null, '', conWs\(/);
  assert.doesNotMatch(EDITOR, /router\.(replace|push)\(/);
});

test('el AI Analyst es un panel del costado: va en la fila del lienzo (no al final, como un modal) y mira la vista', () => {
  // `PanelAnalista` dibuja un `aside` de alto completo y ancho fijo (app/dashboard/PanelAnalista.tsx):
  // montado al final de la pantalla quedaba como una franja debajo del lienzo, sin un error.
  const vuelta = EDITOR.slice(EDITOR.indexOf('return (\n    <div className={`lk lk-app'));
  const iCuerpo = vuelta.indexOf('<div className="lk-cuerpo">');
  const iPanel = vuelta.indexOf('<PanelAnalista ');
  // El primero de los menús flotantes (el `aria-expanded` del botón de la barra dice lo mismo sin el `||`).
  const iMenus = vuelta.indexOf("{menu?.tipo === 'graficos' || menu?.tipo === 'cambiarTipo'");
  assert.ok(iCuerpo > 0 && iMenus > 0, 'no encuentro el cuerpo o los menús: ¿se movieron?');
  assert.ok(iCuerpo < iPanel && iPanel < iMenus, 'el AI Analyst salió de la fila del lienzo');
  assert.equal((vuelta.match(/<PanelAnalista /g) ?? []).length, 1);
  assert.match(vuelta, /<PanelAnalista [^>]*vista=\{vista\}/, 'el análisis a mano miraría lo guardado y no lo que la persona eligió');
  // Desde la tanda de la topbar (punto 4) se abre desde el ⋮, con el logo chico y el punto de «análisis
  // nuevo» (que también va en el ⋮). Al closer y a un link, ni la opción ni la pregunta al server.
  const mas = bloque(vuelta, "{menu?.tipo === 'mas' && (", '</Flotante>');
  assert.match(mas, /\{!soloMirar && \(\s*<>\s*<button type="button" role="menuitem" className="lk-opcion lk-opcion--mako"[^>]*onClick=\{alternarAnalista\}/);
  assert.match(mas, /<LogoMako /);
  assert.match(EDITOR, /const analisisNuevo = useAnalisisNuevo\(hoja\.id, analista, !soloMirar\);/);
  // En la compu es una COLUMNA de esa fila (el lienzo se achica): fixed tapaba la cuarta columna de
  // tarjetas (medido en Chrome el 11/10/2026). Fixed sólo en el celular, donde al lado no entra.
  const css = leer('app/dashboard/PanelAnalista.tsx');
  const reglaAn = css.match(/\n\.an \{[^}]*\}/)?.[0] ?? '';
  assert.ok(reglaAn, 'no encontré la regla .an');
  assert.doesNotMatch(reglaAn, /position: fixed/);
  assert.match(reglaAn, /flex: none/);
  assert.match(css, /@media \(max-width: 760px\) \{ \.an \{ position: fixed;/);
});

test('el PDF: la impresión esconde el cromo y deja cada tarjeta entera en su lugar', async () => {
  const { CSS } = await import('../app/dashboard/editor-css');
  const imprimir = CSS.slice(CSS.indexOf('@media print'));
  assert.match(imprimir, /aside\[data-sidebar\] \{ display: none !important; \}/);
  // De la topbar se imprime el título (la mitad izquierda); los filtros, Compartir, Editar, el ⋮ y el ▾ no.
  assert.match(imprimir, /\.lk-top-der, \.lk-top-hojas, \.lk-barra, \.lk-props, \.lk-comp-acciones, \.lk-sin-imprimir, \.lk-cuerpo > \.an \{ display: none !important; \}/);
  assert.match(imprimir, /\.lk-top \.edin\[data-vacio\]::before \{ content: '' !important; \}/, 'el PDF imprimiría «Agrega un subtítulo»');
  assert.match(imprimir, /grid-column: var\(--lk-col\); grid-row: var\(--lk-fila\); break-inside: avoid; page-break-inside: avoid;/);
  // Y cada tarjeta lleva su lugar en la grilla de papel.
  assert.match(EDITOR, /'--lk-col': `\$\{c\.x \+ 1\} \/ span \$\{c\.w\}`, '--lk-fila': `\$\{c\.y \+ 1\} \/ span \$\{c\.h\}`/);
});
