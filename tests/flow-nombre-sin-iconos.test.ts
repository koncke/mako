// =============================================================================
// Un ícono de Material mete su nombre adentro del texto, y rompía la subida (8/11/2026)
// =============================================================================
// Síntoma: «Flow no mostró la opción de subir» en `flow_trabajos` (ws 9, tres intentos seguidos), y
// la foto del avatar no se subía nunca — la pantalla de AI Avatar se quedaba en «MaKo está subiendo
// tu foto a Google. En unos segundos vuelve a intentar».
//
// La causa, medida contra el DOM REAL de flow.google.com: los items del menú de medios son
// `<mat-icon class="google-symbols">upload</mat-icon>` + `<span>Upload</span>`, así que
// `textContent` devuelve **«uploadUpload»**. `porRol` compara EXACTO (`n === nombre`), de modo que
// buscar 'Upload' no encontraba nada. Pasaba con los cuatro: «folderNew collection»,
// «account_circleCreate character», «play_moviesNew scene».
//
// ⚠️ Se EXCLUYEN los nodos de ícono en vez de recortar el texto con una regex. Lo tentador era
// sacar «la minúscula inicial pegada a una mayúscula», pero eso se come etiquetas legítimas:
// «iPhone» quedaría en «Phone». Mirar QUIÉN pone el texto es exacto; adivinar su forma, no.
//
// Correr: node --import tsx --test tests/flow-nombre-sin-iconos.test.ts
// ROTURAS (8/11/2026, una por vez y restaurada; base 3 / 0): volver a `textContent` pelado → 2 / 1;
// sacar `mat-icon` del selector de íconos → 2 / 1; sacar la guarda del atajo sin íconos → 2 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'extension/flow-interfaz.js'), 'utf8');

test('el nombre accesible se calcula SIN el texto de los íconos', () => {
  assert.match(src, /return textoSinIconos\(el\);/,
    'nombreDe tiene que delegar: `textContent` pelado trae el nombre del ícono pegado');
  assert.match(src, /function textoSinIconos\(el\) \{/, 'falta la función');
});

test('⚠️ y excluye los NODOS de ícono, no recorta el texto con una regex', () => {
  const i = src.indexOf('function textoSinIconos(el) {');
  const f = src.slice(i, i + 700);
  assert.match(f, /mat-icon/, 'el de Flow es un <mat-icon>');
  assert.match(f, /google-symbols/, 'y lleva esa clase');
  assert.match(f, /material-symbols/, 'se cubren las dos familias de Material');
  assert.match(f, /cloneNode\(true\)/, 'se clona para no tocar la página');
  assert.match(f, /\.remove\(\)/, 'y se sacan los íconos de la copia');
  assert.ok(!/replace\(\/\^\[a-z/.test(f),
    'nada de recortar «minúscula inicial pegada a mayúscula»: eso convierte «iPhone» en «Phone»');
});

test('⚠️ y el camino sin íconos no clona de más', () => {
  // Es el caso común: clonar cada botón de la página en cada búsqueda sería caro y no hace falta.
  const i = src.indexOf('function textoSinIconos(el) {');
  assert.match(src.slice(i, i + 400), /if \(!el\.querySelector \|\| !el\.querySelector\(ICONOS\)\)/,
    'sin íconos, se devuelve el texto directo');
});
