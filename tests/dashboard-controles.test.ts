// =============================================================================
// Los controles de la VISTA del Dashboard (puntos 12, 13 y 14 del feedback de Martín, 11/10/2026) y, desde la
// tanda v5 (12/10/2026, puntos 1, 4 y 14), el botón «Filtro» y su desplegable (app/dashboard/MenuFiltro.tsx)
// =============================================================================
// Qué fija:
//   1. El resumen corto de cada tipo de control y el rango corto de un período.
//   2. El ORDEN de los campos que se ofrecen: primero los que filtran algún gráfico de la página.
//   3. Uno por cosa al agregar, y que agregar un control a un gráfico NO cambia lo que el gráfico muestra
//      (se compara `efectivoDe` antes y después). ⚠️ Agregar SUMA a la lista: desde v5 el período propio de
//      antes vive en `controles` (un control fijo), y `controles: [nuevo]` lo borraba y cambiaba el número.
//   4. La lista desplegable: lo elegido arriba aunque no tenga filas, el tope, y que tildar desde «todos» deja
//      SÓLO ese valor (no «todos menos ése», que pasaría MAX_VALORES).
//   5. El desplegable «Filtro»: los FIJOS no se dibujan ni cuentan, el período va primero, el número cuenta lo
//      que filtra, una tarjeta sin nada que decir no dibuja nada, y el aviso «No filtra por X» no se pierde.
//   6. Guards POR FUENTE de app/dashboard/MenuFiltro.tsx: elegir un valor mirando llama `onVista` y nunca
//      escribe el informe (si no, cada casilla se autoguarda y le cambia el informe a todos), los paneles sólo
//      ELIGEN, y agregar suma a la lista ENTERA (con los fijos).
//   7. El panel de propiedades: muestra también los fijos (es donde se editan) y escribe la lista entera; cuáles ve
//      quien mira lo decide la sección que lo monta (app/dashboard/Propiedades.tsx, «A la vista»), no un segundo
//      interruptor acá.
//   8. Sin voseo en el texto de los archivos de los controles: el guard del repo enumera con `git ls-files`,
//      que no ve un archivo sin `git add` (AGENTS.md).
//
// Probado ROMPIÉNDOLO (11/10/2026), una rotura por vez sobre la base en verde (19/19) y restaurando a mano —las
// de la tanda de antes siguen valiendo para lo que quedó igual (el resumen, el orden, la lista)—.
// Tanda v5 (12/10/2026, scratchpad/p4v5-romper.mjs, una por vez, restaurada de MEMORIA y comparada byte a byte,
// nunca con git). Base: 23 pasan / 0 fallan. Cada rotura (pasan / fallan):
//   · mirando, escribir el informe (`elegirMirando` → `cambiar`)        → 22 / 1
//   · el ternario del modo al revés                                     → 22 / 1
//   · los fijos se dibujan (sin `controlesQueSeVen`)                    → 21 / 2
//   · el período no va primero                                          → 22 / 1
//   · los fijos cuentan como «filtros activos»                          → 22 / 1
//   · agregar a una tarjeta REEMPLAZA la lista (`[c]`)                  → 22 / 1
//   · se escribe sobre los que se ven (se pierden los fijos)            → 22 / 1
//   · una tarjeta sin nada que decir dibuja el embudo                   → 22 / 1
//   · el aviso «No filtra por» se pierde                                → 22 / 1
//   · la guía de «agregar» también mirando                              → 22 / 1
//   · sin la burbuja del número                                         → 22 / 1
//   · una lista con un valor no lo dice                                 → 22 / 1
//   · Escape adentro de un renglón no vuelve a la raíz                  → 22 / 1
//   · el panel de propiedades cambia mandando sólo ese control          → 22 / 1
//   · el panel de propiedades esconde los fijos                         → 22 / 1
//   · el panel de propiedades agrega reemplazando                       → 22 / 1
//   · «Buscá» en la barra                                               → 22 / 1
//
// Correr: npx tsx --test tests/dashboard-controles.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CAMPOS, MAX_CONTROLES, MAX_VALORES, conVista, efectivoDe, hojaVacia, sanearControles, sanearGrafico,
  type ControlVista, type Grafico, type Hoja,
} from '../lib/graficos-catalogo';
import {
  alternarValor, camposParaComp, camposParaHoja, distintoDeEntrada, fuentesDelCampoEnHoja, hayVistaElegida, nuevoControlPara,
  opcionesAgregar, opcionesDeLista, parcheDeEntrada, periodoDePagina, rangoCorto, resumenControl, yaExiste,
} from '../lib/graficos-controles-texto';
import { marcasDeVoseo } from '../lib/puestas-data';
import { MenuFiltro, controlesDelMenu, filtrosActivos, ordenFilas, valorDeFila } from '../app/dashboard/MenuFiltro';
import { EditorControlesComp } from '../app/dashboard/BarraControles';
import { idBusquedaDe } from '../app/dashboard/exportar';

const RAIZ = join(import.meta.dirname, '..');
const HOY = '2026-10-11';

const g = (r: Record<string, unknown>): Grafico => sanearGrafico({ id: 'g1', ...r })!;
const control = (r: Partial<ControlVista> & { id: string; tipo: ControlVista['tipo'] }): ControlVista =>
  sanearControles([{ campo: null, preset: 'ult30', valores: null, texto: '', agrupar: 'auto', ...r }])[0];
const hoja = (componentes: Grafico[], controles: ControlVista[] = []): Hoja => hojaVacia('H', { componentes, controles });
const sinEstilos = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '');

// ── 1. El resumen ────────────────────────────────────────────────────────────────────────────

test('el resumen de cada tipo de control es corto y dice lo que hay elegido', () => {
  const r = (x: Partial<ControlVista> & { tipo: ControlVista['tipo'] }) => resumenControl(control({ id: 'c', ...x }), HOY);
  assert.equal(r({ tipo: 'periodo', preset: 'ult7' }), 'Últimos 7 días');
  assert.equal(r({ tipo: 'periodo', preset: 'personalizado', desde: '2026-10-05', hasta: '2026-10-11' }), '5 – 11 oct');
  assert.equal(r({ tipo: 'lista', campo: 'campana' }), 'Campaña', 'en «todos» dice sólo el campo');
  assert.equal(r({ tipo: 'lista', campo: 'campana', valores: ['Promo oct'] }), 'Campaña: Promo oct');
  assert.equal(r({ tipo: 'lista', campo: 'campana', valores: ['A', 'B'] }), 'Campaña · 2');
  assert.equal(r({ tipo: 'lista', campo: 'campana', valores: ['Una campaña con un nombre larguísimo'] }), 'Campaña: Una campaña con un no…');
  assert.equal(r({ tipo: 'texto', campo: 'campana' }), 'Buscar campaña');
  assert.equal(r({ tipo: 'texto', campo: 'campana', texto: 'promo' }), 'Busca: promo');
  assert.equal(r({ tipo: 'agrupar', agrupar: 'semana' }), 'Por semana');
  assert.equal(r({ tipo: 'agrupar', agrupar: 'dia' }), 'Por día');
  assert.equal(r({ tipo: 'agrupar', agrupar: 'auto' }), 'Agrupar: automático');
});

test('el resumen muestra lo elegido MIRANDO cuando se le pasa el control con la vista encima', () => {
  const c = control({ id: 'c1', tipo: 'lista', campo: 'campana' });
  assert.equal(resumenControl(conVista(c, { c1: { valores: ['X', 'Y', 'Z'] } }), HOY), 'Campaña · 3');
  assert.equal(resumenControl(conVista(c, {}), HOY), 'Campaña');
});

test('el rango corto: el año sólo si no es el de hoy o si el rango cruza de año', () => {
  assert.equal(rangoCorto('2026-10-05', '2026-10-11', HOY), '5 – 11 oct');
  assert.equal(rangoCorto('2026-09-28', '2026-10-04', HOY), '28 sep – 4 oct');
  assert.equal(rangoCorto('2026-10-11', '2026-10-11', HOY), '11 oct');
  assert.equal(rangoCorto('2025-01-01', '2025-12-31', HOY), '1 ene – 31 dic 2025');
  assert.equal(rangoCorto('2025-12-28', '2026-01-04', HOY), '28 dic 2025 – 4 ene 2026');
});

// ── 2. Qué campos se ofrecen ────────────────────────────────────────────────────────────────

test('primero los campos que filtran algún gráfico de la página, de más a menos gráficos', () => {
  const h = hoja([
    g({ id: 'a', fuente: 'meta', tipo: 'barras', dimension: 'campana' }),
    g({ id: 'b', fuente: 'meta', tipo: 'barras', dimension: 'anuncio' }),
    g({ id: 'c', fuente: 'leads', tipo: 'barras', dimension: 'etapa' }),
  ], [control({ id: 'l', tipo: 'lista', campo: 'campana' })]);
  const lista = camposParaHoja(h);
  assert.equal(lista.length, CAMPOS.length, 'se ofrecen todos: los que no filtran nada van abajo, no se esconden');
  assert.deepEqual(lista.slice(0, 3).map((c) => [c.id, c.graficos]), [['anuncio', 3], ['campana', 3], ['conjunto', 2]]);
  const primeroSinGrafico = lista.findIndex((c) => c.graficos === 0);
  assert.ok(primeroSinGrafico > 0 && lista.slice(primeroSinGrafico).every((c) => c.graficos === 0), 'ninguno que filtra queda abajo de uno que no');
  // Los de un gráfico, por nombre. Se compara contra el catálogo y no contra una lista escrita a mano:
  // el catálogo crece (otra sesión le suma dimensiones a los leads) y el orden es lo que se prueba.
  const deUno = lista.filter((c) => c.graficos === 1);
  assert.deepEqual(deUno.map((c) => c.nombre), [...deUno.map((c) => c.nombre)].sort((a, b) => a.localeCompare(b, 'es')));
  assert.deepEqual(new Set(deUno.map((c) => c.id)), new Set(CAMPOS.filter((c) => !c.en.meta && !!c.en.leads).map((c) => c.id)));
  assert.ok(['closer', 'producto', 'leads.etapa'].every((id) => deUno.some((c) => c.id === id)));
  assert.equal(lista.find((c) => c.id === 'campana')?.usado, true, 'el campo que ya tiene control se marca (uno por cosa)');
  assert.equal(lista.find((c) => c.id === 'anuncio')?.usado, false);
});

test('en un gráfico se ofrecen sólo los campos que su conjunto puede filtrar', () => {
  // (Desde v5 no hay bloques: los migra el saneo a gráficos del catálogo.)
  const m = g({ id: 'm', fuente: 'meta', tipo: 'barras', dimension: 'campana' });
  assert.deepEqual(camposParaComp(m).map((c) => c.id), ['anuncio', 'campana', 'conjunto']);
});

test('los valores de una lista de la página se cuentan en los conjuntos de ESA página', () => {
  const h = hoja([g({ id: 'a', fuente: 'meta', dimension: 'campana' }), g({ id: 'b', fuente: 'negocio', tipo: 'serie', dimension: 'dia' })]);
  assert.deepEqual(fuentesDelCampoEnHoja(h, 'campana'), ['meta']);
  assert.equal(fuentesDelCampoEnHoja(h, 'closer'), undefined, 'si ningún gráfico lo usa, se cuenta en todos');
});

// ── 3. Qué se puede agregar, y con qué arranca ──────────────────────────────────────────────

test('uno por cosa: un período, un «agrupar por» y un control por campo (lista y búsqueda comparten)', () => {
  const h = hoja([], [control({ id: 'p', tipo: 'periodo' }), control({ id: 't', tipo: 'texto', campo: 'campana' })]);
  const op = Object.fromEntries(opcionesAgregar({ nivel: 'hoja', hoja: h }).map((o) => [o.id, o.motivo]));
  assert.equal(op.periodo, 'Ya hay uno');
  assert.equal(op.agrupar, null);
  assert.equal(op.lista, null, 'quedan otros campos libres');
  assert.equal(yaExiste(h.controles, 'lista', 'campana'), true, 'una lista sobre el campo de una búsqueda: el saneo la tiraría');
  const lleno = hoja([], Array.from({ length: MAX_CONTROLES }, (_, i) => control({ id: `x${i}`, tipo: 'lista', campo: CAMPOS[i].id })));
  assert.ok(opcionesAgregar({ nivel: 'hoja', hoja: lleno }).every((o) => o.motivo === `Hasta ${MAX_CONTROLES}`));
});

test('en un gráfico se apaga lo que no haría nada, con su motivo', () => {
  const porCategoria = g({ id: 'm', fuente: 'meta', tipo: 'barras', dimension: 'campana' });
  const hoy = sanearGrafico({ id: 't', fuente: 'tareas', fecha: 'actual', tipo: 'barras', dimension: 'estado' })!;
  const motivos = (comp: Grafico) => Object.fromEntries(opcionesAgregar({ nivel: 'componente', comp, hoja: hoja([comp]) }).map((o) => [o.id, o.motivo]));
  assert.equal(motivos(porCategoria).agrupar, 'No va por fecha');
  assert.equal(motivos(hoy).periodo, 'No usa fechas');
  const todosUsados = { ...porCategoria, controles: sanearControles(['anuncio', 'campana', 'conjunto'].map((campo, i) => ({ id: `l${i}`, tipo: 'lista', campo }))) };
  assert.equal(motivos(todosUsados).lista, 'Ya están todos');
});

test('agregar un control a un gráfico NO cambia lo que el gráfico muestra (y se SUMA a la lista)', () => {
  const pagina = [control({ id: 'pp', tipo: 'periodo', preset: 'ult90' }), control({ id: 'pl', tipo: 'lista', campo: 'campana', valores: ['A'] })];
  // `periodo: 'ult7'`: desde v5 el saneo lo migra a un control FIJO del gráfico. Reemplazar la lista se lo llevaría.
  const conPropio = g({ id: 'x', fuente: 'meta', tipo: 'serie', dimension: 'semana', periodo: 'ult7' });
  const auto = g({ id: 'y', fuente: 'meta', tipo: 'serie', dimension: 'semana' });
  assert.ok(conPropio.controles.some((c) => c.tipo === 'periodo' && c.fijo), 'el período propio de antes es un control fijo');
  for (const comp of [conPropio, auto]) {
    const h = hoja([comp], pagina);
    const antes = efectivoDe(comp, h, {}, HOY);
    for (const [tipo, campo] of [['periodo', null], ['lista', 'campana'], ['texto', 'anuncio']] as const) {
      const nuevo = nuevoControlPara(tipo, campo, { nivel: 'componente', comp, hoja: h })!;
      const despues = efectivoDe({ ...comp, controles: [...comp.controles, nuevo] }, h, {}, HOY);
      assert.deepEqual([despues.desde, despues.hasta, despues.filtros], [antes.desde, antes.hasta, antes.filtros], `agregar ${tipo} a ${comp.id} cambió lo que se ve`);
    }
  }
  const ag = nuevoControlPara('agrupar', null, { nivel: 'componente', comp: auto, hoja: hoja([auto]) })!;
  assert.equal(ag.agrupar, 'semana', 'sin «agrupar» en la página, arranca con la dimensión del gráfico');
});

// ── 4. Lo elegido ───────────────────────────────────────────────────────────────────────────

test('tildar desde «todos» deja SÓLO ese valor; destildar el último vuelve a «todos»', () => {
  assert.deepEqual(alternarValor(null, 'A'), { valores: ['A'], topeado: false });
  assert.deepEqual(alternarValor(['A'], 'B'), { valores: ['A', 'B'], topeado: false });
  assert.deepEqual(alternarValor(['A', 'B'], 'A'), { valores: ['B'], topeado: false });
  assert.deepEqual(alternarValor(['A'], 'A'), { valores: null, topeado: false }, 'nunca [] para «todos»');
  const llenos = Array.from({ length: MAX_VALORES }, (_, i) => `v${i}`);
  assert.deepEqual(alternarValor(llenos, 'otro'), { valores: llenos, topeado: true });
});

test('la lista: lo elegido arriba aunque no tenga filas, la búsqueda sin acentos y el tope', () => {
  const valores = Array.from({ length: 60 }, (_, i) => ({ valor: `Campaña ${i}`, filas: 100 - i }));
  const { opciones, ocultos } = opcionesDeLista(valores, ['Campaña 59', 'Vieja'], '');
  assert.deepEqual(opciones.slice(0, 2).map((o) => [o.valor, o.filas, o.elegido]), [['Vieja', 0, true], ['Campaña 59', 41, true]]);
  assert.equal(opciones.length, 52, 'las 2 elegidas + 50');
  assert.equal(ocultos, 9);
  const busca = opcionesDeLista([{ valor: 'Promoción', filas: 3 }, { valor: 'Otra', filas: 9 }], null, 'promocion');
  assert.deepEqual(busca.opciones.map((o) => o.valor), ['Promoción']);
});

test('lo de entrada: el parche sólo toca los campos de su tipo, y «todos» se guarda como null', () => {
  assert.deepEqual(parcheDeEntrada('lista', { valores: [] }), { valores: null });
  assert.deepEqual(parcheDeEntrada('lista', { valores: ['A'], preset: 'ult7' }), { valores: ['A'] });
  assert.deepEqual(parcheDeEntrada('periodo', { preset: 'personalizado', desde: '2026-10-01', hasta: '2026-10-05' }), { preset: 'personalizado', desde: '2026-10-01', hasta: '2026-10-05' });
  assert.deepEqual(parcheDeEntrada('agrupar', { agrupar: 'mes' }), { agrupar: 'mes' });
});

test('«Restablecer» aparece sólo si lo que se mira es distinto de lo de entrada (la barra o una tarjeta)', () => {
  const c = control({ id: 'c', tipo: 'lista', campo: 'campana', valores: ['A'] });
  const propio = control({ id: 'gp', tipo: 'periodo', preset: 'ult7' });
  const h = hoja([{ ...g({ id: 'k', fuente: 'meta', dimension: 'campana' }), controles: [propio] }], [c]);
  assert.equal(hayVistaElegida(h, {}), false);
  assert.equal(hayVistaElegida(h, { c: { valores: ['A'] } }), false, 'elegir lo mismo que lo de entrada no es un cambio');
  assert.equal(distintoDeEntrada(c, { c: { valores: ['B'] } }), true);
  assert.equal(hayVistaElegida(h, { gp: { preset: 'ult90' } }), true, 'también cuenta lo elegido en la cabecera de un gráfico');
  assert.deepEqual(periodoDePagina(h, {}, HOY), { desde: '2026-09-12', hasta: HOY }, 'sin control de período en la página: 30 días');
});

// ── 5. El desplegable «Filtro» (app/dashboard/MenuFiltro.tsx) ─────────────────────────────────

const FIJO = control({ id: 'fj', tipo: 'lista', campo: 'llamadas_venta.reunion', valores: ['R1'], fijo: true });
const PERIODO = control({ id: 'pe', tipo: 'periodo', preset: 'todo' });
const LISTA = control({ id: 'li', tipo: 'lista', campo: 'campana' });

test('los renglones: sin los FIJOS, el período primero, y el número cuenta sólo lo que filtra', () => {
  assert.ok(FIJO.fijo, 'el control de definición sobrevive al saneo');
  assert.deepEqual(ordenFilas([LISTA, PERIODO]).map((c) => c.id), ['pe', 'li'], 'el PERÍODO es el primer renglón');
  assert.deepEqual(controlesDelMenu([LISTA, FIJO, PERIODO]).map((c) => c.id), ['pe', 'li'], 'un fijo no se dibuja nunca');
  assert.equal(filtrosActivos([LISTA, FIJO, PERIODO], {}), 0, 'ni el fijo ni el período cuentan como «filtros activos»');
  assert.equal(filtrosActivos([LISTA, FIJO, PERIODO], { li: { valores: ['Promo'] } }), 1, 'lo elegido mirando, sí');
  // La barra de búsqueda de una tabla se dibuja en su cabecera: si su control es uno guardado (una búsqueda que la
  // tabla ya tenía; la decide `idBusquedaDe`, app/dashboard/exportar.ts), no va también en el desplegable.
  const ya = control({ id: 'tx', tipo: 'texto', campo: 'campana' });
  const t = { ...g({ id: 'tb', fuente: 'meta', tipo: 'tabla', dimension: 'campana', metricas: ['gasto'] }), controles: [ya], tabla: { buscar: true } };
  assert.equal(idBusquedaDe(t), 'tx', 'la barra usa la búsqueda que la tabla ya tenía');
  assert.deepEqual(controlesDelMenu(t.controles, idBusquedaDe(t)), [], 'la barra de una tabla no es un renglón');
  assert.deepEqual(controlesDelMenu(t.controles, null).map((c) => c.id), ['tx'], 'sin barra, es un «Contiene…» más');
});

test('lo que tiene puesto cada renglón, a la derecha (el nombre ya está a la izquierda)', () => {
  assert.equal(valorDeFila(PERIODO, HOY), 'Todo');
  assert.equal(valorDeFila(control({ id: 'p', tipo: 'periodo', preset: 'ult30' }), HOY), 'Últimos 30 días');
  assert.equal(valorDeFila(LISTA, HOY), 'Todo');
  assert.equal(valorDeFila(conVista(LISTA, { li: { valores: ['Promo'] } }), HOY), 'Promo');
  assert.equal(valorDeFila(conVista(LISTA, { li: { valores: ['A', 'B'] } }), HOY), '2 valores');
  assert.equal(valorDeFila(control({ id: 't', tipo: 'texto', campo: 'campana', texto: 'pro' }), HOY), '«pro»');
  assert.equal(valorDeFila(control({ id: 'a', tipo: 'agrupar', agrupar: 'semana' }), HOY), 'Semana');
});

const nada = () => {};
const filtroHoja = (h: Hoja, editando: boolean, guardable = true, vista = {}) => sinEstilos(renderToStaticMarkup(createElement(MenuFiltro, {
  modo: 'hoja', hoja: h, vista, editando, guardable, hoy: HOY, onVista: nada, onAgregar: nada, onCambiar: nada, onQuitar: nada, onRestablecer: nada,
})));

test('el botón «Filtro» de la hoja: siempre (también sin filtros), con el número, y la guía de «agregar» sólo editando', () => {
  const vacia = hoja([]);
  const mirando = filtroHoja(vacia, false);
  assert.match(mirando, /aria-label="Filtro"/, 'una hoja sin filtros muestra el botón igual (adentro dice que no tiene)');
  assert.match(mirando, />Filtro</);
  assert.doesNotMatch(mirando, /dash-filtro/, 'mirando no se agregan filtros: el paso de la guía no apunta acá');
  assert.match(filtroHoja(vacia, true), /data-recorrido="dash-filtro"/, 'editando, el paso «Agregar un filtro» apunta a este botón');
  assert.doesNotMatch(filtroHoja(vacia, true, false), /dash-filtro/, 'sin poder guardar no se agrega');
  // Con algo elegido: la burbuja con el número y el nombre que lo dice.
  const h = hoja([], [LISTA]);
  const activo = filtroHoja(h, false, true, { li: { valores: ['Promo'] } });
  assert.match(activo, /aria-label="Filtro \(1 activo\)"/);
  assert.match(activo, /class="mf-num"[^>]*>1</);
  assert.match(activo, /data-activo="true"/);
  assert.doesNotMatch(filtroHoja(h, false), /mf-num/, 'sin nada elegido, sin número');
});

const filtroTarjeta = (comp: Grafico, h: Hoja, editando = false, vista = {}) => sinEstilos(renderToStaticMarkup(createElement(MenuFiltro, {
  modo: 'tarjeta', comp, hoja: h, vista, efectivo: efectivoDe(comp, h, vista, HOY), editando, hoy: HOY, onVista: nada, onCambiarComp: nada,
})));

test('el de una tarjeta: sin nada que decir no dibuja nada; un fijo no lo hace aparecer; el «No filtra por» no se pierde', () => {
  const m = g({ id: 'm', fuente: 'meta', tipo: 'barras', dimension: 'campana' });
  assert.equal(filtroTarjeta(m, hoja([m])), '', 'un embudo en cada tarjeta que abre un panel vacío es ruido');
  const conFijo = { ...m, controles: [control({ id: 'f', tipo: 'lista', campo: 'campana', valores: ['A'], fijo: true })] };
  assert.equal(filtroTarjeta(conFijo, hoja([conFijo])), '', 'un filtro de DEFINICIÓN no se dibuja: la tarjeta no tiene nada para mirar');
  assert.match(filtroTarjeta(m, hoja([m]), true), /aria-label="Filtro"/, 'editando aparece, para poder agregar');
  // Un filtro de la página que su conjunto no puede aplicar: el embudo avisa (y adentro, el renglón lo dice).
  const h = hoja([m], [control({ id: 'cl', tipo: 'lista', campo: 'closer', valores: ['Ana'] })]);
  const aviso = filtroTarjeta(m, h);
  assert.match(aviso, /data-aviso=""/);
  assert.match(aviso, /title="No filtra por Closer"/);
  // El período propio de antes (un control fijo desde v5) no se cuenta como filtro, pero sí se informa.
  const propio = g({ id: 'p', fuente: 'meta', tipo: 'serie', dimension: 'semana', periodo: 'ult12m' });
  assert.match(filtroTarjeta(propio, hoja([propio])), /aria-label="Filtro"/, 'el «Período propio» se informa adentro');
});

// ── 6. Los guards por fuente: mirar no guarda ───────────────────────────────────────────────

const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas de comentario PRIMERO y los bloques después (AGENTS.md: un `/*` adentro de un `//`). */
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const FILTRO = sinComentarios(leer('app/dashboard/MenuFiltro.tsx'));
const CONTROLES = sinComentarios(leer('app/dashboard/BarraControles.tsx'));
/** El bloque entre dos anclas reales del archivo (nunca un número de caracteres elegido a ojo). */
function entre(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(i, j);
}

test('el camino de MIRAR llama a onVista y nunca escribe el informe (lo elegido no se guarda)', () => {
  const mirando = entre(FILTRO, 'const elegirMirando =', '\n');
  assert.match(mirando, /onVista\(control\.id, v\)/);
  assert.doesNotMatch(mirando, /cambiar|quitar|agregar|onCambiar|onAgregar|onQuitar/);
  const deEntrada = entre(FILTRO, 'const elegirDeEntrada =', '\n');
  assert.match(deEntrada, /cambiar\(control\.id, parcheDeEntrada\(/, '«Lo que muestra de entrada» sí guarda');
  assert.match(FILTRO, /const onElegir = modo === 'vista' \? elegirMirando : elegirDeEntrada;/);
  // Y el modo de un renglón recién abierto es SIEMPRE el de mirar.
  assert.equal((FILTRO.match(/setPantalla\(\{ tipo: 'control', id: c\.id, modo: 'vista' \}\)/g) ?? []).length, 2, 'abrir un renglón y agregar uno arrancan mirando');
});

test('los paneles sólo ELIGEN: no conocen onCambiar, onQuitar, onAgregar ni onVista', () => {
  const paneles = entre(FILTRO, 'export function PanelPeriodo(', 'export function PanelDe(');
  assert.doesNotMatch(paneles, /onCambiar|onQuitar|onAgregar|onVista|cambiar\(|quitar\(|agregar\(/);
  // Cada panel recibe el `onElegir` de quien lo monta: el desplegable (por modo) y el panel de propiedades (entrada).
  const de = entre(FILTRO, 'export function PanelDe(', 'export type ExtraAgregar');
  assert.equal((de.match(/onElegir=\{onElegir\}/g) ?? []).length, 4, 'los cuatro paneles');
});

test('agregar SUMA a la lista ENTERA (con los fijos), y cambiar o quitar uno no se lleva a los demás', () => {
  const menu = entre(FILTRO, 'export function MenuFiltro(', 'export function EstilosControles(');
  assert.match(menu, /const todos = comp \? comp\.controles : hoja\.controles;/, 'se escribe sobre TODOS, no sobre los que se ven');
  assert.match(menu, /props\.onCambiarComp\(\{ controles: \[\.\.\.todos, c\] \}\)/);
  assert.match(menu, /props\.onCambiarComp\(\{ controles: todos\.map\(/);
  assert.match(menu, /props\.onCambiarComp\(\{ controles: todos\.filter\(/);
  assert.doesNotMatch(menu, /controles: \[c\]|controles: \[nuevo\]|controles: visibles/, 'reemplazar la lista se lleva los fijos');
  // El panel de propiedades igual.
  assert.match(CONTROLES, /onCambiarComp\(\{ controles: \[\.\.\.comp\.controles, c\] \}\)/);
});

test('el desplegable va por portal y su Escape frena a los demás con stopImmediatePropagation', () => {
  const pop = entre(FILTRO, 'export function Popover(', 'export function Chevron(');
  assert.match(pop, /createPortal\(/);
  assert.match(pop, /window\.addEventListener\('keydown', tecla, true\)/);
  assert.match(pop, /e\.stopImmediatePropagation\(\);/);
  assert.match(pop, /useCapaModal\(true, \{ anidada: true \}\)/);
  // Adentro de un renglón, Escape vuelve a la raíz antes de cerrar.
  assert.match(pop, /if \(escape\.current\?\.\(\)\) return;/);
});

// ── 7. El panel de propiedades: los fijos se ven y se editan ahí ─────────────────────────────

test('el panel de propiedades muestra TAMBIÉN los fijos (es el único lugar donde se editan) y escribe la lista entera', () => {
  const m = { ...g({ id: 'm', fuente: 'meta', tipo: 'barras', dimension: 'campana' }), controles: [control({ id: 'f', tipo: 'lista', campo: 'llamadas_venta.reunion', valores: ['R1'], fijo: true }), LISTA] };
  const html = sinEstilos(renderToStaticMarkup(createElement(EditorControlesComp, { comp: m, hoja: hoja([m]), onCambiarComp: nada, hoy: HOY })));
  assert.equal((html.match(/class="bc-editor-fila"/g) ?? []).length, 2, 'un renglón por control, el fijo incluido');
  assert.match(html, /Reunión · Llamadas de venta: R1/, 'el fijo se ve con lo que define');
  // Cambiar y quitar uno mandan la lista ENTERA (un fijo que se pierda cambia el número de la tarjeta).
  assert.match(entre(CONTROLES, 'const cambiar = (id: string, parche: Partial<ControlVista>) =>', '\n'), /onCambiarComp\(\{ controles: comp\.controles\.map\(/);
  assert.match(entre(CONTROLES, 'const quitar = (id: string) =>', '\n'), /onCambiarComp\(\{ controles: comp\.controles\.filter\(/);
  // Cuáles ve quien mira lo decide la sección que lo monta («A la vista»): acá no hay un segundo interruptor.
  assert.doesNotMatch(CONTROLES, /fijo: true|aria-pressed/, 'dos interruptores para la misma marca se contradicen');
});

// ── 8. Sin voseo en lo que se dibuja ────────────────────────────────────────────────────────

/** Las palabras terminadas en á/é/í (o en ás/és/ís) que SÍ son de tú o neutras. Todo lo demás es sospechoso. */
const NEUTRAS = new Set(['más', 'está', 'aquí', 'así', 'ahí', 'allí', 'sí', 'qué', 'días', 'después', 'además', 'través', 'país']);

test('sin voseo en el texto de los controles (el guard del repo no ve un archivo sin git add)', () => {
  for (const ruta of ['app/dashboard/BarraControles.tsx', 'app/dashboard/MenuFiltro.tsx', 'app/dashboard/BuscarEnHoja.tsx', 'app/dashboard/valores.ts', 'lib/graficos-controles-texto.ts', 'lib/graficos-buscar.ts']) {
    const codigo = sinComentarios(leer(ruta));
    assert.deepEqual(marcasDeVoseo(codigo), [], `${ruta}: voseo`);
    const raras = [...new Set((codigo.match(/(?<!\p{L})\p{L}+(?:á|é|í|ás|és|ís)(?!\p{L})/gu) ?? []).map((w) => w.toLowerCase()))].filter((w) => !NEUTRAS.has(w));
    assert.deepEqual(raras, [], `${ruta}: palabras con forma de voseo («buscá», «tenés»…)`);
  }
});
