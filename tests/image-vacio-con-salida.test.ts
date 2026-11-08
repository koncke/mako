// =============================================================================
// Sin carruseles, Image TIENE que seguir teniendo salida al editor (8/11/2026)
// =============================================================================
// Lo encontró la revisión de `punta/carruseles-thumbnails`, que entró a main sin que nadie la
// mirara. Dos hallazgos que eran el MISMO origen, los dos «rompe-cliente» y los dos unánimes
// (0 de 3 refutadores los tumbó):
//   · «En el teléfono, el cliente sin carruseles queda encerrado en Image: no hay Crear desde cero
//      ni sus diseños, sólo un link a Spy»
//   · «Sin carruseles no se dibuja el selector Carruseles · Anuncios · Thumbnails: la tab que pidió
//      Martín depende de un único botón de texto que sólo existe si la biblioteca ya tiene filas»
//
// La causa: `segmento` (el selector) y `botones` (donde vive «Crear desde cero») se dibujaban SÓLO
// en la rama que pide `hayAlgo`. Un negocio nuevo —el que todavía no sigue a nadie en Spy— cae en
// la rama vacía, y ahí no había ninguna de las dos. En el teléfono era peor, porque las pastillas
// tampoco están en la cabecera: `{telefono ? null : botones}`.
//
// Correr: node --import tsx --test tests/image-vacio-con-salida.test.ts
// ROTURAS (8/11/2026, una por vez y restaurada; base 3 / 0): sacar `segmento` del estado vacío
// → 2 / 1; sacar `botones` del estado vacío → 2 / 1; devolver las pastillas a la cabecera del
// teléfono (que es la otra forma de "arreglarlo", y deja el selector afuera igual) → 2 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'app/image-editor/carruseles/ExplorarCarruseles.tsx'), 'utf8');

/** El bloque del estado vacío: desde `!hayAlgo ?` hasta la rama siguiente. */
function estadoVacio(): string {
  const i = src.indexOf('!hayAlgo ? (');
  assert.ok(i > 0, 'no existe la rama del estado vacío');
  const j = src.indexOf('className={s.filtros}', i + 12);
  const k = src.indexOf('\n        ) : (', i);
  assert.ok(k > i, 'no encontré el final de la rama vacía');
  return src.slice(i, k);
}

test('sin carruseles se sigue dibujando el selector de pestañas', () => {
  const v = estadoVacio();
  assert.match(v, /\{segmento\}/,
    'el selector Carruseles · Anuncios · Thumbnails tiene que estar también cuando no hay nada: es la tab que pidió Martín');
});

test('sin carruseles, en el teléfono sigue habiendo «Crear desde cero»', () => {
  const v = estadoVacio();
  assert.match(v, /telefono \? botones : null/,
    'en el teléfono las pastillas no están en la cabecera, así que el estado vacío las tiene que traer o el cliente queda encerrado');
});

test('⚠️ y la cabecera sigue SIN pastillas en el teléfono: ésa es la razón de lo de arriba', () => {
  // Si alguien "arregla" esto devolviendo las pastillas a la cabecera, el selector se queda afuera
  // igual y vuelve la mitad del problema. La decisión de Martín era que en el teléfono las pastillas
  // van en la fila que se desliza, no bajo el título.
  assert.match(src, /\{telefono \? null : botones\}/,
    'la cabecera no dibuja las pastillas en el teléfono, a propósito');
});
