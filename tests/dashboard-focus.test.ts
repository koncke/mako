// =============================================================================
// El Dashboard unido: abre en «Focus» (lo que era /general), con las hojas en pestañas y «Templates»
// =============================================================================
// Martín (17/10/2026, ~22:40, prototipo docs/prototipos/coherencia-1710.md, pedido 3): «Home» sale de la sidebar y el
// Dashboard abre en la hoja fija Focus; las otras pestañas son las hojas de siempre; las plantillas, en «Templates»;
// /general redirige. Lo que se puede romper sin que se vea: que /dashboard sin hoja vuelva a abrir el Dashboard (y Focus
// quede escondida), que una plantilla como `foco` caiga en Focus, que el closer vea Focus, que /general pierda el
// `?ws=` del cliente que se mira, y que un editor reuse el estado del otro al pasar de Focus a una hoja.
//
// Correr: node --import tsx --test tests/dashboard-focus.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026, base 7/0): sin hoja → «dashboard» en `informeDePedida` → 6 / 1; el closer con
// Focus (`conFocus` sin mirar el rol) → 6 / 1; /general sin la query (`redirect('/dashboard?hoja=focus')`) → 6 / 1; el
// editor de Focus sin `key` → 6 / 1; «Templates» en el Dashboard como link (sin abrir la galería en el lugar) → 6 / 1;
// el teléfono sin la ruta de Focus → 6 / 1; el segmentado del teléfono sin las hojas del Dashboard → 6 / 1; las
// pestañas de General después de las del Dashboard → 6 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOJA_FOCUS, NOMBRE_FOCUS, chipsQueEntran, hojaDesdeGeneral, hojaGeneralPedida, informeDePedida, pestanasDelDashboard } from '../lib/dashboard-focus';
import { conLaQuery } from '../lib/ajustes-secciones';
import { rutaMovil } from '../lib/movil-rutas';
import { opcionesDeHojas } from '../app/m/hoy/modelo';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));

const GENERAL = ['g-foco', 'g-cobros'];
const DASH = ['d-ventas', 'd-ads'];

test('qué editor abre /dashboard: sin hoja y con `focus`, Focus; una hoja de General, Focus; lo demás, el Dashboard', () => {
  assert.equal(informeDePedida(undefined, GENERAL, DASH, true), 'general');
  assert.equal(informeDePedida('', GENERAL, DASH, true), 'general');
  assert.equal(informeDePedida(HOJA_FOCUS, GENERAL, DASH, true), 'general');
  assert.equal(informeDePedida('g-cobros', GENERAL, DASH, true), 'general', 'la hoja de General que el editor escribe en la URL');
  assert.equal(informeDePedida('d-ads', GENERAL, DASH, true), 'dashboard');
  // Las plantillas del Dashboard que se piden por URL (las rutas viejas de los Analysts, `foco`) siguen siendo suyas.
  for (const p of ['foco', 'comercial', 'closing']) assert.equal(informeDePedida(p, GENERAL, DASH, true), 'dashboard', p);
  // Sin Focus (el closer, el setter), siempre el Dashboard.
  assert.equal(informeDePedida(undefined, GENERAL, DASH, false), 'dashboard');
  assert.equal(informeDePedida('g-cobros', GENERAL, DASH, false), 'dashboard');
  assert.equal(hojaGeneralPedida(undefined, GENERAL), 'g-foco');
  assert.equal(hojaGeneralPedida(HOJA_FOCUS, GENERAL), 'g-foco');
  assert.equal(hojaGeneralPedida('g-cobros', GENERAL), 'g-cobros');
});

test('la tira: Focus primero (fija, con su nombre), las otras hojas de General, y las del Dashboard', () => {
  const p = pestanasDelDashboard(
    [{ id: 'g-foco', nombre: 'Foco de la semana' }, { id: 'g-cobros', nombre: 'Cobros', emoji: '💰' }],
    [{ id: 'd-ventas', nombre: 'Ventas', emoji: '📈' }],
  );
  assert.deepEqual(p.map((x) => [x.nombre, x.informe, x.href]), [
    [NOMBRE_FOCUS, 'general', '/dashboard'],
    ['Cobros', 'general', '/dashboard?hoja=g-cobros'],
    ['Ventas', 'dashboard', '/dashboard?hoja=d-ventas'],
  ]);
  assert.equal(p[0].fija, true);
  assert.equal(p[0].id, 'g-foco', 'Focus se marca elegida con el id de la hoja de General');
  // Sin hojas propias en ninguno, igual está Focus.
  assert.deepEqual(pestanasDelDashboard([], []).map((x) => x.nombre), [NOMBRE_FOCUS]);
});

test('/general lleva a /dashboard con la query entera: el ?ws= del cliente y la hoja de General; sin hoja, Focus', () => {
  const src = leer('app/general/page.tsx');
  assert.match(src, /redirect\(conLaQuery\('\/dashboard', \{ \.\.\.sp, hoja: hojaDesdeGeneral\(hoja\) \}\)\)/);
  assert.doesNotMatch(src, /EditorInforme|leerInformeGeneral/, 'la página vieja volvió a dibujar');
  assert.equal(conLaQuery('/dashboard', { ws: '3', hoja: hojaDesdeGeneral(undefined) }), '/dashboard?ws=3&hoja=focus');
  assert.equal(conLaQuery('/dashboard', { hoja: hojaDesdeGeneral('g-cobros'), ws: '3' }), '/dashboard?hoja=g-cobros&ws=3');

});

test('la página del Dashboard: Focus sólo para quien veía /general, y cada editor con su `key`', () => {
  const src = leer('app/dashboard/page.tsx');
  assert.match(src, /const conFocus = rol === 'admin' && tabEnCapa\('general', capa\);/);
  assert.match(src, /conFocus \? await Promise\.all\(\[leerTablero\(\), leerInformeGeneral\(\)\]\) : \[null, null\]/);
  assert.match(src, /if \(lecturaDash && lecturaGeneral && !plantillas\) \{/);
  assert.match(src, /informeDePedida\(pedida, idsGeneral, lecturaDash\.tablero\.hojas\.map\(\(h\) => h\.id\), true, PLANTILLAS_GENERAL\.map\(\(x\) => x\.id\)\) === 'general'/);
  assert.match(src, /<EditorInforme\s+key="dashboard"/);
  assert.match(src, /unido=\{otrasDeGeneral \? \{ otras: otrasDeGeneral \} : null\}/);
  // El closer y el setter no leen General ni ven la tira (`otrasDeGeneral` es null sin Focus).
  assert.match(src, /const otrasDeGeneral: HojaCorta\[\] \| null = lecturaGeneral\s*\?/);
  assert.match(leer('app/dashboard/FocusDeGeneral.tsx'), /<EditorInforme\s+key="general"[\s\S]*?informe="general"[\s\S]*?unido=\{\{ otras: hojasDashboard \}\}/);
});

test('el editor dibuja la tira con las hojas que hay en pantalla, y el último chip abre el desplegable', () => {
  const src = leer('app/dashboard/EditorInforme.tsx');
  assert.match(src, /const pestanas = unido \? \(esGeneral \? pestanasDelDashboard\(propias, unido\.otras\) : pestanasDelDashboard\(unido\.otras, propias\)\) : null;/);
  // 32f430356 (tipos, 24/10) le pasa a la tira `informeGeneralODashboard` (el mismo informe, con el tipo de los dos del Dashboard).
  assert.match(src, /<PestanasDashboard pestanas=\{pestanas\} actual=\{hoja\.id\} informe=\{informeGeneralODashboard\} onIr=\{irAHoja\}/);
  assert.match(src, /onMenu=\{\(ancla\) => alternarMenu\('hojas', ancla\)\}/);
  assert.doesNotMatch(src, /onTemplates/, 'volvió el botón «Templates»: todas las plantillas van en «Nueva hoja»');
  assert.match(src, /const \[nuevaHoja, setNuevaHoja\] = useState\(\(\) => plantillasInicial && /);
});

test('en el teléfono: Focus es la portada, y su segmentado suma las hojas del Dashboard que entran', () => {
  assert.equal(rutaMovil('/dashboard?hoja=focus&ws=3'), '/m/hoy');
  assert.equal(rutaMovil('/general'), '/m/hoy');
  // Las demás hojas del Dashboard, en su pantalla de siempre.
  assert.equal(rutaMovil('/dashboard?hoja=d-ventas'), '/m/dashboard/d-ventas');
  const ops = opcionesDeHojas([{ id: 'g-foco', nombre: 'Foco de la semana' }, { id: 'g-cobros', nombre: 'Cobros' }], [{ id: 'd-ventas', nombre: 'Ventas' }]);
  assert.deepEqual(ops.map((o) => [o.id, o.label, o.href]), [
    ['g-foco', NOMBRE_FOCUS, '/general?hoja=g-foco'],
    ['g-cobros', 'Cobros', '/general?hoja=g-cobros'],
    ['dashboard:d-ventas', 'Ventas', '/dashboard?hoja=d-ventas'],
  ]);
  const src = leer('app/m/hoy/page.tsx');
  assert.match(src, /puedeVerKey\('graphics', ctx\.rol, ctx\.capa\) \? leerTablero\(\)\.catch\(\(\) => null\) : Promise\.resolve\(null\)/);
  assert.match(src, /const opcionesHoja = opcionesDeHojas\(tablero\.hojas, delDashboard\);/);
});

test('en la tira, una pestaña del editor montado cambia en el lugar; una del otro informe es un link', () => {
  const src = leer('app/dashboard/PestanasDashboard.tsx');
  assert.match(src, /return p\.informe === informe\s*\? <button [^>]*onClick=\{\(\) => \{ if \(!elegida\) onIr\(p\.id\); \}\}/);
  assert.match(src, /: <Link key=\{`\$\{p\.informe\}:\$\{p\.id\}`\} href=\{p\.href\}/);
  assert.doesNotMatch(src, /Templates<\//, 'volvió el botón «Templates»');
});

// ── El último chip (1/11/2026) ─────────────────────────────────────────────────────────────

test('los chips: si entran todos, ninguno adentro del último', () => {
  assert.deepEqual(chipsQueEntran([80, 80, 80], 500, 100, 8, 0), { visibles: [0, 1, 2], fuera: [] });
  // Justo: 3 × (80 + 8) + 100 = 364.
  assert.deepEqual(chipsQueEntran([80, 80, 80], 364, 100, 8, 0).fuera, []);
  assert.deepEqual(chipsQueEntran([80, 80, 80], 363, 100, 8, 0).fuera, [2]);
});

test('los chips: los que no entran se juntan en el último, en orden', () => {
  assert.deepEqual(chipsQueEntran([80, 80, 80, 80, 80], 300, 100, 8, 0), { visibles: [0, 1], fuera: [2, 3, 4] });
});

test('los chips: la hoja abierta entra siempre: es lo que dice dónde estás', () => {
  const r = chipsQueEntran([80, 80, 80, 80, 80], 300, 100, 8, 4);
  assert.ok(r.visibles.includes(4), 'la abierta quedó adentro del desplegable');
  assert.deepEqual(r, { visibles: [0, 4], fuera: [1, 2, 3] });
  // Una abierta más ancha desplaza a las que hagan falta.
  assert.deepEqual(chipsQueEntran([80, 80, 80, 170], 300, 100, 8, 3), { visibles: [3], fuera: [0, 1, 2] });
});

test('los chips: sin lugar para ninguno, igual se ve la abierta', () => {
  assert.deepEqual(chipsQueEntran([80, 80], 50, 100, 8, 1), { visibles: [1], fuera: [0] });
});

test('la barra con chips no dibuja el título de la hoja; editando vuelve, que es donde se cambia', () => {
  const src = leer('app/dashboard/EditorInforme.tsx');
  assert.match(src, /\{pestanas && !cabeceraPropia \? \(/);
  assert.match(src, /izquierda: <PestanasDashboard /);
  assert.match(src, /\{editando && !enBlanco && \(\s*<BarraSuperior hoja=\{hojaTop\} editable=\{guardable\}/);
});

test('el desplegable trae también las hojas del otro informe', () => {
  assert.match(leer('app/dashboard/EditorInforme.tsx'), /otras=\{pestanas\?\.filter\(\(p\) => p\.informe !== informeGeneralODashboard\) \?\? \[\]\}/);
});

test('una sola galería: quien tiene los dos informes ve las plantillas de los dos', () => {
  const g = leer('app/dashboard/NuevaHoja.tsx');
  // 4/11/2026: la galería de los dos informes, con SÓLO las que se ofrecen (las que traen su diseño copiado: lib/graficos-plantillas.ts).
  assert.match(g, /const CATALOGO_UNICO = \[\.\.\.PLANTILLAS_GENERAL_OFRECIDAS, \.\.\.PLANTILLAS_OFRECIDAS\];/);
  assert.match(g, /const catalogo = conTodas \? CATALOGO_UNICO : informe === 'general' \? PLANTILLAS_GENERAL_OFRECIDAS : PLANTILLAS_OFRECIDAS;/);
  // Una del otro informe la suma su editor al abrir.
  assert.match(g, /if \(conTodas && IDS_GENERAL\.has\(p\.id\) !== \(informe === 'general'\)\) \{ window\.location\.assign/);
  assert.equal(informeDePedida('foco', ['g1'], ['d1'], true, ['foco']), 'general');
  assert.equal(informeDePedida('marketing', ['g1'], ['d1'], true, ['foco']), 'dashboard');
  // Sin Focus (el closer, el setter), nunca General.
  assert.equal(informeDePedida('foco', ['g1'], ['d1'], false, ['foco']), 'dashboard');
  const f = leer('app/dashboard/FocusDeGeneral.tsx');
  assert.match(f, /hojaAgregada=\{agregar\}/);
  assert.match(f, /const nacida = plantilla && !enBlanco \? base\.hojas\.find\(\(h\) => h\.plantilla === plantilla\.id\) : undefined;/);
});
