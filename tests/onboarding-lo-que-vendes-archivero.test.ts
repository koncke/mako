// =============================================================================
// «Lo que vendes» queda como documento en El Archivero al cerrar el onboarding (17/10/2026)
// =============================================================================
// docs/relevo/onboarding.md, «lo que sigue»: «el PDF que no queda en El Archivero» — el PDF se armaba cada vez que se
// pedía y no quedaba en ningún lado: ni en El Archivero ni en Second Brain → Documentos. Decisión con criterio: queda,
// pero SIN EXTRACCIÓN (sus datos ya están en el perfil, escritos de las mismas piezas: leerlo con la IA sería pagar por
// lo que ya se sabe). El código es server-only: se lee el fuente.
//
// PROBADO ROMPIÉNDOLO (17/10/2026): el cierre sin archivarlo → 1 fallo; archivarlo con la extracción paga → 1 fallo;
// sin mirar si ya estaba → 1 fallo. Base: 2 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('el cierre del arranque deja «Lo que vendes» en El Archivero, sin trabarse si falla', () => {
  const src = sinComentarios(leer('lib/onboarding-arranque-server.ts'));
  const cierre = src.slice(src.indexOf('export async function cerrarArranque('));
  assert.match(cierre, /if \(h\.modo === 'oferta' && piezas\) \{[\s\S]{0,300}?archivarLoQueVendes\(ws, piezas, e\.negocio \?\? ''\)\.catch\(/);
});

test('se archiva sin pagar IA, una vez por negocio, y sin dejar el binario suelto', () => {
  const src = sinComentarios(leer('lib/onboarding-arranque-server.ts'));
  const f = src.slice(src.indexOf('export async function archivarLoQueVendes('), src.indexOf('export class FaltaParaCerrar'));
  assert.ok(f.length > 300);
  assert.doesNotMatch(f, /extraerDeArchivo|registrarDocumentoSinPisar|leerDocumentoIA/, 'sin extracción: sus datos ya están en el perfil');
  assert.match(f, /\(await listFiles\(\)\)\.some\(\(f\) => f\.nombre === nombre\)/, 'una vez por negocio');
  assert.match(f, /campos: \{\}/);
  assert.match(f, /catch \(e\) \{\s*await borrarBinario\(path\);/, 'si la fila no entra, el binario no queda suelto');
});
