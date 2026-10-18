// =============================================================================
// Offer: se pueden ver las versiones anteriores de una oferta (17/10/2026)
// =============================================================================
// docs/relevo/offer.md: «ver versiones anteriores» (sin hacer). Cada «Pulir la oferta» deja una versión nueva, y la de
// antes sólo se podía bajar armando a mano `?v=` en la ruta del PDF. En la pestaña del PDF ahora se elige cuál ver; la
// ruta ya servía cualquier versión (`conclusionDeVersion`). El diagnóstico y la oferta muestran la última: es la que
// trae la vista.
//
// PROBADO ROMPIÉNDOLO (17/10/2026): el PDF siempre con la última → 1 fallo; sin el selector → 1 fallo. Base: 2 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conclusionDeVersion } from '../lib/offer-reglas';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('la pestaña del PDF elige la versión, arranca en la última y ofrece todas', () => {
  const src = leer('app/offer/Conclusion.tsx');
  assert.match(src, /const \[verVersion, setVerVersion\] = useState<number>\(conclusion\.version\);/);
  assert.match(src, /<VistaPdf sesionId=\{sesion\.id\} version=\{verVersion\} \/>/);
  assert.match(src, /\{ultima > 1 && \(/, 'con una sola versión no hay nada que elegir');
  assert.match(src, /options=\{Array\.from\(\{ length: ultima \}, \(_, i\) => ultima - i\)/, 'de la última a la primera');
});

test('la ruta del PDF sirve la versión pedida (o la última sin `v`)', () => {
  const cs = [{ version: 1, x: 'a' }, { version: 2, x: 'b' }, { version: 3, x: 'c' }];
  assert.equal(conclusionDeVersion(cs, 2)?.x, 'b');
  assert.equal(conclusionDeVersion(cs, null)?.x, 'c');
  assert.equal(conclusionDeVersion(cs, 9), null);
  assert.match(leer('app/api/offer/pdf/route.ts'), /conclusionDeVersion\(fila\.conclusiones, version\)/);
});
