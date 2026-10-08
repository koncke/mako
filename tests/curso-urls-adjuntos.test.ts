// =============================================================================
// Las URLs de los adjuntos de la lección: UNA caché, y una función que CAMBIA cuando llegan
// =============================================================================
// Revisión final del audio del 08/10/2026 (docs/feedback-curso-08oct.md), sobre el árbol ya integrado de
// las pistas EDITOR, TAREA y MODELO:
//
//   · La integración dejó `useUrlsDeAdjuntos` de la lección con `useCallback(…, [])`: una función FIJA. El
//     editor rico (app/_ui/EditorRico.tsx) redibuja sus imágenes SÓLO cuando cambia `urlDeAdjunto` (son
//     nodos de ProseMirror, no hijos de React), así que una imagen cuya URL llegaba después de montar el
//     editor —abrir una clase por link, o sin pasar el cursor por su tarjeta— quedaba en blanco.
//   · Había DOS cachés: la de la lección y una copia en ./TareaEditor.tsx. Lo que el cursor adelantaba
//     sobre una tarjeta (`precargarLeccion`) no le servía a la tarea: se volvía a pedir al abrir la clase,
//     en la fila de actions de la apertura (item 18, 10:40: «está tardando mucho en cargar una clase»).
//   · Quien MIRA la tab sin editar veía la tarea sin su consigna con formato ni sus adjuntos: a TareaAlumno
//     no le llegaban `tareaHtml` ni `urlDeAdjunto`.
//
// Lee FUENTE: normaliza CRLF y busca sin comentarios (AGENTS.md).
//
// Probado ROMPIÉNDOLO (08/10/2026), una rotura por vez y restaurada:
//   · `[version]` → `[]` en el useCallback de ./urls-adjuntos.ts                      → 3 / 1
//   · TareaEditor vuelve a tener su `function useUrlsDeAdjuntos` propia               → 3 / 1
//   · sin `tareaHtml={…}` en TareaComoLaVeElAlumno                                    → 3 / 1
//   · `precargarLeccion` sin `htmlsDeTareas(c)`                                        → 3 / 1
//   · EditorRico redibuja con `[]` en vez de `[urlDeAdjunto]` (el porqué deja de ser cierto) → 3 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));

const URLS = leer('app/customer-success/curso/urls-adjuntos.ts');
const LECCION = leer('app/customer-success/curso/LeccionEditable.tsx');
const TAREA = leer('app/customer-success/curso/TareaEditor.tsx');
const RICO = leer('app/_ui/EditorRico.tsx');

test('la función de las URLs cambia de identidad cuando llegan (el editor rico redibuja por eso)', () => {
  const cuerpo = URLS.slice(URLS.indexOf('export function useUrlsDeAdjuntos'));
  assert.ok(cuerpo.length > 50 && cuerpo.length < 1500, `recorte raro (${cuerpo.length})`);
  const callback = /return useCallback\(([\s\S]*?)\);\s*\}/.exec(cuerpo)?.[1] ?? '';
  assert.ok(callback, 'no encontré el useCallback de la función que se devuelve');
  assert.match(callback, /,\s*\[version\]\s*$/, 'las dependencias tienen que ser [version]: con [] la función es fija');
  assert.match(cuerpo, /const \[version, repintar\] = useState\(0\);/);
  // El porqué: el editor rico mira la IDENTIDAD de urlDeAdjunto para redibujar sus imágenes.
  assert.match(RICO, /c\.resolver = urlDeAdjunto;\s*c\.vivas\.forEach\(\(pintar\) => pintar\(\)\);\s*\}, \[urlDeAdjunto\]\);/);
});

test('UNA caché: la lección y la tarea usan ./urls-adjuntos, ninguna tiene la suya', () => {
  for (const [nombre, src] of [['LeccionEditable', LECCION], ['TareaEditor', TAREA]] as const) {
    assert.match(src, /import \{[^}]*\buseUrlsDeAdjuntos\b[^}]*\} from '\.\/urls-adjuntos';/, `${nombre} no usa la caché compartida`);
    assert.doesNotMatch(src, /function useUrlsDeAdjuntos\b|function pedirUrls\b|urlsAdjuntosAction\(/, `${nombre} tiene su propia copia`);
  }
});

test('lo que se adelanta al pasar el cursor incluye las consignas de las tareas', () => {
  const f = LECCION.slice(LECCION.indexOf('export function precargarLeccion'));
  const cuerpo = f.slice(0, f.indexOf('\n}\n'));
  assert.match(cuerpo, /precargarUrlsDeAdjuntos\(\[c\.descripcionHtml \?\? '', \.\.\.htmlsDeTareas\(c\)\]\)/);
});

test('quien mira la tab sin editar ve la tarea con su consigna con formato y sus adjuntos', () => {
  const f = LECCION.slice(LECCION.indexOf('function TareaComoLaVeElAlumno'));
  const cuerpo = f.slice(0, f.indexOf('\n}\n'));
  assert.match(cuerpo, /tareaHtml=\{c\.tareaHtml \?\? null\}/);
  assert.match(cuerpo, /urlDeAdjunto=\{urlDeAdjunto\}/);
  assert.match(cuerpo, /useUrlsDeAdjuntos\(htmlsDeTareas\(c\)\.join\(' '\)\)/);
});
