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
import { bloquesDeAdjuntos, placeholderDeAdjunto } from '../lib/mako-adjuntos';
import { clasificarIntencion } from '../lib/mako-intencion';
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
  // Lo leído va a la MEMORIA, no a `texto`: los detectores del pedido leen el placeholder (la revisión de 92d23e11d).
  assert.match(doer, /texto = placeholderDeAdjunto\(adjunto\.tipo, adjunto\.caption, textoDirecto\);\n\s*leidoDelAdjunto = loQueDice \? loQueDice\.slice\(0, 600\) : '';/);
  assert.match(doer, /await guardarTurno\(wsData, jid, 'user', \[texto, leidoDelAdjunto\]\.filter\(Boolean\)\.join\('\\n'\), msgId\);/);
});

test('4. la lista que trae la foto no vuelve el pedido «cargar al plan»: el clasificador lee lo que escribió la persona', () => {
  // El presupuesto de la revisión adversarial: con lo leído adentro de `texto`, «¿qué te parece?» se volvía un volcado al plan.
  const placeholder = placeholderDeAdjunto('image', '', 'mako, ¿qué te parece?');
  const leido = textoDelAdjunto('1. Landing US$ 300\n2. Campaña Meta US$ 500\n3. Mantenimiento US$ 100', 'image');
  assert.equal(clasificarIntencion([placeholder, leido].join('\n'), {}).intencion, 'capturar', 'el caso ya no muestra el peligro: revisar el test');
  assert.notEqual(clasificarIntencion(placeholder, {}).intencion, 'capturar');
});
