// =============================================================================
// Dashboard y General: quien nunca guardó un informe arranca EN BLANCO (12/10/2026 y 14/10/2026)
// =============================================================================
// Martín (12/10): «si es un usuario que nunca creó una página en dashboard, que no le salga ninguna página, que le salga
// todo en blanco abajo con la opción de crear una». El informe inicial viaja por dentro (la pantalla lee `hojas[0]`),
// pero no se muestra, no se guarda, y la primera página que se crea es la ÚNICA.
//
// Y el 14/10, para General y para el Dashboard: «lo mismo que en Dashboard, para un usuario nuevo, deberías proponerle un
// template. Lo único es que en lugar del botón de "nuevo dashboard" te pido que pongas ahí el "¿Qué vas a crear hoy?"...
// y el botón de EDITAR no debería saltarme ningún modal..., debería habilitar el menú de edición de la página». La
// pantalla en blanco monta la MISMA pieza que el modal «Nueva hoja» (`CrearHoja`), y «Editar» arranca una hoja en
// blanco ya editándose.
//
// Verificado volviendo a `[...tt.hojas, nueva]` en crearHoja: 1 falla («la primera página…»). Y el 14/10 (base 5 / 0),
// cada rotura → 4 / 1: el botón «＋ Nuevo Dashboard» de vuelta en lugar de `CrearHoja`; «Editar» en blanco abriendo el
// modal (`() => setNuevaHoja(true)`); el modal con su propia copia en vez de montar `CrearHoja`; General sin `sinPaginas`;
// la barra de filtros de vuelta en General (sin `!esGeneral`); la API de General leyendo el informe crudo.
//
// Correr: npx tsx --test tests/dashboard-en-blanco.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const leer = (f: string) => readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

test('page.tsx: sin informe guardado y sin pedir una hoja, la pantalla va en blanco y no lee datos', () => {
  const src = leer('app/dashboard/page.tsx');
  assert.match(src, /if \(lectura\.estado === 'inicial'\) \{/);
  assert.match(src, /else sinPaginas = true;/);
  assert.match(src, /const graficos = sinPaginas \? \[\] : pedidos0\.graficos;/);
  assert.match(src, /sinPaginas=\{sinPaginas\}/);
});

test('General: quien nunca armó la suya arranca en blanco como el Dashboard, y la API ve lo mismo que la pantalla', () => {
  const src = leer('app/general/page.tsx');
  assert.match(src, /const sinPaginas = lectura\.estado === 'inicial' \|\| !lectura\.tablero\.hojas\.length;/);
  assert.match(src, /const graficos = sinPaginas \? \[\] : pedidos0\.graficos;/);
  assert.match(src, /sinPaginas=\{sinPaginas\}/);
  // La API de MaKo lee el informe de General como lo ve la pantalla: sin hojas para quien nunca armó el suyo (si no,
  // crear la primera hoja guardaría también la General de siempre, que nunca se le mostró).
  const run = leer('lib/api-mako/areas/general.run.ts');
  assert.match(run, /return l\.estado === 'inicial' \? \{ \.\.\.l, tablero: \{ \.\.\.l\.tablero, hojas: \[\] \} \} : l;/);
  assert.doesNotMatch(run.slice(0, run.indexOf('async function informeDe')), /leerTableroVersionado\(/, 'un runner lee el informe crudo');
});

test('EditorInforme: en blanco, la caja «¿Qué vas a crear hoy?» con las plantillas (la pieza del modal), y «Editar» edita', () => {
  const src = leer('app/dashboard/EditorInforme.tsx');
  assert.match(src, /autoabrir: conGuia && !enBlanco && !editando/);
  // Un return aparte se dibujaba SIN los <style> del editor (12/10: el texto chiquito arriba a la izquierda).
  assert.doesNotMatch(src, /if \(enBlanco\) \{\s*return \(/);
  assert.match(src, /\{enBlanco \? \(\s*<div className="lk-en-blanco lk-en-blanco-crear" onClick=\{\(e\) => e\.stopPropagation\(\)\}>\s*\{guardable && <CrearHoja onCrear=\{crearHoja\} enBlanco="Página 1" informe=\{informe\} \/>\}/);
  assert.doesNotMatch(src, /Nuevo Dashboard/, 'volvió el botón en lugar de la caja');
  assert.match(src, /conHojas=\{!enBlanco && /);
  // «Editar» en blanco no abre ningún modal: arranca una hoja en blanco, ya editándose.
  assert.match(src, /onClick=\{enBlanco \? empezarEnBlanco : alternarEdicion\}/);
  assert.match(src, /const empezarEnBlanco = \(\) => \{ crearHoja\(hojaVacia\('Página 1'\)\); setEditando\(true\); \};/);
  // En General, la topbar del Dashboard menos la búsqueda y el filtro.
  assert.match(src, /\{!esGeneral && \(\s*<div className="lk-top-filtros"/);
});

test('NuevaHoja: el modal monta la MISMA pieza que la pantalla en blanco, y las plantillas van como páginas', () => {
  const src = leer('app/dashboard/NuevaHoja.tsx');
  assert.match(src, /export function CrearHoja\(/);
  assert.match(src, /<Modal titulo="Nueva hoja" ancho=\{980\} sinFiletes onCerrar=\{cerrar\}>\s*<CrearHoja onCrear=\{onCrear\} onListo=\{cerrar\} enBlanco=\{enBlanco\} informe=\{informe\} \/>\s*<\/Modal>/);
  assert.equal((src.match(/<CajaPedido /g) ?? []).length, 1, 'una sola caja: la de CrearHoja');
  assert.match(src, /<MiniaturaHoja hoja=\{muestras\.get\(p\.id\) \?\? null\} \/>/);
  assert.match(src, /<span className="nh-usar">Usar plantilla<\/span>/);
});

test('EditorInforme: la primera página que se crea en blanco es la ÚNICA (el inicial no se guarda)', () => {
  const src = leer('app/dashboard/EditorInforme.tsx');
  assert.match(src, /hojas: enBlanco \? \[nueva\] : \[\.\.\.tt\.hojas, nueva\]/);
});
