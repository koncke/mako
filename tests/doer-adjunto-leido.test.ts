// =============================================================================
// MaKo en el grupo ve las fotos y los PDF con cualquier IA del negocio (27/10/2026, P2)
// =============================================================================
// Leila, 26/10: «No puedo ver imágenes directamente». El doer mandaba la imagen como bloque NATIVO, que sólo ve Claude: el
// camino de su GPT o su Gemini (`chatCheapTools`) pasa cada mensaje por `bloqueATexto` (lib/ai-cheap.ts), que se queda con
// el texto. Ahora el código la LEE antes del turno (`archivoATexto`, el lector del chat de la app y del importador) y lo que
// dice viaja como texto, al lado del bloque.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bloquesDeAdjuntos } from '../lib/mako-adjuntos';
import { textoDelAdjunto, TOPE_LECTURA_ADJUNTO } from '../lib/doer-hilo';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
/** Lo que le queda a su GPT o su Gemini de un mensaje: sólo el texto (la misma regla que `bloqueATexto`). */
const loQueVeLaBarata = (bloques: Array<{ type: string } & Record<string, unknown>>) =>
  bloques.filter((b) => b.type === 'text').map((b) => String(b.text ?? '')).join('\n');

test('1. lo leído de la imagen viaja en el TEXTO: lo ve también la IA que no mira imágenes', () => {
  const leido = 'Captura de Fathom: «Esta grabación no se pudo analizar». Fecha 26/10, reunión con Juan.';
  const bloques = bloquesDeAdjuntos([{ tipo: 'image', mime: 'image/jpeg', base64: 'AAAA' }], ['mirá esto', textoDelAdjunto(leido, 'image')].join('\n\n'));
  const visto = loQueVeLaBarata(bloques as never);
  assert.match(visto, /mirá esto/);
  assert.match(visto, /\[Lo que dice la imagen que mandaste\]\nCaptura de Fathom: «Esta grabación no se pudo analizar»/);
  // Y el bloque nativo sigue, para Claude.
  assert.ok((bloques as Array<{ type: string }>).some((b) => b.type !== 'text'), 'se perdió el bloque de la imagen');
});

test('2. sin lectura no se inventa: lo dice; y un PDF largo entra cortado', () => {
  assert.equal(textoDelAdjunto('', 'image'), '(No pude leer la imagen que mandaste: si es importante, escríbeme lo que dice.)');
  assert.match(textoDelAdjunto(null, 'document'), /No pude leer el archivo/);
  const largo = textoDelAdjunto('x'.repeat(TOPE_LECTURA_ADJUNTO + 500), 'document');
  assert.ok(largo.length < TOPE_LECTURA_ADJUNTO + 60 && largo.endsWith('…'));
});

test('3. el doer lee el adjunto ANTES de armar el turno, y lo deja en la memoria', () => {
  const doer = leer('lib/mako-doer-in.ts');
  const i = doer.indexOf('const leida = await archivoATexto(');
  const j = doer.indexOf('mediaBlocks = bloquesDeAdjuntos(');
  assert.ok(i > 0 && j > i, 'el doer arma el turno sin leer la imagen');
  assert.match(doer.slice(j, j + 220), /\[textoDirecto \|\| adjunto\.caption, loQueDice\]\.filter\(Boolean\)/);
  assert.match(doer, /texto = \[placeholderDeAdjunto\(adjunto\.tipo, adjunto\.caption, textoDirecto\), loQueDice \? loQueDice\.slice\(0, 600\) : ''\]/);
});
