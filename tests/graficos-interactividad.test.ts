// Tests de los gráficos INTERACTIVOS del Dashboard (punto 5 del feedback de Martín, 11/10/2026): las
// referencias que viajan con cada fila (lib/graficos-agregar.ts), el detalle agrupado por entidad
// (`agregarPorRef`), el mapa de «a qué abre cada métrica» (lib/graficos-catalogo.ts, `destinoDetalle`),
// las acciones de cada fila y la leyenda (lib/graficos-acciones.ts), y dos guards de fuente: que los
// lectores lleven los ids y que el detalle no le mande nombres de personas a ninguna IA.
// Correr: npx tsx --test tests/graficos-interactividad.test.ts
//
// Probados rompiéndolos (11/10/2026, de a una pieza, restaurando desde memoria), con la base en 16 de 16 y
// la vuelta en 16 de 16:
//   · `refDeGrupo` devolviendo el PRIMER id aunque haya varios → 2 fallos de 16 («un grupo con UN id…» y
//     «las filas sin id cuentan…»).
//   · `agregarPorRef` agrupando por el NOMBRE (`f.d[ref]`) en vez del id → 2 fallos de 16 («el detalle
//     agrupa por el id…» y «la cuota lleva los dos ids…»).
//   · «Marcar cobrada» sin mirar el estado de la cuota → 1 fallo de 16 («las acciones de cada fila…»).
//   · `alternarSerie` dejando apagar la última serie → 1 fallo de 16 («la leyenda…»).
//   · `import { chatCheap } from './ai-cheap'` en lib/graficos-detalle.ts → 1 fallo de 16 («el detalle no
//     pasa por ninguna IA»).
//   · El lector de pagos sin `cuota: String(x.id)` en `r` → 1 fallo de 16 («los lectores llevan los ids…»).
//   · El `useState` de CuerpoGrafico movido después del primer `return` → 1 fallo de 16 («el gráfico
//     declara su único hook…»). La primera versión de ese guard buscaba `useState(` y daba ROJO sobre el
//     código sano (el hook va con su tipo, `useState<…>(`): se mide con `\buseState\b`.
//   · `recortarAlTramo` devolviendo todo, y el detalle sin llamarlo → 1 fallo de 16 cada una («un conjunto
//     «hoy» se recorta…»).
//   · `leads.lead` fuera de DIMENSIONES_PERSONA, y `leads.etapa` (pública) adentro → 1 fallo de 16 cada una
//     («las dimensiones con nombres de personas…»).
// Al retomar la corrida (cortada por la cuota) este archivo importaba DIMENSIONES_PERSONA y el módulo no lo
// exportaba: lo marcó el typecheck (TS2305), no tsx — un import nombrado que falta es `undefined` en CJS.
//
// Closing al Dashboard (11/10/2026, P2a): «Ver llamada» ya no es un link a /closing?call= sino la ficha de la
// llamada en la caja del detalle, y las llamadas de venta llevan sus ids. Base 17 de 17; roturas:
//   · `ver_llamada` de vuelta a un link a /closing?call=      → 2 fallos de 17 («las acciones de cada fila» y
//     «"Ver llamada" abre la ficha…»).
//   · filasLlamadasVenta sin `r: { llamada, lead }`             → 1 fallo de 17 («los lectores llevan los ids…»).
//   · Detalle.tsx sin la rama `a.tipo === 'llamada'`            → 1 fallo de 17 («"Ver llamada" abre la ficha…»).
//
// Tanda v5 (12/10/2026, P6): las dimensiones de personas de los conjuntos nuevos, la entrega leída del universo de
// la cartera (P2), y lo que abre un clic en un pop-up y las acciones en la fila de una tabla. Base 20 de 20 (con
// los 2 rojos de la ola 1 ya en verde); roturas, una por vez, restaurando DE MEMORIA (arnés scratchpad/p6/romper.mjs),
// cada una 19 pases y 1 fallo; la vuelta, 20 de 20:
//   · `cobranza.cliente` fuera de DIMENSIONES_PERSONA                    → «las dimensiones con…».
//   · `filasPorId` quedándose con la PRIMERA de dos cuotas del mismo id  → «las acciones en la fila…».
//   · `idDeDimension` devolviendo la primera clave de `ids` siempre     → «las acciones en la fila…».
//   · `contextoDeClic` sin mirar que la dimensión SEA la entidad        → «lo que abre un clic…».
//   · `contextoDeClic` aceptando un ref que no es un número             → «lo que abre un clic…».
//   · `accionInicial` de un pop-up de llamada en «sincronizar»          → «con qué nace…».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENTIDADES, FUENTES, destinoDetalle, fuenteDe, sanearGrafico, type Grafico } from '../lib/graficos-catalogo';
import { agregar, agregarPorRef, OTROS, type Fila } from '../lib/graficos-agregar';
import {
  ACCIONES, DIMENSIONES_PERSONA, ESTADO_COBRADO, PIEZAS_ENTIDAD, SIN_CAPACIDADES, aFilaDetalle, accionInicial, accionesDeFila, alternarSerie,
  campoParaFiltrar, contextoDeClic, entidadDeGrafico, filasPorId, idDeDimension, piezaInicial, planDetalle, rangoDeClave, recortarAlTramo,
  serieOculta, type Capacidades, type FilaDetalle,
} from '../lib/graficos-acciones';
import { PIEZA_COMPLETA } from '../lib/graficos-migrar-v5';
import { dimensionPublica } from '../lib/graficos-analisis';

const g = (r: Partial<Grafico> & Record<string, unknown>): Grafico => sanearGrafico({ id: 'g1', ...r })!;
const fila = (d: Record<string, string | null>, v: Record<string, number>, r?: Record<string, string | null>, f = '2026-10-05'): Fila => ({ f, d, v, ...(r ? { r } : {}) });
const TODO: Capacidades = { crm: true, ads: true, closing: true, plan: true };
const leer = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
/** El fuente sin comentarios: las líneas primero y los bloques después (AGENTS: un guard se acusa a sí mismo). */
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── Las referencias del agregador ──────────────────────────────────────────────────────────────

test('un grupo con UN id lleva su ref; dos clientes que se llaman igual son ambiguos y no eligen el primero', () => {
  const graf = g({ fuente: 'pagos', tipo: 'barras', fecha: 'vencimiento', dimension: 'cliente', metricas: ['monto'] });
  const r = agregar(graf, [
    fila({ cliente: 'Ana' }, { monto: 100 }, { cliente: '7', cuota: '70' }),
    fila({ cliente: 'Ana' }, { monto: 50 }, { cliente: '7', cuota: '71' }),
    fila({ cliente: 'Juan Pérez' }, { monto: 30 }, { cliente: '8', cuota: '80' }),
    fila({ cliente: 'Juan Pérez' }, { monto: 20 }, { cliente: '9', cuota: '90' }),
  ], '2026-10-01', '2026-10-31');
  const ana = r.filas.find((x) => x.etiqueta === 'Ana')!;
  const juan = r.filas.find((x) => x.etiqueta === 'Juan Pérez')!;
  assert.equal(ana.ref, '7');
  assert.equal(ana.ambiguo, undefined);
  assert.equal(juan.ref, undefined, 'con dos ids no hay ref: nunca se elige el primero');
  assert.equal(juan.ambiguo, 2);
  assert.equal(juan.valores[0], 50, 'el texto sigue agrupando: la suma no cambia');
});

test('las filas sin id cuentan como una cosa más; una dimensión sin refs no dice nada; el tiempo y «Otros» no llevan ref', () => {
  const graf = g({ fuente: 'meta', tipo: 'barras', dimension: 'campana', metricas: ['gasto'] });
  const r = agregar(graf, [
    fila({ campana: 'Black' }, { gasto: 10 }, { campana: 'c1' }),
    fila({ campana: 'Black' }, { gasto: 5 }, { campana: null }),
    fila({ campana: 'Otoño' }, { gasto: 3 }),
  ], '2026-10-01', '2026-10-31');
  assert.equal(r.filas.find((x) => x.etiqueta === 'Black')!.ambiguo, 2);
  assert.equal(r.filas.find((x) => x.etiqueta === 'Black')!.ref, undefined);
  const otono = r.filas.find((x) => x.etiqueta === 'Otoño')!;
  assert.equal(otono.ref, undefined);
  assert.equal(otono.ambiguo, undefined);

  const porDia = agregar(g({ fuente: 'meta', tipo: 'serie', dimension: 'dia', metricas: ['gasto'] }), [fila({ anuncio: 'A' }, { gasto: 1 }, { dia: 'x', anuncio: 'a1' })], '2026-10-05', '2026-10-05');
  assert.equal(porDia.filas[0].ref, undefined);

  const torta = agregar(g({ fuente: 'meta', tipo: 'circular', dimension: 'anuncio', metricas: ['gasto'], limite: 3 }), [
    fila({ anuncio: 'A' }, { gasto: 9 }, { anuncio: 'a' }), fila({ anuncio: 'B' }, { gasto: 8 }, { anuncio: 'b' }),
    fila({ anuncio: 'C' }, { gasto: 7 }, { anuncio: 'c' }), fila({ anuncio: 'D' }, { gasto: 6 }, { anuncio: 'd' }),
  ], '2026-10-01', '2026-10-31');
  const otros = torta.filas.find((x) => x.clave === OTROS)!;
  assert.ok(otros, 'hay «Otros»');
  assert.equal(otros.ref, undefined);
  assert.equal(otros.ambiguo, undefined, '«Otros» no es una cosa');
  assert.equal(torta.filas[0].ref, 'a');
});

// ── El detalle agrupado por entidad ────────────────────────────────────────────────────────────

test('el detalle agrupa por el id: dos anuncios con el mismo nombre son dos filas, y sólo entra el que aporta', () => {
  const filas: Fila[] = [
    fila({ anuncio: 'Video 1', campana: 'Black' }, { gasto: 10, leads: 1 }, { anuncio: 'a1', campana: 'c1' }, '2026-10-02'),
    fila({ anuncio: 'Video 1', campana: 'Black' }, { gasto: 5, leads: 1 }, { anuncio: 'a1', campana: 'c1' }, '2026-10-03'),
    fila({ anuncio: 'Video 1', campana: 'Otoño' }, { gasto: 30, leads: 0 }, { anuncio: 'a2', campana: 'c2' }, '2026-10-02'),
    fila({ anuncio: 'Apagado' }, { gasto: 0, leads: 0 }, { anuncio: 'a3' }),
    fila({ anuncio: 'Sin id' }, { gasto: 4, leads: 0 }, { anuncio: null }),
  ];
  const r = agregarPorRef('meta', ['gasto', 'leads', 'cpl'], filas, 'anuncio', 50);
  assert.deepEqual(r.filas.map((x) => x.id), ['a2', 'a1'], 'ordenado por gasto; el de gasto 0 no aporta');
  assert.equal(r.filas[1].valores[0], 15);
  assert.equal(r.filas[1].valores[2], 7.5, 'el CPL es lo sumado ÷ lo sumado');
  assert.equal(r.filas[0].valores[2], null, 'sin leads no hay CPL');
  assert.equal(r.filas[1].r.campana, 'c1');
  assert.equal(r.sinId, 1, 'lo que no trae id se cuenta, no se esconde');
  const tope = agregarPorRef('meta', ['gasto'], filas, 'anuncio', 1);
  assert.equal(tope.filas.length, 1);
  assert.equal(tope.fuera, 1);
});

test('la cuota lleva los dos ids de la MISMA fila; un id que varía en la entidad no viaja; la etiqueta es la más reciente', () => {
  const filas: Fila[] = [
    fila({ cliente: 'Ana', cuota: 'Cuota 1', estado: 'Pendiente' }, { monto: 100, pendiente: 100 }, { cliente: '7', cuota: '70' }),
    fila({ cliente: 'Ana', cuota: 'Cuota 2', estado: ESTADO_COBRADO }, { monto: 100, cobrado: 100 }, { cliente: '7', cuota: '71' }),
  ];
  const r = agregarPorRef('pagos', ['pendiente', 'monto'], filas, 'cuota', 50);
  assert.deepEqual(r.filas.map((x) => x.id), ['70'], 'el detalle de «Pendiente» no lista la cuota cobrada');
  const f = aFilaDetalle('pagos', r.filas[0], ['pendiente', 'monto'], ['monto'])!;
  assert.deepEqual(f.ids, { pago: '70', lead: '7' });
  assert.equal(f.nombre, 'Ana · Cuota 1');
  assert.equal(f.estado, 'Pendiente');
  assert.deepEqual(f.valores, [100], 'las columnas que se muestran, en su orden');

  const renombrado = agregarPorRef('meta', ['gasto'], [
    fila({ anuncio: 'Viejo' }, { gasto: 1 }, { anuncio: 'a1', campana: 'c1' }, '2026-10-01'),
    fila({ anuncio: 'Nuevo' }, { gasto: 1 }, { anuncio: 'a1', campana: 'c9' }, '2026-10-04'),
  ], 'anuncio');
  assert.equal(renombrado.filas[0].d.anuncio, 'Nuevo');
  assert.equal(renombrado.filas[0].r.campana, undefined, 'dos campañas para el mismo anuncio: no se elige una');
});

// ── A qué abre cada métrica ────────────────────────────────────────────────────────────────────

test('el resumen del negocio abre el conjunto de cada métrica; lo que no tiene filas atrás no abre nada', () => {
  assert.deepEqual(destinoDetalle('negocio', 'fecha', 'gasto'), { fuente: 'meta', fecha: 'fecha', incluye: 'gasto', columnas: ['gasto', 'leads', 'cpl'] });
  assert.equal(destinoDetalle('negocio', 'fecha', 'cac')?.fuente, 'leads');
  assert.equal(destinoDetalle('negocio', 'fecha', 'roas_cobrado')?.fuente, 'pagos');
  assert.equal(destinoDetalle('negocio', 'fecha', 'vistas_vsl'), null, 'las vistas del VSL no son de un anuncio');
  assert.equal(destinoDetalle('visitas', 'fecha', 'visitas'), null, 'un conjunto sin entidad no lista');
  // En un conjunto con entidad: el mismo conjunto, y sin columnas de unos.
  assert.deepEqual(destinoDetalle('leads', 'agenda', 'agendas'), { fuente: 'leads', fecha: 'agenda', incluye: 'agendas', columnas: [] });
  assert.deepEqual(destinoDetalle('leads', 'cierre', 'tasa_cierre')?.columnas, [], 'una tasa de UN lead es 0% o 100%');
  assert.deepEqual(destinoDetalle('meta', 'fecha', 'cpm')?.columnas, ['cpm', 'gasto', 'impresiones']);
  assert.equal(destinoDetalle('leads', 'inventada', 'leads'), null);
});

test('el mapa del detalle nombra sólo lo que existe: cada métrica, cada fecha y cada dimensión del conjunto', () => {
  const negocio = fuenteDe('negocio')!;
  for (const m of negocio.metricas) {
    const d = destinoDetalle('negocio', 'fecha', m.id);
    if (!d) continue;
    const f = fuenteDe(d.fuente);
    assert.ok(f && ENTIDADES[d.fuente], `${m.id} → ${d.fuente}: el destino tiene que tener entidad`);
    assert.ok(f!.fechas.some((x) => x.id === d.fecha), `${m.id}: la fecha ${d.fecha} no existe en ${d.fuente}`);
    for (const id of [d.incluye, ...d.columnas]) assert.ok(f!.metricas.some((x) => x.id === id), `${m.id}: ${id} no existe en ${d.fuente}`);
  }
  for (const [id, e] of Object.entries(ENTIDADES)) {
    const f = fuenteDe(id);
    assert.ok(f, `ENTIDADES nombra un conjunto que no existe: ${id}`);
    for (const dim of [...e.nombre, ...e.linea]) assert.ok(f!.dimensiones.some((x) => x.id === dim), `${id}: la dimensión ${dim} no existe`);
    for (const m of e.unidad) assert.ok(f!.metricas.some((x) => x.id === m), `${id}: la métrica ${m} no existe`);
  }
  for (const p of DIMENSIONES_PERSONA) {
    const [fid, dim] = p.split('.');
    assert.ok(FUENTES.find((x) => x.id === fid)?.dimensiones.some((x) => x.id === dim), `DIMENSIONES_PERSONA: ${p} no existe`);
  }
});

// ── Las acciones de cada fila ──────────────────────────────────────────────────────────────────

test('las acciones de cada fila: según sus ids, la capa del workspace y el estado de la cuota', () => {
  const p = { desde: '2026-10-01', hasta: '2026-10-31' };
  const ids = (xs: ReturnType<typeof accionesDeFila>) => xs.map((x) => x.id);
  assert.deepEqual(ids(accionesDeFila({ ids: { lead: '7' }, estado: null }, TODO, p)), ['abrir_ficha']);
  assert.deepEqual(ids(accionesDeFila({ ids: { pago: '70', lead: '7' }, estado: 'Vencido' }, TODO, p)), ['abrir_ficha', 'marcar_cobrada']);
  assert.deepEqual(ids(accionesDeFila({ ids: { pago: '70', lead: '7' }, estado: ESTADO_COBRADO }, TODO, p)), ['abrir_ficha'], 'una cuota cobrada no se vuelve a cobrar');
  assert.deepEqual(ids(accionesDeFila({ ids: { pago: '70' }, estado: 'Vencido' }, TODO, p)), [], 'sin el lead de la MISMA fila no se cobra');
  assert.deepEqual(ids(accionesDeFila({ ids: { pago: '70', lead: '7' }, estado: 'Vencido' }, { ...TODO, crm: false }, p)), [], 'sin CRM en la capa, ningún botón del CRM');
  assert.deepEqual(accionesDeFila({ ids: { anuncio: '120 9' }, estado: null }, TODO, p).map((x) => x.href), ['/anuncio/120%209?desde=2026-10-01&hasta=2026-10-31']);
  // «Ver llamada» abre la ficha de la llamada EN la caja del detalle (la tab /closing se eliminó el 11/10/2026):
  // no lleva ningún link.
  assert.deepEqual(accionesDeFila({ ids: { llamada: '55' }, estado: null }, TODO, p), [{ id: 'ver_llamada', titulo: 'Ver llamada', tipo: 'llamada' }]);
  assert.deepEqual(accionesDeFila({ ids: { llamada: '55' }, estado: null }, { ...TODO, closing: false }, p), [], 'sin Closing en la capa, no se ofrece');
  assert.deepEqual(accionesDeFila({ ids: { tarea: 't-9' }, estado: null }, TODO, p).map((x) => x.href), ['/plan?tarea=t-9']);
  assert.deepEqual(accionesDeFila({ ids: { lead: '7', anuncio: '1' }, estado: null }, SIN_CAPACIDADES, p), []);
});

test('ninguna acción irreversible ni con plata: ni calificar, ni asistencia, ni presupuesto, ni pausar', () => {
  const prohibidas = /calific|asisten|presupuest|budget|pausa|borra|elimin|etapa/i;
  for (const a of ACCIONES) assert.doesNotMatch(`${a.id} ${a.titulo}`, prohibidas, a.id);
});

// ── Lo que se lee en el detalle ────────────────────────────────────────────────────────────────

test('el grupo clickeado: una categoría es un filtro más; una semana acota el período; lo que no cruza se dice', () => {
  const dest = destinoDetalle('meta', 'fecha', 'gasto')!;
  const cat = planDetalle('meta', dest, [{ dimension: 'campana', valores: ['Black'] }], { dimension: 'anuncio', valor: 'Video 1' }, { desde: '2026-10-01', hasta: '2026-10-31' });
  assert.deepEqual(cat.filtros, [{ dimension: 'campana', valores: ['Black'] }, { dimension: 'anuncio', valores: ['Video 1'] }]);
  assert.equal(cat.grupoPerdido, false);
  // «Agrupar por semana» en un gráfico por día: la clave es el lunes, y el período queda en esa semana.
  const sem = planDetalle('meta', dest, [], { dimension: 'dia', valor: '2026-09-28' }, { desde: '2026-10-01', hasta: '2026-10-31' }, 'semana');
  assert.deepEqual([sem.desde, sem.hasta], ['2026-10-01', '2026-10-04']);
  assert.deepEqual(rangoDeClave('mes', '2026-02-01'), { desde: '2026-02-01', hasta: '2026-02-28' });
  // Del resumen del negocio a los leads: un filtro que no cruza va a `noAplica`, nunca se pierde callado.
  const aLeads = destinoDetalle('negocio', 'fecha', 'cierres')!;
  const neg = planDetalle('negocio', aLeads, [{ dimension: 'inventada', valores: ['x'] }], { dimension: null, valor: null }, { desde: '2026-10-01', hasta: '2026-10-31' });
  assert.deepEqual(neg.noAplica, ['inventada']);
  // De Meta a los leads, la campaña sí cruza (es un campo compartido).
  const cruza = planDetalle('meta', aLeads, [{ dimension: 'campana', valores: ['Black'] }], { dimension: 'campana', valor: 'Black' }, { desde: '2026-10-01', hasta: '2026-10-31' });
  assert.deepEqual(cruza.filtros.map((x) => x.dimension), ['campana', 'campana']);
  // Un grupo que el destino no tiene: listar sería listar todo.
  const perdido = planDetalle('meta', aLeads, [], { dimension: 'conjunto', valor: 'C1' }, { desde: '2026-10-01', hasta: '2026-10-31' });
  assert.equal(perdido.grupoPerdido, true);
});

test('un conjunto «hoy» se recorta al tramo clickeado; con período, o sin tiempo clickeado, no se toca', () => {
  const filas = [{ f: '2026-10-02', n: 1 }, { f: '2026-10-03', n: 2 }, { f: null, n: 3 }, { f: '2026-10-09', n: 4 }];
  const sem = { desde: '2026-09-28', hasta: '2026-10-04' };
  assert.deepEqual(recortarAlTramo(filas, sem, { dimension: 'semana', valor: '2026-09-28' }, true).map((x) => x.n), [1, 2], 'sin fecha no es de esa semana');
  assert.equal(recortarAlTramo(filas, sem, { dimension: 'semana', valor: '2026-09-28' }, false).length, 4, 'con período lo recorta el lector');
  assert.equal(recortarAlTramo(filas, sem, { dimension: 'proyecto', valor: 'X' }, true).length, 4, 'una categoría no es un tramo');
  assert.equal(recortarAlTramo(filas, sem, { dimension: null, valor: null }, true).length, 4, 'una KPI mira todo');
  // Y el detalle lo usa sobre lo que leyó, antes de agrupar (un guard de cableado: la función se prueba arriba).
  const det = sinComentarios(leer('lib', 'graficos-detalle.ts'));
  assert.match(det, /recortarAlTramo\(leidas, plan, sel, sinRango\)/);
  assert.match(det, /agregarPorRef\(destino\.fuente, metricas, filtrarFilas\(delGrupo,/);
});

test('las dimensiones con nombres de personas no viajan a ningún modelo (fuera de DIMENSIONES_PUBLICAS)', () => {
  assert.ok(DIMENSIONES_PERSONA.length >= 5);
  for (const p of DIMENSIONES_PERSONA) {
    const [fid, dim] = p.split('.');
    assert.equal(dimensionPublica(fid, dim), false, `${p} viajaría con su etiqueta al AI Analyst`);
  }
  // Y la que NOMBRA cada fila del detalle (la primera de `nombre`) está en la lista: una entidad nueva que se
  // nombre con una persona tiene que sumarse acá (y quedar afuera de allá) antes de que el detalle la liste.
  // Los anuncios y los conjuntos se nombran con lo que escribió quien armó la campaña: no son personas. Los guiones
  // (v5) se nombran con el anuncio (`guion` es pública, lib/graficos-analisis.ts).
  for (const [fid, e] of Object.entries(ENTIDADES)) {
    if (fid === 'meta' || fid === 'presupuesto' || fid === 'guiones') continue;
    assert.ok(DIMENSIONES_PERSONA.includes(`${fid}.${e.nombre[0]}`), `${fid}.${e.nombre[0]} nombra una fila del detalle y no está en DIMENSIONES_PERSONA`);
  }
});

// ── v5: las acciones en la fila de una tabla, y lo que abre un clic en un pop-up ──────────────────

const filaDet = (id: string, ids: FilaDetalle['ids']): FilaDetalle => ({ id, nombre: id, linea: null, fecha: null, valores: [], ids, estado: null });

test('las acciones en la fila: el id que nombra cada fila de la tabla, y nunca la primera de dos cuotas', () => {
  // «A quién cobrarle» agrupa por cliente: la fila de la tabla trae el id del LEAD (`r.cliente`).
  assert.equal(idDeDimension('cobranza', 'cliente'), 'lead');
  assert.equal(idDeDimension('llamadas_venta', 'llamada'), 'llamada');
  assert.equal(idDeDimension('cobranza', 'urgencia'), null, 'una dimensión que no es un id: sin acciones');
  assert.equal(idDeDimension('inventado', 'cliente'), null);
  const m = filasPorId([filaDet('c1', { pago: '70', lead: '7' }), filaDet('c2', { pago: '80', lead: '8' }), filaDet('c3', { pago: '81', lead: '8' })], 'lead');
  assert.deepEqual(m.get('7')?.ids, { pago: '70', lead: '7' }, 'la cuota viaja con SU lead');
  assert.equal(m.has('8'), false, 'dos cuotas del mismo cliente: no se elige una');
  // Y con la fila emparejada, el MISMO «Marcar cobrada» del detalle.
  assert.deepEqual(accionesDeFila(m.get('7')!, TODO, { desde: '2026-10-01', hasta: '2026-10-31' }).map((x) => x.id), ['abrir_ficha', 'marcar_cobrada']);
});

test('lo que abre un clic: la entidad sólo si la dimensión ES la entidad, con un id que es un número', () => {
  assert.deepEqual(contextoDeClic({ fuente: 'llamadas_venta', dimension: 'llamada', ref: '123' }), { tipo: 'llamada', ref: '123' });
  assert.deepEqual(contextoDeClic({ fuente: 'guiones', dimension: 'guion', ref: '120208' }), { tipo: 'anuncio', ref: '120208' });
  assert.deepEqual(contextoDeClic({ fuente: 'leads', dimension: 'lead', ref: '9' }), { tipo: 'lead', ref: '9' });
  assert.equal(contextoDeClic({ fuente: 'llamadas_venta', dimension: 'closer', ref: '123' }), null, 'una barra por closer no abre a nadie');
  assert.equal(contextoDeClic({ fuente: 'llamadas_venta', dimension: 'llamada', ref: 'abc' }), null, 'un ref que no es un id');
  assert.equal(contextoDeClic({ fuente: 'llamadas_venta', dimension: 'llamada', ref: null }), null);
  assert.equal(contextoDeClic({ fuente: 'pagos', dimension: 'cuota', ref: '5' }), null, 'una cuota no tiene ficha que partir');
  assert.equal(entidadDeGrafico({ fuente: 'meta', dimension: 'anuncio' }), 'anuncio');
  assert.equal(entidadDeGrafico({ fuente: 'meta', dimension: 'campana' }), null);
});

test('con qué nace un elemento «Acción» o «Ficha» (el saneo descarta uno vacío), y las piezas que existen', () => {
  assert.equal(accionInicial(null).id, 'sincronizar_llamadas');
  assert.equal(accionInicial('llamada').id, 'reanalizar_llamada');
  assert.equal(accionInicial('anuncio').id, 'abrir_ficha');
  assert.deepEqual(piezaInicial('llamada'), { tipo: 'llamada', pieza: PIEZA_COMPLETA });
  // La pieza entera (la que pone la migración de los bloques) está en las tres fichas.
  for (const t of ['llamada', 'anuncio', 'lead'] as const) assert.ok(PIEZAS_ENTIDAD[t].some((p) => p.id === PIEZA_COMPLETA), t);
  // Los ids de pieza caben en lo que acepta el saneo (/^[a-z0-9_-]{1,40}$/i).
  for (const ps of Object.values(PIEZAS_ENTIDAD)) for (const p of ps) assert.match(p.id, /^[a-z0-9_-]{1,40}$/i);
});

test('«Filtrar la página por esto» usa el campo compartido cuando existe', () => {
  assert.equal(campoParaFiltrar('meta', 'campana'), 'campana');
  assert.equal(campoParaFiltrar('pagos', 'estado'), 'pagos.estado');
  assert.equal(campoParaFiltrar('leads', 'lead'), 'leads.lead');
  assert.equal(campoParaFiltrar('meta', 'dia'), null, 'el tiempo no es un campo');
  assert.equal(campoParaFiltrar('meta', 'inventada'), null);
});

// ── La leyenda ─────────────────────────────────────────────────────────────────────────────────

test('la leyenda prende y apaga series, y la última no se apaga', () => {
  const claves = ['gasto', 'leads'];
  const a = alternarSerie(new Set(), 'gasto', claves);
  assert.deepEqual([...a], ['gasto']);
  const b = alternarSerie(a, 'leads', claves);
  assert.equal(b, a, 'apagar la última no cambia nada');
  assert.deepEqual([...alternarSerie(a, 'gasto', claves)], [], 'volver a tocarla la prende');
  assert.equal(serieOculta(a, 'gasto', claves), true);
  assert.equal(serieOculta(new Set(['x', 'y']), 'x', ['x', 'y']), false, 'si quedaron todas apagadas, ninguna');
});

// ── Guards de fuente ───────────────────────────────────────────────────────────────────────────

test('el detalle no pasa por ninguna IA: devuelve nombres de personas', () => {
  for (const ruta of [['lib', 'graficos-detalle.ts'], ['lib', 'graficos-acciones.ts'], ['app', 'dashboard', 'Detalle.tsx']]) {
    const src = sinComentarios(leer(...ruta));
    const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    assert.ok(imports.length > 2, `${ruta.join('/')}: no encuentro sus imports`);
    for (const i of imports) assert.doesNotMatch(i, /(^|\/)(ai-|anthropic|model-|mako-doer|chart-insights|graficos-ia|graficos-analisis)/, `${ruta.join('/')} importa ${i}`);
    assert.doesNotMatch(src, /chatCheap|chatClaude|\/api\/chart-insights/, ruta.join('/'));
  }
});

test('los lectores llevan los ids de la misma fila (Meta, leads, pagos, llamadas, entrega, tareas)', () => {
  const src = sinComentarios(leer('lib', 'graficos-datos.ts'));
  const cuerpo = (nombre: string) => {
    const ini = src.indexOf(`async function ${nombre}(`);
    assert.ok(ini >= 0, `no encuentro ${nombre}`);
    const fin = src.indexOf('\nasync function ', ini + 10);
    return src.slice(ini, fin < 0 ? undefined : fin);
  };
  const meta = cuerpo('filasMeta');
  assert.match(meta, /'id, fecha, ad_id, campaign_id, adset_id,/);
  assert.match(meta, /r: \{ campana: txt\(x\.campaign_id\), conjunto: txt\(x\.adset_id\), anuncio: txt\(x\.ad_id\) \}/);
  assert.match(cuerpo('filasLeads'), /r: \{ lead: String\(x\.id\) \}/);
  assert.match(cuerpo('filasLeads'), /lead: txt\(x\.nombre\)/);
  assert.match(cuerpo('filasPagos'), /r: \{ cliente: lead, cuota: String\(x\.id\) \}/);
  assert.match(cuerpo('filasLlamadas'), /r: \{ llamada: String\(x\.recording_id\)/);
  // v5 (P2): la entrega lee el UNIVERSO de la cartera de CS (un cliente sin fila en cliente_entrega también está).
  assert.match(cuerpo('filasEntrega'), /await carteraEnEntrega\(\)/);
  assert.match(cuerpo('filasEntrega'), /r: \{ cliente: String\(lead\) \}/);
  assert.equal((cuerpo('filasTareas').match(/r: \{ tarea: String\(x\.id\) \}/g) ?? []).length, 2, 'las dos mitades del tablero');
  // Y las llamadas de venta (lib/graficos-datos-extra.ts): cada fila con SU llamada y su lead, y nombrada como la lista.
  const extra = sinComentarios(leer('lib', 'graficos-datos-extra.ts'));
  const ini = extra.indexOf('async function filasLlamadasVenta(');
  assert.ok(ini >= 0, 'no encuentro filasLlamadasVenta');
  const venta = extra.slice(ini, extra.indexOf('\nconst GRUPO_DIM', ini));
  assert.ok(venta.length > 400 && venta.length < 3000, `el recorte de filasLlamadasVenta mide ${venta.length}`);
  assert.match(venta, /title, lead_id, lead_nombre, invitee_email'/);
  assert.match(venta, /r: \{ llamada: String\(x\.recording_id\), lead: x\.lead_id != null \? String\(x\.lead_id\) : null \}/);
  assert.match(venta, /llamada: nombreDeLlamada\(x\)/);
});

test('«Ver llamada» abre la ficha de la llamada en lugar de la caja del detalle (como la del lead)', () => {
  const det = sinComentarios(leer('app', 'dashboard', 'Detalle.tsx'));
  assert.match(det, /import \{ FichaLlamada \} from '\.\/entidades\/FichaLlamada'/);
  // El botón de una acción `llamada` guarda el id de LA FILA (no uno que llegue de otro lado)…
  assert.match(det, /if \(a\.tipo === 'llamada'\) \{ const id = Number\(f\.ids\.llamada\); if \(Number\.isInteger\(id\) && id > 0\) setLlamada\(id\); return; \}/);
  // …y con eso se dibuja la ficha ANTES que la caja del detalle (un Modal encima de otro apaga al de abajo).
  const ficha = det.indexOf('<FichaLlamada recordingId={llamada}');
  const caja = det.indexOf('<Modal');
  assert.ok(ficha > 0 && caja > 0 && ficha < caja, 'la ficha de la llamada no reemplaza a la caja del detalle');
  assert.match(det, /<FichaLlamada recordingId=\{llamada\} onCerrar=\{\(\) => setLlamada\(null\)\} onCambio=\{recargar\} \/>/);
  // Ninguna acción vuelve a la tab retirada.
  for (const a of ACCIONES) assert.ok(!a.href || !a.href({ llamada: '1', anuncio: '1', tarea: '1' }, { desde: '2026-10-01', hasta: '2026-10-31' }).startsWith('/closing'), a.id);
});

test('el gráfico declara su único hook antes del primer return', () => {
  const src = sinComentarios(leer('app', 'dashboard', 'Grafico.tsx'));
  const ini = src.indexOf('export function CuerpoGrafico(');
  const cuerpo = src.slice(ini, src.indexOf('\n}\n', ini));
  assert.ok(cuerpo.length > 1000, `el recorte mide ${cuerpo.length}`);
  const hook = cuerpo.search(/\buseState\b/);
  const ret = cuerpo.search(/\breturn\b/);
  assert.ok(hook > 0 && hook < ret, 'un hook detrás de un return es la pantalla en blanco');
  assert.match(cuerpo, /onDetalle\?: \(sel: SelDetalle\) => void/);
});
