// =============================================================================
// El Video Editor fluido: lo que lo trababa al entrar y al usarlo (12/11/2026)
// =============================================================================
// Martín, 12/11/2026: «cada vez que ingreso desde la web a utilizar esta pestaña de edición, se me traba exageradamente
// todo... ni siquiera lo puedo utilizar». Medido ese día en producción (docs/hallazgos-video-editor.md):
//   · AL ENTRAR: la página bajaba y compilaba TRES veces el mismo script de 1,1 MB (los mismos 236 módulos del motor),
//     porque la tab pedía el motor por siete `import()` distintos y el empaquetador arma un grupo con su propia copia por
//     cada uno. Ahora todo entra por UNA puerta: app/video-editor/editor-cargado.ts.
//   · AL USARLO: la RAÍZ del editor (editor-page.tsx) leía el tiempo del cabezal con `useEditor`, que escucha a los nueve
//     managers: cada salto del cabezal (cada movimiento del mouse al arrastrarlo) y cada aviso de cualquier manager
//     mientras se reproduce redibujaba el editor ENTERO. Ahora lo lee sólo si se ven las notas de los marcadores y hay
//     alguna, que es lo único que lo usa.
// El empaquetado y el redibujado no corren en node: se fija el fuente.
//
// Correr: node --import tsx --test tests/video-editor-fluidez.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('F1: la tab carga el motor por UNA puerta (un import() propio vuelve a duplicar el núcleo)', () => {
  for (const archivo of ['app/video-editor/VideoEditorCliente.tsx', 'app/video-editor/proyectos.ts']) {
    const src = sinComentarios(leer(archivo));
    const pedidos = [...src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
    assert.ok(pedidos.length > 0, `${archivo} ya no carga nada a pedido: revisar el test`);
    assert.deepEqual([...new Set(pedidos)], ['./editor-cargado'], `${archivo} carga a pedido por fuera de la puerta: ${pedidos.join(', ')}`);
  }
  const puerta = leer('app/video-editor/editor-cargado.ts');
  for (const nombre of ['EditorCore', 'storageService', 'EditorPage', 'PanelChat', 'ImportarDesde', 'ArmarPlantilla', 'nombreLibre', 'nombreProyectoLibre', 'nombreProyectoNuevo']) {
    assert.match(puerta, new RegExp(`export \\{[^}]*\\b${nombre}\\b`), `la puerta no exporta ${nombre}`);
  }
  // Lo que la tab usa de la puerta, la puerta lo tiene.
  const usados = [...sinComentarios(leer('app/video-editor/VideoEditorCliente.tsx')).matchAll(/import\('\.\/editor-cargado'\)\.then\(\(m\) => m\.(\w+)/g)].map((m) => m[1]);
  for (const u of usados) assert.match(puerta, new RegExp(`\\b${u}\\b`), `la tab usa ${u} y la puerta no lo exporta`);
});

test('F2: la raíz del editor no se redibuja con el tiempo del cabezal (sólo con las notas de los marcadores a la vista)', () => {
  const src = sinComentarios(leer('app/video-editor/_opencut/editor-page.tsx'));
  assert.doesNotMatch(src, /useEditor\(\(editor\) => editor\.playback\.getCurrentTime\(\)\)/, 'la raíz lee el cabezal siempre: redibuja el editor entero en cada salto');
  const lectura = /const currentTime = useEditor\(\(editor\) =>\s*([\s\S]*?)\);/.exec(src)?.[1] ?? '';
  assert.match(lectura, /^showBookmarkNotes && hayNotasDeMarcador\(/, 'sólo si se ven las notas y hay alguna');
  assert.match(lectura, /: ZERO_MEDIA_TIME,?\s*$/, 'si no, un valor fijo: no cambia y no redibuja');
  // `showBookmarkNotes` tiene que estar calculado ANTES de leer el cabezal.
  assert.ok(src.indexOf('const showBookmarkNotes') < src.indexOf('const currentTime'), 'showBookmarkNotes se calcula después de usarse');
  assert.match(src, /function hayNotasDeMarcador\([^)]*\): boolean \{\s*return !!bookmarks\?\.some\(\(b\) => b\.note != null && b\.note\.trim\(\) !== ""\);/);
  // Y ningún otro lugar de la raíz lee el cabezal.
  assert.equal((src.match(/getCurrentTime\(\)/g) ?? []).length, 1);
});

test('F3: con un clip elegido, el panel Video › Básico no se redibuja en cada salto del cabezal (sin fotogramas clave)', () => {
  // Medido el 12/11 después del deploy: 167–477 componentes por salto con un clip elegido. Cada grupo del panel (Escala,
  // Posición, Mezcla…) escuchaba el TIEMPO por useElementPlayhead, y «Alineación» lo leía para medir la caja.
  const gancho = sinComentarios(leer('app/video-editor/_opencut/components/editor/panels/properties/hooks/use-element-playhead.ts'));
  assert.match(gancho, /seguirTiempo \? editor\.playback\.getCurrentTime\(\) : null/, 'sin seguir el tiempo, el selector devuelve un valor fijo');
  assert.match(gancho, /seguirTiempo \? null : cabezalDentro\(editor\.playback\.getCurrentTime\(\), startTime, duration\)/, 'y escucha sólo si está sobre el clip (un booleano)');
  const grupo = sinComentarios(leer('app/video-editor/_opencut/components/editor/panels/properties/hooks/use-params-con-fotogramas.ts'));
  assert.match(grupo, /seguirTiempo: conFotogramas/, 'el grupo sigue el tiempo SÓLO con fotogramas clave');
  assert.ok(grupo.indexOf('const conFotogramas') < grupo.indexOf('useElementPlayhead('), 'conFotogramas se calcula antes');
  // El primer fotograma clave se crea en el tiempo de AHORA, no en el del último redibujo.
  assert.match(grupo, /const ahora = leerTiempoLocal\(\);[\s\S]*?time: ahora,/);
  const basico = sinComentarios(leer('app/video-editor/_opencut/components/editor/panels/properties/video/basico.tsx'));
  assert.doesNotMatch(basico, /useEditor\(\(e\) => e\.playback\.getCurrentTime\(\)\)/, 'Alineación vuelve a escuchar el cabezal');
  assert.match(basico, /const caja = medir\(editor\.playback\.getCurrentTime\(\)\);/, 'la caja se mide al tocar');
});
