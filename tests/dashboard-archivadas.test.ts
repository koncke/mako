// =============================================================================
// Eliminar una hoja la ARCHIVA, y se pueden eliminar todas (14/10/2026, Dashboard y General)
// =============================================================================
// Martín: «Me debería dejar eliminar todas las hojas, también para dashboard. Y en el desplegable de las hojas, un texto
// que diga "Archivados" y ahí la opción de eliminar permanentemente. El "archivados" como un texto sutil abajo de todas
// las opciones, como lo tenemos en los filtros del CRM con "Eliminar filtros"». Y, en la misma tanda: «Las miniaturas y
// el título de abajo, deberían estar englobadas en un contendor... con una sombra, que se separe del fondo».
//
// Lo que fija:
//   · el informe guarda las archivadas y la marca de «se eliminaron todas» (`enBlanco`), saneadas, con ids únicos entre
//     las dos listas (restaurar una no puede chocar) y con tope;
//   · los que leen el informe por fuera (la API de MaKo, los links) no ven la hoja vacía que viaja por dentro;
//   · la pantalla deja eliminar la última, archiva en vez de borrar, restaura, y borra para siempre con un segundo clic;
//   · la API de MaKo archiva igual que la pantalla;
//   · cada plantilla de «¿Qué vas a crear hoy?» es una tarjeta con borde, fondo y sombra.
// Correr: npx tsx --test tests/dashboard-archivadas.test.ts
//
// PROBADO ROMPIÉNDOLO (14/10/2026; base en verde: 5 pasan, 0 fallan). Una rotura por vez, restaurando de memoria:
//   · `sanearTablero` sin las archivadas (no las devuelve)                                 -> 4 / 1 «el informe guarda…»
//   · `leerTableroVisible` sin normalizar `enBlanco`                                        -> 4 / 1 «los que leen por fuera…»
//   · y al revés, la lectura de la PANTALLA normalizando (`if (t?.enBlanco) t.hojas = []`)  -> 4 / 1 «los que leen por fuera…»
//   · `eliminarHoja` con el `if (tablero.hojas.length <= 1) return;` de vuelta              -> 4 / 1 «la pantalla…»
//   · la API borrando la hoja en vez de archivarla                                          -> 4 / 1 «la API…»
//   · la tarjeta de plantilla sin sombra (`box-shadow` fuera de `.nh-plantilla`)            -> 4 / 1 «cada plantilla…»

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_ARCHIVADAS, hojaVacia, hojasVisibles, sanearTablero } from '../lib/graficos-catalogo';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('el informe guarda las archivadas y la marca de «se eliminaron todas», saneadas y con ids únicos', () => {
  const a = { ...hojaVacia('Ventas'), id: 'h1' };
  const b = { ...hojaVacia('Cobros'), id: 'h1' }; // el mismo id que una visible: al restaurar chocaría
  const t = sanearTablero({ hojas: [a], archivadas: [b, 'basura'], enBlanco: true })!;
  assert.equal(t.hojas.length, 1);
  assert.equal(t.archivadas?.length, 1, 'la archivada no se guardó (o se guardó la basura)');
  assert.notEqual(t.archivadas![0].id, t.hojas[0].id, 'dos hojas con el mismo id entre las dos listas');
  assert.equal(t.enBlanco, true);
  assert.deepEqual(hojasVisibles(t), [], 'con todas eliminadas no se muestra la hoja vacía de adentro');
  // Sin archivadas ni marca, el informe sale como antes (sin campos nuevos).
  const limpio = sanearTablero({ hojas: [a] })!;
  assert.equal('archivadas' in limpio, false);
  assert.equal('enBlanco' in limpio, false);
  assert.equal(hojasVisibles(limpio).length, 1);
  // Con tope.
  const muchas = Array.from({ length: MAX_ARCHIVADAS + 5 }, (_, i) => ({ ...hojaVacia(`H${i}`), id: `x${i}` }));
  assert.equal(sanearTablero({ hojas: [a], archivadas: muchas })!.archivadas?.length, MAX_ARCHIVADAS);
});

test('los que leen el informe por fuera (la API, los links) no ven la hoja vacía de adentro', () => {
  const src = leer('lib/graficos-tablero.ts');
  const visible = src.slice(src.indexOf('export async function leerTableroVisible('), src.indexOf('export type ResultadoGuardar'));
  assert.match(visible, /const visible = t\?\.enBlanco \? \{ v: 3 as const, nombre: t\.nombre, hojas: \[\], \.\.\.\(t\.archivadas \? \{ archivadas: t\.archivadas \} : \{\}\) \} : t;/);
  // ⚠️ La PANTALLA lee crudo: con la lectura normalizada, el Dashboard de quien eliminó todas leía hojas[0] de una lista
  // vacía (c73755ec, lo cazó mirarlo). La normalización vive SÓLO en la lectura de afuera.
  const crudo = src.slice(src.indexOf('export async function leerTableroVersionado('), src.indexOf('export async function leerTableroVisible('));
  assert.doesNotMatch(crudo, /enBlanco/, 'la lectura de la pantalla volvió a esconder las hojas');
  for (const r of ['lib/api-mako/areas/dashboard.run.ts', 'lib/api-mako/areas/general.run.ts', 'app/api/compartir/route.ts', 'app/compartido/[token]/informe-compartido.ts']) {
    assert.doesNotMatch(leer(r), /leerTableroVersionado\(/, `${r} lee crudo: vería la hoja vacía de adentro`);
  }
  assert.match(leer('app/dashboard/page.tsx'), /\} else if \(tablero\.enBlanco && !agregar\) \{\s*sinPaginas = true;/);
  assert.match(leer('app/general/page.tsx'), /\|\| !!lectura\.tablero\.enBlanco;/);
});

test('la pantalla deja eliminar la última, archiva, restaura y borra para siempre con un segundo clic', () => {
  const editor = leer('app/dashboard/EditorInforme.tsx');
  const eliminar = editor.slice(editor.indexOf('const eliminarHoja = (id: string) => {'), editor.indexOf('const restaurarHoja'));
  assert.ok(eliminar.length > 200 && eliminar.length < 1500, `el recorte mide ${eliminar.length}`);
  assert.doesNotMatch(eliminar, /hojas\.length <= 1\) return/, 'volvió el candado de la última hoja');
  assert.match(eliminar, /archivadas: \[h, \.\.\.\(t\.archivadas \?\? \[\]\)\.filter\(\(x\) => x\.id !== id\)\]\.slice\(0, MAX_ARCHIVADAS\)/);
  assert.match(eliminar, /if \(ultima\) \{ setEnBlanco\(true\);/);
  assert.match(editor, /const restaurarHoja = \(id: string\) => \{/);
  assert.match(editor, /const borrarArchivada = \(id: string\) => \{/);
  const menu = leer('app/dashboard/Cabecera.tsx');
  assert.match(menu, /\{op\('Eliminar', 'borrar', \(\) => acciones\.onEliminar\(deOpciones\.id\), false, true\)\}/);
  assert.match(menu, /className="lk-archivados"/);
  assert.match(menu, /Archivados \(\{archivadas\.length\}\)/);
  // El segundo clic sobre el mismo botón, que dice la consecuencia.
  assert.match(menu, /onClick=\{\(\) => \{ if \(aBorrar === h\.id\) \{ setABorrar\(null\); onBorrarArchivada\(h\.id\); \} else setABorrar\(h\.id\); \}\}/);
  assert.match(menu, /\{aBorrar === h\.id \? 'Eliminar para siempre' :/);
});

test('la API de MaKo archiva igual que la pantalla', () => {
  const api = leer('lib/api-mako/areas/dashboard.helpers.ts');
  const borrar = api.slice(api.indexOf("case 'borrar_hoja':"), api.indexOf("case 'agregar_componente':"));
  assert.match(borrar, /archivadas: \[h, \.\.\.\(t\.archivadas \?\? \[\]\)\.filter\(\(x\) => x\.id !== h\.id\)\]\.slice\(0, MAX_ARCHIVADAS\)/);
});

test('cada plantilla de «¿Qué vas a crear hoy?» es una tarjeta: borde, fondo y sombra', () => {
  const nh = readFileSync(join(RAIZ, 'app/dashboard/NuevaHoja.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const regla = nh.match(/\.nh-plantilla\{[^}]*\}/)?.[0] ?? '';
  assert.match(regla, /border:1px solid var\(--border\)/);
  assert.match(regla, /background:var\(--surface\)/);
  assert.match(regla, /box-shadow:/);
});
