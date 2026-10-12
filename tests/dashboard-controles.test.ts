// =============================================================================
// Los controles de la VISTA del Dashboard (puntos 12, 13 y 14 del feedback de Martín, 11/10/2026)
// =============================================================================
// Qué fija:
//   1. El resumen corto de cada tipo de control, el que va en el botón («Últimos 7 días»,
//      «Campaña · 2», «Busca: promo», «Por semana») y el rango corto de un período.
//   2. El ORDEN de los campos que se ofrecen: primero los que filtran algún gráfico de la página.
//   3. Uno por cosa al agregar, y que agregar un control a un gráfico NO cambia lo que el gráfico
//      muestra (se compara `efectivoDe` antes y después).
//   4. La lista desplegable: lo elegido arriba aunque no tenga filas, el tope, y que tildar desde
//      «todos» deja SÓLO ese valor (no «todos menos ése», que pasaría MAX_VALORES).
//   5. Un guard POR FUENTE de app/dashboard/BarraControles.tsx: elegir un valor mirando llama `onVista`
//      y nunca `onCambiar` (si no, cada casilla se autoguarda y le cambia el informe a todos).
//   6. Sin voseo en el texto de los tres archivos nuevos: el guard del repo (tests/puente-panel-copy)
//      enumera con `git ls-files`, que no ve un archivo sin `git add` (AGENTS.md).
//
// Probado ROMPIÉNDOLO (11/10/2026), una rotura por vez sobre la base en verde (19/19) y restaurando a mano:
//   · `elegirMirando` llamando a `onCambiar` en vez de `onVista` → 1 fallo («el camino de MIRAR…»), 18 pases.
//   · el ternario de `onElegir` dado vuelta (vista → elegirDeEntrada) → 1 fallo («…corresponde al modo…»), 18 pases.
//   · `camposParaHoja` sin el orden por gráficos (todo por nombre) → 1 fallo («primero los que filtran…»), 18 pases.
//   · `alternarValor` desde «todos» devolviendo [] en vez de [valor] → 1 fallo («tildar desde todos…»), 18 pases.
//   · `opcionesDeLista` sin subir lo elegido (todo en el orden de llegada) → 1 fallo («la lista…»), 18 pases.
//   · `nuevoControlPara` sin copiar el período propio del gráfico → 1 fallo («agregar… NO cambia…»), 18 pases.
//   · un «Buscá un campo» en un placeholder de BarraControles.tsx → 1 fallo (el de voseo, nombra «buscá»), 18 pases.
// Re-medidas al retomar la corrida (11/10/2026, de nuevo sobre 19/19 y restaurando a mano):
//   · `elegirMirando` → `onCambiar(c.id, parcheDeEntrada(...))` → 1 fallo («el camino de MIRAR…»), 18 pases.
//   · `camposParaHoja` con un `.sort(porNombre)` al final → 1 fallo («primero los que filtran…»), 18 pases.
//   · el resumen de una lista con UN valor como «Campaña · 1» → 1 fallo («el resumen de cada tipo…»), 18 pases.
//
// Correr: npx tsx --test tests/dashboard-controles.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAMPOS, MAX_CONTROLES, MAX_VALORES, conVista, efectivoDe, hojaVacia, sanearBloque, sanearControles, sanearGrafico,
  type ControlVista, type Grafico, type Hoja,
} from '../lib/graficos-catalogo';
import {
  alternarValor, camposParaComp, camposParaHoja, distintoDeEntrada, fuentesDelCampoEnHoja, hayVistaElegida, nuevoControlPara,
  opcionesAgregar, opcionesDeLista, parcheDeEntrada, periodoDePagina, rangoCorto, resumenControl, yaExiste,
} from '../lib/graficos-controles-texto';
import { marcasDeVoseo } from '../lib/puestas-data';

const RAIZ = join(import.meta.dirname, '..');
const HOY = '2026-10-11';

const g = (r: Record<string, unknown>): Grafico => sanearGrafico({ id: 'g1', ...r })!;
const control = (r: Partial<ControlVista> & { id: string; tipo: ControlVista['tipo'] }): ControlVista =>
  sanearControles([{ campo: null, preset: 'ult30', valores: null, texto: '', agrupar: 'auto', ...r }])[0];
const hoja = (componentes: Grafico[], controles: ControlVista[] = []): Hoja => hojaVacia('H', { componentes, controles });

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

test('en un gráfico se ofrecen sólo los campos que su conjunto puede filtrar; un bloque no tiene', () => {
  const m = g({ id: 'm', fuente: 'meta', tipo: 'barras', dimension: 'campana' });
  assert.deepEqual(camposParaComp(m).map((c) => c.id), ['anuncio', 'campana', 'conjunto']);
  assert.deepEqual(camposParaComp(sanearBloque({ id: 'b', bloque: 'revenue' })!), []);
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

test('en un gráfico se apaga lo que no haría nada, con su motivo; un bloque sólo ofrece período', () => {
  const porCategoria = g({ id: 'm', fuente: 'meta', tipo: 'barras', dimension: 'campana' });
  const hoy = sanearGrafico({ id: 't', fuente: 'tareas', fecha: 'actual', tipo: 'barras', dimension: 'estado' })!;
  const motivos = (comp: Grafico) => Object.fromEntries(opcionesAgregar({ nivel: 'componente', comp, hoja: hoja([comp]) }).map((o) => [o.id, o.motivo]));
  assert.equal(motivos(porCategoria).agrupar, 'No va por fecha');
  assert.equal(motivos(hoy).periodo, 'No usa fechas');
  const todosUsados = { ...porCategoria, controles: sanearControles(['anuncio', 'campana', 'conjunto'].map((campo, i) => ({ id: `l${i}`, tipo: 'lista', campo }))) };
  assert.equal(motivos(todosUsados).lista, 'Ya están todos');
  const b = sanearBloque({ id: 'b', bloque: 'revenue' })!;
  assert.deepEqual(opcionesAgregar({ nivel: 'componente', comp: b, hoja: hoja([]) }).map((o) => o.id), ['periodo']);
});

test('agregar un control a un gráfico NO cambia lo que el gráfico muestra', () => {
  const pagina = [control({ id: 'pp', tipo: 'periodo', preset: 'ult90' }), control({ id: 'pl', tipo: 'lista', campo: 'campana', valores: ['A'] })];
  const conPropio = g({ id: 'x', fuente: 'meta', tipo: 'serie', dimension: 'semana', periodo: 'ult7' });
  const auto = g({ id: 'y', fuente: 'meta', tipo: 'serie', dimension: 'semana' });
  for (const comp of [conPropio, auto]) {
    const h = hoja([comp], pagina);
    const antes = efectivoDe(comp, h, {}, HOY);
    for (const [tipo, campo] of [['periodo', null], ['lista', 'campana'], ['texto', 'anuncio']] as const) {
      const nuevo = nuevoControlPara(tipo, campo, { nivel: 'componente', comp, hoja: h })!;
      const despues = efectivoDe({ ...comp, controles: [nuevo] }, h, {}, HOY);
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

// ── 5. El guard por fuente: mirar no guarda ─────────────────────────────────────────────────

const SRC = readFileSync(join(RAIZ, 'app/dashboard/BarraControles.tsx'), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas de comentario PRIMERO y los bloques después (AGENTS.md: un `/*` adentro de un `//`). */
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const CODIGO = sinComentarios(SRC);
/** El bloque entre dos anclas reales del archivo (nunca un número de caracteres elegido a ojo). */
function entre(desde: string, hasta: string): string {
  const i = CODIGO.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}» en BarraControles.tsx`);
  const j = CODIGO.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}» después de «${desde}»`);
  return CODIGO.slice(i, j);
}

test('el camino de MIRAR llama a onVista y nunca a onCambiar (lo elegido no se guarda)', () => {
  const mirando = entre('const elegirMirando =', '\n');
  assert.match(mirando, /onVista/);
  assert.doesNotMatch(mirando, /onCambiar|onQuitar|onAgregar/);
  const deEntrada = entre('const elegirDeEntrada =', '\n');
  assert.match(deEntrada, /onCambiar\(c\.id, parcheDeEntrada\(/, '«Lo que muestra de entrada» sí guarda');
});

test('lo que se elige en un panel va por el camino que corresponde al modo, y el modo arranca en «vista»', () => {
  const boton = entre('function BotonControl(', 'function MenuAgregar(');
  assert.match(boton, /const onElegir = modo === 'vista' \? elegirMirando : elegirDeEntrada;/);
  assert.match(boton, /useState<Modo>\(soloEntrada \? 'entrada' : 'vista'\)/);
  const paneles = boton.match(/<Panel[A-Z]\w*/g) ?? [];
  assert.equal(paneles.length, 4, 'los cuatro paneles');
  assert.equal((boton.match(/onElegir=\{onElegir\}/g) ?? []).length, paneles.length, 'cada panel recibe el onElegir del modo, ninguno uno propio');
});

test('los paneles sólo ELIGEN: no conocen onCambiar, onQuitar, onAgregar ni onVista', () => {
  const paneles = entre('function PanelPeriodo(', 'type PropsBoton =');
  assert.doesNotMatch(paneles, /onCambiar|onQuitar|onAgregar|onVista/);
});

test('la barra y los chips abren el popover en modo «vista» (soloEntrada es sólo del panel de propiedades)', () => {
  assert.doesNotMatch(entre('export function BarraControles(', 'export function ChipsControles('), /soloEntrada/);
  assert.doesNotMatch(entre('export function ChipsControles(', 'export function EditorControlesComp('), /soloEntrada/);
});

test('el popover va por portal y su Escape frena a los demás con stopImmediatePropagation', () => {
  const pop = entre('function Popover(', 'function Chevron(');
  assert.match(pop, /createPortal\(/);
  assert.match(pop, /window\.addEventListener\('keydown', tecla, true\)/);
  assert.match(pop, /e\.stopImmediatePropagation\(\);/);
  assert.match(pop, /useCapaModal\(true, \{ anidada: true \}\)/);
});

// ── 6. Sin voseo en lo que se dibuja ────────────────────────────────────────────────────────

/** Las palabras terminadas en á/é/í (o en ás/és/ís) que SÍ son de tú o neutras. Todo lo demás es sospechoso. */
const NEUTRAS = new Set(['más', 'está', 'aquí', 'así', 'ahí', 'allí', 'sí', 'qué', 'días', 'después', 'además', 'través', 'país']);

test('sin voseo en el texto de los controles (el guard del repo no ve un archivo sin git add)', () => {
  for (const ruta of ['app/dashboard/BarraControles.tsx', 'app/dashboard/valores.ts', 'lib/graficos-controles-texto.ts']) {
    const codigo = sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8').replace(/\r\n/g, '\n'));
    assert.deepEqual(marcasDeVoseo(codigo), [], `${ruta}: voseo`);
    const raras = [...new Set((codigo.match(/(?<!\p{L})\p{L}+(?:á|é|í|ás|és|ís)(?!\p{L})/gu) ?? []).map((w) => w.toLowerCase()))].filter((w) => !NEUTRAS.has(w));
    assert.deepEqual(raras, [], `${ruta}: palabras con forma de voseo («buscá», «tenés»…)`);
  }
});
