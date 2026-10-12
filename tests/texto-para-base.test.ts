// =============================================================================
// texto-para-base: lo que Postgres no acepta guardar sale del texto antes de la base
// =============================================================================
// El caso real (11/10/2026): un PDF subido a Offer traía un NUL adentro del texto y el
// guardado de la conversación tiró «unsupported Unicode escape sequence».
//
// Probado rompiéndolo (11/10/2026, base 5/5 en verde):
//   · no limpiar los controles (el NUL) ................. 2 fallos, 3 pases
//   · sacar el reemplazo de sustitutos sueltos .......... 1 fallo, 4 pases
//   · que archivoATexto devuelva el texto crudo ......... 1 fallo, 4 pases
//   · que offer-sesiones inserte sin limpiar ............ 1 fallo, 4 pases
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { textoParaBase, limpiarParaBase } from '../lib/texto-para-base';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('saca el NUL y los controles, y deja tabs, saltos y acentos', () => {
  assert.equal(textoParaBase('Oferta\u0000 irresistible\u0007'), 'Oferta irresistible');
  assert.equal(textoParaBase('uno\tdos\nTres\r\ncuatro ñandú'), 'uno\tdos\nTres\r\ncuatro ñandú');
  // Lo que importa de verdad: JSON.stringify ya no produce el escape que la base rechaza.
  assert.ok(!JSON.stringify(textoParaBase('a\u0000b')).includes('\\u0000'));
});

test('saca un sustituto suelto y conserva un emoji entero', () => {
  assert.equal(textoParaBase('mitad \uD83D de emoji'), 'mitad  de emoji');
  assert.equal(textoParaBase('cola \uDE00 suelta'), 'cola  suelta');
  assert.equal(textoParaBase('entero 😀 ✦'), 'entero 😀 ✦');
});

test('limpiarParaBase recorre la fila entera (lo que va a un jsonb)', () => {
  const fila = limpiarParaBase({
    titulo: 'Mi\u0000 oferta', n: 3, ok: true, nada: null,
    documentos: [{ nombre: 'doc.pdf', texto: 'precio\u0000 1.500', chars: 12 }],
  });
  assert.equal(fila.titulo, 'Mi oferta');
  assert.equal(fila.documentos[0].texto, 'precio 1.500');
  assert.equal(fila.n, 3);
  assert.equal(fila.ok, true);
  assert.equal(fila.nada, null);
});

test('el lector de archivos compartido devuelve el texto limpio', () => {
  const src = leer('lib/archivo-a-texto.ts');
  assert.match(src, /export async function archivoATexto[\s\S]{0,200}return \{ \.\.\.lectura, texto: textoParaBase\(lectura\.texto\) \};/);
});

test('Offer limpia lo que inserta y lo que actualiza', () => {
  const src = leer('lib/offer-sesiones.ts');
  assert.match(src, /\.insert\(limpiarParaBase\(\{/);
  assert.match(src, /\.update\(limpiarParaBase\(\{ \.\.\.aColumnas\(c\)/);
});
