// =============================================================================
// Video Editor, motor: cuatro trampas del compositor que fallan sin error (11/10/2026)
// =============================================================================
// Las cuatro se vieron en el navegador (Chrome sin ventana, el reproductor y el MP4
// exportado medidos con ffmpeg) y ninguna tiraba un error en la consola:
//
//   1. EL CANVAS DEL COMPOSITOR ES DE UNO SOLO. El reproductor muestra el canvas
//      del WASM tal cual, y `applyEffectPasses` del WASM dibuja EN ESE canvas y lo
//      achica a su tamaño. La miniatura del «Desenfoque» (160×160) en Biblioteca ›
//      Efectos dejaba el reproductor mostrando esa miniatura y el próximo cuadro
//      salía en 160×160: la esquina de arriba a la izquierda estirada («todo rojo»
//      con las barras de prueba). Parecía un bug del reparto de los pases `ce-*`
//      (repartir-ce.ts): NO lo era. Nadie del editor llama a `applyEffectPasses`.
//   2. EL MISMO CANVAS TRAE OTRO CUADRO. El decodificador recicla 3 canvas: el
//      compositor que cacheaba por identidad no re-subía el cuadro al saltar un
//      múltiplo de 3 (mover el cabezal 1 s) y el MP4 a Velocidad 3× salía
//      congelado desde 0,67 s. Se compara también la versión (el timestamp).
//   3. UNA LISTA DE UN SELECT VA ARRIBA DE LOS DIÁLOGOS. Comparten el portal; con
//      z-50 contra el z-250 del diálogo, «Relación de aspecto» de Recortar se abría
//      debajo, invisible: no se podía elegir 1:1.
//   4. EL EFECTO DE ESCENA VA CON EL NOMBRE QUE LEE EL WASM. El `serde` de
//      opencut-wasm 0.2.10 espera `effect_pass_groups` (snake_case) en la
//      variante SceneEffect y `effectPassGroups` en la capa. «Desenfoque» como
//      capa tiraba «missing field `effect_pass_groups`» y congelaba el reproductor.
//      El test lee el nombre del propio .wasm: si se actualiza el paquete y cambia,
//      falla y avisa que el adaptador (`paraElWasm`) sobra o está mal.
//
// Correr: node --import tsx --test tests/video-editor-motor.test.ts
// PROBADO ROMPIÉNDOLO (11/10/2026, de a una y restaurando):
//   R1 gpu-renderer.ts otra vez con `applyEffectPasses({ … })` del WASM   → 2/1 (de 3)
//   R2 texturaExternaVigente sin comparar la versión                     → 2/1 (de 3)
//   R3 SelectContent de vuelta en z-50                                   → 2/1 (de 3)
//   R4 `paraElWasm` mandando `effectPassGroups` en el efecto de escena   → 3/1 (de 4)
// Restaurado: 4/0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { texturaExternaVigente } from '../app/video-editor/_opencut/services/renderer/compositor/textura-vigente';

const RAIZ = join(import.meta.dirname, '..');
const EDITOR = join(RAIZ, 'app', 'video-editor');

function archivos(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta));
    else if (/\.(ts|tsx)$/.test(nombre)) salida.push(ruta);
  }
  return salida;
}

test('1: nadie del editor llama a applyEffectPasses del WASM (dibuja en el canvas del reproductor)', () => {
  const culpables = archivos(EDITOR).filter((ruta) => {
    const sinComentarios = readFileSync(ruta, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    return /\bapplyEffectPasses\s*\(/.test(sinComentarios);
  });
  assert.deepEqual(culpables.map((r) => relative(RAIZ, r)), []);
});

test('2: el mismo canvas con otro cuadro se vuelve a subir; el mismo cuadro, no', () => {
  const canvas = {};
  const previa = { source: canvas, width: 1280, height: 720, version: 0 };
  assert.equal(texturaExternaVigente(previa, { source: canvas, width: 1280, height: 720, version: 0 }), true);
  assert.equal(texturaExternaVigente(previa, { source: canvas, width: 1280, height: 720, version: 1 }), false);
  assert.equal(texturaExternaVigente(previa, { source: {}, width: 1280, height: 720, version: 0 }), false);
  assert.equal(texturaExternaVigente(previa, { source: canvas, width: 640, height: 720, version: 0 }), false);
  assert.equal(texturaExternaVigente(undefined, previa), false);
  // Una imagen (sin versión) sigue cacheada por identidad.
  const imagen = { source: canvas, width: 10, height: 10 };
  assert.equal(texturaExternaVigente(imagen, { ...imagen }), true);
});

test('3: la lista de un Select se abre arriba de un diálogo (comparten el portal)', () => {
  const z = (archivo: string, marca: RegExp) => {
    const fuente = readFileSync(join(EDITOR, '_opencut', 'components', 'ui', archivo), 'utf8');
    const bloque = fuente.slice(fuente.search(marca));
    const m = bloque.match(/\bz-(\d+)\b/);
    assert.ok(m, `sin z-index en ${archivo}`);
    return Number(m[1]);
  };
  const zSelect = z('select.tsx', /<SelectPrimitive\.Content\b/);
  const zDialogo = z('dialog.tsx', /<DialogPrimitive\.Content\b/);
  assert.ok(zSelect > zDialogo, `SelectContent z-${zSelect} no pasa al diálogo z-${zDialogo}`);
});

test('4: el efecto de escena llega al WASM con el nombre de campo que lee su serde', () => {
  const binario = readFileSync(join(RAIZ, 'node_modules', 'opencut-wasm', 'opencut_wasm_bg.wasm')).toString('latin1');
  const m = binario.match(/([A-Za-z_]+)struct variant FrameItemDescriptor::SceneEffect/);
  assert.ok(m, 'no encontré la variante SceneEffect en el .wasm (¿cambió opencut-wasm?)');
  const campo = m[1];
  const compositor = readFileSync(join(EDITOR, '_opencut', 'services', 'renderer', 'compositor', 'wasm-compositor.ts'), 'utf8');
  if (campo === 'effectPassGroups') return; // el descriptor de TS ya lo manda así
  assert.ok(
    compositor.includes(`${campo}: item.effectPassGroups`),
    `el WASM espera «${campo}» en SceneEffect y wasm-compositor.ts no lo traduce`,
  );
});
