// =============================================================================
// Sin GPU, el Video Editor no se cae: muestra el editor sin vista previa
// =============================================================================
// Tarjeta #853 (llamadas del 16/10/2026): «al entrar al editor dice Esta pantalla
// se rompió al dibujarse y no deja entrar», y a Joan le pasó después de arrastrar
// un video: la vista previa quedó en blanco con el audio sonando, y al recargar ya
// no pudo volver a entrar.
//
// La causa, medida el 17/10/2026 con un Chrome sin ventana y con el WASM del
// editor: sin WebGPU NI WebGL2, `initializeGpu()` falla («Failed to create a WebGPU
// surface… webgl2 not available»), el EditorProvider lo atrapa y marca el modo
// degradado… y el reproductor llamaba igual a `renderer.getOutputCanvas()` →
// `initCompositor()` dentro de un efecto, que tira «GPU context not initialized.
// Call initializeGpu() first.». Un error en un efecto cae en app/error.tsx. A
// Chrome le pasa cuando su proceso de GPU se cae varias veces (un video pesado
// alcanza) y queda así hasta reiniciarlo: de ahí el «irrecuperable».
//
// Probado rompiéndolo (17/10/2026), con el resultado de cada rotura:
//   · sacar `|| sinGpu` del efecto que monta el lienzo → falla «el lienzo no se
//     monta sin GPU».
//   · sacar `sinGpu ||` del bucle de dibujo → falla «el bucle no dibuja sin GPU».
//   · volver al aviso «abre el editor en Chrome» → falla «el aviso dice qué hacer».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const raiz = process.cwd();
const PREVIEW = readFileSync(join(raiz, 'app/video-editor/_opencut/preview/components/index.tsx'), 'utf8');
const PAGINA = readFileSync(join(raiz, 'app/video-editor/_opencut/editor-page.tsx'), 'utf8');
const PROVIDER = readFileSync(join(raiz, 'app/video-editor/_opencut/components/providers/editor-provider.tsx'), 'utf8');

test('la premisa: sin el contexto de GPU, el compositor del WASM TIRA', async () => {
  // Si una versión nueva del WASM deja de tirar acá, la guarda sigue sirviendo,
  // pero este test avisa que el motivo cambió.
  const glue = await import(pathToFileURL(join(raiz, 'node_modules/opencut-wasm/opencut_wasm_bg.js')).href);
  const wasm = readFileSync(join(raiz, 'public/ve/wasm/opencut-wasm-0.2.10.wasm'));
  const { instance } = await WebAssembly.instantiate(wasm, { './opencut_wasm_bg.js': glue });
  glue.__wbg_set_wasm(instance.exports);
  (instance.exports as { __wbindgen_start?: () => void }).__wbindgen_start?.();
  assert.throws(() => glue.initCompositor(1280, 720), /GPU context not initialized/);
});

test('el modo degradado sale de que la GPU no arrancó, antes de abrir el proyecto', () => {
  const i = PROVIDER.indexOf('setDegraded(!isGpuAvailable())');
  const j = PROVIDER.indexOf('await editor.project.loadProject(');
  assert.ok(i > 0 && j > i, 'el EditorProvider ya no marca el modo degradado antes de cargar el proyecto');
});

/** El cuerpo del bloque que abre en `desde` (contando llaves). */
function bloque(src: string, desde: number): string {
  const i = src.indexOf('{', desde);
  let d = 0;
  for (let k = i; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1);
  }
  return '';
}

test('el lienzo no se monta sin GPU', () => {
  assert.match(PREVIEW, /const sinGpu = useEditor\(\(e\) => e\.renderer\.isDegraded\);/);
  const llamada = PREVIEW.indexOf('renderer.getOutputCanvas()');
  assert.ok(llamada > 0, 'no encontré el montaje del lienzo');
  const efecto = PREVIEW.lastIndexOf('useEffect(', llamada);
  const cuerpo = bloque(PREVIEW, efecto);
  const guarda = /if \([^)]*\bsinGpu\b[^)]*\) return;/.exec(cuerpo);
  assert.ok(guarda, 'el efecto que monta el lienzo no corta sin GPU: getOutputCanvas() tira y tumba la pantalla');
  assert.ok(cuerpo.indexOf(guarda[0]) < cuerpo.indexOf('renderer.getOutputCanvas()'), 'la guarda va ANTES de getOutputCanvas()');
});

test('el bucle de dibujo no dibuja sin GPU', () => {
  const i = PREVIEW.indexOf('const render = useCallback(');
  const cuerpo = bloque(PREVIEW, i);
  assert.match(cuerpo, /^\{\s*if \(sinGpu \|\|/, 'el bucle de dibujo no corta sin GPU');
});

test('el aviso dice qué hacer, no «abre el editor en Chrome»', () => {
  // Lo que se DIBUJA (el <span>), no el comentario que cuenta lo que decía antes.
  assert.doesNotMatch(PAGINA, /<span>[^<]*abre el editor en Chrome/, 'se le mostraba a gente que ya estaba en Chrome con la GPU caída');
  assert.match(PAGINA, /<span>[^<]*reinicia el navegador/);
});
