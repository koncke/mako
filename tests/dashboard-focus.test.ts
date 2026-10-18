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
import { HOJA_FOCUS, HREF_TEMPLATES, NOMBRE_FOCUS, hojaDesdeGeneral, hojaGeneralPedida, informeDePedida, pestanasDelDashboard } from '../lib/dashboard-focus';
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
  assert.equal(HREF_TEMPLATES, '/dashboard?plantillas=1');
});

test('la página del Dashboard: Focus sólo para quien veía /general, y cada editor con su `key`', () => {
  const src = leer('app/dashboard/page.tsx');
  assert.match(src, /const conFocus = rol === 'admin' && tabEnCapa\('general', capa\);/);
  assert.match(src, /conFocus \? await Promise\.all\(\[leerTablero\(\), leerInformeGeneral\(\)\]\) : \[null, null\]/);
  assert.match(src, /if \(lecturaDash && lecturaGeneral && !plantillas\) \{/);
  assert.match(src, /informeDePedida\(pedida, idsGeneral, lecturaDash\.tablero\.hojas\.map\(\(h\) => h\.id\), true\) === 'general'/);
  assert.match(src, /<EditorInforme\s+key="dashboard"/);
  assert.match(src, /unido=\{otrasDeGeneral \? \{ otras: otrasDeGeneral \} : null\}/);
  // El closer y el setter no leen General ni ven la tira (`otrasDeGeneral` es null sin Focus).
  assert.match(src, /const otrasDeGeneral: HojaCorta\[\] \| null = lecturaGeneral\s*\?/);
  assert.match(leer('app/dashboard/FocusDeGeneral.tsx'), /<EditorInforme\s+key="general"[\s\S]*?informe="general"[\s\S]*?unido=\{\{ otras: hojasDashboard \}\}/);
});

test('el editor dibuja la tira con las hojas que hay en pantalla, y «Templates» abre la galería en el lugar', () => {
  const src = leer('app/dashboard/EditorInforme.tsx');
  assert.match(src, /const pestanas = unido \? \(esGeneral \? pestanasDelDashboard\(propias, unido\.otras\) : pestanasDelDashboard\(unido\.otras, propias\)\) : null;/);
  assert.match(src, /<PestanasDashboard pestanas=\{pestanas\} actual=\{hoja\.id\} informe=\{informe\} onIr=\{irAHoja\}/);
  assert.match(src, /onTemplates=\{esGeneral \|\| !guardable \? null : \(\) => \{ setMenu\(null\); setNuevaHoja\(true\); \}\}/);
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
  assert.match(src, /: <Link href=\{HREF_TEMPLATES\}/);
});
