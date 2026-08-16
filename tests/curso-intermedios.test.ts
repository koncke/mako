// =============================================================================
// El filtro de intermedios de yt-dlp no puede comerse una clase real
// =============================================================================
// `esIntermedio` decide qué archivo del disco es un transitorio de yt-dlp y por lo
// tanto NO se sube a Drive ni se transcribe. Existe por una razón buena: la copia
// incremental corre mientras el descargador escribe, así que captura sus archivos a
// medio hacer — y cuando yt-dlp los mergea y los borra en local, las copias del
// destino sobreviven. Así se subieron tres intermedios de 500 MB con la pista de
// video y sin audio.
//
// El problema es el costo del falso positivo, que es MUDO. Un archivo que el filtro
// descarta por error no llega a Drive, no se transcribe, y el único síntoma es la
// línea «no está bajado todavía» sobre un archivo que está en disco con el nombre
// exacto que se esperaba. Nadie lee esa línea entre 77.
//
// La versión original era `/\.f[^.]*\.(mp4|mkv|webm|m4v)$/i` y el bug estaba en la
// bandera `i`: hacía que cualquier título que después de un punto empezara con «F»
// se tomara por intermedio. En «Bigseo Academy» escondió cuatro clases; en «M5 -95»
// habría escondido otras dos, y se salvó solo porque ese curso se procesó antes de
// que el filtro existiera.
//
// Los casos de abajo son NOMBRES REALES de los cursos del portal, no inventados: es
// la regla de AGENTS.md sobre umbrales —correlo contra los datos que ya tenés— y es
// lo único que habría atajado esto antes de que llegara a Drive.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esIntermedio, nDeArchivo } from '../scripts/curso-comun.mjs';

// Títulos reales que empiezan con «F» después de un punto. Los cuatro primeros son
// las clases que efectivamente se perdieron.
const CLASES_REALES = [
  '13 - 09.Funciones del Keyword Planner.mp4',
  '42 - 07.Formatos para Contenidos.mp4',
  '61 - 02.Funciones.mp4',
  '73 - 02.Funcionamiento de los datos estructurados.mp4',
  '068 - 1.Fast M5-95.mp4',
  '113 - 4.Fórmulas personalizadas y secretas.mp4',
  // Y control: títulos con punto que NO empiezan con f.
  '03.Google.mp4',
  '01 - Bienvenida a ICO.mp4',
  '005 - Section 4 Chapter 1 - Story 4.mp4',
];

// Cómo nombra yt-dlp de verdad: `f` minúscula + id de formato (numérico o protocolo).
const INTERMEDIOS_REALES = [
  '129 - Asesora de Imagen 4.fhls-fastly_skyfire-audio-high-Original.mp4',
  '098 - Directo Coach Vocal 8.fhls-fastly_skyfire-audio-high-Original.mp4',
  '007 - Section 6 Chapter 1.f614.mp4',
  'x.fdash-audio_es.mp4',
  'y.fhttp-1080.mp4',
  'z.f299.webm',
];

test('una clase real NUNCA se confunde con un intermedio de yt-dlp', () => {
  for (const f of CLASES_REALES) {
    assert.equal(esIntermedio(f), false, `${f} es una clase real y el filtro la descartaría`);
  }
});

test('los intermedios de yt-dlp SÍ se descartan', () => {
  for (const f of INTERMEDIOS_REALES) {
    assert.equal(esIntermedio(f), true, `${f} es un intermedio y el filtro lo dejaría pasar`);
  }
});

test('la distinción es la MAYÚSCULA: .Funciones no es .f<formato>', () => {
  // El corazón del bug, aislado. Si alguien vuelve a poner la bandera `i`, esto falla.
  assert.equal(esIntermedio('a.Funciones.mp4'), false);
  assert.equal(esIntermedio('a.f614.mp4'), true);
  // Y minúscula tampoco alcanza: hace falta la FORMA del id de formato.
  assert.equal(esIntermedio('a.funciones.mp4'), false);
});

test('un intermedio con extensión en mayúsculas se sigue descartando', () => {
  assert.equal(esIntermedio('a.f614.MP4'), true);
});

test('la ruta completa se juzga por su nombre, no por sus carpetas', () => {
  // El nombre de un módulo puede tener puntos; lo que se mira es el archivo.
  assert.equal(esIntermedio('02 03. CHAPTER 1/007 - Section 6 Chapter 1.mp4'), false);
  assert.equal(esIntermedio('02 03. CHAPTER 1/007 - Section 6.f614.mp4'), true);
});

test('nDeArchivo lee el número de clase que abre el nombre', () => {
  assert.equal(nDeArchivo('068 - 1.Fast M5-95.mp4'), 68);
  assert.equal(nDeArchivo('13 - 09.Funciones del Keyword Planner.mp4'), 13);
  assert.equal(nDeArchivo('sin numero.mp4'), null);
});
